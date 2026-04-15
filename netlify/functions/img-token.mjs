import { createHmac } from "crypto";

// Secret key from environment variable (set in Netlify dashboard or netlify.toml)
const SECRET = process.env.IMG_SECRET || "changeme-set-IMG_SECRET-env-var";

// Token valid for 90 seconds
const TOKEN_TTL = 90;

export const handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const filePath = event.queryStringParameters?.f;
  if (!filePath) {
    return { statusCode: 400, body: "Missing file parameter" };
  }

  // Sanitize: only allow paths under assets/images/ and assets/images/blog/ etc.
  // Prevent path traversal
  const normalized = filePath.replace(/\\/g, "/").replace(/\.\.+/g, "");
  if (!normalized.startsWith("assets/")) {
    return { statusCode: 403, body: "Forbidden" };
  }

  const ts = Math.floor(Date.now() / 1000);
  const payload = `${normalized}:${ts}`;
  const token = createHmac("sha256", SECRET).update(payload).digest("hex");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Don't cache tokens
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
    body: JSON.stringify({ token, ts, ttl: TOKEN_TTL }),
  };
};
