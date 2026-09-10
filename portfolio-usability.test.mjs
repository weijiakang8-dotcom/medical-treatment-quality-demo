import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { DemoStateModule, STORAGE_KEYS } from "./modules.js";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
const checks = [];
const test = async (name, run) => {
  try { await run(); checks.push({ test: name, status: "通过" }); }
  catch (error) { checks.push({ test: name, status: "失败", actual: error.message }); }
};

await test("01 作品集入口可访问", () => assert.match(html, /id="portfolio"[\s\S]*id="portfolio-title"/));
await test("02 一键演示可以启动", () => {
  assert.match(html, /id="demo-btn"/);
  assert.match(app, /function startDemoMode\(\)[\s\S]*createPlan/);
});
await test("03 演示可以生成质量日志", () => {
  assert.match(app, /function startDemoMode/);
  assert.match(app, /function endOperation\(/);
  assert.match(html, /id="end-btn"/);
});
await test("04 演示禁止写入验证记录", () => assert.match(app, /if \(state\.demoMode\)[\s\S]*演示数据禁止写入验证记录/));
await test("05 退出演示清除状态", () => assert.match(app, /function exitDemoMode\(\)[\s\S]*demoStateModule\.clear\(\)/));
await test("06 三类证据边界存在", () => {
  assert.match(html, />已验证</);
  assert.match(html, />合成模拟</);
  assert.match(html, />尚未验证</);
  for (const label of ["[工程验证]", "[合成模拟]", "[个人走查]", "[待真实环境验证]"]) assert.ok(html.includes(label));
});
await test("07 免责声明存在", () => {
  for (const text of ["个人自驱项目", "不是半岛医疗官方项目", "不用于真实医疗决策", "未开展真实用户测试"]) assert.ok(html.includes(text));
});
await test("08 下载文件路径有效", async () => {
  const files = ["FINAL-PORTFOLIO.md", "EXECUTIVE-SUMMARY.md", "VALIDATION-RESULTS.md", "ARCHITECTURE.md", "SOURCE-APPENDIX.md", "SCREENSHOT-CHECKLIST.md"];
  for (const file of files) {
    assert.ok(html.includes(`href="${file}"`));
    await access(new URL(`./${file}`, import.meta.url));
  }
});
await test("09 存储键明确分离", () => assert.deepEqual(STORAGE_KEYS, {
  demo: "demo_state",
  treatment: "treatment_session",
  validation: "validation_records"
}));
await test("10 演示状态生命周期", () => {
  const values = new Map();
  global.sessionStorage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key)
  };
  const demo = new DemoStateModule();
  demo.start({ stage: "rules" });
  assert.equal(demo.isActive(), true);
  assert.equal(values.has(STORAGE_KEYS.treatment), false);
  assert.equal(values.has(STORAGE_KEYS.validation), false);
  demo.clear();
  assert.equal(demo.isActive(), false);
  delete global.sessionStorage;
});

console.table(checks);
const failed = checks.filter((item) => item.status === "失败");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
