# 治疗质量管理助手

个人发起的治疗过程质量管理作品集原型，非半岛医疗官方、委托、授权或内部项目。原型只使用脱敏合成数据，不接入真实患者、真实设备或内部系统，不用于真实医疗决策、疗效判断或安全结论。

## 开源许可证

本项目源代码和文档采用 [Apache License 2.0](LICENSE) 开源。版权及项目声明见 [NOTICE](NOTICE)。Apache许可证不授予任何第三方名称、商标、Logo、临床数据或专有材料的使用权。

## 运行

项目不依赖第三方包：

```bash
python3 -m http.server 4173
```

访问 `http://127.0.0.1:4173/`。统一首页提供核心模拟、沙盒扩展、验证摘要、完整作品集提案、数据来源与限制。确定性核心流程是唯一业务主线，扩展输入通过 `integration.js` 标准化后才可进入检测链。机构管理地址为 `http://127.0.0.1:4173/v2/`。

真实文本智能能力需要在被Git忽略的`.env.local`中配置`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`和`LLM_TIMEOUT_MS`，然后运行：

```bash
node ai/server.js
```

浏览器不会接触API Key。未配置模型时，手动核心流程仍可完整使用。

> V2扩展功能仅用于沙盒演示与架构验证，不接触真实患者、不用于真实医疗决策、不连接未经授权的设备或内部系统。

演示状态使用 `sessionStorage.demo_state`，普通治疗会话使用 `localStorage.treatment_session`，验证记录使用 `localStorage.validation_records`。演示操作不会写入验证记录，退出演示和页面刷新都会清除演示状态。

```bash
node portfolio-usability.test.mjs
node acceptance.test.mjs
node replay.test.mjs
node stress.test.mjs
node v2-acceptance.test.mjs
node v2-stress.test.mjs
node unified-integration.test.mjs
```

## 演示路径

```text
项目入口
→ 新建模拟治疗计划并选择计划区域
→ 确认允许区域与预设禁区
→ 点击区域记录完成事件
→ 点击预设禁区模拟疑似越界
→ 保留未完成区域模拟疑似漏打
→ 结束操作并生成一页质量日志
→ 复制或导出 TXT
→ 普通模式可手工保存独立模拟验证记录；演示模式不显示也不写入该记录
```

## 指标

- 覆盖率 = 完成区域数 ÷ 计划区域数 × 100%。
- 区域偏差率 = 去重后的受影响计划区域数 ÷ 计划区域总数 × 100%。同一区域同时漏打及发生其他偏差只计一次。
- 偏差事件率 = 明确记录的疑似越界及其他明确偏差事件数 ÷ 总操作事件数 × 100%。结束时推断的漏打区域不进入事件分子。
- 总操作事件为 0 时显示“暂无足够事件计算”。
- 旧 `deviationRate` 口径为兼容历史验收保留；其结果仅用于测试规则，不作为最终业务指标。
- 提示接受度采用参与者手工填写的 1—5 分意愿评分；当前不计算 NPS。

## 已验证与未验证

当前已经验证：网页从区域输入、规则展示、人工模拟、疑似偏差提示到质量日志和本地导出的闭环；12项确定性规则测试；5条合成轨迹重复回放；同轨迹提示输出差异；会话重置；验证记录独立存储；候选人个人专家走查9项任务。

当前没有验证：真实操作者接受度、真实视觉识别准确性、设备接口、医疗安全、临床疗效、法规符合性、真实机构流程、操作质量与疗效的相关性。所有半岛内部能力和落地条件均待半岛内部验证。

当前质量数据来自人工按钮或JSON夹具产生的合成模拟事件，不是用户或临床数据。项目目前不招募参与者，不声称用户接受度、满意度或NPS；验证记录表仅保留为未来影子验证的数据结构。

人工标注未来可以替换为输出相同 `OperationEvent` 的视频识别适配器；模拟事件未来可以替换为设备结构化日志适配器。两种替换均不改变检测、提示与质量日志接口。

## 文件

- `config.js`：可替换的治疗项目及区域规则配置。
- `modules.js`：领域模块、统一数据对象和独立验证记录模块。
- `app.js`：页面状态和模块编排，不承载区域配置。
- `index.html`：五步原型页面及模拟验证记录表。
- `styles.css`：响应式界面样式。
- `acceptance.test.mjs`：A/B/C 场景与边界测试。
- `ARCHITECTURE.md`：模块职责、接口及未来替换方案。
- `SIMULATION-TEST-PROTOCOL.md`：单页模拟试用说明。
- `VALIDATION-DATA-DICTIONARY.md`：空白记录表、字段定义和指标口径。
- `SCREENSHOT-CHECKLIST.md`：七张作品集截图记录。
- `PUBLIC-EVIDENCE-REGISTER.md`：已核验公开论文和监管方法来源。
- `fixtures/operation-traces.json`、`replay.test.mjs`：合成轨迹夹具与回放器。
- `TRACE-REPLAY-REPORT.md`：五条合成轨迹结果。
- `COUNTERFACTUAL-REPLAY-REPORT.md`：同轨迹提示对照和合成修正边界。
- `SOLO-WALKTHROUGH.md`：候选人个人专家走查。
- `PORTFOLIO-PAGE-5.md`：重写后的第5页验证结果。
- `FINAL-PORTFOLIO.md`：完整7页提案包。
- `EXECUTIVE-SUMMARY.md`、`VALIDATION-RESULTS.md`、`SOURCE-APPENDIX.md`：网页可查看或下载的提案文件。
- `portfolio-usability.test.mjs`：作品集入口、演示隔离、证据边界和下载路径检查。
- `VALIDATION-MATRIX.md`、`DATA-PROVENANCE-REGISTER.md`：能力状态与数据来源边界。
- `stress.test.mjs`、`STRESS-TEST-REPORT.md`：V1边界、失败安全和10,000事件测试。
- `v2/`：完全独立的浏览器本地沙盒及可替换模块。
- `v2-acceptance.test.mjs`、`v2-stress.test.mjs`、`V2-TEST-REPORT.md`：V2权限、适配器和规模测试。
- `DATA-GOVERNANCE-V2.md`：V2沙盒数据分类、删除、权限和生产差距。
- `integration.js`：V1/V2事件转换、工作流和Treatment引用桥接。
- `UNIFIED-ARCHITECTURE.md`、`UNIFIED-DATA-FLOW.md`、`STORAGE-SCHEMA.md`：统一分层、数据流和存储契约。
- `AI-PORTFOLIO.md`：以业务闭环、架构、数据、验证与风险为主线的AI作品集。
- `V1-V2-INTEGRATION-REPORT.md`、`unified-integration.test.mjs`：整合结果和统一回归。
