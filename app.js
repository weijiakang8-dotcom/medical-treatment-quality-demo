import { PROJECT_DISCLAIMER, TREATMENT_CONFIG } from "./config.js";
import {
  AlertModule,
  DemoStateModule,
  DeviationDetector,
  ExportModule,
  InputModule,
  OperationEventModule,
  QualityLogModule,
  RegionRuleModule,
  TreatmentPlanModule,
  ValidationRecordModule
} from "./modules.js";

const regionRules = new RegionRuleModule(TREATMENT_CONFIG);
const planModule = new TreatmentPlanModule();
const inputModule = new InputModule();
const eventModule = new OperationEventModule();
const detector = new DeviationDetector();
const alertModule = new AlertModule();
const logModule = new QualityLogModule();
const exportModule = new ExportModule();
const validationRecordModule = new ValidationRecordModule();
const demoStateModule = new DemoStateModule();

const state = {
  currentView: "home",
  plan: null,
  rules: [],
  startedAt: null,
  timerId: null,
  qualityLog: null,
  demoMode: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const regionName = (id) => state.rules.find((rule) => rule.id === id)?.name ?? id;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function canVisit(view) {
  if (view === "home" || view === "portfolio" || view === "evidence" || view === "plan") return true;
  if ((view === "rules" || view === "operation") && state.plan) return true;
  return view === "log" && state.qualityLog;
}

function goTo(view) {
  if (!canVisit(view)) return;
  state.currentView = view;
  const viewNames = { home: "工作台", plan: "新建治疗记录", rules: "确认治疗范围", operation: "记录治疗过程", log: "治疗质量报告", evidence: "治疗质量", portfolio: "关于本系统" };
  history.replaceState(null, "", `${location.pathname}${location.search}#${view === "home" ? "workspace" : view}`);
  $("#breadcrumb-current").textContent = viewNames[view] || "工作台";
  $$(".sidebar [data-go]").forEach((item) => item.classList.toggle("active", item.dataset.go === view));
  $$(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  const order = ["home", "plan", "rules", "operation", "log"];
  const activeIndex = order.indexOf(view);
  $$(".step").forEach((step, index) => {
    step.classList.toggle("active", step.dataset.go === view);
    step.disabled = view === "evidence" || view === "portfolio" ? !canVisit(step.dataset.go) : index > activeIndex || !canVisit(step.dataset.go);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTreatmentOptions() {
  const select = $("#treatment-type");
  select.innerHTML = regionRules.listTreatments().map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  renderPlanRules();
}

function renderPlanRules() {
  const treatmentType = $("#treatment-type").value;
  const rules = regionRules.getRules(treatmentType);
  const allowed = rules.filter((rule) => rule.ruleType === "allowed");
  const restricted = rules.filter((rule) => rule.ruleType === "restricted");
  $("#allowed-options").innerHTML = allowed.map((rule) => `
    <label class="option"><input type="checkbox" name="allowedRegion" value="${rule.id}" checked /><span>${rule.name}</span></label>
  `).join("");
  $("#restricted-preview").innerHTML = restricted.map((rule) => `
    <div class="restricted-item"><strong>${rule.name}</strong><span>${rule.description}</span></div>
  `).join("");
}

function createPlan(event) {
  event.preventDefault();
  const allowedRegions = $$('input[name="allowedRegion"]:checked').map((input) => input.value);
  if (!allowedRegions.length) {
    showToast("请至少选择一个计划治疗区域。当前未创建计划。");
    return;
  }
  const treatmentType = $("#treatment-type").value;
  state.rules = regionRules.getRules(treatmentType);
  state.plan = planModule.create({
    operator: $("#operator").value,
    treatmentType,
    allowedRegions,
    restrictedRegions: state.rules.filter((rule) => rule.ruleType === "restricted").map((rule) => rule.id),
    notes: $("#notes").value,
    ruleVersion: regionRules.listTreatments().find((item) => item.id === treatmentType)?.ruleVersion ?? "unversioned"
  });
  eventModule.reset();
  alertModule.reset();
  state.qualityLog = null;
  renderRuleConfirmation();
  goTo("rules");
}

function renderRuleConfirmation() {
  const treatment = regionRules.listTreatments().find((item) => item.id === state.plan.treatmentType);
  const plannedRules = state.rules.filter((rule) => state.plan.allowedRegions.includes(rule.id));
  const restrictedRules = state.rules.filter((rule) => state.plan.restrictedRegions.includes(rule.id));
  $("#rules-treatment-name").textContent = treatment?.name ?? "模拟项目";
  $("#rules-map").innerHTML = [...plannedRules, ...restrictedRules].map((rule) => `
    <div class="rule-tile ${rule.ruleType === "restricted" ? "restricted" : ""}">
      <strong>${rule.name}</strong><span>${rule.ruleType === "allowed" ? "计划允许区域" : "预设禁区 · 待复核规则"}</span>
    </div>
  `).join("");
  $("#allowed-count").textContent = plannedRules.length;
  $("#restricted-count").textContent = restrictedRules.length;
  $("#allowed-list").textContent = plannedRules.map((rule) => rule.name).join(" · ");
  $("#restricted-list").textContent = restrictedRules.map((rule) => rule.name).join(" · ");
}

function beginOperation() {
  eventModule.reset();
  alertModule.reset();
  state.startedAt = Date.now();
  window.clearInterval(state.timerId);
  state.timerId = window.setInterval(renderTimer, 1000);
  renderOperation();
  goTo("operation");
}

function renderTimer() {
  if (!state.startedAt) return;
  $("#timer").textContent = formatTime(Math.round((Date.now() - state.startedAt) / 1000));
}

function getCompleted() {
  return new Set(eventModule.list().filter((event) => event.eventType === "region_completed").map((event) => event.regionId));
}

function renderOperation() {
  const events = eventModule.list();
  const completed = getCompleted();
  const plannedRules = state.rules.filter((rule) => state.plan.allowedRegions.includes(rule.id));
  const restrictedRules = state.rules.filter((rule) => state.plan.restrictedRegions.includes(rule.id));
  $("#operation-regions").innerHTML = plannedRules.map((rule) => `
    <button class="region-action ${completed.has(rule.id) ? "completed" : ""}" data-complete-region="${rule.id}">
      <strong>${completed.has(rule.id) ? "已记录完成" : "完成该区域"}</strong><span>${rule.name}</span>
    </button>
  `).join("");
  $("#restricted-buttons").innerHTML = restrictedRules.map((rule) => `<button data-restricted-region="${rule.id}">记录提醒：${rule.name}</button>`).join("");
  $("#progress-pill").textContent = `${completed.size} / ${state.plan.allowedRegions.length} 已完成`;
  const progress = state.plan.allowedRegions.length ? completed.size / state.plan.allowedRegions.length * 100 : 0;
  $("#visual-progress").style.width = `${progress}%`;
  $("#metric-completed").textContent = completed.size;
  $("#metric-missed").textContent = state.plan.allowedRegions.length - completed.size;
  $("#metric-events").textContent = events.length;
  $("#undo-btn").disabled = !events.length;
  renderEventFeed(events);
  $$('[data-complete-region]').forEach((button) => button.addEventListener("click", () => recordCompleted(button.dataset.completeRegion)));
  $$('[data-restricted-region]').forEach((button) => button.addEventListener("click", () => recordRestricted(button.dataset.restrictedRegion)));
}

function renderEventFeed(events) {
  const list = $("#event-list");
  if (!events.length) {
    list.innerHTML = '<li class="empty">暂无操作记录，请先完成一个区域。</li>';
    return;
  }
  list.innerHTML = [...events].reverse().map((event) => {
    const labels = {
      region_completed: `记录完成：${regionName(event.regionId)}`,
      restricted_area: `重点避让提醒：${regionName(event.regionId)}`,
      missed_area: `标记为待确认：${regionName(event.regionId)}`
    };
    return `<li>${labels[event.eventType] ?? event.eventType}<time>${new Date(event.timestamp).toLocaleTimeString("zh-CN")}</time></li>`;
  }).join("");
}

function setCurrentAlert(type, title, detail) {
  const box = $("#current-alert");
  box.className = `current-alert ${type}`;
  box.innerHTML = `<span>当前提示</span><strong>${title}</strong><p>${detail}</p>`;
}

function recordCompleted(regionId) {
  const event = inputModule.createManualEvent({ treatmentPlanId: state.plan.id, eventType: "region_completed", regionId });
  eventModule.add(event);
  setCurrentAlert("success", "记录完成", `${regionName(regionId)}已完成，区域进度已更新。`);
  renderOperation();
  persistSnapshot();
}

function recordRestricted(regionId) {
  const event = inputModule.createManualEvent({ treatmentPlanId: state.plan.id, eventType: "restricted_area", regionId });
  eventModule.add(event);
  const alert = detector.detectEvent(state.plan, event, regionRules.getRule(state.plan.treatmentType, regionId));
  alertModule.add(alert);
  setCurrentAlert("alert", "重点避让提醒", `当前记录接近${regionName(regionId)}，请暂停确认。`);
  renderOperation();
  persistSnapshot();
}

function markMissed() {
  const unfinished = state.plan.allowedRegions.find((id) => !getCompleted().has(id));
  if (!unfinished) {
    showToast("本次治疗区域均已记录完成，无待确认区域。");
    return;
  }
  const event = inputModule.createManualEvent({ treatmentPlanId: state.plan.id, eventType: "missed_area", regionId: unfinished });
  eventModule.add(event);
  setCurrentAlert("alert", "待确认区域", `${regionName(unfinished)}尚未完成记录，请确认是否需要补充。`);
  renderOperation();
  persistSnapshot();
}

function undoLast() {
  const removed = eventModule.undo();
  if (!removed) return;
  alertModule.removeByRelatedEvent(removed.id);
  setCurrentAlert("neutral", "已撤销上一条", `${regionName(removed.regionId)}的最近一条操作记录已移除。`);
  renderOperation();
  persistSnapshot();
}

function endOperation() {
  const events = eventModule.list();
  const missedAlerts = detector.detectMissed(state.plan, events);
  alertModule.addMany(missedAlerts);
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.qualityLog = logModule.generate(state.plan, events, alertModule.list(), state.startedAt, state.rules);
  renderQualityLog();
  persistSnapshot();
  goTo("log");
}

function renderQualityLog() {
  const log = state.qualityLog;
  $("#log-id").textContent = `记录编号 ${log.treatmentPlanId}`;
  $("#log-metrics").innerHTML = [
    ["区域完成度", `${log.coverageRate}%`], ["待确认区域", log.missedCount], ["重点避让提醒", log.suspectedRestrictedCount],
    ["操作时长", formatTime(log.duration)], ["待复核事项", log.unresolvedItems.length]
  ].map(([label, value]) => `<div class="log-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("#log-plan").innerHTML = [
    ["操作医生", log.operator], ["本次治疗区域", log.plannedRegions.join("、") || "无"], ["已完成区域", log.completedRegions.join("、") || "无"],
    ["待确认区域", log.missedRegions.join("、") || "无"], ["治疗备注", log.notes || "无"]
  ].map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("");
  const sourceLabels = { manual: "manual（人工标注）", simulation: "simulation（合成演示）", device_mock: "device_mock（模拟设备）", video_mock: "video_mock（模拟视频AI）" };
  const visibleSources = log.eventSources?.map((source) => sourceLabels[source] || source).join(" / ") || "人工标注 / 模拟事件";
  const logDetails = [
    ["完成度计算", `${log.completedRegions.length} ÷ ${log.plannedRegions.length} × 100%`], ["待确认提醒", `${log.missedCount} 次`],
    ["重点避让提醒", `${log.suspectedRestrictedCount} 次`],
    ["区域偏差率", log.regionDeviationRate === null ? "暂无计划区域计算" : `${log.regionDeviationRate}%`],
    ["偏差事件率", log.deviationEventRate === null ? "暂无足够事件计算" : `${log.deviationEventRate}%`],
    ["指标口径", "同一区域若同时漏打及发生其他偏差，区域偏差只计一次；偏差事件率不纳入结束时推断的漏打区域。"],
    ["提示响应", "待人工补充"], ["事件来源", visibleSources]
  ];
  if (!new URLSearchParams(window.location.search).has("demo")) {
    logDetails.splice(6, 0, ["旧口径", `${log.deviationRate === null ? "暂无足够事件计算" : `${log.deviationRate}%`}；仅用于测试规则，不作为最终业务指标。`]);
  }
  $("#log-deviations").innerHTML = logDetails.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("");
  $("#unresolved-list").innerHTML = log.unresolvedItems.length
    ? log.unresolvedItems.map((item) => `<li>${item}</li>`).join("")
    : "<li>未记录待复核提示。该结果不构成医疗、安全或疗效结论。</li>";
  $("#generated-time").textContent = `GENERATED ${new Date(log.generatedAt).toLocaleString("zh-CN")}`;
  $(".validation-panel").hidden = state.demoMode;
  fillValidationMetrics(log);
  if (!$("#validation-date").value) $("#validation-date").value = new Date().toISOString().slice(0, 10);
  renderValidationCount();
}

function fillValidationMetrics(log) {
  $("#validation-planned").value = log.plannedRegions.length;
  $("#validation-completed").value = log.completedRegions.length;
  $("#validation-missed").value = log.missedCount;
  $("#validation-restricted").value = log.suspectedRestrictedCount;
  $("#validation-coverage").value = `${log.coverageRate}%`;
  $("#validation-region-deviation").value = log.regionDeviationRate === null ? "暂无计划区域计算" : `${log.regionDeviationRate}%`;
  $("#validation-event-deviation").value = log.deviationEventRate === null ? "暂无足够事件计算" : `${log.deviationEventRate}%`;
  $("#validation-duration").value = `${log.duration} 秒`;
}

function persistSnapshot() {
  const snapshot = { plan: state.plan, events: eventModule.list(), alerts: alertModule.list(), qualityLog: state.qualityLog };
  if (state.demoMode) {
    demoStateModule.save(snapshot);
    return;
  }
  eventModule.save(snapshot);
}

function renderValidationCount() {
  const count = validationRecordModule.list().length;
  $("#validation-count").textContent = `本地记录 ${count} 条`;
  $("#export-validation").disabled = count === 0;
}

function saveValidationRecord(event) {
  event.preventDefault();
  if (state.demoMode) {
    showToast("演示数据禁止写入验证记录。");
    return;
  }
  const log = state.qualityLog;
  if (!log) return;
  const participantId = $("#participant-id").value.trim();
  const willingnessScore = Number($("#willingness-score").value);
  if (!participantId || willingnessScore < 1 || willingnessScore > 5) {
    showToast("请填写试用者编号和 1—5 分意愿评分。");
    return;
  }
  const record = validationRecordModule.create({
    condition: $("#validation-condition").value,
    participantId,
    plannedRegionCount: log.plannedRegions.length,
    completedRegionCount: log.completedRegions.length,
    missedRegionCount: log.missedCount,
    suspectedRestrictedCount: log.suspectedRestrictedCount,
    coverageRate: log.coverageRate,
    regionDeviationRate: log.regionDeviationRate,
    deviationEventRate: log.deviationEventRate,
    duration: log.duration,
    alertUnderstood: $("#alert-understood").value,
    alertDisruptive: $("#alert-disruptive").value,
    familiarity: $("#prototype-familiarity").value,
    willingnessScore,
    notes: $("#validation-notes").value,
    testDate: $("#validation-date").value
  });
  validationRecordModule.add(record);
  $("#validation-form").reset();
  fillValidationMetrics(log);
  $("#validation-date").value = new Date().toISOString().slice(0, 10);
  renderValidationCount();
  showToast("模拟验证记录已保存在本机。");
}

function clearCurrentSession({ clearTreatment = true } = {}) {
  state.plan = null;
  state.rules = [];
  state.startedAt = null;
  state.qualityLog = null;
  eventModule.reset({ clearStorage: clearTreatment });
  alertModule.reset();
  window.clearInterval(state.timerId);
  state.timerId = null;
  $("#plan-form").reset();
  $(".validation-panel").hidden = false;
  renderPlanRules();
}

function resetSession() {
  if (state.demoMode) {
    exitDemoMode();
    return;
  }
  clearCurrentSession({ clearTreatment: true });
  goTo("plan");
}

function setDemoUi(active) {
  state.demoMode = active;
  $("#demo-banner").hidden = !active;
  $("#demo-controls").hidden = !active;
  document.body.classList.toggle("demo-mode", active);
}

function startDemoMode() {
  clearCurrentSession({ clearTreatment: false });
  demoStateModule.clear();
  demoStateModule.start({ stage: "rules" });
  setDemoUi(true);
  goTo("plan");
  $("#operator").value = "演示操作员（合成）";
  $("#notes").value = "演示数据 / 合成操作轨迹 / 不代表真实用户或临床结果";
  createPlan({ preventDefault() {} });
}

function exitDemoMode() {
  demoStateModule.clear();
  setDemoUi(false);
  clearCurrentSession({ clearTreatment: false });
  window.history.replaceState({}, "", window.location.pathname);
  goTo("home");
}

function bindEvents() {
  $("#start-btn").addEventListener("click", () => goTo("plan"));
  $("#portfolio-btn").addEventListener("click", () => goTo("portfolio"));
  $("#footer-about").addEventListener("click", () => goTo("portfolio"));
  $("#sidebar-about").addEventListener("click", () => goTo("portfolio"));
  const drawer = $("#nav-drawer");
  const backdrop = $("#drawer-backdrop");
  let drawerTrigger = null;
  const closeDrawer = () => { drawer.setAttribute("aria-hidden", "true"); backdrop.hidden = true; $("#mobile-menu").setAttribute("aria-expanded", "false"); drawerTrigger?.focus(); };
  $("#mobile-menu").addEventListener("click", (event) => { drawerTrigger = event.currentTarget; drawer.setAttribute("aria-hidden", "false"); backdrop.hidden = false; event.currentTarget.setAttribute("aria-expanded", "true"); $("#drawer-close").focus(); });
  $("#drawer-close").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  drawer.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.getAttribute("aria-hidden") === "false") closeDrawer(); });
  const confirmDialog = $("#confirm-dialog");
  let confirmTrigger = null;
  $("#exit-flow").addEventListener("click", (event) => { confirmTrigger = event.currentTarget; $("#confirm-title").textContent = "退出当前治疗记录？"; $("#confirm-description").textContent = "当前演示记录会保留在本地，您可以稍后继续。"; confirmDialog.showModal(); $("#confirm-action").focus(); });
  confirmDialog.addEventListener("close", () => { if (confirmDialog.returnValue === "confirm") goTo("home"); confirmTrigger?.focus(); });
  $("#evidence-home-btn").addEventListener("click", () => goTo("evidence"));
  $("#portfolio-prototype-btn").addEventListener("click", () => goTo("plan"));
  $("#evidence-btn")?.addEventListener("click", () => goTo("evidence"));
  $("#demo-btn").addEventListener("click", startDemoMode);
  $("#portfolio-demo-btn").addEventListener("click", startDemoMode);
  $("#exit-demo-btn").addEventListener("click", exitDemoMode);
  $("#demo-complete-btn").addEventListener("click", () => {
    if (!state.demoMode || !state.plan) return;
    state.plan.allowedRegions.slice(0, -1).forEach((regionId) => {
      if (!eventModule.list().some((item) => item.regionId === regionId && item.eventType === "region_completed")) recordCompleted(regionId);
    });
  });
  $("#demo-restricted-btn").addEventListener("click", () => {
    if (!state.demoMode || !state.plan) return;
    const regionId = state.plan.restrictedRegions[0];
    if (!eventModule.list().some((item) => item.regionId === regionId && item.eventType === "restricted_entry")) recordRestricted(regionId);
  });
  $("#demo-log-btn").addEventListener("click", () => {
    if (state.demoMode && state.plan) endOperation();
  });
  $$("[data-go]").forEach((button) => button.addEventListener("click", () => goTo(button.dataset.go)));
  $("#treatment-type").addEventListener("change", renderPlanRules);
  $("#plan-form").addEventListener("submit", createPlan);
  $("#confirm-rules").addEventListener("click", beginOperation);
  $("#undo-btn").addEventListener("click", undoLast);
  $("#miss-btn").addEventListener("click", markMissed);
  $("#end-btn").addEventListener("click", endOperation);
  $("#new-session").addEventListener("click", resetSession);
  $("#copy-log").addEventListener("click", async () => {
    try { await exportModule.copy(state.qualityLog); showToast("日志已复制到剪贴板。"); }
    catch { showToast("浏览器未授权剪贴板，请使用导出 TXT。"); }
  });
  $("#download-log").addEventListener("click", () => exportModule.download(state.qualityLog));
  $("#validation-form").addEventListener("submit", saveValidationRecord);
  $("#export-validation").addEventListener("click", () => validationRecordModule.downloadCsv());
}

function loadDemoState() {
  const demo = new URLSearchParams(window.location.search).get("demo");
  demoStateModule.clear();
  if (!demo || demo === "entry") return;
  if (demo === "portfolio") {
    goTo("portfolio");
    return;
  }
  if (demo === "evidence") {
    goTo("evidence");
    return;
  }
  setDemoUi(true);
  demoStateModule.start({ stage: demo, screenshotFixture: true });
  goTo("plan");
  $("#operator").value = "演示操作员（合成）";
  $("#notes").value = "演示数据 / 合成操作轨迹 / 不代表真实用户或临床结果";
  if (demo === "plan") return;

  createPlan({ preventDefault() {} });
  if (demo === "rules") return;
  beginOperation();
  if (demo === "operation") {
    recordCompleted(state.plan.allowedRegions[0]);
    recordCompleted(state.plan.allowedRegions[1]);
    return;
  }
  if (demo === "restricted") {
    recordCompleted(state.plan.allowedRegions[0]);
    recordRestricted(state.plan.restrictedRegions[0]);
    return;
  }
  if (demo === "missed") {
    recordCompleted(state.plan.allowedRegions[0]);
    endOperation();
    return;
  }
  if (demo === "log") {
    state.plan.allowedRegions.slice(0, -1).forEach(recordCompleted);
    recordRestricted(state.plan.restrictedRegions[0]);
    endOperation();
  }
}

localStorage.removeItem("quality-sentinel-session");
localStorage.removeItem("quality-sentinel-validation-records");
document.querySelector(".notice span").textContent = PROJECT_DISCLAIMER;
renderTreatmentOptions();
bindEvents();
goTo("home");
loadDemoState();
