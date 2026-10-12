// Cloudflare worker for dashcloud.in/blog/*.
// Serves the static blog (cf-dist) and wraps each HTML page with the main site's header and footer.
// See blog-shell.mjs. The shell comes from the main site's worker through the SITE service binding.
import { withSiteShell } from "./blog-shell.mjs";

export default {
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);
    return withSiteShell(response, request, ctx, env);
  },
};
