import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DeviationDetector, QualityLogModule } from "./modules.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/operation-traces.json", import.meta.url), "utf8"));
const detector = new DeviationDetector();
const logModule = new QualityLogModule();

export function replayTrace(trace, { alertsEnabled = true, events = trace.operationEvents } = {}) {
  const alerts = [];
  if (alertsEnabled) {
    for (const event of events) {
      const rule = fixture.regionRules.find((item) => item.id === event.regionId);
      const alert = detector.detectEvent(trace.treatmentPlan, event, rule);
      if (alert) alerts.push({ ...alert, regionId: event.regionId });
    }
    alerts.push(...detector.detectMissed(trace.treatmentPlan, events));
  }
  const log = logModule.generate(trace.treatmentPlan, events, alerts, Date.now(), fixture.regionRules);
  return { events, alerts, log };
}

const results = [];
for (const trace of fixture.traces) {
  const replay = replayTrace(trace);
  assert.equal(replay.log.coverageRate, trace.expectedCoverage, `${trace.id} coverage`);
  assert.deepEqual(replay.log.missedRegions, trace.expectedMissedRegions, `${trace.id} missed regions`);
  assert.equal(replay.log.suspectedRestrictedCount, trace.expectedRestrictedAlerts, `${trace.id} restricted alerts`);
  for (const [field, expected] of Object.entries(trace.expectedQualityLog)) {
    assert.equal(replay.log[field], expected, `${trace.id} ${field}`);
  }
  results.push({ id: trace.id, name: trace.name, status: "通过", coverageRate: replay.log.coverageRate, missedCount: replay.log.missedCount, restrictedAlerts: replay.log.suspectedRestrictedCount, regionDeviationRate: replay.log.regionDeviationRate, deviationEventRate: replay.log.deviationEventRate });
}

const errorTrace = fixture.traces.find((trace) => trace.id === "T4");
const withoutAlerts = replayTrace(errorTrace, { alertsEnabled: false });
const withAlerts = replayTrace(errorTrace, { alertsEnabled: true });
assert.deepEqual(withoutAlerts.events, withAlerts.events, "同轨迹事件必须一致");
assert.equal(withoutAlerts.alerts.length, 0);
assert.ok(withAlerts.alerts.length > 0);
assert.equal(withoutAlerts.log.totalEventCount, withAlerts.log.totalEventCount);

const missedTrace = fixture.traces.find((trace) => trace.id === "T2");
const beforeCorrection = replayTrace(missedTrace);
const correctionEvent = {
  id: "synthetic-correction-c",
  treatmentPlanId: missedTrace.treatmentPlan.id,
  eventType: "region_completed",
  regionId: "c",
  timestamp: "2026-01-01T00:00:03.000Z",
  source: "simulation",
  metadata: { syntheticAssumption: "received_alert_then_corrected" }
};
const afterCorrection = replayTrace(missedTrace, { events: [...missedTrace.operationEvents, correctionEvent] });
assert.equal(beforeCorrection.log.coverageRate, 67);
assert.equal(afterCorrection.log.coverageRate, 100);
assert.equal(beforeCorrection.log.regionDeviationRate, 33.3);
assert.equal(afterCorrection.log.regionDeviationRate, 0);

console.log(JSON.stringify({
  disclaimer: fixture.disclaimer,
  traceResults: results,
  sameTraceComparison: {
    operationEventsEqual: true,
    withoutAgentAlerts: withoutAlerts.alerts.length,
    withAgentAlerts: withAlerts.alerts.length,
    totalEventCountBoth: withAlerts.log.totalEventCount
  },
  syntheticCorrection: {
    assumption: "收到提示后补充完成事件；合成行为模拟，不是真实用户测试。",
    before: { coverageRate: beforeCorrection.log.coverageRate, regionDeviationRate: beforeCorrection.log.regionDeviationRate },
    after: { coverageRate: afterCorrection.log.coverageRate, regionDeviationRate: afterCorrection.log.regionDeviationRate }
  }
}, null, 2));
