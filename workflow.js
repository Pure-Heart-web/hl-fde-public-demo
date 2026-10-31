/* Local interaction gates only. Evidence opened is not evidence certified. */
(function (root) {
  'use strict';
  const M = root.SemanticDemo;
  const decisions = Object.freeze(['已内部复核', '等待客户补充资料', '不适用']);
  const key = ref => [ref.source_id, ref.version, ref.line, ref.quote].join('\u001f');
  function findings(r) {
    if (!M.usable(r)) return [];
    // Reuse the simulator's judgments and citations; introduce no new inference.
    return r.candidates.map(c => ({id:c.id, title:c.label, message:c.gap, evidence:c.evidence}));
  }
  function required(r) {
    return [...new Map(findings(r).flatMap(f => f.evidence).map(ref => [key(ref), ref])).values()];
  }
  function begin(r) {
    r.workflow = {result_id:r.result_id, viewed_evidence:[], confirmation:null};
    return r;
  }
  function current(r) {
    return M.usable(r) && r.workflow?.result_id === r.result_id;
  }
  function openEvidence(r, id, line) {
    if (!current(r)) return false;
    const ref = required(r).find(ref => ref.source_id === id && ref.line === line);
    const doc = r.sources.find(d => d.id === id);
    if (!ref || !doc || doc.version !== ref.version || doc.lines[line-1] !== ref.quote) return false;
    if (!r.workflow.viewed_evidence.some(e => key(e) === key(ref))) {
      r.workflow.viewed_evidence.push({...ref, opened_at:new Date().toISOString()});
    }
    return true;
  }
  function evidenceComplete(r) {
    const refs = required(r);
    return current(r) && refs.length > 0 && refs.every(ref => {
      const doc = r.sources.find(d => d.id === ref.source_id);
      return doc?.version === ref.version && doc.lines[ref.line-1] === ref.quote &&
        r.workflow.viewed_evidence.some(e => key(e) === key(ref));
    });
  }
  function clearConfirmation(r) {
    if (r?.workflow) r.workflow.confirmation = null;
  }
  function confirmReview(r, status, note, acknowledged) {
    if (!evidenceComplete(r)) throw Error('请先逐条打开全部异常证据。');
    if (!acknowledged || !decisions.includes(status) || !note.trim() || note.length > 1500) {
      throw Error('请选择处理状态、填写合成备注，并勾选本地复核确认。');
    }
    const confirmation = {result_id:r.result_id, status, note:note.trim(), confirmed_at:new Date().toISOString(), scope:'LOCAL_SYNTHETIC_REVIEW_ONLY'};
    r.review = {status, note:note.trim()};
    r.workflow.confirmation = confirmation;
    r.audit.push({type:'LOCAL_REVIEW', at:confirmation.confirmed_at, ...r.review});
  }
  function canExport(r) {
    return evidenceComplete(r) && r.workflow.confirmation?.result_id === r.result_id;
  }
  function report(r, edits) {
    if (!canExport(r)) throw Error('当前结果尚未完成人工确认，不能导出核验报告。');
    return JSON.parse(JSON.stringify({...r, report_type:'SYNTHETIC_VERIFICATION_REPORT',
      report_schema_version:'1.0', exported_at:new Date().toISOString(),
      summary:{anomalies:findings(r), business_release:false, unresolved_questions:r.clarifications},
      metrics:{latency_ms:null,input_tokens:null,output_tokens:null,cost:null,model_quality:null},
      current_local_edits:edits,
      interaction_notice:'证据打开和本地人工确认仅记录演示交互；不证明阅读理解、身份、客户验收或业务批准。'}));
  }
  root.DemoWorkflow = Object.freeze({decisions, findings, required, begin, openEvidence, evidenceComplete, clearConfirmation, confirmReview, canExport, report});
})(typeof window !== 'undefined' ? window : globalThis);
