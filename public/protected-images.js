/**
 * protected-images.js
 *
 * Fetches short-lived HMAC tokens from /.netlify/functions/img-token
 * and sets the real src/srcset/background-image on elements that were
 * rewritten by the Vite build plugin (vite-plugin-protect-images.js).
 *
 * Attributes handled:
 *   data-pimg    → sets img.src
 *   data-psrcset → sets source.srcset (inside <picture>)
 *   data-pbg     → sets element's inline background-image style
 *
 * Uses IntersectionObserver so images are only loaded when near the viewport.
 */

(function () {
  "use strict";

  // In-memory token cache: path → { token, ts, expiresAt }
  const tokenCache = new Map();

  /**
   * Fetch a signed token for the given file path.
   * Returns { token, ts } or null on failure.
   */
  async function getToken(filePath) {
    const cached = tokenCache.get(filePath);
    // Use cached token if it still has >10 seconds of life
    if (cached && Date.now() < cached.expiresAt - 10000) {
      return { token: cached.token, ts: cached.ts };
    }

    try {
      const res = await fetch(
        `/.netlify/functions/img-token?f=${encodeURIComponent(filePath)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      tokenCache.set(filePath, {
        token: data.token,
        ts: data.ts,
        expiresAt: Date.now() + data.ttl * 1000,
      });
      return { token: data.token, ts: data.ts };
    } catch (e) {
      console.warn("[protected-images] token fetch failed:", e);
      return null;
    }
  }

  /**
   * Build the signed image URL for a given file path.
   */
  async function buildImageUrl(filePath) {
    const tok = await getToken(filePath);
    if (!tok) return null;
    return `/.netlify/functions/img?f=${encodeURIComponent(filePath)}&token=${tok.token}&ts=${tok.ts}`;
  }

  /**
   * Load a single element (img, source, or background element).
   */
  async function loadElement(el) {
    // Mark as loading to avoid double-loading
    if (el.dataset.pimgLoading) return;
    el.dataset.pimgLoading = "1";

    const imgPath = el.dataset.pimg;
    const srcsetPath = el.dataset.psrcset;
    const bgPath = el.dataset.pbg;

    if (imgPath) {
      const url = await buildImageUrl(imgPath);
      if (url) {
        el.src = url;
        // Once loaded, remove the data attribute to avoid re-processing
        el.addEventListener("load", () => delete el.dataset.pimg, { once: true });
      } else if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        // Fallback for local development if Netlify functions are not available
        // (e.g. running 'npm run dev' instead of 'netlify dev')
        el.src = imgPath;
        delete el.dataset.pimg;
      }
    }

    if (srcsetPath) {
      const url = await buildImageUrl(srcsetPath);
      if (url) {
        el.srcset = url;
        delete el.dataset.psrcset;
      } else if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        el.srcset = srcsetPath;
        delete el.dataset.psrcset;
      }
    }

    if (bgPath) {
      const url = await buildImageUrl(bgPath);
      if (url) {
        // Preserve any existing background-image value and replace the empty url()
        const current = el.style.backgroundImage || "";
        if (current.includes("url()")) {
          el.style.backgroundImage = current.replace("url()", `url(${url})`);
        } else {
          el.style.backgroundImage = `url(${url})`;
        }
        delete el.dataset.pbg;
      } else if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        const current = el.style.backgroundImage || "";
        if (current.includes("url()")) {
          el.style.backgroundImage = current.replace("url()", `url(${bgPath})`);
        } else {
          el.style.backgroundImage = `url(${bgPath})`;
        }
        delete el.dataset.pbg;
      }
    }
  }

  /**
   * Set up IntersectionObserver to lazy-load protected images.
   */
  function initProtectedImages() {
    const selector = "[data-pimg], [data-psrcset], [data-pbg]";
    const elements = document.querySelectorAll(selector);

    if (!elements.length) return;

    // Prefetch tokens for all images on the page in one batch
    // (reduces perceived latency — tokens are cached)
    const allPaths = new Set();
    elements.forEach((el) => {
      if (el.dataset.pimg) allPaths.add(el.dataset.pimg);
      if (el.dataset.psrcset) allPaths.add(el.dataset.psrcset);
      if (el.dataset.pbg) allPaths.add(el.dataset.pbg);
    });
    // Prefetch tokens silently (don't await — just warm the cache)
    allPaths.forEach((p) => getToken(p));

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadElement(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        {
          // Start loading 200px before the element enters the viewport
          rootMargin: "200px 0px",
          threshold: 0,
        }
      );

      elements.forEach((el) => observer.observe(el));
    } else {
      // Fallback: load all immediately
      elements.forEach((el) => loadElement(el));
    }
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProtectedImages);
  } else {
    initProtectedImages();
  }

  // Expose to window for manual re-initialization (useful for dynamic content)
  window.initProtectedImages = initProtectedImages;
})();
