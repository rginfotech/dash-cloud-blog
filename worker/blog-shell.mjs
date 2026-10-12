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

/**
 * Tailwind registers its --tw-* variables with @property, and browsers ignore @property inside a shadow
 * root. Without them `translate`, shadows, rings etc. silently break. So the @property rules are copied
 * out of the site's stylesheets and added to the page itself. `fetchCss(href)` returns a stylesheet's text.
 */
export async function withPropertyRules(shellHtml, fetchCss) {
  const hrefs = [...shellHtml.matchAll(/<link[^>]*\brel="stylesheet"[^>]*>/g)]
    .map((m) => m[0].match(/\bhref="([^"]+)"/)?.[1])
    .filter(Boolean);
  const rules = [];
  for (const href of hrefs) {
    try {
      const css = await fetchCss(href);
      rules.push(...(css.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g) ?? []));
    } catch {
      /* a missing stylesheet only loses its @property rules */
    }
  }
  return rules.length ? `${shellHtml}<style id="dc-props">${[...new Set(rules)].join("")}</style>` : shellHtml;
}

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
  const props = shellHtml.match(/<style id="dc-props">([\s\S]*?)<\/style>/)?.[1] ?? "";
  const hostCss = `<style>#site-header{display:block;position:sticky;top:0;z-index:50}#site-footer{display:block}${props}</style>`;

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
    const get = (url) => (env?.SITE ? env.SITE.fetch(new Request(url)) : fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } }));
    let shellHtml;
    const cached = await cache.match(shellUrl);
    if (cached) {
      shellHtml = await cached.text();
    } else {
      const shell = await get(shellUrl);
      if (!shell.ok) return response;
      shellHtml = await withPropertyRules(await shell.text(), async (href) => (await get(new URL(href, shellUrl))).text());
      const copy = new Response(shellHtml, { headers: { "content-type": "text/html", "cache-control": "public, max-age=300" } });
      ctx?.waitUntil(cache.put(shellUrl, copy));
    }

    const html = mergeShell(await response.text(), shellHtml);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response; // never break the blog because the shell is unavailable
  }
}
