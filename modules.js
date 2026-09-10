const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export const STORAGE_KEYS = Object.freeze({
  demo: "demo_state",
  treatment: "treatment_session",
  validation: "validation_records"
});

export class DemoStateModule {
  constructor(storageKey = STORAGE_KEYS.demo) {
    this.storageKey = storageKey;
  }

  start(snapshot = {}) {
    const demoState = { ...snapshot, active: true, source: "synthetic_operation_trace", startedAt: nowIso() };
    sessionStorage.setItem(this.storageKey, JSON.stringify(demoState));
    return demoState;
  }

  save(snapshot) {
    if (!this.isActive()) return;
    sessionStorage.setItem(this.storageKey, JSON.stringify({ ...snapshot, active: true, source: "synthetic_operation_trace" }));
  }

  isActive() {
    try {
      return JSON.parse(sessionStorage.getItem(this.storageKey) ?? "null")?.active === true;
    } catch {
      return false;
    }
  }

  clear() {
    sessionStorage.removeItem(this.storageKey);
  }
}

export class RegionRuleModule {
  constructor(configs) {
    this.configs = configs;
  }

  listTreatments() {
    return this.configs.map(({ id, name, description, ruleVersion }) => ({ id, name, description, ruleVersion }));
  }

  getRules(treatmentType) {
    return this.configs.find((item) => item.id === treatmentType)?.regions.map((rule) => ({ ...rule })) ?? [];
  }

  getRule(treatmentType, regionId) {
    return this.getRules(treatmentType).find((rule) => rule.id === regionId) ?? null;
  }
}

export class TreatmentPlanModule {
  create({ operator, treatmentType, allowedRegions, restrictedRegions, notes, ruleVersion = "unversioned" }) {
    return {
      id: createId("plan"),
      ruleVersion,
      operator: operator.trim() || "未填写",
      treatmentType,
      allowedRegions: [...allowedRegions],
      restrictedRegions: [...restrictedRegions],
      createdAt: nowIso(),
      notes: notes.trim()
    };
  }
}

export class InputModule {
  createManualEvent({ treatmentPlanId, eventType, regionId = null, metadata = {} }) {
    return {
      id: createId("event"),
      treatmentPlanId,
      eventType,
      regionId,
      timestamp: nowIso(),
      source: "manual",
      metadata: { ...metadata }
    };
  }
}

export class OperationEventValidator {
  constructor({ allowedEventTypes = ["region_completed", "restricted_area", "missed_area"], maxTextLength = 2000 } = {}) {
    this.allowedEventTypes = new Set(allowedEventTypes);
    this.maxTextLength = maxTextLength;
  }

  validate(event, plan, knownRegionIds, existingIds = new Set()) {
    const errors = [];
    if (!event || typeof event !== "object") return { valid: false, errors: ["事件必须是对象"] };
    if (!event.id || existingIds.has(event.id)) errors.push(event.id ? "事件ID重复" : "缺少事件ID");
    if (!this.allowedEventTypes.has(event.eventType)) errors.push("无效事件类型");
    if (!event.regionId) errors.push("缺少regionId");
    else if (!knownRegionIds.has(event.regionId)) errors.push("未知regionId");
    if (!event.timestamp || Number.isNaN(Date.parse(event.timestamp))) errors.push("缺失或无效时间戳");
    if (event.treatmentPlanId !== plan?.id) errors.push("治疗计划ID不匹配");
    const text = JSON.stringify(event.metadata ?? {});
    if (text.length > this.maxTextLength) errors.push("事件附加字段过长");
    return { valid: errors.length === 0, errors };
  }
}

export class OperationEventModule {
  constructor(storageKey = STORAGE_KEYS.treatment) {
    this.storageKey = storageKey;
    this.events = [];
  }

  reset({ clearStorage = false } = {}) {
    this.events = [];
    if (clearStorage && typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }

  add(event) {
    this.events.push(event);
    return event;
  }

  undo() {
    return this.events.pop() ?? null;
  }

  list() {
    return this.events.map((event) => ({ ...event, metadata: { ...event.metadata } }));
  }

  save(snapshot) {
    localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
  }
}

export class DeviationDetector {
  detectEvent(plan, event, regionRule) {
    if (event.eventType === "restricted_area" || regionRule?.ruleType === "restricted") {
      return {
        id: createId("alert"),
        treatmentPlanId: plan.id,
        alertType: "suspected_restricted_area",
        message: "记录到疑似进入预设禁区，请人工复核。",
        relatedEventId: event.id,
        timestamp: nowIso(),
        status: "pending"
      };
    }
    return null;
  }

