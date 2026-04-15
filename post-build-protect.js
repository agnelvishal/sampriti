/**
 * post-build-protect.js
 *
 * Runs after `vite build` to rewrite image src attributes in built HTML files.
 * Replaces:
 *   <img src="/assets/foo-HASH.avif">
 * with:
 *   <img data-pimg="assets/images/foo.avif" src="">
 *
 * Uses dist/.vite/manifest.json to map hashed filenames back to original source
 * paths (e.g. "assets/shakti-peya-new-JOlxPYMC.avif" → "assets/images/shakti-peya-new.avif").
 * This ensures data-pimg contains the path that the Netlify Function (img.mjs) can serve.
 */

import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

// Load Vite manifest to build hashed→original path map
let hashedToOriginal = {};
try {
  const manifest = JSON.parse(
    readFileSync("dist/.vite/manifest.json", "utf8")
  );
  for (const [originalPath, info] of Object.entries(manifest)) {
    if (info.file) {
      // manifest key: "assets/images/foo.avif"
      // info.file:    "assets/foo-HASH.avif"
      hashedToOriginal[info.file] = originalPath;
    }
  }
  console.log(
    `[protect-images] Loaded manifest with ${Object.keys(hashedToOriginal).length} entries.`
  );
} catch (e) {
  console.warn(
    "[protect-images] Warning: could not load dist/.vite/manifest.json — will use normalized paths as-is.",
    e.message
  );
}

const IMAGE_EXTS = /\.(avif|webp|jpg|jpeg|png|gif)(\?[^"']*)?$/i;

// Matches: src="assets/..." or src="/assets/..."
const IMG_SRC_RE = /(<img\b[^>]*?)\s+src=(["'])((?:\/)?assets\/[^"']+)\2/gi;

// Matches: srcset="assets/..." on <source> tags
const SOURCE_SRCSET_RE =
  /(<source\b[^>]*?)\s+srcset=(["'])((?:\/)?assets\/[^"']+)\2/gi;

// Matches inline style background-image: url(...) with quoted or unquoted paths
const BG_STYLE_RE =
  /(<[^>]+\bstyle=(["'])[^"']*?)url\((['"]?)((?:\/)?assets\/[^)"']+)\3\)/gi;

function normalizePath(p) {
  return p.startsWith("/") ? p.slice(1) : p;
}

/** Resolve a hashed path to its original source path using the manifest. */
function resolveOriginalPath(p) {
  const normalized = normalizePath(p); // e.g. "assets/shakti-peya-new-JOlxPYMC.avif"
  return hashedToOriginal[normalized] || normalized;
}

function isProtectedImage(p) {
  return !(/\.mp4$/i.test(p)) && IMAGE_EXTS.test(p);
}

function isLogoImg(prefix) {
  const lower = prefix.toLowerCase();
  return (
    lower.includes('alt="sampriti logo"') ||
    lower.includes("alt='sampriti logo'")
  );
}

const htmlFiles = globSync("dist/**/*.html");
if (htmlFiles.length === 0) {
  console.warn("[protect-images] No HTML files found in dist/");
  process.exit(0);
}

for (const file of htmlFiles) {
  let html = readFileSync(file, "utf8");
  let imgCount = 0;
  let srcsetCount = 0;
  let bgCount = 0;

  html = html.replace(IMG_SRC_RE, (match, prefix, quote, path) => {
    if (!isProtectedImage(path) || isLogoImg(prefix)) return match;
    const original = resolveOriginalPath(path);
    imgCount++;
    return `${prefix} data-pimg="${original}" src=""`;
  });

  html = html.replace(SOURCE_SRCSET_RE, (match, prefix, quote, path) => {
    if (!isProtectedImage(path)) return match;
    if (/type=(["'])video/i.test(prefix)) return match;
    const original = resolveOriginalPath(path);
    srcsetCount++;
    return `${prefix} data-psrcset="${original}"`;
  });

  html = html.replace(BG_STYLE_RE, (match, prefix, styleQuote, urlQuote, path) => {
    if (!isProtectedImage(path)) return match;
    const original = resolveOriginalPath(path);
    const withoutUrl = match.replace(
      `url(${urlQuote}${path}${urlQuote})`,
      "url()"
    );
    bgCount++;
    return withoutUrl.replace(/<(\w+)/, `<$1 data-pbg="${original}"`);
  });

  writeFileSync(file, html);
  console.log(
    `[protect-images] ${file}: ${imgCount} img, ${srcsetCount} srcset, ${bgCount} bg-image`
  );
}

console.log("[protect-images] Done.");
