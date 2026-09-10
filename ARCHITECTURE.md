# 超声治疗操作质量哨兵：MVP 架构

> 候选人个人发起的自驱型作品集项目，非半岛医疗官方或授权项目。当前实现仅用于模拟验证。

## 核心数据对象

- `TreatmentPlan`：计划编号、操作者、项目类型、允许区域、禁区、创建时间和备注。
- `RegionRule`：区域编号、名称、规则类型、状态和说明。
- `OperationEvent`：事件编号、计划编号、事件类型、区域、时间、来源和元数据。
- `AlertEvent`：提示编号、计划编号、提示类型、文本、关联事件、时间和状态。
- `QualityLog`：覆盖率、漏打区域数、疑似越界事件数、区域偏差率、偏差事件率、旧口径兼容值、时长、提示、待复核项和生成时间。
- `ValidationRecord`：测试条件、匿名试用者编号、质量指标、提示反馈、熟悉程度、1—5分意愿评分、备注和测试日期。

## 模块边界

| 模块 | 唯一职责 | 输入 | 输出 / 对外接口 | 当前低成本实现 | 未来替换方式 |
|---|---|---|---|---|---|
| `TreatmentPlanModule` | 创建标准治疗计划对象 | 表单字段、区域 ID | `create(input): TreatmentPlan` | 浏览器表单与本地对象 | 接入机构计划系统适配器 |
| `RegionRuleModule` | 查询项目、允许区域和禁区规则 | JSON 配置、项目 ID | `listTreatments()`、`getRules()`、`getRule()` | `config.js` 静态配置 | 内部确认后替换为受控配置服务 |
| `InputModule` | 把输入转换为标准操作事件 | 人工按钮输入 | `createManualEvent(): OperationEvent` | 按钮与区域点击 | 新增视频识别或设备日志适配器，输出对象保持不变 |
| `OperationEventModule` | 保存、撤销和读取事件 | `OperationEvent` | `add()`、`undo()`、`list()`、`save()` | 内存数组与 `localStorage` | 受控数据库或机构日志服务 |
| `DeviationDetector` | 用显式规则识别疑似偏差 | 计划、事件、区域规则 | `detectEvent()`、`detectMissed()` | 确定性 JavaScript 规则 | 经产品、医学和法规确认的规则引擎 |
| `AlertModule` | 管理提示生命周期 | `AlertEvent` | `add()`、`addMany()`、`removeByRelatedEvent()`、`list()` | 内存数组 | 提示服务、工作流或审阅队列 |
| `QualityLogModule` | 聚合计划、事件和提示生成日志 | 计划、事件、提示、规则 | `generate(): QualityLog` | 浏览器计算 | 后端审计日志生成服务 |
| `ExportModule` | 将日志转换为可携带格式 | `QualityLog` | `toText()`、`copy()`、`download()` | 剪贴板与 TXT 下载 | PDF、系统归档或受控导出接口 |
| `ValidationRecordModule` | 独立保存模拟测试记录 | 测试条件、试用者编号、质量指标、意愿评分、备注 | `create()`、`add()`、`list()`、`toCsv()`、`downloadCsv()` | 独立 `localStorage` 与 CSV | 受控验证数据服务；不反向依赖治疗模块 |

## 依赖方向

```text
配置 -> RegionRuleModule -> TreatmentPlan
人工输入 -> InputModule -> OperationEventModule
TreatmentPlan + OperationEvent + RegionRule -> DeviationDetector -> AlertModule
TreatmentPlan + OperationEvent + AlertEvent -> QualityLogModule -> ExportModule
QualityLog + 手工测试信息 -> ValidationRecordModule -> 独立本地记录 / CSV
```

### 真实LLM辅助链

```text
浏览器AI面板 -> 本地Node代理 -> LLMService -> OpenAI兼容接口
                                   -> Schema校验
                                   -> 敏感信息/医疗越界/区域白名单
                                   -> 待人工确认草稿
```

`LLMService`提供`generateStructuredPlan`、`summarizeQualityLog`和`parseNaturalLanguageQuery`。代理从环境变量读取地址、密钥、模型和超时；浏览器不接触密钥。审计只保存请求ID、操作、模型、状态、耗时、输入字段名和校验结果。LLM不依赖或替代`DeviationDetector`、`QualityLogModule`与导出流程。

页面仅调用模块接口并渲染其返回值。检测器不操作页面，日志生成器不读取 DOM，输入来源也不参与偏差规则判断。因此人工标注未来可替换为输出同一 `OperationEvent` 的视频识别适配器，模拟事件可替换为设备日志适配器，而不改变检测、提示、日志和展示页。验证记录模块仅消费已生成的质量指标与真实参与者手工字段，不影响治疗操作模块。

## 指标口径

- 覆盖率 = 已完成计划区域数 ÷ 计划区域总数。
- 区域偏差率 = 去重后的受影响计划区域数 ÷ 计划区域总数；同一区域同时漏打及发生其他偏差只计一次。
- 偏差事件率 = 明确记录的疑似越界及其他明确偏差事件数 ÷ 总操作事件数；结束时推断的漏打区域不计入事件分子。
- 分母为 0 时显示“暂无足够事件计算”。
- `deviationRate` 旧口径仍保留用于历史规则测试，但不作为最终业务指标。

## 四层验证架构

1. `acceptance.test.mjs` 对领域模块执行12项确定性规则测试。
2. `fixtures/operation-traces.json` 与 `replay.test.mjs` 以5条合成轨迹执行离线回放。
3. 同一事件流分别以关闭/开启Alert生成运行；反事实修正通过明确标记的合成事件实现。
4. `SOLO-WALKTHROUGH.md` 记录候选人个人工程走查，不作为用户或医生研究。

自动化测试和轨迹夹具仅依赖领域模块，不读取页面DOM。页面中的FDE证据面板是测试结果的只读摘要，不参与业务计算。

## V2沙盒扩展与生产化前置条件

V2位于独立 `v2/` 目录，禁止导入V1业务状态或使用V1存储键。架构包含Repository接口实现、AuthService/RBAC、Organization/Patient服务、DeviceAdapterInterface、VideoJobService、AIProviderInterface、ROI/NPS纯函数、AuditService和治理动作。V2所有Repository键以 `v2_` 开头。

统一分层、对象和实际桥接代码说明见 `UNIFIED-ARCHITECTURE.md`；设备/视频/AI到OperationEvent及QualityLog来源流见 `UNIFIED-DATA-FLOW.md`；存储键见 `STORAGE-SCHEMA.md`。

当前浏览器LocalRepository仅用于架构演示。生产化必须替换为服务端认证、可信权限执行、数据库事务与租户行级隔离、对象存储、不可篡改审计、加密密钥、备份灾备和安全监控；设备、视频及AI适配器必须经过授权、医学与法规评估。

## 当前产品边界

- 主用户：超声治疗操作医生。
- 次用户：机构负责人或医疗运营人员。
- 非目标用户：患者不是当前 MVP 的直接操作用户。
- 不接真实设备，不控制参数，不判断疗效，不做医疗诊断或安全结论。
- 规则均为项目演示配置，不代表半岛医疗内部规则或现有系统能力。
