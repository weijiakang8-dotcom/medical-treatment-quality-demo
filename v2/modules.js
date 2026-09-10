export const V2_DISCLAIMER = "V2扩展功能仅用于沙盒演示与架构验证，不接触真实患者、不用于真实医疗决策、不连接未经授权的设备或内部系统。";
export const V2_KEYS = Object.freeze({ auth:"v2_auth", users:"v2_users", orgs:"v2_orgs", patients:"v2_patients", treatments:"v2_treatments", deviceEvents:"v2_device_events", videoJobs:"v2_video_jobs", aiResults:"v2_ai_results", roi:"v2_roi", nps:"v2_nps", auditLogs:"v2_audit_logs" });
export const ROLES = Object.freeze(["platform_admin","org_admin","medical_operator","front_desk","patient","viewer"]);
const uid=(prefix)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const now=()=>new Date().toISOString();

export class MemoryStore { constructor(){this.map=new Map()} getItem(k){return this.map.get(k)??null} setItem(k,v){this.map.set(k,String(v))} removeItem(k){this.map.delete(k)} }
export class LocalRepository {
  constructor(key,storage=globalThis.localStorage){this.key=key;this.storage=storage}
  list(){try{const value=JSON.parse(this.storage.getItem(this.key)??"[]");return Array.isArray(value)?value:[]}catch{return []}}
  save(items){this.storage.setItem(this.key,JSON.stringify(items));return items}
  add(item){const items=[...this.list(),item];this.save(items);return item}
  get(id){return this.list().find(x=>x.id===id)??null}
  update(id,patch){let found=null;const items=this.list().map(x=>x.id===id?(found={...x,...patch}):x);this.save(items);return found}
  delete(id){const before=this.list();this.save(before.filter(x=>x.id!==id));return before.length!==this.list().length}
  clear(){this.storage.removeItem(this.key)}
}
export class UserRepository extends LocalRepository { constructor(s){super(V2_KEYS.users,s)} }
export class OrganizationRepository extends LocalRepository { constructor(s){super(V2_KEYS.orgs,s)} }
export class PatientRepository extends LocalRepository { constructor(s){super(V2_KEYS.patients,s)} }
export class TreatmentRepository extends LocalRepository { constructor(s){super(V2_KEYS.treatments,s)} }
export class DeviceEventRepository extends LocalRepository { constructor(s){super(V2_KEYS.deviceEvents,s)} }
export class VideoJobRepository extends LocalRepository { constructor(s){super(V2_KEYS.videoJobs,s)} }
export class AIResultRepository extends LocalRepository { constructor(s){super(V2_KEYS.aiResults,s)} }
export class ROIRepository extends LocalRepository { constructor(s){super(V2_KEYS.roi,s)} }
export class NPSRepository extends LocalRepository { constructor(s){super(V2_KEYS.nps,s)} }
export class AuditLogRepository extends LocalRepository { constructor(s){super(V2_KEYS.auditLogs,s)} }

