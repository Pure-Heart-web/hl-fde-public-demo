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

(function () {
  'use strict';
  const M=window.SemanticDemo, W=window.DemoWorkflow, $=id=>document.getElementById(id);
  let scenario='align', expression='direct', result=null, busy=false, generation=0, version=0, savedVersion=-1, toastTimer;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function say(text,error=false){clearTimeout(toastTimer);$('message').textContent=text;$('message').dataset.error=String(error);$('message').hidden=false;toastTimer=setTimeout(()=>$('message').hidden=true,6500);}
  function cite(ref){const b=node('button',ref.source_id+' / '+ref.version+' · 第'+ref.line+'行','cite-button');b.type='button';b.dataset.document=ref.source_id;b.dataset.line=String(ref.line);return b;}
  function refs(container,list){const row=node('div',undefined,'citation-row');list.forEach(ref=>row.append(cite(ref)));container.append(row);}
  function showSource(id,line=0){const d=M.docs(scenario,expression).find(d=>d.id===id);if(!d)return;const box=$('sem-reference');box.replaceChildren();const header=node('div',undefined,'source-heading');header.append(node('h3',d.name),node('span',d.id+' · '+d.version,'tag'));box.append(header,node('p',result&&M.usable(result)?'合成原文 · 当前预设版本 · 仅本地引用匹配':'预置或历史文本 · 不构成当前有效证据','micro'));const ol=node('ol',undefined,'source-lines');d.lines.forEach((text,i)=>ol.append(node('li',text,i+1===line?'matched':'')));box.append(ol);if(line){box.append(node('span','完整引用 / 第'+line+'行','quote-label'),node('blockquote',d.lines[line-1]));}W.openEvidence(result,id,line);controls();box.focus({preventScroll:true});box.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});}
  function docs(){const list=$('sem-docs');list.replaceChildren();M.docs(scenario,expression).forEach((d,i)=>{const b=node('button',undefined,'document-button');b.type='button';b.dataset.document=d.id;b.append(node('span',i===0?'RFQ':'SPEC','doc-icon'),node('strong',d.name),node('small',d.id+' · '+d.version+' · '+d.role));list.append(b);});$('sem-revision').textContent='当前询盘 '+(scenario==='revision'?'R2':'R1');$('sem-expression').disabled=scenario!=='align'||busy;document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));}
  function controls(){workflowControls();const audit=$('sem-audit');audit.replaceChildren();if(result&&M.usable(result)&&result.audit.length){audit.append(node('strong','本地留痕 · '+result.request_revision+' · 未正式批准'));result.audit.slice(-4).forEach(a=>audit.append(node('p',a.at.slice(11,19)+' UTC / '+(a.type==='LOCAL_REVIEW'?'人工复核记录':'编辑保存记录')+' / '+(a.status||result.review.status))));}else audit.append(node('span','尚无当前结果的本地留痕。'));const valid=M.usable(result);$('sem-expression').disabled=scenario!=='align'||busy;$('sem-human-fields').disabled=!valid||busy;$('sem-run').disabled=busy;$('sem-run').textContent=busy?'正在运行本地模拟…':'运行模拟语义核验 →';$('sem-corrupt').disabled=busy;$('sem-export').disabled=!result||busy||(valid&&!W.canExport(result));$('sem-export').textContent=result&&!valid?'导出诊断记录 JSON（非核验报告）':'导出核验报告 JSON ↗';$('sem-invalidate').disabled=!valid||busy;$('sem-copy').disabled=!valid||busy||!$('sem-draft').value.trim();$('sem-save-draft').disabled=!valid||busy||!$('sem-draft').value.trim();$('sem-save-state').textContent=!valid?'无有效模拟证据，人工操作已停用':savedVersion===version?'当前记录已保存在本页内存 · 未发送 / 未批准':'当前编辑未保存 · 刷新将丢失';}
  function workflowControls(){
    const valid=M.usable(result),required=W.required(result),viewed=result?.workflow?.viewed_evidence||[],complete=W.evidenceComplete(result),confirmed=W.canExport(result);
    const phase=!result?(busy?1:0):!valid?1:!complete?2:!confirmed?3:4;
    ['select','discover','evidence','review','export'].forEach((name,i)=>{const item=$('flow-'+name);item.className=i<phase?'done':i===phase?'active':'';if(i===phase)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
    $('flow-next').textContent=!result?(busy?'正在本地读取预设与检查规则…':'已选择合成资料包；运行后展示异常及引用。'):!valid?'本次结果不可核验。请查看拒绝或失效原因，再重新运行。':!complete?'证据已打开 '+viewed.length+' / '+required.length+' 条。下一步逐条查看异常原句。':!confirmed?'证据已全部打开。请选择处理状态、填写合成备注并勾选确认。':'本地处理已确认。可导出核验报告；异常仍未解决，未作业务放行。';
    const action=$('flow-action');action.textContent=['下一步：发现异常 ↓','查看结果与原因 ↓','下一步：打开一条待看证据 ↓','下一步：人工确认 ↓','下一步：导出核验报告 ↓'][phase];action.href=['#sem-run','#sem-output','#sem-reference','#sem-human','#sem-export'][phase];
    $('sem-review-gate').textContent=!valid?'先运行有效的模拟核验。':!complete?'请先打开异常引用（'+viewed.length+'/'+required.length+'）。':'全部异常引用已打开；仅确认本地处理，不替代工程验证。';
    $('sem-save-review').disabled=busy||!complete||!W.decisions.includes($('sem-review').value)||!$('sem-note').value.trim()||!$('sem-ack').checked;
    document.querySelectorAll('#sem-output button[data-line]').forEach(b=>{const opened=viewed.some(ref=>ref.source_id===b.dataset.document&&ref.line===Number(b.dataset.line));b.dataset.viewed=String(opened);b.setAttribute('aria-label',b.textContent+(opened?'，已打开':''));});
  }
  $('flow-action').addEventListener('click',e=>{if(M.usable(result)&&!W.evidenceComplete(result)){e.preventDefault();const next=W.required(result).find(ref=>!result.workflow.viewed_evidence.some(v=>v.source_id===ref.source_id&&v.version===ref.version&&v.line===ref.line));if(next)showSource(next.source_id,next.line);}});
  function clearInput(){for(const id of ['sem-note','sem-draft'])$(id).value='';$('sem-review').value='待工程师复核';$('sem-ack').checked=false;version++;savedVersion=-1;}
  function reset(){generation++;busy=false;result=null;clearInput();docs();render();$('sem-reference').replaceChildren(node('p','点击合成资料卡或结果引用，查看完整原句。','reference-placeholder'));for(let i=0;i<3;i++)$('sem-step-'+i).className='';}
  function render(){const box=$('sem-output');box.replaceChildren();const badge=$('sem-badge');badge.className='badge neutral';
    if(!result){badge.textContent=busy?'本地模拟处理中':'等待核验';const empty=node('div',undefined,'semantic-empty');empty.append(node('span','READ → ALIGN → VERIFY'),node('h3','不止找到数字，还要找到数字成立的条件。'),node('p','运行后展示需求结构、候选依据、限制条件与澄清问题。所有提案为人工预设。'));box.append(empty);controls();return;}
    const invalid=result.outcome==='INPUT_INVALIDATED',rejected=result.outcome==='UNVERIFIABLE_EVIDENCE';badge.className='badge '+(invalid||rejected?'invalid':'conflict');badge.textContent=invalid?'来源失效 · 重新核验':rejected?'引用拒绝 · 不进入对照':'待工程师复核 · 未批准';
    const banner=node('div',undefined,'semantic-banner '+(invalid||rejected?'bad':''));banner.append(node('small',result.outcome),node('h3',invalid?'旧结论已撤销，不能恢复旧授权。':rejected?'预设提案再像答案，错误引用也必须拒绝。':scenario==='revision'?'要求已变更：旧候选必须重新证明。':scenario==='pressure'?'缺少扬程上下文：相近概念不能直接合并。':'一个条件性候选，一个证据缺口，一个明确排除。'));
    banner.append(node('p',invalid?'这是静态来源失效模拟。可用事实、候选、观察、发现、人工记录与草稿均已清空；重新运行才会建立新的模拟结果。':rejected?'故障注入把提案quote改成了不存在的句子；本地原文逐字核对未通过。未进入候选矩阵，不自动修正模型回答。':'这些是证据对照状态，不是最终选型。语义理解、引用匹配与工程可接受性分别判断。'));box.append(banner);
    const counts=node('div',undefined,'evidence-counts');[['有效事实',result.facts.length],['候选',result.candidates.length],['观察',result.observations.length],['发现',result.findings.length]].forEach(([label,n])=>{const c=node('span');c.append(node('b',String(n)),document.createTextNode(label));counts.append(c);});box.append(counts);
    if(invalid||rejected){if(rejected){const p=node('div',undefined,'rejected-quote');p.append(node('small','被拒绝的模拟提案 / 非有效证据'),node('blockquote',result.proposed_facts[0].source.quote),node('p','实际原句：'+result.sources[0].lines[1]));box.append(p);}controls();return;}
    const anomalies=node('section',undefined,'workflow-findings');anomalies.id='sem-findings';anomalies.append(node('h3','2 / 发现异常 → 3 / 逐条打开证据'),node('p','以下复用现有候选判断；打开全部引用后再确认本地处理。已打开只记录交互，不证明理解或来源认证。','micro'));
    W.findings(result).forEach(f=>{const card=node('article',undefined,'finding-card');card.append(node('h4',f.id+' · '+f.title),node('p',f.message));refs(card,f.evidence);anomalies.append(card);});box.append(anomalies);
    const facts=node('div',undefined,'facts-table');facts.append(node('h4','01 / 需求结构 · 原文与推导分开'));result.facts.forEach(f=>{const row=node('div',undefined,'fact-row'),text=node('div');text.append(node('strong',f.label),node('small',f.meaning));const value=node('div',undefined,'fact-value');value.append(node('b',f.value+(f.unit?' '+f.unit:'')),node('span',f.kind,'kind-label'));row.append(text,value,cite(f.source));facts.append(row);if(f.rule)facts.append(node('p',f.rule,'fact-rule'));});box.append(facts);
    const candidates=node('div',undefined,'candidate-list');candidates.append(node('h4','02 / 候选对照 · 排名不能覆盖硬约束'));result.candidates.forEach(c=>{const card=node('article',undefined,'candidate-card '+c.status.toLowerCase());const head=node('div',undefined,'candidate-head');head.append(node('h3',c.name),node('span',c.label,'candidate-label'));card.append(head,node('p','有依据的部分：'+c.supported),node('p','判断 / 缺口：'+c.gap,'candidate-gap'));refs(card,c.evidence);candidates.append(card);});box.append(candidates);
    const questions=node('div',undefined,'clarifications');questions.append(node('h4','03 / 报价前必须澄清的事项'));const ol=node('ol');result.clarifications.forEach(q=>ol.append(node('li',q)));questions.append(ol,node('p','尚未确认的条件不是事实；本演示不默认材料适用、不默认压力等于扬程。','micro'));box.append(questions);controls();
  }
  function hasEdits(){return Boolean($('sem-note').value||$('sem-draft').value||$('sem-ack').checked);}
  document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.scenario===scenario)return;if(hasEdits()&&!window.confirm('切换预设将清除本页备注和草稿，是否继续？'))return;scenario=b.dataset.scenario;reset();say('已切换合成场景，旧结果未复用。请重新运行。');}));
  $('sem-expression').addEventListener('change',()=>{if(hasEdits()&&!window.confirm('切换表达将清除本页备注和草稿，是否继续？')){$('sem-expression').value=expression;return;}expression=$('sem-expression').value;reset();say('已切换预置表达；之前的证据矩阵已撤销。');});
  $('sem-corrupt').addEventListener('change',()=>{if(hasEdits()&&!window.confirm('改变引用条件将清除本页备注和草稿，是否继续？')){$('sem-corrupt').checked=!$('sem-corrupt').checked;return;}reset();say('已改变提案条件，请重新运行模拟。');});
  document.addEventListener('click',e=>{const b=e.target.closest('button[data-document]');if(b)showSource(b.dataset.document,Number(b.dataset.line||0));});
  $('sem-run').addEventListener('click',async()=>{if(busy)return;if(hasEdits()&&!window.confirm('重新运行会清除本次备注和草稿，是否继续？'))return;const token=++generation;busy=true;result=null;clearInput();docs();render();$('sem-reference').replaceChildren(node('p','本次核验进行中，旧引用已撤销。','reference-placeholder'));for(let i=0;i<3;i++)$('sem-step-'+i).className='';for(let i=0;i<3;i++){if(token!==generation)return;$('sem-step-'+i).className='active';await new Promise(resolve=>setTimeout(resolve,260));if(token!==generation)return;$('sem-step-'+i).className='done';}result=W.begin(M.create(scenario,expression,$('sem-corrupt').checked));busy=false;render();say(result.outcome==='UNVERIFIABLE_EVIDENCE'?'引用不一致，提案已拒绝。':'本地模拟完成：请查看工况缺口和引用，不构成选型批准。');});
  $('sem-reset').addEventListener('click',()=>{if(hasEdits()&&!window.confirm('清除本次本地编辑并重新开始？'))return;scenario='align';expression='direct';$('sem-expression').value='direct';$('sem-corrupt').checked=false;reset();say('语义演示已重置，未保留旧结论与本地编辑。');});
  $('sem-invalidate').addEventListener('click',()=>{if(!M.usable(result)||busy)return;generation++;M.invalidate(result);clearInput();render();$('sem-reference').replaceChildren(node('p','来源已模拟失效。历史原句只能作为预置文本查看，不能继续授权操作。','reference-placeholder'));say('模拟来源失效：候选、观察、发现、草稿和人工记录全部撤销。',true);});
  $('sem-save-review').addEventListener('click',()=>{if(!M.usable(result)||busy)return;try{W.confirmReview(result,$('sem-review').value,$('sem-note').value,$('sem-ack').checked);savedVersion=$('sem-draft').value===result.draft?version:-1;controls();say('本地处理记录已确认，可导出核验报告。所有异常与澄清项仍保留，未批准型号或报价。');}catch(error){say(error.message,true);}});
  $('sem-generate').addEventListener('click',()=>{if(!M.usable(result)||busy)return;if($('sem-draft').value&&!window.confirm('替换当前草稿为本地模板？'))return;$('sem-draft').value=M.draft(result);version++;controls();say('已生成基于合成证据的本地模板，尚未保存或发送。');});
  $('sem-save-draft').addEventListener('click',()=>{if(!M.usable(result)||busy)return;result.draft=$('sem-draft').value;savedVersion=$('sem-note').value===result.review.note&&$('sem-review').value===result.review.status?version:-1;result.audit.push({type:'LOCAL_EDIT_SAVE',at:new Date().toISOString()});controls();say('当前草稿已保存在本页内存；复核记录需单独确认，不构成客户确认。');});
  function reviewChanged(){W.clearConfirmation(result);version++;controls();}
  $('sem-note').addEventListener('input',reviewChanged);$('sem-review').addEventListener('change',reviewChanged);$('sem-ack').addEventListener('change',reviewChanged);
  $('sem-draft').addEventListener('input',()=>{version++;controls();});
  $('sem-copy').addEventListener('click',async()=>{if(!M.usable(result)||busy||!$('sem-draft').value.trim())return;const r=result,token=generation,text=$('sem-draft').value,unsaved=savedVersion!==version;let ok=false;try{await navigator.clipboard.writeText(text);ok=true;}catch(_){}if(r!==result||token!==generation||!M.usable(result))return;if(ok)say('已复制点击时的草稿。'+(unsaved?'该编辑尚未保存。':'')+'未发送、未承诺。');else{$('sem-draft').focus();$('sem-draft').select();say('自动复制失败，已选中文本，请手动复制；未确认复制成功。',true);}});
  $('sem-export').addEventListener('click',()=>{
    if(!result||busy)return;
    try{
      const valid=M.usable(result),edits=valid?{note:$('sem-note').value,status:$('sem-review').value,draft:$('sem-draft').value,saved:savedVersion===version}:null;
      const data=valid?W.report(result,edits):{...result,report_type:'SYNTHETIC_DIAGNOSTIC_ONLY',exported_at:new Date().toISOString(),metrics:{latency_ms:null,input_tokens:null,output_tokens:null,cost:null,model_quality:null},current_local_edits:null};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=node('a');a.href=url;a.download='houlai-synthetic-'+(valid?'verification':'diagnostic')+'-'+scenario+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      say(valid?'已生成合成核验报告下载，包含异常、逐行证据及本地人工确认。未测模型指标保持null。':'已生成诊断记录下载；来源无效或引用拒绝，不构成核验报告。');
    }catch(error){say('导出未完成：'+error.message,true);}
  });
  M.terms.forEach(t=>{const option=node('option',t.pair);option.value=t.id;$('concept-select').append(option);});function concept(){const t=M.terms.find(t=>t.id===$('concept-select').value);const box=$('concept-result');box.replaceChildren(node('span',t.relation,'concept-relation'),node('p',t.why));} $('concept-select').addEventListener('change',concept);concept();
  $('golden-run').addEventListener('click',()=>{const results=M.evalGolden(),box=$('golden-output'),passed=results.filter(t=>t.pass).length;box.replaceChildren(node('h3',passed+' / '+results.length+' 本地检查通过'),node('p','仅静态模拟器 · 固定合成材料与人工预期 · 非真实模型评测成绩','micro'));const table=node('table',undefined,'golden-table');const head=node('tr');['案例 / 任务','人工预期','实际值','结果'].forEach(v=>head.append(node('th',v)));const thead=node('thead');thead.append(head);table.append(thead);const tbody=node('tbody');results.forEach(t=>{const tr=node('tr');[t.id+' '+t.name,String(t.expected),String(t.actual),t.pass?'PASS':'FAIL'].forEach(v=>tr.append(node('td',v)));tbody.append(tr);});table.append(tbody);box.append(table);say('已实际运行12项本地模拟检查；没有调用模型，不生成模型准确率。');});
  window.addEventListener('beforeunload',e=>{if(hasEdits()&&savedVersion!==version){e.preventDefault();e.returnValue='';}});
  window.addEventListener('pagehide',()=>{generation++;busy=false;clearTimeout(toastTimer);});window.addEventListener('pageshow',event=>{if(event.persisted)reset();});
  reset();
})();
