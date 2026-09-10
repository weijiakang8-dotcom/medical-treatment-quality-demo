# 治疗质量管理助手设计系统

## 原则

- 任务优先：工作台先呈现快捷操作和待处理事项。
- 克制可信：医疗蓝、青绿、灰白；琥珀只用于需要注意的状态。
- 可理解：状态同时使用文字、图标和颜色，不只依靠颜色。
- 一致反馈：保存、失败、加载、待确认和删除使用统一组件。
- 边界明确：演示数据和未接入能力始终附带文字说明。

## 设计令牌

全站令牌在 `design-tokens.css`。业务CSS只能引用令牌或由令牌派生的局部变量。品牌色、字体、间距、圆角、阴影、侧栏宽度和顶栏高度均可统一调整。

## 原子组件

| 组件 | CSS/HTML契约 | 状态 |
|---|---|---|
| AppShell | `.enterprise-shell` | desktop/mobile |
| Sidebar | `.sidebar`、`#nav-drawer` | open/collapsed |
| Topbar | `.enterprise-topbar` | default |
| Breadcrumb | `.breadcrumb` | current page |
| PageHeader | `.page-header` | actions/description |
| SectionCard | `.section-card` | default |
| MetricCard | `.metric-card` | demo/empty |
| StatusBadge | `.status-badge` | success/warning/info/muted |
| PrimaryButton | `.button.primary` | hover/focus/disabled/loading |
| SecondaryButton | `.button.secondary` | hover/focus/disabled |
| FormField | `.form-field` | focus/error/disabled |
| EmptyState | `.empty-state` | empty |
| LoadingState | `.loading-state` | busy |
| ErrorState | `.error-state` | retry guidance |
| NoticeBanner | `.notice-banner` | info/warning |
| ConfirmDialog | `#confirm-dialog` | open/closed |
| Drawer | `#nav-drawer` | modal navigation |
| DataTable | `.data-table` | desktop/mobile scroll |
| Timeline | `.timeline` | event/status |
| ProgressBar | `.progress-bar` | 0–100 |
| RegionCard | `.region-card` | completed/pending/restricted/unrecorded |
| QualitySummary | `.quality-summary` | metrics/review |
| SourceTag | `.source-tag` | demo/manual/empty |

## 无障碍约束

- 所有主要点击目标最小44px。
- `:focus-visible`统一3px焦点环。
- 页面提供跳过导航链接。
- 抽屉和确认对话框具有语义角色和焦点管理。
- 状态消息使用`aria-live`。
- 表单错误使用`aria-describedby`关联字段。
- `prefers-reduced-motion`关闭非必要动画。
- 当前只完成低成本静态与键盘检查，不声称完整WCAG 2.2 AA认证。
