import assert from "node:assert/strict";
import {
  AlertModule, DeviationDetector, InputModule, OperationEventModule, QualityLogModule,
  RegionRuleModule, TreatmentPlanModule, ValidationRecordModule
} from "./modules.js";

const planModule = new TreatmentPlanModule();
const input = new InputModule();
const detector = new DeviationDetector();
const logModule = new QualityLogModule();
const rules = [
  { id: "a", name: "区域A", ruleType: "allowed" }, { id: "b", name: "区域B", ruleType: "allowed" },
  { id: "c", name: "区域C", ruleType: "allowed" }, { id: "r", name: "预设禁区R", ruleType: "restricted" }
];
const createPlan = (allowedRegions = ["a", "b", "c"], restrictedRegions = ["r"]) => planModule.create({ operator: "测试代码", treatmentType: "demo", allowedRegions, restrictedRegions, notes: "synthetic" });
const event = (plan, eventType, regionId, id = `${eventType}-${regionId}`) => ({ ...input.createManualEvent({ treatmentPlanId: plan.id, eventType, regionId }), id, source: "simulation" });
const analyze = (plan, events, eventAlerts = []) => {
  const alerts = [...eventAlerts, ...detector.detectMissed(plan, events)];
  return logModule.generate(plan, events, alerts, Date.now(), rules);
};
const results = [];
async function test(name, inputSummary, expectedSummary, execute) {
  try {
    const actual = await execute();
    results.push({ test: name, input: inputSummary, expected: expectedSummary, actual, status: "通过" });
  } catch (error) {
    results.push({ test: name, input: inputSummary, expected: expectedSummary, actual: error.message, status: "失败" });
  }
}

