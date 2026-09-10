# 公开Demo部署

## 定位

这是个人FDE作品的公开产品原型，使用脱敏合成数据。它不是半岛医疗官方、委托或内部系统，不接入真实患者、真实设备或真实医疗流程，不用于真实医疗决策。

## 平台与结构

- 前端：Vercel静态托管，保留原生HTML/CSS/JavaScript。
- AI代理：Vercel Serverless Functions。
- 数据：浏览器本地演示数据，不连接生产数据库。
- 构建命令：无。
- 输出目录：项目根目录。

公开路由：

- `/`：治疗质量管理助手主流程。
- `/v2/`：机构、患者与扩展演示功能。
- `/api/ai/status`：AI配置状态。
- `/api/ai/plan`：计划草稿。
- `/api/ai/summary`：质量摘要。
- `/api/ai/query`：只读查询解析。

项目没有独立`/portfolio/`网页目录；作品说明位于主站“关于本系统”及Markdown文档，因此不伪造该路由。

## 环境变量

在Vercel Project Settings中配置：

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_TIMEOUT_MS
DEMO_MODE
```

浏览器不接触API Key。`.env.example`只包含占位符，`.env.local`被忽略且不得上传。

## 安全与降级

Serverless接口只接受声明的方法，限制请求体和文本长度，拦截手机号、身份证号、病历号、医疗结论和治疗参数，严格校验模型JSON和字段Schema。AI结果均保留`requiresHumanConfirmation: true`。

未配置或模型失败时，页面显示智能功能不可用并保留完整手动流程。公开Serverless不保存完整输入或输出。当前速率限制是单函数实例内存窗口，不能视为分布式生产级限流；公开Demo仍需依赖Vercel平台防护与供应商配额。

## 本地运行

静态站点与AI代理分别运行：

```text
python3 -m http.server 4173
node ai/server.js
```

本地页面使用4174代理；非本地主机自动使用同源`/api/ai`。
