# V1+V2存储Schema

> 当前全部是浏览器本地原型存储，不是数据库、真实患者系统或生产数据层。

## V1命名空间

| 键 | 存储 | 内容 | 生命周期 | V2权限 |
|---|---|---|---|---|
| `demo_state` | sessionStorage | 合成演示计划、事件、提示、日志 | 刷新初始化或退出演示清除 | 禁止读取/修改 |
| `treatment_session` | localStorage | 普通V1治疗会话快照 | 新建会话清除 | 禁止读取/修改 |
| `validation_records` | localStorage | 独立模拟验证记录 | 手工删除/浏览器清理 | 禁止读取/修改 |

## V2命名空间

| 键 | 对象/用途 |
|---|---|
| `v2_auth` | 当前沙盒会话 |
| `v2_users` | UserRepository |
| `v2_orgs` | OrganizationRepository |
| `v2_patients` | PatientRepository |
| `v2_treatments` | TreatmentRepository；可含 `v1QualityLogId`引用 |
| `v2_device_events` | DeviceEventRepository |
| `v2_video_jobs` | VideoJobRepository |
| `v2_ai_results` | AIResultRepository |
| `v2_roi` | ROI情景输入与结果 |
| `v2_nps` | 分组NPS手工/演示评分 |
| `v2_audit_logs` | 本地可变审计日志 |

## 跨层引用规则

```text
Treatment.v1QualityLogId = QualityLog.treatmentPlanId
Treatment.linkType = reference_only
```

关联不复制QualityLog，不允许V2修改V1事件、提示或指标。删除V2 Treatment或机构数据默认保留V1脱敏工程日志，并在删除审计中记录V2操作；该策略只适用于当前沙盒。

## 隔离与生产差距

- V1源码不导入V2 Repository；V2源码不访问三个V1键。
- 演示、合成测试和验证记录分别存储，不自动汇总为用户研究。
- `localStorage`无事务、加密、租户行级安全、可信审计、备份和灾备，必须在生产化前替换。
