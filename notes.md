# test and deploy
You can now run npm run dev to see the site locally or npm run build to see the production version in dist/.


##
 For syncing google drive to local

 rclone sync sampriti-gdrive:Sampriti ./

 In future, below can be considered for auto sync
 rclone mount sampriti-gdrive:Sampriti ~/gdrive --daemon

 # design 
 Inspiration from https://animamundiherbals.com/


Future font suggestions https://fonts.google.com/specimen/Marcellus?specimen.preview.text=SAMPRITI
https://fonts.google.com/specimen/Cormorant+SC?specimen.preview.text=SAMPRITI


# Image Protection (HMAC-signed URLs)

Images are served through short-lived signed Netlify Function URLs to make `wget -r` scraping hard.

## How it works

1. **Build:** `post-build-protect.js` (runs after `vite build`) rewrites `<img src="/assets/HASH.avif">` → `<img data-pimg="assets/images/original.avif" src="">` in all `dist/**/*.html` files. Uses `dist/.vite/manifest.json` to map hashed filenames back to original source paths.
2. **Runtime:** `public/protected-images.js` (copied to `dist/` by Vite) finds all `[data-pimg]` elements, fetches a signed token, then sets the real `src` via the function URL.
3. **Token:** `/.netlify/functions/img-token?f=<path>` — returns `{ token, ts, ttl: 90 }`. Token is HMAC-SHA256 of `"path:timestamp"` using `IMG_SECRET`.
4. **Image:** `/.netlify/functions/img?f=<path>&token=<tok>&ts=<ts>` — validates token+age (90s TTL), reads from `assets/images/` (bundled with the function via `included_files` in `netlify.toml`), returns base64-encoded image.
5. **Blocking:** `netlify.toml` redirects direct `/assets/*.avif`, `*.webp`, `*.jpg`, `*.jpeg`, `*.png` requests to 404.

## Key files

| File | Role |
|------|------|
| `public/protected-images.js` | Client-side script — fetches tokens, sets img src at runtime |
| `post-build-protect.js` | Post-build HTML rewriter — adds `data-pimg`, clears `src` |
| `netlify/functions/img-token.mjs` | Issues signed tokens |
| `netlify/functions/img.mjs` | Validates token, serves image bytes |
| `netlify.toml` `[functions]` `included_files` | Bundles `assets/images/**` with the function |
| `vite.config.js` `build.manifest: true` | Emits `dist/.vite/manifest.json` (required by post-build script) |

## Debugging checklist

### Images not loading at all

1. **Check `dist/protected-images.js` exists** — if missing, run `npm run build`. The file lives in `public/` (Vite copies it). If you accidentally put it in the project root instead of `public/`, Vite will warn and NOT copy it.
2. **Open browser DevTools → Network tab** — filter by "img-token". If no requests appear, `protected-images.js` is not running (likely a 404 on the script itself).
3. **Check the script tag in HTML** — should be `<script src="protected-images.js"></script>` near `</body>`.

### Token requests succeed but images still don't load

4. **Check `/.netlify/functions/img` response** — open DevTools → Network, filter "img?f=". A 403 means token is wrong or expired. A 404 means the file wasn't found on the function's filesystem.
5. **`IMG_SECRET` mismatch** — `img-token.mjs` and `img.mjs` must use the same secret. It's set in `netlify.toml` `[build.environment]` or in the Netlify dashboard (Site Settings → Environment Variables). If set in both, the dashboard value wins.
6. **File not found (404 from function)** — the function reads from `process.cwd() + "/" + path`. The `included_files` in `netlify.toml` must include the path. Currently: `assets/images/**`. Check the path in `data-pimg` starts with `assets/images/`.

### Images load locally but not on Netlify

7. **`included_files` paths** — in `netlify.toml`, paths are relative to the **project root** (not `dist/`). The source images at `assets/images/` are bundled with the function. Hashed Vite output images in `dist/assets/` are NOT bundled — this is intentional (we use original paths in `data-pimg`).
8. **Re-deploy after changing `included_files`** — Netlify must rebuild the function bundle. A redeploy without a code change won't re-bundle files.

### Wrong image paths after a build

9. **Check `dist/.vite/manifest.json`** — open it and find the hashed filename. The manifest key is the original path (`assets/images/foo.avif`) and `info.file` is the hashed output (`assets/foo-HASH.avif`). `post-build-protect.js` inverts this map.
10. **If `post-build-protect.js` outputs `0 img`** — the regex didn't match. Likely the HTML structure changed. The regex expects `<img ... src="/assets/HASH.ext" ...>`. Run the script manually with `node post-build-protect.js` after a `vite build` and check its output.

### Logo not showing (should NOT be protected)

11. The logo `<img alt="Sampriti Logo">` is excluded from rewriting. If it's also broken, the issue is unrelated to image protection — check `netlify.toml` redirect rules aren't blocking the logo path.

## Quick diagnostic commands

```bash
# Rebuild everything
npm run build

# Check data-pimg attributes were written
python3 -c "
import re
with open('dist/index.html') as f: html = f.read()
matches = re.findall(r'data-pimg=\"([^\"]+)\"', html)
print(f'{len(matches)} protected images')
print('First 5:', matches[:5])
"

# Check no plain asset src remain (only mp4 is OK)
python3 -c "
import re
with open('dist/index.html') as f: html = f.read()
matches = re.findall(r'src=\"/assets/[^\"]+\"', html)
print('Unprotected src attrs:', matches)
"

# Confirm protected-images.js is in dist
ls -lh dist/protected-images.js

# Inspect manifest entries for a specific image
python3 -c "
import json
m = json.load(open('dist/.vite/manifest.json'))
for k,v in m.items():
  if 'avif' in k: print(k, '->', v.get('file',''))
" | head -20
```

 