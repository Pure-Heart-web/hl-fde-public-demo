(function () {
  'use strict';
  const M = window.DemoModel, $ = id => document.getElementById(id);
  let selected = 'B', report = null, busy = false, generation = 0;
  let noteVersion = 0, draftVersion = 0, savedNoteVersion = null, savedDraftVersion = null;
  let messageVersion = 0, messageTimer;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function say(text, error = false) {
    const version = ++messageVersion; clearTimeout(messageTimer); $('message').textContent = text;
    $('message').dataset.error = String(error); $('message').hidden = false;
    messageTimer = setTimeout(() => { if (version === messageVersion) $('message').hidden = true; }, 6500);
  }
  function indicators() {
    const valid = M.usable(report);
    $('review-fields').disabled = !valid || busy; $('draft-fields').disabled = !valid || busy;
    $('note-status').className = 'save-status' + (noteVersion !== savedNoteVersion ? ' dirty' : '');
    $('note-status').textContent = !valid ? '尚无有效核验记录' : savedNoteVersion === noteVersion ? '当前记录已保存在本页内存' : '当前修改未保存 · 刷新将丢失';
    $('draft-status').className = 'save-status' + (draftVersion !== savedDraftVersion ? ' dirty' : '');
    $('draft-status').textContent = !valid ? '无有效证据，草稿操作已停用' : savedDraftVersion === draftVersion ? '当前草稿已保存在本页内存' : '当前草稿未保存 · 刷新将丢失';
    $('copy').disabled = !valid || busy || !$('draft').value.trim();
    $('save-draft').disabled = !valid || busy || !$('draft').value.trim();
    $('run').disabled = busy; $('run').textContent = busy ? '正在运行模拟…' : '运行模拟核验 →';
    $('invalidate').disabled = !valid || busy; $('export').disabled = !report || busy;
    document.querySelectorAll('[data-case]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.case === selected)); });
  }
  function renderSources() {
    const matched = M.usable(report); $('sources').replaceChildren();
    M.sources(selected).forEach((source, index) => {
      const card = el('article', undefined, 'source-card'), head = el('div', undefined, 'source-heading');
      const title = el('div'); title.append(el('h3', source.name), el('p', source.id + ' · ' + source.kind, 'source-meta'));
      head.append(title, el('span', matched ? '模拟匹配' : '预置资料', 'tag')); card.append(head);
      const list = el('ol', undefined, 'source-lines'); source.lines.forEach((line, i) => list.append(el('li', line, matched && i === 3 ? 'matched' : '')));card.append(list);
      card.append(el('span', matched ? '完整引用 / 第4行 · ' + source.role : '历史或预置文本，不是当前有效证据', 'quote-label'));
      card.append(el('blockquote', matched ? report.candidates[index].quote : '运行模拟核验后展示引用；失效后撤销可用证据。'));
      $('sources').append(card);
    });
    $('evidence-state').textContent = matched ? '2条完整引用 · 仅模拟匹配' : report ? '来源失效 · 有效证据已撤销' : '预置合成来源 · 尚未核对';
  }
  function renderResult() {
    const box = $('result'); box.replaceChildren();
    if (!report) {
      $('result-badge').className = 'badge neutral'; $('result-badge').textContent = busy ? '模拟处理中' : '尚未运行';
      const empty = el('div', undefined, 'empty-result'); empty.append(el('div', '两份资料，一个待确认的事实。', 'big-number'), el('p', '选择左侧案例，观察参数如何关联原文，以及哪些结论必须等待人工核实。')); box.append(empty); return;
    }
    const invalid = report.outcome === 'INPUT_INVALIDATED', conflict = report.outcome === 'BLOCKING_CONFLICT';
    const kind = invalid ? 'invalid' : conflict ? 'conflict' : 'consistent';
    $('result-badge').className = 'badge ' + kind; $('result-badge').textContent = invalid ? '需要重新核验' : conflict ? '阻断 · 不可放行' : '指定资料观察一致';
    const section = el('div', undefined, 'outcome ' + kind);
    section.append(el('div', report.outcome, 'outcome-kicker'));
    section.append(el('h4', invalid ? '来源已变化，撤销旧结论。' : conflict ? '流量不一致，报价先暂停。' : '数值一致，判断仍需人工。'));
    section.append(el('p', invalid ? '这是前端预设的来源失效模拟。可用候选、观察和发现均已清空；旧备注与草稿不再有效。请重新运行模拟核验，不代表真实后端安全验证。' : conflict ? '同一设备、版本和扬程下，询盘要求85 m³/h，规格记载58 m³/h。请人工确认单泵设计流量并更新对应资料；任何人工处理状态都不会解除本次阻断。' : '两份指定合成资料均记载85 m³/h。观察一致不代表资料完整，也不是最终选型、客户确认或业务批准。'));
    if (!invalid) {
      const pair = el('div', undefined, 'value-pair'); report.candidates.forEach((candidate, i) => {
        if (i) pair.append(el('span', conflict ? '≠' : '=', 'comparison-symbol'));
        const value = el('div', undefined, 'value'), number = el('strong', candidate.value_decimal); number.append(el('small', 'm³/h'));
        value.append(number, el('span', i ? '设备规格 / 第4行' : '询盘要求 / 第4行')); pair.append(value);
      });section.append(pair);
    }
    const counts = el('div', undefined, 'evidence-counts');[['可用候选',report.candidates.length],['观察值',report.observations.length],['发现项',report.findings.length]].forEach(([label, count]) => {const item = el('span');item.append(el('b',String(count)),document.createTextNode(label));counts.append(item);});section.append(counts);box.append(section);
  }
  function render() { renderResult(); renderSources(); indicators(); }
  function clearInputs() { $('note').value = ''; $('draft').value = ''; $('review-status').value = '待核实'; noteVersion++; draftVersion++; savedNoteVersion = null; savedDraftVersion = null; }
  function choose(id) {
    generation++; busy = false; selected = id; report = null; clearInputs();
    document.querySelectorAll('.progress li').forEach(n => n.className = ''); render();
  }
  document.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => {
    if (selected === button.dataset.case) return;
    if (($('note').value || $('draft').value) && !window.confirm('切换案例将清除当前备注和草稿，是否继续？')) return;
    choose(button.dataset.case); say('已切换合成案例，尚未运行核验。');
  }));
  $('run').addEventListener('click', async () => {
    if (busy) return;
    if (report && ($('note').value || $('draft').value) && !window.confirm('重新核验会清除本次人工记录和草稿，是否继续？')) return;
    const token = ++generation; busy = true; report = null; clearInputs(); render();
    for (let i = 0; i < 3; i++) {
      if (token !== generation) return;
      $('step-' + i).className = 'active'; await delay(340);
      if (token !== generation) return; $('step-' + i).className = 'done';
    }
    report = M.evaluate(selected); busy = false; render();
    say(report.outcome === 'INPUT_INVALIDATED' ? '已模拟来源失效：结论和相关操作已撤销。' : '模拟核验完成。请查看结果及原文证据。');
  });
  $('invalidate').addEventListener('click', () => {
    if (!M.usable(report) || busy) return; generation++; M.invalidate(report); clearInputs(); render();say('模拟来源失效：有效候选、发现、备注和草稿已撤销。',true);
  });
  $('note').addEventListener('input', () => {noteVersion++;indicators();});
  $('review-status').addEventListener('change', () => {noteVersion++;indicators();});
  $('draft').addEventListener('input', () => {draftVersion++;indicators();});
  $('save-note').addEventListener('click', () => {
    if (!M.usable(report) || busy) return;
    report.review = { status: $('review-status').value, note: $('note').value, saved_at: new Date().toISOString() };
    savedNoteVersion = noteVersion; indicators();say(report.outcome === 'BLOCKING_CONFLICT' ? '人工记录已保存在本页；阻断冲突仍然有效，未放行。' : '人工记录已保存在本页，不构成业务批准。');
  });
  $('generate').addEventListener('click', () => {
    if (!M.usable(report) || busy) return;
    if ($('draft').value && !window.confirm('生成模板将替换当前草稿，是否继续？')) return;
    $('draft').value = M.draft(report); draftVersion++; indicators();say('已生成本地模板，尚未保存或发送。请人工核对。');
  });
  $('save-draft').addEventListener('click', () => {
    if (!M.usable(report) || busy || !$('draft').value.trim()) return;
    report.draft = { text: $('draft').value, saved_at: new Date().toISOString() };savedDraftVersion = draftVersion;indicators();say('当前草稿已保存在本页内存，未发送。');
  });
  $('copy').addEventListener('click', async () => {
    if (!M.usable(report) || busy || !$('draft').value.trim()) return;
    const identity = report, token = generation, text = $('draft').value, version = draftVersion;
    const unsaved = savedDraftVersion !== version;
    let success = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); success = true; } } catch (_) { /* Explicit fallback below; no false success. */ }
    if (token !== generation || report !== identity || !M.usable(report)) return;
    if (!success) {
      const field = $('draft'), start = field.selectionStart, end = field.selectionEnd;
      if (field.value === text) { field.focus();field.select();try {success = document.execCommand('copy');} catch (_) {success = false;} if (success) field.setSelectionRange(start,end); }
    }
    if (success) say('已复制点击时的草稿。' + (unsaved ? '该版本尚未保存；复制不等于保存或发送。' : '复制不等于发送。'));
    else { $('draft').focus();$('draft').select();say('浏览器未允许自动复制。已选中文本，请按 Ctrl/Cmd+C 手动复制；尚未确认复制成功。',true); }
  });
  $('export').addEventListener('click', () => {
    if (!report || busy) return;
    const record = { ...report, exported_at: new Date().toISOString(), current_local_edits: M.usable(report) ? {
      review: {status:$('review-status').value,note:$('note').value,saved: savedNoteVersion === noteVersion},
      draft: {text:$('draft').value,saved: savedDraftVersion === draftVersion}
    } : null };
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)],{type:'application/json;charset=utf-8'}), url = URL.createObjectURL(blob), link = el('a');
      link.href = url;link.download = 'houlai-synthetic-demo-' + selected + '.json';document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),1000);say('已生成本地JSON下载；包含合成数据及当前演示编辑状态。');
    } catch (_) { say('无法生成下载，请检查浏览器权限；未确认导出成功。',true); }
  });
  let resetIdentity;
  $('reset').addEventListener('click', () => { resetIdentity = {report, generation};$('reset-dialog').showModal(); });
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
  $('confirm-reset').addEventListener('click', () => {
    $('reset-dialog').close();
    if (!resetIdentity || resetIdentity.report !== report || resetIdentity.generation !== generation) {say('当前演示已变化，请重新发起重置。',true);return;}
    choose('B');say('已清除本页演示记录，可重新体验。');
  });
  window.addEventListener('beforeunload', event => { if (M.usable(report) && (noteVersion !== savedNoteVersion || draftVersion !== savedDraftVersion) && ($('note').value || $('draft').value)) {event.preventDefault(); event.returnValue = '';} });
  window.addEventListener('pagehide', () => {clearTimeout(messageTimer);messageVersion++;$('message').hidden=true;$('reset-dialog').close();});
  render();
})();
