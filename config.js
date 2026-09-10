export const PROJECT_DISCLAIMER =
  "候选人个人发起的自驱型作品集项目，非半岛医疗官方、授权或内部项目。仅用于模拟验证，不用于真实医疗决策。";

export const TREATMENT_CONFIG = [
  {
    id: "face-ultrasound-demo",
    ruleVersion: "face-demo-v1",
    name: "面部超声治疗（模拟）",
    description: "用于验证区域覆盖记录、偏差提示与复盘闭环。",
    regions: [
      { id: "left-cheek-upper", name: "左侧面颊上区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "left-cheek-lower", name: "左侧面颊下区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "right-cheek-upper", name: "右侧面颊上区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "right-cheek-lower", name: "右侧面颊下区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "forehead-center", name: "额部中央区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "eye-left", name: "左眼周预设禁区", ruleType: "restricted", status: "review_required", description: "项目演示配置，不代表医学或法规结论" },
      { id: "eye-right", name: "右眼周预设禁区", ruleType: "restricted", status: "review_required", description: "项目演示配置，不代表医学或法规结论" },
      { id: "nose-center", name: "鼻部中央预设禁区", ruleType: "restricted", status: "review_required", description: "项目演示配置，不代表医学或法规结论" }
    ]
  },
  {
    id: "neck-ultrasound-demo",
    ruleVersion: "neck-demo-v1",
    name: "颈部超声治疗（模拟）",
    description: "第二套可配置规则，用于证明区域并非写死在页面。",
    regions: [
      { id: "neck-left-upper", name: "左颈上区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "neck-left-lower", name: "左颈下区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "neck-right-upper", name: "右颈上区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "neck-right-lower", name: "右颈下区", ruleType: "allowed", status: "active", description: "本次计划可选区域" },
      { id: "neck-center", name: "颈部中央预设禁区", ruleType: "restricted", status: "review_required", description: "项目演示配置，不代表医学或法规结论" }
    ]
  }
];
