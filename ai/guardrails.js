const SENSITIVE=[{code:"PHONE",re:/(?:^|\D)1[3-9]\d{9}(?:\D|$)/},{code:"ID_CARD",re:/(?:^|\D)\d{17}[\dXx](?:\D|$)/},{code:"MEDICAL_RECORD",re:/(病历号|住院号|门诊号)\s*[:：]?\s*[A-Za-z0-9-]{4,}/i}];
const MEDICAL_CLAIMS=/(治疗安全|绝对安全|风险已排除|疗效良好|治疗有效|疗效达标|符合医学规范|符合医疗规范|建议.{0,8}(增加|降低|调整).{0,8}(能量|深度|发数)|适合治疗|不适合治疗)/i;
const PARAMETER_REQUEST=/(?:能量|深度|发数|焦耳|毫米|档位)|(?:\d\s*(?:mm|j\/cm2?)\b)/i;
export function detectSensitiveText(text){return SENSITIVE.filter(x=>x.re.test(String(text))).map(x=>x.code)}
export function containsMedicalClaim(value){return MEDICAL_CLAIMS.test(typeof value==="string"?value:JSON.stringify(value))}
export function containsTreatmentParameters(value){return PARAMETER_REQUEST.test(typeof value==="string"?value:JSON.stringify(value))}
export function sanitizeInputFields(value){if(!value||typeof value!=="object")return["input"];return Object.keys(value).slice(0,30)}
export function validateRegions(plan,context){const known=new Set((context.availableRegions||[]).map(x=>x.id));const unknown=[];for(const key of ["allowedRegions","attentionRegions","excludedRegions"])for(const id of plan[key]||[])if(!known.has(id))unknown.push(id);return[...new Set(unknown)]}
export function validateBusinessRules(operation,result,context={}){const errors=[];if(result?.requiresHumanConfirmation!==true)errors.push("HUMAN_CONFIRMATION_REQUIRED");if(containsMedicalClaim(result))errors.push("MEDICAL_CLAIM_BLOCKED");if(containsTreatmentParameters(result))errors.push("TREATMENT_PARAMETER_BLOCKED");if(operation==="generateStructuredPlan"){const unknown=validateRegions(result,context);if(unknown.length)errors.push(`UNKNOWN_REGION:${unknown.join(",")}`)}return{valid:errors.length===0,errors}}
