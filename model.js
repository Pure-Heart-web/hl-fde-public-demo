/* Original public demo logic. Synthetic facts only; no production trust claims. */
(function (root) {
  'use strict';
  const cases = Object.freeze({
    A: { name: '一致资料', subtitle: '85 / 85 · 观察一致', spec: '85', outcome: 'OBSERVED_CONSISTENT' },
    B: { name: '报价前冲突', subtitle: '85 / 58 · 阻断冲突', spec: '58', outcome: 'BLOCKING_CONFLICT' },
    C: { name: '来源失效', subtitle: '故障注入 · 撤销结论', spec: '58', outcome: 'INPUT_INVALIDATED' }
  });
  const statuses = Object.freeze(['待核实', '已内部核实', '等待客户确认', '不适用']);
  function sources(id) {
    if (!cases[id]) throw new Error('未知预置案例');
    return [
      { id: 'SYN-INQUIRY-01', name: '合成询盘 · 技术要求', kind: '询盘摘录 / TXT', role: '询盘需求',
        lines: ['Case: SYN-PUMP-001', 'Equipment: P-101', 'Revision: R1', 'Required flow per pump: 85 m3/h', 'Head: 32 m'] },
      { id: 'SYN-SPEC-02', name: '合成规格 · 设备参数', kind: '规格摘录 / TXT', role: '设备规格',
        lines: ['Case: SYN-PUMP-001', 'Equipment: P-101', 'Revision: R1', 'Flow per pump: ' + cases[id].spec + ' m3/h', 'Head: 32 m'] }
    ];
  }
  function evaluate(id) {
    const docs = sources(id);
    const report = {
      demo_schema_version: '1.0', synthetic: true, verification_mode: 'SIMULATED', case_id: id,
      result_id: 'LOCAL-' + id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      generated_at: new Date().toISOString(), outcome: cases[id].outcome,
      object: { case: 'SYN-PUMP-001', equipment: 'P-101', revision: 'R1', head: '32 m', flow_semantics: '单泵流量' },
      candidates: docs.map((doc, i) => ({ source_id: doc.id, field: 'flow_rate', value_decimal: i ? cases[id].spec : '85', unit: 'm3/h', line: 4, quote: doc.lines[3], evidence_status: 'SIMULATED_MATCH' })),
      observations: [], findings: [], review: { status: '待核实', note: '', saved_at: null },
      draft: { text: '', saved_at: null }, final_flow: null, customer_confirmed: false, external_system_writes: 0,
      limitations: ['全部资料和结果为人工设计的合成数据。', '模拟核验不代表生产环境验收结果。', '未调用模型或真实后端；观察一致不等于资料完整或业务批准。', '仅本页内存；刷新或关闭页面将丢失未导出的演示状态。']
    };
    report.observations = report.candidates.map(c => ({ source_id: c.source_id, value_decimal: c.value_decimal, unit: c.unit }));
    if (id === 'B' || id === 'C') report.findings = [{ type: 'FLOW_VALUE_CONFLICT', values: ['85', '58'], severity: 'BLOCKING', resolution: '人工核实单泵设计流量，更新资料后重新核验。' }];
    if (id === 'C') invalidate(report);
    return report;
  }
  function invalidate(report) {
    report.outcome = 'INPUT_INVALIDATED'; report.candidates = []; report.observations = []; report.findings = [];
    report.review = { status: '待核实', note: '', saved_at: null }; report.draft = { text: '', saved_at: null };
    report.final_flow = null; report.customer_confirmed = false; report.external_system_writes = 0;
    return report;
  }
  function usable(r) { return !!r && r.outcome !== 'INPUT_INVALIDATED' && r.candidates.length === 2; }
  function draft(r) {
    if (!usable(r)) throw new Error('来源无效，需重新核验');
    const a = r.candidates[0], b = r.candidates[1];
    return r.outcome === 'BLOCKING_CONFLICT'
      ? '【合成演示 · 客户澄清草稿，尚未发送】\n关于设备 P-101（R1，扬程32 m）的单泵流量，询盘资料记载 ' + a.value_decimal + ' m³/h（' + a.source_id + '，第4行），规格资料记载 ' + b.value_decimal + ' m³/h（' + b.source_id + '，第4行）。\n请协助确认应采用的设计流量，并提供修订后的对应资料。在完成确认并重新核验前，本项报价保持阻断。'
      : '【合成演示 · 资料核实草稿，尚未发送】\n设备 P-101（R1，扬程32 m）的两份预置资料均记载单泵流量85 m³/h（SYN-INQUIRY-01、SYN-SPEC-02，第4行）。\n目前仅观察到指定资料一致，仍请人工核对资料完整性及适用工况；本记录不构成最终选型或业务批准。';
  }
  root.DemoModel = Object.freeze({ cases, statuses, sources, evaluate, invalidate, usable, draft });
})(typeof window !== 'undefined' ? window : globalThis);
