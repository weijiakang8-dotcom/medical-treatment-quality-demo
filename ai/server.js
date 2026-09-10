import http from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LLMService } from "./LLMService.js";
import { TREATMENT_CONFIG } from "../config.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
async function loadEnv(){try{const text=await readFile(resolve(root,".env.local"),"utf8");for(const line of text.split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2]}}catch{}}
await loadEnv();
const auditFile=resolve(root,"logs/ai-calls.ndjson");
const audit=async record=>{await mkdir(dirname(auditFile),{recursive:true});await appendFile(auditFile,JSON.stringify(record)+"\n")};
const service=new LLMService({baseUrl:process.env.LLM_BASE_URL,apiKey:process.env.LLM_API_KEY,model:process.env.LLM_MODEL,timeoutMs:process.env.LLM_TIMEOUT_MS,audit:record=>void audit(record)});
const allowedOrigins=new Set(["http://127.0.0.1:4173","http://localhost:4173"]);
const json=(res,status,body,origin)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"http://127.0.0.1:4173","Vary":"Origin"});res.end(JSON.stringify(body))};
const context={availableTreatments:TREATMENT_CONFIG.map(x=>({id:x.id,name:x.name})),availableRegions:TREATMENT_CONFIG.flatMap(x=>x.regions.map(r=>({id:r.id,name:r.name,ruleType:r.ruleType,treatmentType:x.id})))};
const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||"";if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"http://127.0.0.1:4173","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});return res.end()}if(req.method==="GET"&&req.url==="/api/ai/status")return json(res,200,{configured:service.configured(),model:service.configured()?process.env.LLM_MODEL:null,provider:service.configured()?"OpenAI兼容接口":null},origin);if(req.method!=="POST"||!["/api/ai/plan","/api/ai/summary","/api/ai/query"].includes(req.url))return json(res,404,{error:"NOT_FOUND"},origin);let body="";for await(const chunk of req){body+=chunk;if(body.length>100000){res.destroy();return}}let value;try{value=JSON.parse(body)}catch{return json(res,400,{error:"INVALID_REQUEST"},origin)}let result;if(req.url==="/api/ai/plan")result=await service.generateStructuredPlan(value.input,{...context,...value.context});if(req.url==="/api/ai/summary")result=await service.summarizeQualityLog(value.qualityLog,value.audience);if(req.url==="/api/ai/query")result=await service.parseNaturalLanguageQuery(value.input,value.context);json(res,result.success?200:result.error?.code==="NOT_CONFIGURED"?503:422,result,origin)});
const port=Number(process.env.AI_PROXY_PORT||4174);server.listen(port,"127.0.0.1",()=>console.log(`AI proxy listening on http://127.0.0.1:${port}`));
