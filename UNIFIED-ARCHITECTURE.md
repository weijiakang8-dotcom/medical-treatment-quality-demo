# V1+V2统一架构

> 候选人个人自驱项目，非半岛医疗官方或授权项目。V1和V2均为本地原型/沙盒，不处理真实患者数据、不连接真实设备、不执行真实视频识别、不用于真实医疗决策，也不代表生产级安全、合规、性能或临床能力。

## 分层架构

```text
Presentation Layer
├── 项目首页
├── V1核心模拟
├── V2沙盒扩展
├── FDE验证摘要
└── 作品集提案

Application Layer
├── TreatmentWorkflowService
├── AuthService / OrganizationService / PatientViewService
├── DeviceImportService / VideoJobService / AIProviderService
├── ROIService / NPSService
└── AuditService

Domain Layer
├── V1: TreatmentPlan / RegionRule / OperationEvent / AlertEvent / QualityLog
└── V2: User / Organization / Patient / Treatment / DeviceEvent / VideoJob /
        AIResult / ROIScenario / NPSRecord / AuditLog

Repository / Adapter Layer
├── LocalRepository及各对象Repository
├── DeviceAdapterInterface: Mock / CSV / Future
└── AIProviderInterface: RuleBased / MockAI / FutureVision
```

## 统一方式

V1是唯一业务主线，`DeviationDetector`和`QualityLogModule`继续决定原有统计口径。V2不是第二套检测产品，而是围绕Treatment上下文提供身份、机构、患者视图、输入适配、运营情景和审计能力。

`integration.js`提供边界服务：

- `EventNormalizer`将DeviceEvent或明确的模拟AI结果转换为V1 OperationEvent；
- `TreatmentWorkflowService`调用V1校验、检测和日志模块；
- `TreatmentContextService`以 `v1QualityLogId`建立引用，不复制日志；
- `PatientViewService`通过Auth作用域读取本人Treatment；
- `DeviceImportService`和`AIProviderService`封装适配器/Provider。

## 架构约束

1. V2输入必须转成OperationEvent，不能直接生成Alert或修改统计。
2. FutureVisionProvider的 `not_implemented` 结果不能产生OperationEvent。
3. MockAI事件必须保留 `isSynthetic:true`、`requiresHumanReview:true` 和 `video_mock` 来源。
4. QualityLog保存 `eventSources` 和 `sourceBreakdown`，不改变覆盖率或偏差率公式。
5. 页面仅调用Service和Repository接口；生产化时替换浏览器本地实现。
6. V1/V2存储隔离，跨层只保存明确ID引用。

## 已验证与限制

`[工程验证]` 统一桥接测试覆盖设备事件转换、模拟AI事件、Future Provider阻断、来源日志和引用关系。

`[沙盒演示]` V2 Auth/RBAC、机构、患者、ROI/NPS和审计只在浏览器本地运行。

`[待真实环境验证]` 服务端认证、数据库、设备协议、医学视觉、法规、临床、并发性能与灾备均未实现。
