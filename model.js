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

/* V2 semantic workflow simulator. Curated synthetic proposals, never live inference. */
(function (root) {
  'use strict';
  const expressions = Object.freeze({
    direct: { raw: 'Duty point per pump: 85 m3/h at 32 m total head.', value: '85', unit: 'm3/h', rule: '直接陈述：单泵设计点 Q=85 m³/h，H=32 m。', kind: '原文事实' },
    litres: { raw: 'Each duty pump shall deliver 85000 litres/hour at 32 m total head.', value: '85', unit: 'm3/h', rule: '受控单位换算：85000 L/h ÷ 1000 = 85 m³/h；仍保留单泵及扬程条件。', kind: '受控换算' },
    capacity: { raw: 'Required pump capacity: 85 cubic metres per hour; total head at duty: 32 m.', value: '85', unit: 'm3/h', rule: '在本句明确的泵、体积流量和设计点语境下，将 pump capacity 对齐为设计流量。', kind: '语义对齐提案' }
  });
  const terms = Object.freeze([
    {id:'capacity',pair:'pump capacity ↔ 单泵体积流量',relation:'语境内等价',why:'本例已明确 cubic metres per hour 和每台运行泵；脱离单位与设备语境不可直接套用。'},
    {id:'pressure',pair:'压差 ↔ 扬程',relation:'条件可转换',why:'须确认压差、密度和测点条件；压力读数不自动等于泵总扬程。'},
    {id:'outlet',pair:'出口压力 ↔ 总扬程',relation:'上下文不足',why:'缺吸入口压力、介质密度及速度/高程等条件，不能把出口压力直接当作泵压差。'},
    {id:'maximum',pair:'最大流量 ↔ 额定/设计流量',relation:'相关但不等价',why:'最大值不证明在目标扬程、转速、叶轮及介质条件下满足设计点。'},
    {id:'power',pair:'电机额定功率 ↔ 轴功率 ↔ 水力功率',relation:'相关但不等价',why:'同为 kW 不代表相同物理量；效率、工况与功率边界必须分别核对。'},
    {id:'system',pair:'系统总流量 ↔ 单泵流量',relation:'上下文不足',why:'须核对运行台数、并联曲线与一用一备方式；不能把备用泵当作同时运行。'},
    {id:'class',pair:'PN16 ↔ Class 150',relation:'相关但不等价',why:'压力等级标准、材料和温度条件不同；本演示不进行跨标准自动等同。'}
  ]);
  function docs(mode='align', expression='direct') {
    if (!expressions[expression] || !['align','revision','pressure'].includes(mode)) throw Error('未知合成预设');
    const first = mode==='revision' ? 'Duty point per pump: 95 m3/h at 32 m total head.' : mode==='pressure' ? 'Flow per pump: 85 m3/h. Outlet pressure required: 3.2 bar(g).' : expressions[expression].raw;
    return [
      {id:'SYN-RFQ',name:'客户询盘 / 合成邮件',version:mode==='revision'?'R2':'R1',role:'当前要求',lines:['Equipment: P-201; '+(mode==='revision'?'Revision R2 supersedes R1.':'Revision R1.'),first,'Operation: one duty pump + one standby; continuous service.','Medium: 20% ethylene glycol solution at 40 C; density and viscosity not supplied.','Wetted material compatibility and NPSH margin require confirmation.']},
      {id:'SYN-CURVE-A',name:'合成型号 A / 曲线点摘录',version:'D3',role:'厂家候选资料',lines:['Model SYN-A; curve AC-03; 2900 rpm; impeller 180 mm.','Paired curve point: Q 85 m3/h, total head 32 m; test liquid water at 20 C.','Wetted parts: 316L; temperature rating 60 C.','No compatibility statement for 20% ethylene glycol at 40 C; NPSHR and efficiency not supplied.']},
      {id:'SYN-CATALOG-B',name:'合成型号 B / 目录摘要',version:'D2',role:'厂家候选资料',lines:['Model SYN-B; catalogue D2.','Flow range 70-100 m3/h; maximum head 48 m.','No paired Q-H duty point, speed or impeller specification supplied.','Wetted material, glycol suitability and NPSHR not supplied.']},
      {id:'SYN-SPEC-C',name:'合成型号 C / 规格表',version:'D1',role:'厂家候选资料',lines:['Model SYN-C; curve CC-01; 2900 rpm; impeller 175 mm.','Paired curve point: Q 85 m3/h, total head 32 m; test liquid water at 20 C.','Maximum continuous liquid temperature: 30 C.','No approved glycol correction supplied.']}
    ];
  }
  function create(mode='align', expression='direct', corrupt=false) {
    const sources=docs(mode,expression), req=sources[0], q=mode==='revision'?'95':mode==='align'&&expression==='litres'?String(85000/1000):'85';
    const reference=(doc,line)=>({source_id:doc.id,version:doc.version,line,quote:doc.lines[line-1]});
    const facts=[
      {field:'design_flow_per_pump',label:'单泵设计流量',value:q,unit:'m3/h',meaning:'设计点要求，非目录最大值',kind:mode==='align'?expressions[expression].kind:'原文事实',rule:mode==='align'?expressions[expression].rule:'按当前询盘版本提取，不复用旧版本结论。',source:reference(req,2)},
      {field:mode==='pressure'?'outlet_pressure':'total_head',label:mode==='pressure'?'出口表压（不是总扬程）':'设计点总扬程',value:mode==='pressure'?'3.2':'32',unit:mode==='pressure'?'bar(g)':'m',meaning:mode==='pressure'?'缺测点和密度，禁止直接换算为扬程':'必须与 Q 属于同一工况点',kind:'原文事实',source:reference(req,2)},
      {field:'operation',label:'运行方式',value:'一用一备',unit:null,meaning:'单台运行泵，不将备用泵计入系统总量',kind:'语义对齐提案',source:reference(req,3)},
      {field:'medium',label:'介质与温度',value:'20%乙二醇溶液 / 40',unit:'°C',meaning:'密度、黏度未提供，不沿用清水测试条件',kind:'原文事实',source:reference(req,4)}
    ];
    if(corrupt) facts[0].source.quote='Guaranteed flow: 850 m3/h';
    const evidence=facts.every(f=>{const d=sources.find(d=>d.id===f.source.source_id);return d&&d.version===f.source.version&&d.lines[f.source.line-1]===f.source.quote;});
    const r={schema_version:'semantic-demo-2.0',synthetic:true,simulation:true,mode,expression,request_revision:req.version,result_id:'SIM-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),sources,
      outcome:evidence?'ENGINEER_REVIEW_REQUIRED':'UNVERIFIABLE_EVIDENCE',facts:evidence?facts:[],proposed_facts:facts,evidence_status:evidence?'SIMULATED_QUOTE_MATCH':'REJECTED_QUOTE',observations:[],findings:[],candidates:[],clarifications:[],audit:[],review:{status:'待工程师复核',note:''},draft:'',final_model:null,customer_confirmed:false,external_writes:0,
      limitations:['纯合成预设与本地确定性模拟；未调用模型或 A3 后端。','曲线摘录不等于实际工况、系统曲线、NPSH、材料和性能保证已获证实。','没有真实模型准确率、成本或工时改善测量。']};
    if(!evidence){r.findings=[{type:'QUOTE_MISMATCH',message:'语义提案引用与合成原文不一致，整批拒绝进入候选对照。'}];return r;}
    const cite=(id,line)=>reference(sources.find(d=>d.id===id),line);
    r.observations=facts.map(f=>({field:f.field,value:f.value,source:f.source}));
    const unknownPoint=mode!=='align';
    r.candidates=[
      {id:'SYN-A',name:'合成型号 A',status:unknownPoint?'INSUFFICIENT_EVIDENCE':'CONDITIONAL',label:unknownPoint?'证据不足 · 需重核工况':'条件性候选 · 待工程师确认',supported:'同一曲线摘录明确配对 Q85 / H32，2900 rpm、叶轮180 mm、清水20°C。',gap:mode==='revision'?'R2 要求95，旧85/32点不再支持当前目标；必须索取新曲线点。':mode==='pressure'?'3.2 bar(g) 是出口表压；未证明目标总扬程，不能与32 m直接对照。':'曲线介质为清水20°C，客户为乙二醇40°C；仍缺介质修正、材料适用性、效率/功率及NPSH核验。',evidence:[cite('SYN-CURVE-A',2),cite('SYN-CURVE-A',4),cite('SYN-RFQ',2),cite('SYN-RFQ',4)]},
      {id:'SYN-B',name:'合成型号 B',status:'INSUFFICIENT_EVIDENCE',label:'证据不足 · 不凭范围推荐',supported:'目录给出70–100 m³/h范围、最大扬程48 m。',gap:'数值范围包含目标流量，但没有同一转速/叶轮/介质下的Q-H配对点；不能把最大流量和最大扬程拼接。',evidence:[cite('SYN-CATALOG-B',2),cite('SYN-CATALOG-B',3)]},
      {id:'SYN-C',name:'合成型号 C',status:'EXCLUDED',label:'排除 · 触及明确温度硬约束',supported:'资料给出Q85 / H32配对点；这不覆盖所有工况限制。',gap:'规格最大连续温度30°C，低于客户要求40°C；本合成规则据此排除，排名或文本相似度不能覆盖硬约束。',evidence:[cite('SYN-SPEC-C',3),cite('SYN-RFQ',4)]}
    ];
    r.findings=[{type:'CONDITION_MISMATCH',message:'清水曲线与乙二醇实际工况不能直接等同。'},{type:'RANGE_NOT_DUTY_POINT',message:'目录范围不能证明指定Q-H组合。'},{type:'TEMPERATURE_LIMIT',message:'SYN-C 温度硬约束不满足。'}];
    r.clarifications=[
      mode==='pressure'?'请提供吸入口压力、介质密度及压力测点/高程等条件，以核定泵总扬程。':mode==='revision'?'请确认R2的单泵95 m³/h要求，并提供对应32 m扬程的当前曲线。':'请提供目标85 m³/h、32 m的指定转速/叶轮曲线及介质适用性说明。',
      '请确认20%乙二醇在40°C下的密度、黏度及接液材料/密封适用性。',
      '请提供安装侧NPSHA与厂家NPSHR、效率/功率及允许运行区域，供工程师核验。'
    ];
    return r;
  }
  function usable(r){return !!r&&r.evidence_status==='SIMULATED_QUOTE_MATCH'&&r.outcome==='ENGINEER_REVIEW_REQUIRED';}
  function invalidate(r){r.outcome='INPUT_INVALIDATED';r.evidence_status='INVALIDATED';for(const k of ['facts','proposed_facts','observations','findings','candidates','clarifications','audit'])r[k]=[];r.review={status:'待工程师复核',note:''};r.draft='';r.final_model=null;r.customer_confirmed=false;r.external_writes=0;return r;}
  function draft(r){if(!usable(r))throw Error('无有效模拟证据，请重新核验');return '【合成演示 · 待人工审核，尚未发送】\n设备P-201 / '+r.request_revision+'：询盘原文“'+r.sources[0].lines[1]+'”（SYN-RFQ，第2行）。\n候选A仅有清水测试点，尚需确认乙二醇工况及材料适用性；候选B缺Q-H配对点；候选C的30°C上限不满足40°C要求。\n'+r.clarifications.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n以上为待确认问题，不构成选型、性能或报价承诺。';}
  const golden=Object.freeze([
    {id:'G01',task:'等价表达',name:'单泵设计流量直接表达',expected:'85',run:()=>create().facts[0].value},
    {id:'G02',task:'受控换算',name:'85000 L/h保留换算链',expected:'85',run:()=>create('align','litres').facts[0].value},
    {id:'G03',task:'语义对齐',name:'capacity在明确体积流量语境',expected:'语义对齐提案',run:()=>create('align','capacity').facts[0].kind},
    {id:'G04',task:'概念边界',name:'出口表压不能直接当扬程',expected:'outlet_pressure',run:()=>create('pressure').facts[1].field},
    {id:'G05',task:'需求对照',name:'清水曲线只形成条件性候选',expected:'CONDITIONAL',run:()=>create().candidates[0].status},
    {id:'G06',task:'候选初筛',name:'目录范围不可当设计点证明',expected:'INSUFFICIENT_EVIDENCE',run:()=>create().candidates[1].status},
    {id:'G07',task:'硬约束',name:'30°C上限不能满足40°C',expected:'EXCLUDED',run:()=>create().candidates[2].status},
    {id:'G08',task:'版本影响',name:'R2要求95，撤销旧点支持',expected:'INSUFFICIENT_EVIDENCE',run:()=>create('revision').candidates[0].status},
    {id:'G09',task:'证据门禁',name:'篡改quote整批拒绝',expected:'UNVERIFIABLE_EVIDENCE',run:()=>create('align','direct',true).outcome},
    {id:'G10',task:'失效撤销',name:'失效后候选清零',expected:0,run:()=>invalidate(create()).candidates.length},
    {id:'G11',task:'错误等同',name:'PN/Class不自动等同',expected:'相关但不等价',run:()=>terms.find(t=>t.id==='class').relation},
    {id:'G12',task:'人工边界',name:'无最终型号、无客户确认',expected:'null/false/0',run:()=>{const r=create();return [r.final_model,r.customer_confirmed,r.external_writes].map(String).join('/');}}
  ]);
  function evalGolden(cases=golden){return cases.map(g=>{let actual;try{actual=g.run();return {id:g.id,task:g.task,name:g.name,expected:g.expected,actual,pass:actual===g.expected};}catch(_){return {id:g.id,task:g.task,name:g.name,expected:g.expected,actual:null,pass:false,error:'本地模拟执行失败'};}});}
  root.SemanticDemo=Object.freeze({expressions,terms,docs,create,usable,invalidate,draft,golden,evalGolden});
})(typeof window!=='undefined'?window:globalThis);
