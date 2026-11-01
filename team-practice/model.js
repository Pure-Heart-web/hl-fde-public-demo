(function (root) {
  'use strict';
  const VERSION = 'houlai-team-practice-1.0.0';
  const roles = {
    implementation: {name: '实施成员', description: '练习业务核验、人工记录及保存与导出的区别。回答只作为本人自述，不能替代负责人观察。', questions: [
      ['你如何建立一次有效的 DS03 模拟结果？', '说明选择、运行、查看原文的顺序，并说明本页的能力边界。'],
      ['85 与 58 的冲突依据是什么？现在能否批准报价？', '请结合设备、版本、单位和原文解释；人工审核状态是否改变规则结论？'],
      ['已保存 A、页面未保存 B，导出后各处应该是什么？', '再说明仅保存备注B、再保存草稿B以后，提示及文件如何变化。'],
      ['怎样确认导出文件属于正确的结果与记录？', '仅看同样的85/58或文件名够不够？同一个结果ID下人工记录也可能改变。'],
      ['来源失效或保存、导出异常时，你会如何停止和求助？', '不要把旧输入、恢复字节或刚才的成功提示当作有效授权。']
    ]},
    technical: {name: '技术成员', description: '练习识别静态演示与真实服务的边界、版本、会话和故障。这里不启动Python，也不证明你已完成真实部署。', questions: [
      ['你如何确认打开的是预期版本？', '解释页面版本、网址及静态演练标签；相同Git HEAD能否证明未提交的后端候选内容？'],
      ['Fake、无API Key与127.0.0.1各能证明什么？', '分别解释应用模式、入站监听和出站网络限制，不要混为一项。'],
      ['刷新、关闭页面或服务重启后，哪些内容可能丢失？', '本页没有后端和持久化；真实工作台的内存会话也不等于长期存储。'],
      ['来源失效后应该清除与禁止什么？', '说明候选、观察、发现、草稿、复制和人工操作；重新运行与旧授权复活有什么区别？'],
      ['哪些操作需要停止并交给负责人决定？', '包括版本不匹配、未知端口、真实客户资料、真实模型和公网暴露。']
    ]},
    founder: {name: '创始人', description: '练习解释业务价值与验收边界。请记录自己的判断和疑问，不把演示完成当作工程、人员或客户验收。', questions: [
      ['这个流程帮助企业减少哪一种重复核对工作？', '说明你真正需要的业务决策和目前仍需人工负责的部分。'],
      ['在85/58冲突下，你会向谁澄清什么？', '避免把候选数值直接写成最终承诺或选型批准。'],
      ['你如何区分页面输入、已保存记录和导出证据？', '说明A/B演练结果，以及怎样识别错误的成功提示。'],
      ['你会怎样判断另一位成员是否独立理解？', '可以参考五维0–2分及安全否决建议，但不能用自动化成绩代替真人回答。'],
      ['继续试用前，你还需要哪些证据？', '分别考虑人员准备、设备隔离、已知缺陷以及真实客户和真实模型的授权。']
    ]}
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function create() {
    return {version: VERSION, sessionId: null, alias: '', role: 'implementation', startedAt: null,
      completion: null, run: null, revision: 0, generation: 0,
      fields: {note: {text: '', version: 0, dirty: false}, draft: {text: '', version: 0, dirty: false}},
      reviewStatus: '待核实', saved: {note: '', draft: '', reviewStatus: '待核实', noteVersion: null, draftVersion: null, noteAt: null, draftAt: null},
      retained: [], answers: ['', '', '', '', ''], summary: '', suggestion: '', declaration: false,
      events: [], completedActions: [], savedExportCount: 0, exportedWithUnsaved: false};
  }
  function event(s, name, now, data = {}) {
    s.events.push({sequence: (s.events.at(-1)?.sequence || 0) + 1, at: now, action: name, ...data});
    if (s.events.length > 500) s.events.splice(0, s.events.length - 500);
    if (!s.completedActions.includes(name)) s.completedActions.push(name);
  }
  function start(s, role, alias, id, now) {
    if (!Object.hasOwn(roles, role)) throw Error('请选择有效角色。');
    if (typeof alias !== 'string' || !alias.trim() || alias.trim().length > 24) throw Error('请填一个不含个人信息的练习代号。');
    if (s.startedAt) throw Error('本页练习已开始；如需换人，请在新的独立页面开始。');
    s.role = role; s.alias = alias.trim(); s.sessionId = id; s.startedAt = now;
    event(s, 'start', now, {role});
  }
  function active(s) { return Boolean(s.run && !s.run.invalidated); }
  function requireActive(s) { if (!active(s)) throw Error('当前没有有效模拟结果，请重新运行核验。'); }
  function clearFields(s) {
    s.fields.note = {text: '', version: 0, dirty: false};
    s.fields.draft = {text: '', version: 0, dirty: false};
    s.reviewStatus = '待核实';
    s.saved = {note: '', draft: '', reviewStatus: '待核实', noteVersion: null, draftVersion: null, noteAt: null, draftAt: null};
  }
  function retain(s, now) {
    if (!s.run) return;
    if (s.fields.note.dirty || s.fields.draft.dirty) s.retained.push({resultId: s.run.id, isolatedAt: now,
      note: s.fields.note.dirty ? s.fields.note.text : null,
      draft: s.fields.draft.dirty ? s.fields.draft.text : null, trusted: false});
  }
  function run(s, id, now) {
    if (!s.startedAt) throw Error('请先开始个人练习。');
    retain(s, now); clearFields(s); s.revision++; s.completion = null;
    s.run = {id, caseId: 'DS03', equipment: 'P-103', revision: 'A', invalidated: false,
      outcome: 'BLOCKING_CONFLICT', createdAt: now,
      candidates: [{source: '合成客户询盘', value: '85', unit: 'm3/h', quote: 'Required flow per pump: 85 m3/h', evidence: 'SIMULATED_QUOTE_MATCH'},
        {source: '合成厂家规格', value: '58', unit: 'm3/h', quote: 'Flow: 58 m3/h', evidence: 'SIMULATED_QUOTE_MATCH'}],
      observations: [{value: '85', unit: 'm3/h'}, {value: '58', unit: 'm3/h'}],
      findings: [{code: 'SIMULATED_FLOW_CONFLICT', explanation: '同设备、同版本、同扬程的流量不一致，需要澄清。'}],
      resolvedFlow: null, customerConfirmed: false, externalWrites: 0};
    event(s, 'run', now, {resultId: id});
  }
  function edit(s, field, text, now) {
    requireActive(s);
    if (!['note', 'draft'].includes(field) || typeof text !== 'string' || text.length > (field === 'note' ? 1500 : 4000)) throw Error('编辑内容超出范围。');
    s.fields[field].text = text; s.fields[field].version++; s.fields[field].dirty = true;
    s.completion = null; event(s, 'edit-' + field, now, {version: s.fields[field].version});
  }
  function status(s, value, now) {
    requireActive(s);
    if (!['待核实', '已内部核实', '等待客户确认', '不适用'].includes(value)) throw Error('人工状态无效。');
    s.reviewStatus = value; s.fields.note.version++; s.fields.note.dirty = true; s.completion = null;
    event(s, 'edit-review-status', now);
  }
  function save(s, field, now) {
    requireActive(s);
    if (!['note', 'draft'].includes(field)) throw Error('保存字段无效。');
    s.saved[field] = s.fields[field].text; s.saved[field + 'Version'] = s.fields[field].version;
    s.saved[field + 'At'] = now; s.fields[field].dirty = false;
    if (field === 'note') s.saved.reviewStatus = s.reviewStatus;
    event(s, 'save-' + field, now, {resultId: s.run.id, version: s.fields[field].version});
  }
  function invalidate(s, now) {
    requireActive(s); retain(s, now); s.generation++; s.revision++;
    Object.assign(s.run, {invalidated: true, outcome: 'INPUT_INVALIDATED', candidates: [], observations: [], findings: []});
    clearFields(s); s.completion = null; event(s, 'invalidate', now, {resultId: s.run.id});
  }
  function reset(s, now) {
    retain(s, now); s.generation++; s.revision++; s.run = null; clearFields(s); s.completion = null;
    event(s, 'reset', now);
  }
  function savedRecord(s) {
    return {result: clone(s.run), saved_review: {status: s.saved.reviewStatus, note: s.saved.note, savedAt: s.saved.noteAt},
      saved_draft: {text: s.saved.draft, savedAt: s.saved.draftAt},
      pending_edits_present: {note: s.fields.note.dirty, draft: s.fields.draft.dirty},
      storage: 'CURRENT_PAGE_MEMORY_ONLY', backend_verified: false};
  }
  function exportSaved(s, now) {
    requireActive(s);
    const hadUnsaved = s.fields.note.dirty || s.fields.draft.dirty;
    const record = {record_type: 'HOULAI_STATIC_PRACTICE_SAVED_RECORD', version: VERSION,
      evidence_class: 'STATIC_SIMULATION_NOT_FIX009_BACKEND_EVIDENCE', exportedAt: now,
      practiceSession: s.sessionId, ...savedRecord(s)};
    s.savedExportCount++; if (hadUnsaved) s.exportedWithUnsaved = true;
    event(s, 'export-saved', now, {resultId: s.run.id, pending: hadUnsaved});
    return record;
  }
  function ready(s) {
    return Boolean(s.startedAt && active(s) && s.completedActions.includes('run') && s.savedExportCount > 0
      && s.answers.every(x => typeof x === 'string' && x.trim()) && s.summary.trim() && s.declaration);
  }
  function complete(s, now) {
    if (!ready(s)) throw Error('请先运行模拟核验、导出一次已保存记录，填写5题和理解总结，并勾选本人声明。');
    s.completion = {at: now, status: 'SELF_REPORTED_COMPLETE_NOT_HUMAN_ACCEPTED'};
    event(s, 'self-reported-complete', now);
  }
  function personal(s, now) {
    if (!s.startedAt) throw Error('请先开始练习。');
    return {record_type: 'HOULAI_TEAM_PRACTICE_SELF_REPORT', version: VERSION,
      evidence_class: 'STATIC_SIMULATION_NOT_FIX009_BACKEND_EVIDENCE', exportedAt: now,
      participant: {alias: s.alias, role: s.role, roleName: roles[s.role].name, identityVerified: false},
      practiceSession: s.sessionId, startedAt: s.startedAt, completion: clone(s.completion),
      practice: savedRecord(s), walkthrough: {answers: s.answers.map((a, i) => ({question: roles[s.role].questions[i][0], answer: a})),
        summary: s.summary, suggestions: s.suggestion},
      isolated_unsaved_inputs: clone(s.retained),
      human_acceptance: {status: 'NOT_EXECUTED', scores: null, reviewer: null},
      events: clone(s.events), limitations: ['纯合成与静态模拟，未运行A3或真实模型。', '无服务器收集、身份认证或成员同步。', '刷新关闭丢失，下载后自行交回负责人。', '本页复制不自动保存，与本地FIX009不同。']};
  }
  const api = {VERSION, roles, create, start, active, run, edit, status, save, invalidate, reset, exportSaved, personal, complete, ready, event};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PracticeModel = api;
})(typeof window === 'object' ? window : globalThis);
