import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dashcloud.in',
  base: '/blog',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
