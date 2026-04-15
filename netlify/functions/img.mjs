import { createHmac } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const SECRET = process.env.IMG_SECRET || "changeme-set-IMG_SECRET-env-var";
const TOKEN_TTL = 90; // seconds — must match img-token.mjs

// MIME type map
const MIME = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
};

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { f: filePath, token, ts } = event.queryStringParameters || {};

  if (!filePath || !token || !ts) {
    return { statusCode: 400, body: "Missing parameters" };
  }

  // Sanitize path — prevent traversal
  const normalized = filePath.replace(/\\/g, "/").replace(/\.\.+/g, "");
  if (!normalized.startsWith("assets/")) {
    return { statusCode: 403, body: "Forbidden" };
  }

  // Validate token
  const tsNum = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(tsNum) || now - tsNum > TOKEN_TTL) {
    return {
      statusCode: 403,
      body: "Token expired",
      headers: { "Cache-Control": "no-store" },
    };
  }

  const payload = `${normalized}:${tsNum}`;
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  if (token !== expected) {
    return { statusCode: 403, body: "Invalid token" };
  }

  // Resolve file path — in Netlify Functions, the site root is available at process.cwd()
  // The assets are included via netlify.toml included_files
  const absPath = join(process.cwd(), normalized);

  if (!existsSync(absPath)) {
    return { statusCode: 404, body: "Not found" };
  }

  try {
    const data = await readFile(absPath);
    const ext = normalized.split(".").pop().toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        // Short cache — browser can cache for 2 minutes, but CDN/proxies must not
        "Cache-Control": "private, max-age=120",
        // Prevent hotlinking by not exposing the URL pattern
        "X-Robots-Tag": "noindex",
      },
      body: data.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: "Error reading file" };
  }
};