  detectMissed(plan, events) {
    const completed = new Set(
      events.filter((event) => event.eventType === "region_completed").map((event) => event.regionId)
    );
    const manuallyMissed = new Map(
      events.filter((event) => event.eventType === "missed_area").map((event) => [event.regionId, event])
    );
    return plan.allowedRegions
      .filter((regionId) => !completed.has(regionId))
      .map((regionId) => ({
        id: createId("alert"),
        treatmentPlanId: plan.id,
        alertType: "missed_area",
        message: "计划区域未记录完成事件，提示疑似漏打，待人工复核。",
        relatedEventId: manuallyMissed.get(regionId)?.id ?? null,
        regionId,
        timestamp: nowIso(),
        status: "pending"
      }));
  }
}

export class AlertModule {
  constructor() {
    this.alerts = [];
  }

  reset() {
    this.alerts = [];
  }

  add(alert) {
    if (alert) this.alerts.push(alert);
    return alert;
  }

  addMany(alerts) {
    alerts.forEach((alert) => this.add(alert));
  }

  removeByRelatedEvent(eventId) {
    this.alerts = this.alerts.filter((alert) => alert.relatedEventId !== eventId);
  }

  list() {
    return this.alerts.map((alert) => ({ ...alert }));
  }
}

export class QualityLogModule {
  generate(plan, events, alerts, startedAt, regionRules) {
    const completedIds = new Set(
      events.filter((event) => event.eventType === "region_completed").map((event) => event.regionId)
    );
    const completedRegions = plan.allowedRegions.filter((id) => completedIds.has(id));
    const missedRegions = plan.allowedRegions.filter((id) => !completedIds.has(id));
    const nameOf = (id) => regionRules.find((rule) => rule.id === id)?.name ?? id;
    const coverageRate = plan.allowedRegions.length
      ? Math.round((completedRegions.length / plan.allowedRegions.length) * 100)
      : 0;
    const missedCount = alerts.filter((alert) => alert.alertType === "missed_area").length;
    const restrictedAlerts = alerts.filter((alert) => alert.alertType === "suspected_restricted_area");
    const suspectedRestrictedCount = restrictedAlerts.length;
    const totalEventCount = events.length;
    const affectedRegionIds = new Set([
      ...missedRegions,
      ...restrictedAlerts.map((alert) => alert.regionId).filter((regionId) => plan.allowedRegions.includes(regionId))
    ]);
    const regionDeviationRate = plan.allowedRegions.length
      ? Math.round((affectedRegionIds.size / plan.allowedRegions.length) * 1000) / 10
      : null;
    const explicitDeviationEventCount = events.filter((event) =>
      event.eventType === "restricted_area" || (event.eventType !== "region_completed" && event.eventType !== "missed_area")
    ).length;
    const deviationEventRate = totalEventCount
      ? Math.round((explicitDeviationEventCount / totalEventCount) * 1000) / 10
      : null;
    const deviationRate = totalEventCount
      ? Math.round(((missedCount + suspectedRestrictedCount) / totalEventCount) * 1000) / 10
      : null;

    const eventSources = [...new Set(events.map((event) => event.source).filter(Boolean))];
    const sourceBreakdown = events.reduce((counts, event) => {
      const source = event.source || "unknown";
      counts[source] = (counts[source] || 0) + 1;
      return counts;
    }, {});

    return {
      treatmentPlanId: plan.id,
      treatmentType: plan.treatmentType,
      ruleVersion: plan.ruleVersion ?? "unversioned",
      operator: plan.operator,
      plannedRegions: plan.allowedRegions.map(nameOf),
      completedRegions: completedRegions.map(nameOf),
      missedRegions: missedRegions.map(nameOf),
      restrictedRegions: plan.restrictedRegions.map(nameOf),
      coverageRate,
      missedCount,
      suspectedRestrictedCount,
      totalEventCount,
      eventSources,
      sourceBreakdown,
      regionDeviationRate,
      deviationEventRate,
      explicitDeviationEventCount,
      deviationRate,
      duration: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      alerts: alerts.map((alert) => ({ ...alert })),
      unresolvedItems: alerts.filter((alert) => alert.status === "pending").map((alert) => alert.message),
      notes: plan.notes,
      generatedAt: nowIso()
    };
  }
}

export class ValidationRecordModule {
  constructor(storageKey = STORAGE_KEYS.validation) {
    this.storageKey = storageKey;
  }

