/**
 * Vite plugin: protect-images
 *
 * Rewrites <img src="assets/images/..."> and CSS background-image / background
 * references in HTML output so that:
 *   - <img src="assets/images/foo.avif"> becomes <img data-pimg="assets/images/foo.avif" src="">
 *   - <source srcset="assets/images/..."> becomes <source data-psrcset="assets/images/...">
 *   - inline style background-image: url(assets/images/...) is moved to data-pbg="..."
 *
 * The client-side script (protected-images.js) then fetches signed tokens and
 * sets the real src/srcset/background at runtime, so wget/curl cannot harvest image URLs.
 *
 * Videos (<video src> / <source src> for mp4) are NOT rewritten — they are large
 * and Netlify Functions have a 6 MB response limit.
 */

const IMAGE_PATTERN = /^assets\/images\//;

// Matches: src="assets/images/..." or src='assets/images/...'
const IMG_SRC_RE = /(<img\b[^>]*?)\s+src=(["'])(assets\/images\/[^"']+)\2/gi;

// Matches: srcset="assets/images/..." on <source> tags (not video sources)
const SOURCE_SRCSET_RE = /(<source\b[^>]*?)\s+srcset=(["'])(assets\/images\/[^"']+)\2/gi;

// Matches inline style: background-image:url(assets/images/...) or background:url(...)
const BG_STYLE_RE = /(<[^>]+\bstyle=(["'])[^"']*?)url\((assets\/images\/[^)]+)\)/gi;

export function protectImagesPlugin() {
  return {
    name: "protect-images",
    // Run after the build has generated HTML
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // 1. Rewrite <img src="assets/images/...">
        html = html.replace(IMG_SRC_RE, (match, prefix, quote, path) => {
          // Skip if it's inside a <video> tag — we don't protect videos
          return `${prefix} data-pimg="${path}" src=""`;
        });

        // 2. Rewrite <source srcset="assets/images/..."> (picture elements)
        html = html.replace(SOURCE_SRCSET_RE, (match, prefix, quote, path) => {
          return `${prefix} data-psrcset="${path}"`;
        });

        // 3. Rewrite inline style background-image: url(assets/images/...)
        html = html.replace(BG_STYLE_RE, (match, prefix, quote, path) => {
          // Replace url(...) with empty, add data-pbg attribute before the style attr
          const withoutUrl = match.replace(`url(${path})`, "url()");
          // Insert data-pbg attribute right after the opening tag name
          return withoutUrl.replace(/<(\w+)/, `<$1 data-pbg="${path}"`);
        });

        return html;
      },
    },
  };
}
