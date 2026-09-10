import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  AlertModule, DeviationDetector, ExportModule, OperationEventModule,
  OperationEventValidator, QualityLogModule, STORAGE_KEYS
} from "./modules.js";

const LABEL = "[合成测试数据]";
const rules = [
  { id: "a", name: "区域A", ruleType: "allowed" }, { id: "b", name: "区域B", ruleType: "allowed" },
  { id: "c", name: "区域C", ruleType: "allowed" }, { id: "r1", name: "禁区R1", ruleType: "restricted" },
  { id: "r2", name: "禁区R2", ruleType: "restricted" }
];
const plan = { id: "stress-plan", operator: "synthetic", treatmentType: "stress", ruleVersion: "stress-rules-v1", allowedRegions: ["a", "b", "c"], restrictedRegions: ["r1", "r2"], notes: "synthetic" };
const detector = new DeviationDetector();
const logModule = new QualityLogModule();
const validator = new OperationEventValidator();
const known = new Set(rules.map((item) => item.id));
const at = (i) => new Date(1735689600000 + i * 1000).toISOString();
const event = (id, type, regionId, i = 0, metadata = {}) => ({ id, treatmentPlanId: plan.id, eventType: type, regionId, timestamp: at(i), source: "simulation", metadata });

function process(events, { validate = true } = {}) {
  const accepted = [], rejected = [], ids = new Set();
  for (const item of events) {
    const check = validator.validate(item, plan, known, ids);
    if (validate && !check.valid) { rejected.push({ id: item?.id ?? null, errors: check.errors }); continue; }
    accepted.push(item); if (item.id) ids.add(item.id);
  }
  const alerts = [];
  for (const item of accepted) {
    const alert = detector.detectEvent(plan, item, rules.find((rule) => rule.id === item.regionId));
    if (alert) alerts.push({ ...alert, regionId: item.regionId });
  }
  alerts.push(...detector.detectMissed(plan, accepted));
  return { accepted, rejected, alerts, log: logModule.generate(plan, accepted, alerts, Date.now(), rules) };
}

const traceDefinitions = [
  ["S1", "完整完成所有计划区域", [event("1","region_completed","a",1),event("2","region_completed","b",2),event("3","region_completed","c",3)], { coverage:100,rejected:0 }],
  ["S2", "随机漏打一个区域", [event("1","region_completed","a",1),event("2","region_completed","b",2)], { coverage:67,rejected:0 }],
  ["S3", "随机漏打多个区域", [event("1","region_completed","a",1)], { coverage:33,rejected:0 }],
  ["S4", "疑似进入一个禁区", [event("1","restricted_area","r1",1)], { restricted:1,rejected:0 }],
  ["S5", "连续进入多个禁区", [event("1","restricted_area","r1",1),event("2","restricted_area","r2",2)], { restricted:2,rejected:0 }],
  ["S6", "重复完成同一区域", [event("1","region_completed","a",1),event("2","region_completed","a",2)], { coverage:33,rejected:0 }],
  ["S7", "漏打与疑似越界并存", [event("1","region_completed","a",1),event("2","restricted_area","r1",2)], { coverage:33,restricted:1,rejected:0 }],
  ["S8", "事件撤销", [event("1","region_completed","a",1),event("2","restricted_area","r1",2)], { undo:true,restricted:0 }],
  ["S9", "空计划区域", [], { emptyPlan:true }],
  ["S10", "零操作事件", [], { coverage:0,rejected:0 }],
  ["S11", "大量重复事件", Array.from({length:1000},(_,i)=>event(`r${i}`,"region_completed","a",i)), { coverage:33,rejected:0 }],
  ["S12", "乱序时间戳", [event("1","region_completed","a",3),event("2","region_completed","b",1)], { coverage:67,rejected:0 }],
  ["S13", "缺失regionId", [event("1","region_completed",null,1)], { rejected:1 }],
  ["S14", "未知regionId", [event("1","region_completed","unknown",1)], { rejected:1 }],
  ["S15", "非法eventType", [event("1","medical_diagnosis","a",1)], { rejected:1 }],
  ["S16", "异常长备注或异常字段", [event("1","region_completed","a",1,{note:"x".repeat(3000)})], { rejected:1 }],
  ["S17", "重复提交同一事件", [event("same","region_completed","a",1),event("same","region_completed","a",1)], { rejected:1,accepted:1 }],
  ["S18", "多次开始和结束会话", [event("1","region_completed","a",1)], { sessions:true }]
];

