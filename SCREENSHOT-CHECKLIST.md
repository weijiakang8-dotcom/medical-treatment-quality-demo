# 作品集截图记录

生成方式：本机 Google Chrome headless，桌面视口 1440px。全部使用“演示操作员（模拟）”及项目演示配置，不包含真实患者、机构、医疗记录或半岛内部信息。所有状态均为模拟状态，不是试用结果。

| 文件名 | 页面 | 操作路径 / 演示参数 | 核心信息 | 演示数据 | 状态 |
|---|---|---|---|---|---|
| `screenshots/01-entry.png` | 项目入口 | 打开 `?demo=entry` | 个人自驱挑战、核心闭环、模拟验证和不用于真实医疗决策声明 | 无测试结果 | 已生成，模拟 |
| `screenshots/02-treatment-plan.png` | 治疗计划 | 打开 `?demo=plan` | 治疗项目、5个计划区域、3个预设禁区及配置免责声明 | 演示操作员、演示备注 | 已生成，模拟 |
| `screenshots/03-region-rules.png` | 规则确认 | 打开 `?demo=rules` | 允许区域和预设禁区的视觉区分、数量及待复核规则 | 5个允许区域、3个预设禁区 | 已生成，模拟 |
| `screenshots/04-operation-running.png` | 模拟操作 | 打开 `?demo=operation` | 2/5区域完成、事件记录、人工标注模式和控制按钮 | 2条人工完成事件 | 已生成，模拟 |
| `screenshots/05-missed-area-alert.png` | 漏打日志 | 打开 `?demo=missed` | 覆盖率20%、漏打区域数4、区域偏差率80%、待复核事项 | 仅完成1/5区域 | 已生成，模拟 |
| `screenshots/06-restricted-area-alert.png` | 即时提示 | 打开 `?demo=restricted` | “疑似进入预设禁区”、请人工复核、未判断真实越界或医疗风险 | 1条完成事件、1条禁区事件 | 已生成，模拟 |
| `screenshots/07-quality-log.png` | 质量日志 | 打开 `?demo=log` | 当前可复现状态为覆盖率80%、漏打区域数1、疑似越界1、区域偏差率20%、偏差事件率20% | 4条完成事件、1条禁区事件；原PNG为此前演示快照 | 已生成，合成快照 |
| `screenshots/08-v2-sandbox.png` | V2沙盒 | 打开 `/v2/` | 沙盒身份、统一扩展导航及持续免责声明 | Demo Clinic及演示账号配置 | 已生成，沙盒演示 |

## 复现命令

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --hide-scrollbars --window-size=1440,1000 \
  --screenshot=screenshots/01-entry.png \
  'http://127.0.0.1:4173/?demo=entry'
```

将查询参数和输出文件名按上表替换即可。漏打截图使用 `1440,1200`，最终日志使用 `1440,1400`。

`?demo=` 只注入明确标记的截图演示状态，不创建验证记录、不代表真实参与者结果，也不改变正常入口流程。正常演示仍从无参数地址 `http://127.0.0.1:4173/` 开始。