export class AuditService {
  constructor(repository){this.repository=repository}
  record({actorId=null,organizationId=null,action,resourceType,resourceId=null,result="success",source="sandbox_ui"}){return this.repository.add({id:uid("audit"),actorId,organizationId,action,resourceType,resourceId,timestamp:now(),result,source})}
}
const permissions={
  platform_admin:["platform.manage","org.switch","user.manage","patient.read","treatment.read","sandbox.export","sandbox.delete"],
  org_admin:["org.switch","user.manage","patient.create","patient.read","treatment.create","treatment.read","sandbox.export","sandbox.delete"],
  medical_operator:["patient.read","treatment.create","treatment.read","device.import","video.create","ai.generate"],
  front_desk:["patient.create","patient.read.basic","appointment.read"], patient:["self.read","nps.create"], viewer:["patient.read.masked","treatment.read.masked"]
};
export class AuthService {
  constructor(users,audit,storage=globalThis.localStorage){this.users=users;this.audit=audit;this.storage=storage}
  hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
  register({role,organizationId=null,displayName,password,demoPatientId=null}){if(!ROLES.includes(role))throw new Error("无效角色");if(!password||password.length<6)throw new Error("沙盒密码至少6位");const user={id:uid("user"),role,organizationId,displayName:String(displayName).trim().slice(0,60),status:"active",createdAt:now(),passwordHash:this.hash(password),demoPatientId};this.users.add(user);this.audit.record({actorId:user.id,organizationId,action:"register",resourceType:"user",resourceId:user.id,source:"sandbox_auth"});return {...user,passwordHash:undefined}}
  login({displayName,password}){const user=this.users.list().find(x=>x.displayName===displayName&&x.passwordHash===this.hash(password)&&x.status==="active");if(!user){this.audit.record({action:"login",resourceType:"session",result:"denied",source:"sandbox_auth"});throw new Error("账号或密码错误")};const session={userId:user.id,role:user.role,organizationId:user.organizationId,createdAt:now(),sandbox:true};this.storage.setItem(V2_KEYS.auth,JSON.stringify(session));this.audit.record({actorId:user.id,organizationId:user.organizationId,action:"login",resourceType:"session",result:"success",source:"sandbox_auth"});return session}
  session(){try{return JSON.parse(this.storage.getItem(V2_KEYS.auth)??"null")}catch{return null}}
  logout(){const s=this.session();this.storage.removeItem(V2_KEYS.auth);this.audit.record({actorId:s?.userId,organizationId:s?.organizationId,action:"logout",resourceType:"session",source:"sandbox_auth"})}
  can(permission,session=this.session()){return Boolean(session&&permissions[session.role]?.includes(permission))}
  require(permission,session=this.session()){if(!this.can(permission,session)){this.audit.record({actorId:session?.userId,organizationId:session?.organizationId,action:"permission_denied",resourceType:permission,result:"denied",source:"sandbox_auth"});throw new Error("无权执行此沙盒操作")}return true}
  scope(items,session=this.session()){if(!session)return[];if(session.role==="platform_admin")return items;if(session.role==="patient")return items.filter(x=>x.patientId===this.users.get(session.userId)?.demoPatientId);return items.filter(x=>x.organizationId===session.organizationId)}
}

export class OrganizationService { constructor(repo,auth,audit){Object.assign(this,{repo,auth,audit})} create(name,session){this.auth.require("platform.manage",session);const item={id:uid("org"),name:String(name).slice(0,80),status:"active",createdAt:now()};this.repo.add(item);this.audit.record({actorId:session.userId,action:"create_org",resourceType:"organization",resourceId:item.id,source:"sandbox_ui"});return item} switch(id,session){this.auth.require("org.switch",session);if(session.role!=="platform_admin"&&session.organizationId!==id)throw new Error("禁止切换到其他机构");const next={...session,organizationId:id};this.auth.storage.setItem(V2_KEYS.auth,JSON.stringify(next));this.audit.record({actorId:session.userId,organizationId:id,action:"switch_org",resourceType:"organization",resourceId:id});return next} }
export class PatientService { constructor(repo,auth,audit){Object.assign(this,{repo,auth,audit})} create({organizationId,demoName,consentStatus="demo_only"},session){this.auth.require("patient.create",session);if(session.organizationId!==organizationId&&session.role!=="platform_admin")throw new Error("禁止跨机构创建");if(/\d{11}|身份证|病历号/i.test(demoName))throw new Error("不得输入真实个人信息");const item={id:uid("patient"),organizationId,demoName:String(demoName).slice(0,40),consentStatus,createdAt:now(),isSynthetic:true};this.repo.add(item);this.audit.record({actorId:session.userId,organizationId,action:"create_demo_patient",resourceType:"patient",resourceId:item.id});return item} list(session){return this.auth.scope(this.repo.list(),session)} }

