export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ configured: false, error: "METHOD_NOT_ALLOWED" });
  }
  const configured = Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ configured, model: configured ? process.env.LLM_MODEL : null, provider: configured ? "OpenAI兼容接口" : null });
}
