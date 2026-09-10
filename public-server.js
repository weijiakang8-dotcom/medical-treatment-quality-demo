import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { handleAI } from "./api/ai/_handler.js";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4175);
const host = process.env.HOST || "127.0.0.1";
const blocked = /(^|\/)(?:\.|logs(?:\/|$)|node_modules(?:\/|$)|api(?:\/|$))|(?:\.test\.mjs$)|(?:\.md$)|(?:\.json$)/i;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  const relative = normalize(path).replace(/^[/\\]+/, "");
  if (!relative || relative.includes("..") || blocked.test(relative)) {
    res.statusCode = 404; return res.end("Not found");
  }
  const file = resolve(root, relative);
  if (!file.startsWith(`${root}/`)) { res.statusCode = 404; return res.end("Not found"); }
  try {
    if (!(await stat(file)).isFile()) throw new Error("not file");
    const content = await readFile(file);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", relative.endsWith(".html") ? "no-cache" : "public, max-age=3600");
    res.end(content);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
}

const routes = new Map([
  ["/api/ai/plan", "plan"],
  ["/api/ai/summary", "summary"],
  ["/api/ai/query", "query"],
]);

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/ai/status") {
    if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ configured: false, error: "METHOD_NOT_ALLOWED" })); }
    const configured = Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ configured, model: configured ? process.env.LLM_MODEL : null, provider: configured ? "OpenAI兼容接口" : null }));
  }
  if (routes.has(path)) return handleAI(req, res, routes.get(path));
  if (path.startsWith("/api/")) { res.statusCode = 404; return res.end(JSON.stringify({ error: "NOT_FOUND" })); }
  if (!new Set(["GET", "HEAD"]).has(req.method)) { res.statusCode = 405; return res.end("Method not allowed"); }
  return serveStatic(req, res);
});

server.listen(port, host, () => console.log(`Public demo listening on http://${host}:${port}`));
