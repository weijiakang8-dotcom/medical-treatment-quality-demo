import { DeviationDetector, QualityLogModule, OperationEventValidator } from "./modules.js";

export class EventNormalizer {
  fromDeviceEvent(deviceEvent, treatmentPlanId) {
    return {
      id: `op-${deviceEvent.id}`,
      treatmentPlanId,
      eventType: deviceEvent.eventType,
      regionId: deviceEvent.regionId,
      timestamp: deviceEvent.timestamp,
      source: deviceEvent.source === "mock_device" ? "device_mock" : deviceEvent.source,
      metadata: { value: { ...(deviceEvent.value ?? {}) }, isSynthetic: deviceEvent.isSynthetic === true }
    };
  }

  fromAIResult(aiResult, { treatmentPlanId, eventType, regionId, timestamp }) {
    if (aiResult.status === "not_implemented") {
      return { event: null, errors: ["[未实现] Future Provider不得产生OperationEvent"] };
    }
    if (aiResult.source !== "mock_ai" || aiResult.isSynthetic !== true) {
      return { event: null, errors: ["仅明确标记的模拟AI结果可进入沙盒事件链"] };
    }
    return {
      event: {
        id: `op-${aiResult.id}`,
        treatmentPlanId,
        eventType,
        regionId,
        timestamp,
        source: "video_mock",
        metadata: {
          aiResultId: aiResult.id,
          isSynthetic: true,
          requiresHumanReview: true,
          explanation: aiResult.explanation
        }
      },
      errors: []
    };
  }
}

export class TreatmentWorkflowService {
  constructor({ detector = new DeviationDetector(), logModule = new QualityLogModule(), validator = new OperationEventValidator() } = {}) {
    this.detector = detector;
    this.logModule = logModule;
    this.validator = validator;
  }

  run({ plan, rules, events, startedAt = Date.now() }) {
    const knownRegionIds = new Set(rules.map((rule) => rule.id));
    const accepted = [];
    const rejected = [];
    const ids = new Set();
    for (const event of events) {
      const result = this.validator.validate(event, plan, knownRegionIds, ids);
      if (!result.valid) {
        rejected.push({ eventId: event?.id ?? null, errors: result.errors });
        continue;
      }
      ids.add(event.id);
      accepted.push(event);
    }
    const alerts = [];
    for (const event of accepted) {
      const rule = rules.find((item) => item.id === event.regionId);
      const alert = this.detector.detectEvent(plan, event, rule);
      if (alert) alerts.push({ ...alert, regionId: event.regionId });
    }
    alerts.push(...this.detector.detectMissed(plan, accepted));
    return { accepted, rejected, alerts, qualityLog: this.logModule.generate(plan, accepted, alerts, startedAt, rules) };
  }
}

export class TreatmentContextService {
  create({ organizationId, operatorId, patientId, planId, v1QualityLogId = null }) {
    return {
      id: `treatment-context-${planId}`,
      organizationId,
      operatorId,
      patientId,
      planId,
      v1QualityLogId,
      linkType: "reference_only",
      source: "sandbox_context"
    };
  }

  linkQualityLog(treatment, qualityLog) {
    return { ...treatment, v1QualityLogId: qualityLog.treatmentPlanId, linkType: "reference_only" };
  }
}

export class PatientViewService {
  constructor(authService, treatmentRepository) { this.auth = authService; this.treatments = treatmentRepository; }
  listOwn(session) { return this.auth.scope(this.treatments.list(), session); }
}

export class DeviceImportService {
  constructor(adapter, normalizer = new EventNormalizer()) { this.adapter = adapter; this.normalizer = normalizer; }
  import(text, treatmentPlanId) {
    const parsed = this.adapter.parse(text);
    return { ...parsed, operationEvents: parsed.events.map((event) => this.normalizer.fromDeviceEvent(event, treatmentPlanId)) };
  }
}

export class AIProviderService {
  constructor(provider, normalizer = new EventNormalizer()) { this.provider = provider; this.normalizer = normalizer; }
  generateOperationEvent(input, context) {
    const result = this.provider.generate(input);
    return { result, ...this.normalizer.fromAIResult(result, context) };
  }
}

export class ROIService { constructor(calculator) { this.calculate = calculator; } }
export class NPSService { constructor(calculator) { this.calculate = calculator; } }
