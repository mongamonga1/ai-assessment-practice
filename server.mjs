import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { AssistantError, generateReply } from "./lib/assistant.mjs";
const root = resolve(import.meta.dirname, "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const json = (res, status, data) =>
  res
    .writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    })
    .end(JSON.stringify(data));
export function createApp({
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = fetch,
} = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        // Only this loopback app may spend the server's API key.
        const hostname = new URL(`http://${req.headers.host}`).hostname;
        if (
          !["127.0.0.1", "localhost", "[::1]"].includes(hostname) ||
          req.headers["sec-fetch-site"] === "cross-site"
        ) {
          json(res, 403, { error: "로컬 페이지에서 요청하세요." });
          return;
        }
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`
        ) {
          json(res, 403, { error: "허용되지 않은 요청입니다." });
          return;
        }
        if (url.pathname === "/api/assistant/status" && req.method === "GET") {
          json(res, 200, { configured: Boolean(apiKey), model: "gpt-4o-mini" });
          return;
        }
        if (url.pathname !== "/api/assistant") {
          json(res, 404, { error: "API를 찾을 수 없습니다." });
          return;
        }
        if (req.method !== "POST") {
          json(res, 405, { error: "POST 요청만 지원합니다." });
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          json(res, 415, { error: "JSON 요청이 필요합니다." });
          return;
        }
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1000000)
            throw new AssistantError(
              413,
              "첨부 자료가 너무 큽니다. 자료 수를 줄여 주세요.",
            );
          chunks.push(chunk);
        }
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new AssistantError(400, "JSON 형식이 올바르지 않습니다.");
        }
        const result = await generateReply(payload, { apiKey, fetchImpl });
        if (process.env.ASSISTANT_DEBUG === "1")
          console.log("AI scope:", JSON.stringify(result.context));
        json(res, 200, result);
        return;
      }
      const path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const file = path === root ? resolve(root, "index.html") : path;
      const content = await readFile(file);
      res
        .writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(content);
    } catch (error) {
      if (req.url?.startsWith("/api/"))
        json(res, error.status || 500, {
          error:
            error instanceof AssistantError
              ? error.message
              : "요청을 처리하지 못했습니다.",
        });
      else res.writeHead(404).end("Not found");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  createApp().listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
    console.log(
      "Local: http://127.0.0.1:" + (Number(process.env.PORT) || 4173),
    ),
  );
}
