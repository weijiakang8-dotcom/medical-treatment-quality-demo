import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleAI } from "./api/ai/_handler.js";

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ test: name, status: "通过" }); }
  catch (error) { results.push({ test: name, status: `失败：${error.message}` }); }
}
function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}
function request(method, body, headers = {}) {
  return { method, body, headers, socket: { remoteAddress: `test-${Math.random()}` } };
}

const savedEnv = { ...process.env };
delete process.env.LLM_BASE_URL;
delete process.env.LLM_API_KEY;
delete process.env.LLM_MODEL;

await test("01 非POST方法拒绝", async () => {
  const res = response(); await handleAI(request("GET", {}), res, "plan");
  assert.equal(res.statusCode, 405); assert.equal(res.body.error.code, "METHOD_NOT_ALLOWED");
});
await test("02 空计划请求拒绝", async () => {
  const res = response(); await handleAI(request("POST", {}), res, "plan");
  assert.equal(res.statusCode, 400); assert.equal(res.body.error.code, "EMPTY_REQUEST");
});
await test("03 超长请求拒绝", async () => {
  const res = response(); await handleAI(request("POST", { input: "演示".repeat(3000) }), res, "query");
  assert.equal(res.statusCode, 413); assert.equal(res.body.error.code, "REQUEST_TOO_LARGE");
});
await test("04 未配置真实LLM安全降级", async () => {
  const res = response(); await handleAI(request("POST", { input: "查看待人工复核的演示记录" }), res, "query");
  assert.equal(res.statusCode, 503); assert.equal(res.body.error.code, "NOT_CONFIGURED");
});
await test("05 敏感信息在供应商调用前拦截", async () => {
  process.env.LLM_BASE_URL = "https://example.invalid/v1"; process.env.LLM_API_KEY = "test-only"; process.env.LLM_MODEL = "test-only";
  const res = response(); await handleAI(request("POST", { input: "患者手机号13800138000" }), res, "query");
  assert.equal(res.statusCode, 422); assert.equal(res.body.error.code, "SENSITIVE_DATA_DETECTED");
  delete process.env.LLM_BASE_URL; delete process.env.LLM_API_KEY; delete process.env.LLM_MODEL;
});
await test("06 人工确认字段始终保留", async () => {
  const res = response(); await handleAI(request("POST", { input: "查看演示记录" }), res, "query");
  assert.equal(res.body.requiresHumanConfirmation, true);
});
await test("07 前端公开环境使用同源API", async () => {
  const source = await readFile("ai/client.js", "utf8");
  assert.match(source, /\?"http:\/\/127\.0\.0\.1:4174\/api\/ai":"\/api\/ai"/);
});
await test("08 Vercel路由与安全头存在", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.ok(config.headers.some(item => item.source === "/api/ai/(.*)"));
});
await test("09 环境模板不含真实密钥", async () => {
  const example = await readFile(".env.example", "utf8");
  assert.match(example, /LLM_API_KEY=replace_me/); assert.doesNotMatch(example, /sk-[A-Za-z0-9]/);
});
await test("10 公开首页保留原型边界", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /不用于真实医疗决策/); assert.match(html, /不连接真实设备/);
});

for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
Object.assign(process.env, savedEnv);
console.table(results);
const failed = results.filter(item => item.status !== "通过");
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
