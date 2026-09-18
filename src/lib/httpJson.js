import http from "http";
import https from "https";

export function requestJson(url, options = {}) {
  const target = typeof url === "string" ? new URL(url) : url;
  const isHttps = target.protocol === "https:";
  const transport = isHttps ? https : http;
  const method = options.method || "GET";
  const body = options.body ? String(options.body) : null;

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (body && !headers["Content-Length"]) {
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        let rawBody = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          rawBody += chunk;
        });
        res.on("end", () => {
          let jsonBody = null;

          if (rawBody) {
            try {
              jsonBody = JSON.parse(rawBody);
            } catch {
              jsonBody = {
                error: "invalid_json_response",
                message: rawBody.slice(0, 500),
              };
            }
          }

          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body: jsonBody,
          });
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
