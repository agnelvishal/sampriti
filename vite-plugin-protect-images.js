/**
 * Vite plugin: protect-images
 *
 * Rewrites image src/srcset/background-image references in HTML output so that:
 *   - <img src="assets/images/foo.avif"> becomes <img data-pimg="assets/images/foo.avif" src="">
 *   - <img src="/assets/foo-HASH.avif"> becomes <img data-pimg="assets/foo-HASH.avif" src="">
 *   - <source srcset="..."> similarly rewritten
 *   - inline style background-image: url(...) moved to data-pbg="..."
 *
 * Skipped elements:
 *   - <link rel="icon"> / favicon references
 *   - <meta property="og:image"> / twitter:image (social sharing needs real URLs)
 *   - <video> sources (too large for Netlify Functions 6 MB limit)
 *   - Logo img (alt="Sampriti Logo")
 *
 * Uses enforce: "post" to run AFTER ViteMinifyPlugin so minification
 * doesn't strip our data-* attributes or empty src="".
 *
 * The client-side script (protected-images.js) then fetches signed tokens and
 * sets the real src/srcset/background at runtime, so wget/curl cannot harvest image URLs.
 */

// Image extensions to protect
const IMAGE_EXTS = /\.(avif|webp|jpg|jpeg|png|gif)(\?[^"']*)?$/i;

// Matches: src="assets/images/..." or src="/assets/HASH.ext" (but not mp4/video)
// Captures: prefix (everything before src=), quote char, path
const IMG_SRC_RE = /(<img\b[^>]*?)\s+src=(["'])((?:\/)?assets\/[^"']+)\2/gi;

// Matches: srcset="assets/..." on <source> tags
const SOURCE_SRCSET_RE = /(<source\b[^>]*?)\s+srcset=(["'])((?:\/)?assets\/[^"']+)\2/gi;

// Matches inline style: background-image:url(path) OR url("path") OR url('path')
// Handles both quoted and unquoted URLs
const BG_STYLE_RE = /(<[^>]+\bstyle=(["'])[^"']*?)url\((['"]?)((?:\/)?assets\/[^)"']+)\3\)/gi;

// Normalize path: strip leading slash so it's always "assets/..."
function normalizePath(p) {
  return p.startsWith("/") ? p.slice(1) : p;
}

// Check if a path is an image we want to protect
function isProtectedImage(path) {
  // Skip videos
  if (/\.mp4$/i.test(path)) return false;
  // Only protect image extensions
  return IMAGE_EXTS.test(path);
}

// Check if the img tag context suggests it's a logo (we skip those)
function isLogoImg(prefix) {
  const lower = prefix.toLowerCase();
  return (
    lower.includes("alt=\"sampriti logo\"") ||
    lower.includes("alt='sampriti logo'")
  );
}

export function protectImagesPlugin() {
  return {
    name: "protect-images",
    // enforce: "post" ensures this runs AFTER ViteMinifyPlugin
    // so the minifier doesn't strip our data-* attributes or empty src=""
    enforce: "post",
    // Run after the build has generated HTML
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // 1. Rewrite <img src="assets/..."> and <img src="/assets/...">
        html = html.replace(IMG_SRC_RE, (match, prefix, quote, path) => {
          if (!isProtectedImage(path)) return match;
          if (isLogoImg(prefix)) return match;
          const normalized = normalizePath(path);
          return `${prefix} data-pimg="${normalized}" src=""`;
        });

        // 2. Rewrite <source srcset="assets/..."> (picture elements, not video)
        html = html.replace(SOURCE_SRCSET_RE, (match, prefix, quote, path) => {
          if (!isProtectedImage(path)) return match;
          // Skip <source> inside <video> — check if type="video"
          if (/type=(["'])video/i.test(prefix)) return match;
          const normalized = normalizePath(path);
          return `${prefix} data-psrcset="${normalized}"`;
        });

        // 3. Rewrite inline style background-image: url(assets/...) — handles quoted and unquoted
        html = html.replace(BG_STYLE_RE, (match, prefix, styleQuote, urlQuote, path) => {
          if (!isProtectedImage(path)) return match;
          const normalized = normalizePath(path);
          // Replace url(...) with url() and add data-pbg attribute
          const withoutUrl = match.replace(`url(${urlQuote}${path}${urlQuote})`, "url()");
          return withoutUrl.replace(/<(\w+)/, `<$1 data-pbg="${normalized}"`);
        });

        return html;
      },
    },
  };
}
