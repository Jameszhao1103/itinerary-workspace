import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntime } from "./create-runtime.mjs";
import { handleAppRequest, toErrorResponse } from "./app-router.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "../../public");

export async function createAppServer() {
  let runtime = await createRuntime();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const pathname = url.pathname;

      if (request.method === "GET" && pathname === "/") {
        return serveStatic(response, "index.html");
      }

      if (request.method === "GET" && (pathname === "/app.js" || pathname === "/app.css")) {
        return serveStatic(response, pathname.slice(1));
      }

      if (pathname.startsWith("/api/")) {
        const routeResponse = await handleAppRequest(runtime, {
          method: request.method,
          url: request.url ?? pathname,
          body: request.method === "POST" ? await readJsonBody(request) : undefined,
        });
        if (pathname === "/api/debug/reset" && routeResponse.payload.ok) {
          runtime = await createRuntime();
        }
        return writeJson(response, routeResponse.status, routeResponse.payload);
      }

      return writeJson(response, 404, {
        ok: false,
        error: {
          code: "not_found",
          message: `No route for ${request.method} ${pathname}`,
        },
      });
    } catch (error) {
      const routeResponse = toErrorResponse(error);
      return writeJson(response, routeResponse.status, routeResponse.payload);
    }
  });

  return {
    server,
    getSampleTripId() {
      return runtime.sampleTripId;
    },
  };
}

async function serveStatic(response, fileName) {
  const filePath = join(PUBLIC_DIR, fileName);
  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": "no-store",
  });
  response.end(content);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    default:
      return "text/html; charset=utf-8";
  }
}
