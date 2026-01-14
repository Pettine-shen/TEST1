import http from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 5173);
const root = __dirname;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    const rel = pathname === "/" ? "/editor/index.html" : pathname;
    const abs = safeJoin(root, rel);
    if (!abs) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const st = await stat(abs).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(abs);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(await readFile(abs));
  } catch (e) {
    res.writeHead(500);
    res.end(String(e?.stack || e));
  }
});

server.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`Dev server: http://127.0.0.1:${port}/`);
});