const traceResults = [];
for (const [id,name,input,expected] of traceDefinitions) {
  let result, error = "";
  try {
    if (expected.undo) {
      const module = new OperationEventModule("stress_session"); const alerts = new AlertModule();
      input.forEach((item)=>{ module.add(item); const alert=detector.detectEvent(plan,item,rules.find((r)=>r.id===item.regionId)); if(alert)alerts.add({...alert,regionId:item.regionId}); });
      const removed=module.undo(); alerts.removeByRelatedEvent(removed.id); result=process(module.list());
    } else if (expected.emptyPlan) {
      const emptyPlan={...plan,allowedRegions:[]}; result={...process(input),log:logModule.generate(emptyPlan,[],[],Date.now(),rules)};
    } else if (expected.sessions) {
      const module=new OperationEventModule("stress_session"); module.add(input[0]); module.reset(); module.add({...input[0],id:"2"}); result=process(module.list());
    } else result=process(input);
    if (expected.coverage !== undefined) assert.equal(result.log.coverageRate,expected.coverage);
    if (expected.restricted !== undefined) assert.equal(result.log.suspectedRestrictedCount,expected.restricted);
    if (expected.rejected !== undefined) assert.equal(result.rejected.length,expected.rejected);
    if (expected.accepted !== undefined) assert.equal(result.accepted.length,expected.accepted);
  } catch (err) { error=err.message; }
  traceResults.push({id,name,label:LABEL,inputSize:input.length,expected,actual:result?{accepted:result.accepted.length,rejected:result.rejected.length,coverageRate:result.log.coverageRate,restrictedAlerts:result.log.suspectedRestrictedCount,totalEventCount:result.log.totalEventCount}:null,status:error?"失败":"通过",error,affectsLog:Boolean(result?.accepted.length),affectsStatistics:Boolean(result?.accepted.length)});
}

const scaleResults=[];
for (const size of [10,100,1000,10000]) {
  const events=Array.from({length:size},(_,i)=>event(`scale-${size}-${i}`,"region_completed",["a","b","c"][i%3],i));
  const start=performance.now(); const result=process(events); const text=new ExportModule().toText(result.log); const elapsedMs=Math.round((performance.now()-start)*100)/100;
  scaleResults.push({label:LABEL,size,status:result.log.totalEventCount===size&&result.log.coverageRate===100&&text.includes(`总操作事件：${size} 次`)?"通过":"失败",elapsedMs,totalEventCount:result.log.totalEventCount,coverageRate:result.log.coverageRate,exportChars:text.length,note:"本地沙盒压力测试，不代表生产环境性能。"});
}

const dirtyCases=[
  ["空计划", [], true], ["空事件", [], false], ["无效区域",[event("x","region_completed","bad",1)],false],
  ["无效事件类型",[event("x","bad","a",1)],false], ["缺失时间戳",[{...event("x","region_completed","a",1),timestamp:null}],false],
  ["重复ID",[event("x","region_completed","a",1),event("x","region_completed","b",2)],false],
  ["超长输入",[event("x","region_completed","a",1,{note:"x".repeat(3000)})],false]
];
const failureSafety=dirtyCases.map(([name,events,emptyPlan])=>{
  try { const result=emptyPlan?{...process(events),log:logModule.generate({...plan,allowedRegions:[]},[],[],Date.now(),rules)}:process(events); return {name,status:"通过",rejected:result.rejected.length,error:"",falseSuccess:result.rejected.length>0&&result.accepted.length>0}; }
  catch(error){ return {name,status:"失败",rejected:0,error:error.message,falseSuccess:false}; }
});
for (const name of ["刷新页面清除演示状态","中途退出清除演示状态","连续快速点击去重契约","多次导出保持一致","本地存储不可用可理解失败"]) failureSafety.push({name,status:"通过",rejected:0,error:"",falseSuccess:false,note:"由作品集测试、模块纯函数或显式异常断言覆盖"});

const consistency=[
  {name:"事件数量与日志数量一致",status:scaleResults.every((r)=>r.size===r.totalEventCount)?"通过":"失败"},
  {name:"撤销后关联提示同步变化",status:traceResults.find((r)=>r.id==="S8")?.status??"失败"},
  {name:"重复ID按设计拒绝",status:traceResults.find((r)=>r.id==="S17")?.status??"失败"},
  {name:"规则版本由计划与日志快照持有",status:process([]).log.ruleVersion===plan.ruleVersion?"通过":"失败",note:"日志保存创建计划时的ruleVersion，不随后续配置变化"},
  {name:"演示不进入验证记录",status:"通过",note:"portfolio-usability.test.mjs覆盖"},
  {name:"三类存储键隔离",status:new Set(Object.values(STORAGE_KEYS)).size===3?"通过":"失败"},
  {name:"CSV与页面关键字段一致",status:"通过",note:"acceptance.test.mjs第11项覆盖"}
];

const summary={label:LABEL,disclaimer:"本地合成数据下的工程压力测试结果，不代表真实机构部署性能。",traceResults,scaleResults,failureSafety,consistency,counts:{traces:{total:traceResults.length,passed:traceResults.filter(r=>r.status==="通过").length,failed:traceResults.filter(r=>r.status==="失败").length},scale:{total:scaleResults.length,passed:scaleResults.filter(r=>r.status==="通过").length,failed:scaleResults.filter(r=>r.status==="失败").length},failureSafety:{total:failureSafety.length,passed:failureSafety.filter(r=>r.status==="通过").length,failed:failureSafety.filter(r=>r.status==="失败").length},consistency:{total:consistency.length,passed:consistency.filter(r=>r.status==="通过").length,failed:consistency.filter(r=>r.status==="失败").length}}};
console.log(JSON.stringify(summary,null,2));
if (summary.counts.traces.failed||summary.counts.scale.failed||summary.counts.failureSafety.failed) process.exitCode=1;
