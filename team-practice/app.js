'use strict';
(() => {
  const M = window.PracticeModel, s = M.create(), $ = id => document.getElementById(id);
  const now = () => new Date().toISOString();
  const make = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  let busy = false, messageTimer = null, messageVersion = 0, pendingReset = null;
  const id = prefix => prefix + '-' + (window.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2));
  function announce(text, error = false) {
    clearTimeout(messageTimer); const token = ++messageVersion;
    $('message').textContent = text; $('message').className = 'message' + (error ? ' error' : ''); $('message').hidden = false;
    messageTimer = setTimeout(() => { if (messageVersion === token) $('message').hidden = true; }, 6500);
  }
  function revokeReset() { pendingReset = null; if ($('reset-dialog').open) $('reset-dialog').close(); }
  function protect(fn) { try { fn(); } catch (e) { announce(e.message || '操作没有完成，请检查。', true); } }
  function download(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json;charset=utf-8'}));
    const a = make('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveLabels() {
    const valid = M.active(s), note = s.fields.note, draft = s.fields.draft;
    $('note-risk').hidden = !valid || !note.dirty; $('draft-risk').hidden = !valid || !draft.dirty;
    $('note-state').textContent = !valid ? '暂无有效结果；旧授权不能继续使用。' : note.dirty
      ? '当前备注或审核状态未保存；已保存的旧版本未被改写。'
      : s.saved.noteAt ? '已保存到本页演练记录 · ' + new Date(s.saved.noteAt).toLocaleTimeString() : '尚未保存人工记录。';
    $('draft-state').textContent = !valid ? '暂无有效结果。' : draft.dirty ? '当前草稿尚未保存；请明确保存后再导出。'
      : s.saved.draftAt ? '当前草稿已保存到本页内存，刷新仍会丢失。' : '尚未保存草稿。';
  }
  function renderResult() {
    const area = $('result-content'); area.replaceChildren();
    if (!s.run) {
      const empty = make('div', undefined, 'empty'); empty.append(make('span', '85 / 58'), make('h3', '先建立一次模拟结果'), make('p', '冲突需要原文、对象和版本依据，也需要知道什么时候停止判断。')); area.append(empty);
      $('outcome').textContent = '尚未运行'; $('outcome').className = 'badge neutral'; $('result-id').textContent = '暂无结果身份';
    } else {
      const invalid = s.run.invalidated, banner = make('div', undefined, 'result-banner');
      banner.append(make('h3', invalid ? '来源已失效 · 模拟结论撤销' : '发现阻断冲突，等待人工澄清'),
        make('p', invalid ? '可用候选、观察结果、发现项和草稿均已清空。旧结果不能继续授权操作；需要重新运行模拟核验。' : '同一设备 P-103 / Rev A、扬程38 m，单泵流量在两份合成资料中不一致。'));
      area.append(banner);
      if (!invalid) {
        const pair = make('div', undefined, 'candidate-pair');
        for (const c of s.run.candidates) {
          const card = make('div', undefined, 'candidate');
          card.append(make('small', c.source), make('strong', c.value + ' m³/h'), make('blockquote', c.quote), make('span', '模拟引用匹配 · 非可信来源认证', 'quote-state')); pair.append(card);
        }
        area.append(pair);
      } else area.append(make('p', '可用候选 0 · observations 0 · findings 0', 'micro'));
      $('outcome').textContent = s.run.outcome; $('outcome').className = 'badge ' + (invalid ? 'invalid' : 'conflict');
      $('result-id').textContent = '本页模拟结果ID：' + s.run.id;
    }
    $('retained').hidden = !s.retained.length; $('retained-content').replaceChildren();
    for (const r of s.retained) {
      const item = make('div'); item.append(make('p', '旧结果 ' + r.resultId, 'micro'));
      for (const [key, title] of [['note', '未保存备注'], ['draft', '未保存草稿']]) if (r[key] !== null) {
        const label = make('label', title), text = make('textarea'); text.readOnly = true; text.value = r[key]; label.append(text); item.append(label);
      }
      $('retained-content').append(item);
    }
  }
  function refresh() {
    const valid = M.active(s), started = Boolean(s.startedAt);
    for (const name of ['review-status', 'note', 'draft', 'save-note', 'save-draft', 'copy-draft', 'generate', 'export-saved', 'invalidate']) $(name).disabled = !valid || busy;
    $('copy-draft').disabled = !valid || busy || !s.fields.draft.text;
    $('run').disabled = !started || busy; $('start').disabled = started; $('role').disabled = started; $('alias').disabled = started;
    $('activity').hidden = !busy;
    $('session-status').textContent = started ? s.alias + ' · ' + M.roles[s.role].name + ' · 开始于 ' + new Date(s.startedAt).toLocaleString() + ' · 记录仅在当前页面' : '尚未开始。不同成员各用自己的页面，记录不会自动汇总或同步。';
    for (const name of ['summary', 'suggestion', 'declaration']) $(name).disabled = !started;
    $('download-personal').disabled = !started; $('complete').disabled = !M.ready(s) || Boolean(s.completion) || busy;
    $('question-count').textContent = s.answers.filter(x => x.trim()).length + ' / 5 已填写';
    $('completion-status').textContent = s.completion ? '自述打卡完成；待负责人验收，不能视为人员PASS。' : '尚未完成；人工验收状态：NOT_EXECUTED';
    $('completion-list').replaceChildren();
    for (const [done, text] of [[started, '开始个人练习'], [s.completedActions.includes('run'), '运行一次模拟核验'], [s.savedExportCount > 0, '导出一次已保存记录'], [s.answers.every(x => x.trim()) && Boolean(s.summary.trim()), '填写5题及本人理解总结']]) $('completion-list').append(make('li', (done ? '✓ ' : '○ ') + text));
    $('events').replaceChildren(...s.events.slice(-50).map(e => make('li', new Date(e.at).toLocaleTimeString() + ' · ' + e.action + (e.resultId ? ' · ' + e.resultId : ''))));
    saveLabels();
  }
  function updateInputs() { $('note').value = s.fields.note.text; $('draft').value = s.fields.draft.text; $('review-status').value = s.reviewStatus; }
  function questions(role) {
    const data = M.roles[role]; $('role-description').textContent = data.description; $('questions').replaceChildren();
    data.questions.forEach(([title, hint], i) => {
      const card = make('div', undefined, 'question-card'), input = make('textarea'); input.id = 'answer-' + i; input.maxLength = 3000; input.rows = 3; input.value = s.answers[i]; input.disabled = !s.startedAt; input.setAttribute('aria-label', '走读回答' + (i + 1));
      const label = make('label', title); label.htmlFor = input.id;
      card.append(make('span', 'QUESTION ' + String(i + 1).padStart(2, '0'), 'number'), label, make('p', hint), input);
      input.addEventListener('input', () => { s.answers[i] = input.value; s.completion = null; refresh(); }); $('questions').append(card);
    });
  }
  $('role').addEventListener('change', () => { if (!s.startedAt) { s.role = $('role').value; questions(s.role); refresh(); } });
  $('start').addEventListener('click', () => protect(() => { M.start(s, $('role').value, $('alias').value, id('PRACTICE'), now()); questions(s.role); refresh(); announce('练习已开始。仅使用合成资料；请先运行模拟核验。'); }));
  $('run').addEventListener('click', async () => {
    if (busy || !s.startedAt) return; revokeReset(); const generation = ++s.generation; busy = true; refresh();
    await new Promise(resolve => setTimeout(resolve, 450));
    if (generation !== s.generation) return;
    protect(() => { M.run(s, id('SIM-DS03'), now()); updateInputs(); renderResult(); announce('模拟核验完成：发现阻断冲突，需要人工澄清。'); }); busy = false; refresh();
  });
  for (const field of ['note', 'draft']) $(field).addEventListener('input', () => protect(() => { M.edit(s, field, $(field).value, now()); refresh(); }));
  $('review-status').addEventListener('change', () => protect(() => { M.status(s, $('review-status').value, now()); refresh(); }));
  for (const [name, field] of [['save-note', 'note'], ['save-draft', 'draft']]) $(name).addEventListener('click', () => protect(() => { M.save(s, field, now()); refresh(); announce((field === 'note' ? '备注' : '草稿') + '已保存到本页演练记录；没有上传或持久化。'); }));
  $('generate').addEventListener('click', () => protect(() => {
    if (!M.active(s)) throw Error('来源已失效，请重新核验。');
    const text = '您好，关于合成设备 P-103 / Rev A，客户询盘写明单泵流量85 m³/h，技术规格写明58 m³/h（均为扬程38 m）。请确认应采用的单泵设计流量，并核对设备、版本及工况。在确认前不据此批准报价或选型。';
    M.edit(s, 'draft', text, now()); $('draft').value = text; M.event(s, 'generate-template', now()); refresh(); announce('已应用本地澄清模板，尚未保存；请人工编辑。');
  }));
  $('copy-draft').addEventListener('click', async () => {
    if (!M.active(s) || busy) return;
    const identity = s.run.id, generation = s.generation, text = $('draft').value;
    try {
      if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (!M.active(s) || s.run.id !== identity || s.generation !== generation) return;
      M.event(s, 'copy', now()); refresh(); announce('已复制当前文字。' + (s.fields.draft.dirty ? '复制的是未保存草稿，没有自动保存或发送。' : '未自动发送。'));
    } catch {
      if (!M.active(s) || s.run.id !== identity || s.generation !== generation) return;
      $('draft').focus(); $('draft').select(); announce('浏览器未允许自动复制，已选中文字，请手动复制；未自动保存。', true);
    }
  });
  $('export-saved').addEventListener('click', () => protect(() => {
    const exported = M.exportSaved(s, now()); download(exported, 'houlai-practice-saved-' + s.savedExportCount + '.json'); refresh();
    announce(s.fields.note.dirty || s.fields.draft.dirty ? '导出只包含本页已保存版本；当前未保存修改没有进入文件，页面文字仍保留。' : '已导出本页已保存记录；不是后端验收证据。');
  }));
  $('invalidate').addEventListener('click', () => protect(() => { revokeReset(); M.invalidate(s, now()); busy = false; updateInputs(); renderResult(); refresh(); announce('已模拟来源失效：旧结论撤销，未保存文字只读隔离。', true); }));
  $('reset-practice').addEventListener('click', () => {
    if (!s.startedAt) return;
    pendingReset = {id: s.run?.id, revision: s.revision}; $('reset-dialog').showModal();
  });
  $('cancel-reset').addEventListener('click', revokeReset);
  $('reset-dialog').addEventListener('cancel', () => { pendingReset = null; });
  $('confirm-reset').addEventListener('click', () => {
    if (!pendingReset || pendingReset.id !== s.run?.id || pendingReset.revision !== s.revision) { revokeReset(); return; }
    revokeReset(); M.reset(s, now()); busy = false; updateInputs(); renderResult(); refresh(); announce('已重置核验；走读答卷保留，旧结果不能继续操作。');
  });
  for (const name of ['source-customer', 'source-spec']) $(name).addEventListener('toggle', () => { if ($(name).open && s.startedAt) { M.event(s, 'view-' + name, now()); refresh(); } });
  for (const [name, key] of [['summary', 'summary'], ['suggestion', 'suggestion']]) $(name).addEventListener('input', () => { s[key] = $(name).value; s.completion = null; refresh(); });
  $('declaration').addEventListener('change', () => { s.declaration = $('declaration').checked; s.completion = null; refresh(); });
  $('complete').addEventListener('click', () => protect(() => { M.complete(s, now()); refresh(); announce('自述打卡已标记完成，请下载记录并自行交给负责人；尚未经人工验收。'); }));
  $('download-personal').addEventListener('click', () => protect(() => { M.event(s, 'download-personal', now()); download(M.personal(s, now()), 'houlai-personal-practice.json'); refresh(); announce('个人记录已生成下载。页面没有上传或通知负责人，请自行交回文件。'); }));
  window.addEventListener('beforeunload', e => { if (s.startedAt) { e.preventDefault(); e.returnValue = ''; } });
  questions(s.role); renderResult(); refresh();
})();