await test("01 所有计划区域完成", "计划a/b/c；完成a/b/c", "覆盖100%；漏打0；区域偏差0%", () => {
  const plan = createPlan(); const events = [event(plan, "region_completed", "a"), event(plan, "region_completed", "b"), event(plan, "region_completed", "c")]; const log = analyze(plan, events);
  assert.deepEqual([log.coverageRate, log.missedCount, log.regionDeviationRate, log.deviationEventRate], [100, 0, 0, 0]); return "100%, 0, 0%, 0%";
});
await test("02 一个区域漏打", "计划a/b/c；完成a/b", "覆盖67%；漏打c；区域偏差33.3%", () => {
  const plan = createPlan(); const log = analyze(plan, [event(plan, "region_completed", "a"), event(plan, "region_completed", "b")]);
  assert.deepEqual([log.coverageRate, log.missedRegions, log.regionDeviationRate], [67, ["区域C"], 33.3]); return "67%, 区域C, 33.3%";
});
await test("03 多个区域漏打", "计划a/b/c；仅完成a", "覆盖33%；漏打b/c；区域偏差66.7%", () => {
  const plan = createPlan(); const log = analyze(plan, [event(plan, "region_completed", "a")]);
  assert.deepEqual([log.coverageRate, log.missedCount, log.regionDeviationRate], [33, 2, 66.7]); return "33%, 2, 66.7%";
});
await test("04 疑似进入禁区", "完成a；触发r", "即时Alert；疑似越界1；事件率50%", () => {
  const plan = createPlan(); const restricted = event(plan, "restricted_area", "r"); const alert = { ...detector.detectEvent(plan, restricted, rules[3]), regionId: "r" }; const log = analyze(plan, [event(plan, "region_completed", "a"), restricted], [alert]);
  assert.equal(alert.message, "记录到疑似进入预设禁区，请人工复核。"); assert.equal(log.suspectedRestrictedCount, 1); assert.equal(log.deviationEventRate, 50); return "Alert生成, 1, 50%";
});
await test("05 同一区域重复操作", "完成a两次、b/c一次", "事件4；覆盖仍100%", () => {
  const plan = createPlan(); const log = analyze(plan, [event(plan, "region_completed", "a", "a1"), event(plan, "region_completed", "a", "a2"), event(plan, "region_completed", "b"), event(plan, "region_completed", "c")]);
  assert.deepEqual([log.totalEventCount, log.coverageRate], [4, 100]); return "4, 100%";
});
await test("06 越界后撤销", "完成a；触发r；撤销r", "事件回退1；越界提示回退0", () => {
  const plan = createPlan(); const events = new OperationEventModule(); const alerts = new AlertModule(); events.add(event(plan, "region_completed", "a")); const restricted = events.add(event(plan, "restricted_area", "r")); alerts.add(detector.detectEvent(plan, restricted, rules[3])); const removed = events.undo(); alerts.removeByRelatedEvent(removed.id);
  assert.deepEqual([events.list().length, alerts.list().length], [1, 0]); return "1事件, 0提示";
});
await test("07 漏打和越界同时出现", "完成a；触发r；b/c未完成", "漏打2；越界1；区域偏差66.7%；事件率50%", () => {
  const plan = createPlan(); const restricted = event(plan, "restricted_area", "r"); const alert = { ...detector.detectEvent(plan, restricted, rules[3]), regionId: "r" }; const log = analyze(plan, [event(plan, "region_completed", "a"), restricted], [alert]);
  assert.deepEqual([log.missedCount, log.suspectedRestrictedCount, log.regionDeviationRate, log.deviationEventRate], [2, 1, 66.7, 50]); return "2, 1, 66.7%, 50%";
});
await test("08 计划区域为空", "allowedRegions=[]", "覆盖0；区域偏差不可计算；不生成漏打", () => {
  const plan = createPlan([]); const log = analyze(plan, []); assert.deepEqual([log.coverageRate, log.regionDeviationRate, log.missedCount], [0, null, 0]); return "0%, 暂无计划区域计算, 0";
});
await test("09 总操作事件为0", "有计划；无事件", "偏差事件率不可计算", () => {
  const plan = createPlan(); const log = analyze(plan, []); assert.equal(log.deviationEventRate, null); return "暂无足够事件计算";
});
await test("10 重开后旧数据不污染", "保存旧快照后clearStorage", "事件0；旧会话键删除", () => {
  const store = new Map(); global.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k,v) => store.set(k,v), removeItem: (k) => store.delete(k) }; const plan = createPlan(); const events = new OperationEventModule("session-test"); events.add(event(plan, "region_completed", "a")); events.save({ events: events.list() }); events.reset({ clearStorage: true }); assert.equal(events.list().length, 0); assert.equal(store.has("session-test"), false); return "0事件, 存储键已删除";
});
await test("11 日志和CSV字段一致", "T2质量日志转验证记录", "关键指标逐字段一致", () => {
  const plan = createPlan(); const log = analyze(plan, [event(plan, "region_completed", "a"), event(plan, "region_completed", "b")]); const records = new ValidationRecordModule("records-test"); const record = records.create({ condition: "with_agent", participantId: "synthetic-record", plannedRegionCount: log.plannedRegions.length, completedRegionCount: log.completedRegions.length, missedRegionCount: log.missedCount, suspectedRestrictedCount: log.suspectedRestrictedCount, coverageRate: log.coverageRate, regionDeviationRate: log.regionDeviationRate, deviationEventRate: log.deviationEventRate, duration: log.duration, alertUnderstood: "not_applicable", alertDisruptive: "not_applicable", familiarity: "first_use", willingnessScore: 1, notes: "schema test only", testDate: "2026-01-01" }); const csv = records.toCsv([record]); assert.equal(record.coverageRate, log.coverageRate); assert.equal(record.regionDeviationRate, log.regionDeviationRate); assert.match(csv, /plannedRegionCount/); assert.match(csv, /deviationEventRate/); return "覆盖率/区域偏差率一致，CSV字段完整";
});
await test("12 配置变化后检测正常", "动态配置x/y允许、z禁区", "规则查询、漏打y、禁区提示正常", () => {
  const dynamic = new RegionRuleModule([{ id: "changed", name: "changed", regions: [{ id: "x", name: "X", ruleType: "allowed" }, { id: "y", name: "Y", ruleType: "allowed" }, { id: "z", name: "Z", ruleType: "restricted" }] }]); const changedRules = dynamic.getRules("changed"); const plan = planModule.create({ operator: "test", treatmentType: "changed", allowedRegions: ["x", "y"], restrictedRegions: ["z"], notes: "" }); const restricted = event(plan, "restricted_area", "z"); const alert = detector.detectEvent(plan, restricted, dynamic.getRule("changed", "z")); const missed = detector.detectMissed(plan, [event(plan, "region_completed", "x"), restricted]); assert.equal(changedRules.length, 3); assert.equal(missed[0].regionId, "y"); assert.ok(alert); return "3规则, 漏打y, 禁区Alert";
});

console.table(results);
const failed = results.filter((result) => result.status === "失败");
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
