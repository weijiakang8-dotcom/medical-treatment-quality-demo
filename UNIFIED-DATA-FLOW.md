# V1+V2统一数据流

## 核心治疗流

```text
TreatmentPlan
→ RegionRule
→ OperationEvent
→ DeviationDetector
→ AlertEvent
→ QualityLog
```

`[工程验证]` 这是唯一偏差检测和指标计算链路。V2不能直接改变检测结论或V1统计口径。

## 用户与机构流

```text
User → Organization → Treatment → Patient
                            │
                            ├── planId → TreatmentPlan
                            └── v1QualityLogId → QualityLog
```

`TreatmentContextService`创建Treatment上下文。`v1QualityLogId`只保存引用，不复制V1日志。删除V2机构对象时，默认不删除V1脱敏工程日志；若未来需要联动删除，必须经过数据治理和授权确认。

## 设备适配流

```text
CSVDeviceAdapter / MockDeviceAdapter
→ DeviceEvent
→ DeviceImportService
→ EventNormalizer
→ OperationEvent(source: device_mock)
→ TreatmentWorkflowService
→ DeviationDetector
→ QualityLog(eventSources/sourceBreakdown)
```

设备层只读入示例CSV，不发送设备命令。未知或非法事件在进入检测器前被 `OperationEventValidator` 拒绝。

## 视频接口流

```text
VideoJob
→ MockAIProvider / FutureVisionProvider
→ AIResult
→ AIProviderService
→ EventNormalizer
→ OperationEvent(source: video_mock)
→ TreatmentWorkflowService
→ QualityLog
```

只有 `MockAIProvider` 且 `isSynthetic:true` 的结果可转换为沙盒OperationEvent，并保留人工复核标记。`FutureVisionProvider`返回 `not_implemented`，不能产生事件。当前没有读取视频内容、医学定位或准确率。

## 来源保留

QualityLog新增但不参与统计的字段：

```text
eventSources: [manual, simulation, device_mock, video_mock]
sourceBreakdown: { manual: 2, device_mock: 1 }
```

这些字段支持追溯输入来源，不表示来源可靠或经过真实环境验证。
