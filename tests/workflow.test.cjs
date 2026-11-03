const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../model.js');
require('../workflow.js');
const M=globalThis.SemanticDemo,W=globalThis.DemoWorkflow;
const fresh=(mode='align',expression='direct',corrupt=false)=>W.begin(M.create(mode,expression,corrupt));
const openAll=r=>W.required(r).forEach(ref=>assert.ok(W.openEvidence(r,ref.source_id,ref.line)));
const confirm=r=>W.confirmReview(r,'等待客户补充资料','合成记录：需补充介质适用性与当前曲线。',true);
for(const g of M.golden)test('existing '+g.id+' '+g.name,()=>assert.equal(g.run(),g.expected));
test('report requires opened evidence and explicit human decision',()=>{
  const r=fresh();assert.equal(W.canExport(r),false);assert.throws(()=>W.report(r,null));assert.throws(()=>confirm(r));
  const refs=W.required(r);assert.equal(refs.length,7);
  assert.equal(W.openEvidence(r,'SYN-RFQ',0),false);assert.equal(W.openEvidence(r,'wrong',2),false);
  refs.slice(1).forEach(ref=>W.openEvidence(r,ref.source_id,ref.line));assert.throws(()=>confirm(r));
  W.openEvidence(r,refs[0].source_id,refs[0].line);assert.ok(W.evidenceComplete(r));
  for(const [status,note,ack] of [['待工程师复核','合成备注',true],['已内部复核',' ',true],['已内部复核','合成备注',false],['已内部复核','x'.repeat(1501),true]])assert.throws(()=>W.confirmReview(r,status,note,ack));
  confirm(r);assert.ok(W.canExport(r));
  const data=W.report(r,{draft:'未保存的合成草稿',saved:false});
  assert.equal(data.report_type,'SYNTHETIC_VERIFICATION_REPORT');assert.equal(data.workflow.confirmation.scope,'LOCAL_SYNTHETIC_REVIEW_ONLY');
  assert.equal(data.summary.anomalies.length,3);assert.equal(data.summary.business_release,false);assert.equal(data.final_model,null);assert.equal(data.customer_confirmed,false);assert.equal(data.external_writes,0);
  assert.ok(Object.values(data.metrics).every(x=>x===null));assert.equal(data.current_local_edits.saved,false);
  data.sources[0].lines[1]='changed';assert.notEqual(r.sources[0].lines[1],'changed');
});
test('opening a duplicate does not inflate evidence count',()=>{const r=fresh();const ref=W.required(r)[0];W.openEvidence(r,ref.source_id,ref.line);W.openEvidence(r,ref.source_id,ref.line);assert.equal(r.workflow.viewed_evidence.length,1);});
test('quote/version corruption cannot complete or retain a confirmation',()=>{
  for(const mutate of [r=>r.sources[0].version='R9',r=>r.sources[0].lines[1]='tampered']){const r=fresh();openAll(r);confirm(r);mutate(r);assert.equal(W.canExport(r),false);assert.throws(()=>W.report(r,null));}
});
test('changed human input revokes confirmation without resolving anomalies',()=>{const r=fresh();openAll(r);confirm(r);W.clearConfirmation(r);assert.equal(W.canExport(r),false);assert.equal(r.findings.length,3);assert.equal(r.candidates[2].status,'EXCLUDED');});
test('invalidation clears every derived record including human confirmation',()=>{const r=fresh();openAll(r);confirm(r);r.draft=M.draft(r);M.invalidate(r);assert.equal(r.workflow,null);for(const field of ['facts','proposed_facts','observations','findings','candidates','clarifications','audit'])assert.equal(r[field].length,0);assert.equal(r.review.note,'');assert.equal(r.draft,'');assert.equal(W.openEvidence(r,'SYN-RFQ',2),false);assert.throws(()=>W.report(r,null));});
test('new revision and rerun never inherit an earlier confirmation',()=>{const r=fresh();openAll(r);confirm(r);const next=fresh('revision');assert.notEqual(next.result_id,r.result_id);assert.equal(next.request_revision,'R2');assert.equal(next.facts[0].value,'95');assert.equal(next.candidates[0].status,'INSUFFICIENT_EVIDENCE');assert.equal(W.canExport(next),false);assert.equal(next.workflow.viewed_evidence.length,0);});
test('all presets can complete and keep their original engineering boundaries',()=>{for(const [mode,expression] of [['align','direct'],['align','litres'],['align','capacity'],['revision','direct'],['pressure','direct']]){const r=fresh(mode,expression);openAll(r);confirm(r);assert.ok(W.canExport(r));assert.deepEqual(r.candidates.map(c=>c.status),[mode==='align'?'CONDITIONAL':'INSUFFICIENT_EVIDENCE','INSUFFICIENT_EVIDENCE','EXCLUDED']);}});
test('rejected proposals cannot be opened, confirmed, or exported as reports',()=>{const r=fresh('align','direct',true);assert.equal(r.outcome,'UNVERIFIABLE_EVIDENCE');assert.deepEqual(W.required(r),[]);assert.equal(W.openEvidence(r,'SYN-RFQ',2),false);assert.throws(()=>confirm(r));assert.throws(()=>W.report(r,null));});
test('legacy 85/58 behavior is preserved',()=>{const L=globalThis.DemoModel;assert.equal(L.evaluate('A').outcome,'OBSERVED_CONSISTENT');const r=L.evaluate('B');assert.equal(r.findings[0].values.join('/'),'85/58');L.invalidate(r);assert.equal(L.usable(r),false);assert.throws(()=>L.draft(r));});
test('static entrypoint keeps isolation and local scripts',()=>{const html=fs.readFileSync('index.html','utf8');assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);assert.match(html,/object-src 'none'/);assert.match(html,/<meta name="viewport"/);assert.equal((html.match(/src="https?:/g)||[]).length,0);const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const match of html.matchAll(/<script src="([^"]+)"/g))assert.ok(fs.existsSync(match[1]));});
