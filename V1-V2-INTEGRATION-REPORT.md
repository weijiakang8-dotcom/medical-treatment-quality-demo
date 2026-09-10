# V1+V2整合报告

## 整合结论

V1保持唯一业务核心，V2通过Application Service、Repository和Adapter围绕Treatment上下文扩展。没有复制检测器、提示逻辑或指标公式。

## 代码增量

- `integration.js`：EventNormalizer、TreatmentWorkflowService、TreatmentContextService、PatientViewService、DeviceImportService、AIProviderService、ROIService和NPSService。
- V1 QualityLog新增 `eventSources` 与 `sourceBreakdown`，只提供来源追溯，不参与统计。
- 统一首页提供V1、V2、验证摘要、完整提案、数据来源与限制五个入口。

## 数据流验证

- Mock/CSV DeviceEvent → OperationEvent(`device_mock`) → V1检测与日志。
- MockAI AIResult → OperationEvent(`video_mock`, `isSynthetic:true`) → V1检测与日志。
- FutureVisionProvider → `not_implemented` → 不产生OperationEvent。
- Treatment通过 `v1QualityLogId`引用V1日志，不复制数据。

## 隔离验证

V1只使用三个原有键，V2只使用 `v2_*` 键。统一桥接测试在内存中运行，不写浏览器存储。删除V2对象不会删除V1日志。

## 事实边界

`[工程验证]` 表示规则、接口、数据流和测试通过。

`[沙盒演示]` 表示浏览器本地身份、机构、患者视图和运营模块可操作。

`[待真实环境验证]` 包括真实身份、数据库、患者、设备、视频、医学法规、生产安全、临床及经营结果。
