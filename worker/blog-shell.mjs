/**
 * Puts the DashCloud header and footer around the Astro blog at https://dashcloud.in/blog/.
 *
 * The blog HTML already contains two empty placeholders:
 *   <div id="site-header"></div>   and   <div id="site-footer"></div>
 * This module fills them with the markup from https://dashcloud.in/blog-shell/ (built by the Next site, see
 * src/app/blog-shell/page.tsx). The result is still ordinary server-rendered HTML at /blog/..., so the
 * articles keep their own URLs, canonical tags and SEO, and the visitor never leaves the page.
 *
 * Header and footer go inside a shadow root (declarative shadow DOM) so the blog's CSS and the site's
 * Tailwind CSS cannot affect each other.
 *
 * Use in the Cloudflare worker that already serves /blog/*:
 *
 *   import { withSiteShell } from "./blog-shell.mjs";
 *   ...
 *   const response = await <your existing code that returns the Astro response>;
 *   return withSiteShell(response, request, ctx, env);
 *
 * If env.SITE is a service binding to the main site's worker, the shell is fetched through it (a worker
 * cannot reliably fetch another worker on its own zone by URL). Without it, a normal fetch is used.
 *
 * The worker route must NOT match /blog-shell/ (use "dashcloud.in/blog/*", not "dashcloud.in/blog*").
 */

const SHELL_PATH = "/blog-shell/";

/** Pure string merge, easy to test. `shellHtml` is the HTML of /blog-shell/, `astroHtml` the blog page. */
export function mergeShell(astroHtml, shellHtml) {
  const grab = (id) => shellHtml.match(new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`))?.[1];
  const header = grab("dc-shell-header");
  const footer = grab("dc-shell-footer");
  if (!header || !footer) return astroHtml; // shell not built as expected: serve the blog unchanged

  const css = [...shellHtml.matchAll(/<link[^>]*\brel="stylesheet"[^>]*>/g)]
    .map((m) => m[0].match(/\bhref="([^"]+)"/)?.[1])
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");

  const shadow = (html) => `<template shadowrootmode="open">${css}${html}</template>`;
  const hostCss =
    "<style>#site-header{display:block;position:sticky;top:0;z-index:50}#site-footer{display:block}</style>";

  let out = astroHtml
    .replace('<div id="site-header"></div>', () => `<div id="site-header">${shadow(header)}</div>`)
    .replace('<div id="site-footer"></div>', () => `<div id="site-footer">${shadow(footer)}</div>`);
  out = out.includes("</head>") ? out.replace("</head>", () => `${hostCss}</head>`) : out;
  return out;
}

/** Wraps an Astro response. Anything that is not an HTML page (images, css, rss, ...) is returned untouched. */
export async function withSiteShell(response, request, ctx, env) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  try {
    const shellUrl = new URL(SHELL_PATH, request.url);
    const cache = caches.default;
    let shell = await cache.match(shellUrl);
    if (!shell) {
      shell = env?.SITE
        ? await env.SITE.fetch(new Request(shellUrl))
        : await fetch(shellUrl, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (shell.ok) {
        const copy = new Response(shell.clone().body, shell);
        copy.headers.set("cache-control", "public, max-age=300");
        ctx?.waitUntil(cache.put(shellUrl, copy));
      }
    }
    if (!shell.ok) return response;

    const html = mergeShell(await response.text(), await shell.text());
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response; // never break the blog because the shell is unavailable
  }
}