  list() {
    if (typeof localStorage === "undefined") return [];
    try {
      const records = JSON.parse(localStorage.getItem(this.storageKey) ?? "[]");
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  create({ condition, participantId, plannedRegionCount, completedRegionCount, missedRegionCount, suspectedRestrictedCount, coverageRate, regionDeviationRate, deviationEventRate, duration, alertUnderstood, alertDisruptive, familiarity, willingnessScore, notes, testDate }) {
    return {
      id: createId("validation"),
      condition,
      participantId: participantId.trim(),
      plannedRegionCount,
      completedRegionCount,
      missedRegionCount,
      suspectedRestrictedCount,
      coverageRate,
      regionDeviationRate,
      deviationEventRate,
      duration,
      alertUnderstood,
      alertDisruptive,
      familiarity,
      willingnessScore,
      notes: notes.trim(),
      testDate,
      source: "low_risk_simulation_test",
      createdAt: nowIso()
    };
  }

  add(record) {
    const records = [...this.list(), record];
    localStorage.setItem(this.storageKey, JSON.stringify(records));
    return record;
  }

  toCsv(records = this.list()) {
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const headers = ["recordId", "condition", "participantId", "plannedRegionCount", "completedRegionCount", "missedRegionCount", "suspectedRestrictedCount", "coverageRate", "regionDeviationRate", "deviationEventRate", "durationSeconds", "alertUnderstood", "alertDisruptive", "familiarity", "willingnessScore", "notes", "testDate", "source", "createdAt"];
    const rows = records.map((record) => [record.id, record.condition, record.participantId, record.plannedRegionCount, record.completedRegionCount, record.missedRegionCount, record.suspectedRestrictedCount, record.coverageRate, record.regionDeviationRate, record.deviationEventRate, record.duration, record.alertUnderstood, record.alertDisruptive, record.familiarity, record.willingnessScore, record.notes, record.testDate, record.source, record.createdAt]);
    return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  }

  downloadCsv(records = this.list()) {
    const blob = new Blob(["\ufeff", this.toCsv(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "模拟验证记录.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export class ExportModule {
  toText(log) {
    return [
      "超声治疗操作质量哨兵｜模拟操作质量日志",
      `计划编号：${log.treatmentPlanId}`,
      `操作者：${log.operator}`,
      `规则版本：${log.ruleVersion}`,
      `计划区域：${log.plannedRegions.join("、") || "无"}`,
      `已完成区域：${log.completedRegions.join("、") || "无"}`,
      `未完成区域：${log.missedRegions.join("、") || "无"}`,
      `覆盖率：${log.coverageRate}%`,
      `疑似漏打：${log.missedCount} 次`,
      `疑似进入预设禁区：${log.suspectedRestrictedCount} 次`,
      `总操作事件：${log.totalEventCount} 次`,
      `事件来源：${log.eventSources?.join("、") || "unknown"}`,
      `区域偏差率：${log.regionDeviationRate === null ? "暂无计划区域计算" : `${log.regionDeviationRate}%`}`,
      `偏差事件率：${log.deviationEventRate === null ? "暂无足够事件计算" : `${log.deviationEventRate}%`}`,
      `旧口径偏差率：${log.deviationRate === null ? "暂无足够事件计算" : `${log.deviationRate}%`}（仅用于测试规则，不作为最终业务指标）`,
      `操作时长：${log.duration} 秒`,
      `待复核：${log.unresolvedItems.join("；") || "无"}`,
      `生成时间：${new Date(log.generatedAt).toLocaleString("zh-CN")}`,
      "声明：本日志来自模拟操作，仅用于产品假设验证，不用于真实医疗决策、疗效判断或安全结论。"
    ].join("\n");
  }

  async copy(log) {
    await navigator.clipboard.writeText(this.toText(log));
  }

  download(log) {
    const blob = new Blob([this.toText(log)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `模拟操作质量日志-${log.treatmentPlanId}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
