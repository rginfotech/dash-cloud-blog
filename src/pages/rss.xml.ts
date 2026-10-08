import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib';
export async function GET(ctx: APIContext) {
  const posts = await getPosts();
  const base = import.meta.env.BASE_URL;
  return rss({
    title: 'DashCloud Blog',
    description: 'AI lead follow-up, automation and growth guides.',
    site: ctx.site!,
    items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: `${base}${p.id}/` })),
  });
}
