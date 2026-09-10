import { LLMService } from "../../ai/LLMService.js";
import { TREATMENT_CONFIG } from "../../config.js";

const MAX_BODY_BYTES = 32_000;
const MAX_TEXT_LENGTH = 4_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const rateBuckets = globalThis.__aiDemoRateBuckets || new Map();
globalThis.__aiDemoRateBuckets = rateBuckets;

const context = {
  availableTreatments: TREATMENT_CONFIG.map(({ id, name }) => ({ id, name })),
  availableRegions: TREATMENT_CONFIG.flatMap(treatment => treatment.regions.map(region => ({
    id: region.id,
    name: region.name,
    ruleType: region.ruleType,
    treatmentType: treatment.id,
  }))),
};

function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function fail(code, message) {
  return { success: false, result: null, requiresHumanConfirmation: true, source: "real_llm", isSynthetic: false, error: { code, message } };
}

function clientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "anonymous";
}

function allowRequest(req) {
  const key = clientKey(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw Object.assign(new Error("too large"), { code: "REQUEST_TOO_LARGE" });
  }
  if (!raw.trim()) throw Object.assign(new Error("empty"), { code: "EMPTY_REQUEST" });
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("invalid json"), { code: "INVALID_REQUEST" });
  }
}

function inputLength(value) {
  return typeof value === "string" ? value.length : JSON.stringify(value || {}).length;
}

function configuredService() {
  return new LLMService({
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
    timeoutMs: process.env.LLM_TIMEOUT_MS || 30_000,
  });
}

export async function handleAI(req, res, operation) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, fail("METHOD_NOT_ALLOWED", "仅支持POST请求。"));
  }
  if (!allowRequest(req)) return send(res, 429, fail("RATE_LIMITED", "请求过于频繁，请稍后再试。"), { "Retry-After": "60" });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    const tooLarge = error.code === "REQUEST_TOO_LARGE";
    return send(res, tooLarge ? 413 : 400, fail(error.code || "INVALID_REQUEST", tooLarge ? "输入内容过长，请精简后重试。" : "请求内容为空或格式错误。"));
  }

  const service = configuredService();
  let result;
  if (operation === "plan") {
    const input = body.input ?? body.text;
    if (!String(input || "").trim()) return send(res, 400, fail("EMPTY_REQUEST", "请先输入治疗计划描述。"));
    if (inputLength(input) > MAX_TEXT_LENGTH) return send(res, 413, fail("REQUEST_TOO_LARGE", "输入内容过长，请精简后重试。"));
    result = await service.generateStructuredPlan(input, { ...context, ...(body.context || {}) });
  } else if (operation === "summary") {
    if (!body.qualityLog || typeof body.qualityLog !== "object") return send(res, 400, fail("EMPTY_REQUEST", "请先生成质量报告。"));
    if (inputLength(body.qualityLog) > MAX_TEXT_LENGTH) return send(res, 413, fail("REQUEST_TOO_LARGE", "质量记录内容过长，请精简后重试。"));
    result = await service.summarizeQualityLog(body.qualityLog, body.audience || "operator");
  } else if (operation === "query") {
    const input = body.input ?? body.text;
    if (!String(input || "").trim()) return send(res, 400, fail("EMPTY_REQUEST", "请输入查询问题。"));
    if (inputLength(input) > MAX_TEXT_LENGTH) return send(res, 413, fail("REQUEST_TOO_LARGE", "输入内容过长，请精简后重试。"));
    result = await service.parseNaturalLanguageQuery(input, body.context || {});
  } else {
    return send(res, 404, fail("NOT_FOUND", "接口不存在。"));
  }

  const status = result.success ? 200 : result.error?.code === "NOT_CONFIGURED" ? 503 : 422;
  return send(res, status, result);
}
