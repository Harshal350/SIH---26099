import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fetcherScript = path.resolve(__dirname, "../scripts/live_fetcher.py");

export function liveRepositoryPlugin() {
  return {
    name: "vite-plugin-live-repository",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Live repository sync endpoint
        if (req.method === "POST" && url.pathname === "/api/repos/sync") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });

          req.on("end", () => {
            try {
              const payload = body ? JSON.parse(body) : {};
              const source = payload.source || "gem";
              const query = payload.query || "";
              const limit = String(payload.limit || 10);

              execFile(
                "python3",
                [fetcherScript, "--source", source, "--query", query, "--limit", limit],
                { timeout: 25000 },
                (error, stdout, stderr) => {
                  if (error) {
                    console.error("[live-sync] Error running live_fetcher.py:", stderr || error.message);
                    res.statusCode = 502;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        status: "ERROR",
                        error: stderr || error.message,
                      })
                    );
                    return;
                  }

                  try {
                    const parsed = JSON.parse(stdout);
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(parsed));
                  } catch (e) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ status: "ERROR", error: "Failed to parse fetcher output" }));
                  }
                }
              );
            } catch (err) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ status: "ERROR", error: err.message }));
            }
          });
          return;
        }

        // Live test endpoint
        if (req.method === "GET" && url.pathname === "/api/repos/health") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "UP", liveFetcher: "AVAILABLE", script: fetcherScript }));
          return;
        }

        next();
      });
    },
  };
}