export class DeviceAdapterInterface { parse(){throw new Error("DeviceAdapterInterface.parse未实现")} }
export class MockDeviceAdapter extends DeviceAdapterInterface { parse(rows){return rows.map((r,i)=>({id:r.eventId||uid(`mock-${i}`),treatmentId:r.treatmentId,eventType:r.eventType,regionId:r.regionId,value:{energy:r.energy??null,depth:r.depth??null,shotCount:r.shotCount??null},timestamp:r.timestamp,source:"mock_device",isSynthetic:true}))} }
export class CSVDeviceAdapter extends DeviceAdapterInterface { parse(text){const lines=String(text).trim().split(/\r?\n/);if(lines.length<2)return{events:[],errors:["CSV无数据行"]};const headers=lines[0].split(",");const required=["eventId","deviceId","treatmentId","regionId","eventType","energy","depth","shotCount","timestamp"];const missing=required.filter(x=>!headers.includes(x));if(missing.length)return{events:[],errors:[`缺少字段: ${missing.join(",")}`]};const rows=lines.slice(1).map(line=>Object.fromEntries(headers.map((h,i)=>[h,line.split(",")[i]??""])));return{events:new MockDeviceAdapter().parse(rows),errors:[]}} }
export class FutureDeviceAdapter extends DeviceAdapterInterface { parse(){return{events:[],errors:["[待真实环境验证] 未配置授权设备接口"]}} }

export class VideoJobService { constructor(repo,audit){this.repo=repo;this.audit=audit} create({treatmentId,fileName,size,type},session){if(!/video\/(mp4|webm)/.test(type)||size>20*1024*1024)throw new Error("仅允许20MB以内的MP4/WebM演示文件");const job={id:uid("video"),treatmentId,fileName:String(fileName).slice(0,120),status:"queued",source:"sandbox_upload_metadata",createdAt:now(),isSynthetic:true};this.repo.add(job);this.audit.record({actorId:session?.userId,organizationId:session?.organizationId,action:"upload_video",resourceType:"video_job",resourceId:job.id});return job} }
export class AIProviderInterface { generate(){throw new Error("AIProviderInterface.generate未实现")} }
const aiResult=(sourceId,resultType,explanation,source)=>({id:uid("ai"),sourceId,resultType,confidence:null,explanation,status:"requires_human_review",createdAt:now(),source,isSynthetic:source!=="rule_based",requiresHumanReview:true});
export class RuleBasedProvider extends AIProviderInterface { generate(input){return aiResult(input.id,"event_classification",`[规则生成] 事件类型：${input.eventType}`,"rule_based")} }
export class MockAIProvider extends AIProviderInterface { generate(input){return aiResult(input.id,"log_summary","[模拟AI结果] 沙盒摘要，不含医学结论。","mock_ai")} }
export class FutureVisionProvider extends AIProviderInterface { generate(input){return{...aiResult(input.id,"vision_placeholder","[待真实模型验证] 未实现真实医学视觉识别。","future_vision"),status:"not_implemented"}} }

export function calculateROI(values){const n=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number(v||0)]));const complaintSavings=n.orgCount*n.annualTreatments*n.complaintRate*n.avoidableRate*n.complaintCost;const repurchaseContribution=n.orgCount*n.annualTreatments*n.repurchaseLift*n.repurchaseContribution;return{complaintSavings,repurchaseContribution,netScenarioValue:complaintSavings+repurchaseContribution-n.deploymentCost-n.annualOperatingCost,source:"user_input_scenario",label:"[情景测算] 不代表半岛实际财务结果。"}}
export function calculateNPS(records,group){const selected=records.filter(x=>x.group===group);if(!selected.length)return{value:null,label:"暂无数据",count:0};const promoters=selected.filter(x=>x.score>=9).length/selected.length*100;const detractors=selected.filter(x=>x.score<=6).length/selected.length*100;return{value:Math.round((promoters-detractors)*10)/10,label:selected.some(x=>x.isDemo)?"[演示数据]":"[用户输入]",count:selected.length}}
export function exportSandbox(repositories){return Object.fromEntries(Object.entries(repositories).map(([name,repo])=>[name,repo.list()]))}
export function deleteOrganizationData(orgId,repositories){let deleted=0;for(const repo of Object.values(repositories)){const items=repo.list();const kept=items.filter(x=>x.organizationId!==orgId);deleted+=items.length-kept.length;repo.save(kept)}return deleted}
