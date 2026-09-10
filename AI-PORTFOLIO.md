# AI作品集｜术中操作质量可追溯MVP

> 候选人个人自驱项目，不是半岛医疗官方或授权项目。V1和V2均为本地原型/沙盒，不处理真实患者数据、不连接真实设备、不执行真实视频识别、不用于真实医疗决策。

## 1. 问题发现

`[基于公开信息的分析]` 公开治疗研究记录区域、深度、能量、线数、间距和路径；半岛公开信息显示设备端存在部分合规、验真和智能化能力。机构端过程追溯是否存在缺口仍属 `[待真实环境验证]`。

## 2. 产品边界

不做诊断、设备控制、疗效预测、自动医学定位或患者医疗服务。先验证“区域输入→规则→事件→疑似提示→日志”最小闭环。

## 3. V1核心Agent

`[工程验证]` TreatmentPlan、RegionRule、OperationEvent、DeviationDetector、AlertEvent和QualityLog组成唯一业务链。检测是确定性规则，不包装成AI模型。

## 4. V2沙盒扩展

`[沙盒演示]` 用户/RBAC、Demo Clinic A/B、匿名患者只读视图、设备CSV、视频任务、AI Provider、ROI/NPS及审计围绕Treatment上下文工作。V2验证扩展接口，不代表生产化。

## 5. 架构解耦

Presentation调用Application Service；Service使用Domain对象；Repository/Adapter可替换。`EventNormalizer`是V2输入进入V1的唯一桥接点，V2不能直接生成Alert或修改指标。

## 6. 数据对象

V1：TreatmentPlan、RegionRule、OperationEvent、AlertEvent、QualityLog。

V2：User、Organization、Patient、Treatment、DeviceEvent、VideoJob、AIResult、ROIScenario、NPSRecord、AuditLog。

## 7. Prompt、规则与Provider职责

- Prompt：当前不驱动医疗决策；页面固定文案仅说明沙盒操作。
- 规则：`DeviationDetector`执行可解释漏打/禁区逻辑，`OperationEventValidator`拒绝脏事件。
- RuleBasedProvider：生成事件解释，标记 `[规则生成数据]`。
- MockAIProvider：生成合成摘要，`isSynthetic:true`并要求人工复核。
- FutureVisionProvider：只返回 `[未实现] not_implemented`，不能产生OperationEvent。

## 7A. 真实文本LLM能力

新增`LLMService`及本地Node代理，通过OpenAI兼容接口调用`gpt-5.3-codex-spark`。实际完成计划草稿、质量摘要和查询解析三类调用；输入均为脱敏合成内容，API密钥仅在忽略的本地环境文件中，调用日志不保存正文。Prompt明确禁止诊断、治疗建议、安全结论、疗效判断、治疗参数和不存在信息；输出继续经过Schema、区域白名单、业务规则和人工确认。模型失败不影响V1/V2手动流程。

## 8. 测试与压测

V1：规则12/12、轨迹5/5、作品集10/10、压力与失败安全41/41、个人工程走查9/9。

V2：验收18/18、规模5/5。统一测试覆盖入口、双向存储隔离、DeviceEvent/AIResult转换、Future Provider阻断、QualityLog来源和作品集内容。

`[合成测试数据]` 10,000事件结果只说明本地Node执行完成，不代表生产性能。

## 9. 数据来源

`DATA-PROVENANCE-REGISTER.md`登记公开原始资料、项目配置、沙盒演示、合成测试、规则生成、个人走查和待获取数据。搜索摘要、虚构评价、访谈、NPS或临床样本不进入结论。

## 10. 限制

`[待真实环境验证]` 真实操作者、流程、设备字段、视频标注、医学与法规、临床结果、经营数据、服务端安全、数据库、并发和灾备。

## 11. 下一步真实验证计划

阶段1确认规则、流程、字段和权限；阶段2在不控制设备的影子场景验证事件结构、提示接受度、误报漏报和复盘价值；阶段3才评估受控设备/视频接入、生产权限和产品化价值。

核心路径：业务问题→最小闭环→可替换架构→数据与权限→验证设计→风险边界→落地路径。
