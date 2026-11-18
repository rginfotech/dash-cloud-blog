import { getPosts } from '../lib';
import { CATEGORIES } from '../categories';

const SITE = 'https://dashcloud.in';
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: Date) => d.toISOString().slice(0, 10);
const url = (path: string, lastmod?: Date, image?: string) =>
  `<url><loc>${SITE}${BASE}/${path}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ''}${image ? `<image:image><image:loc>${esc(image)}</image:loc></image:image>` : ''}</url>`;

// Tag pages are left out on purpose: they duplicate the category pages.
// Rebuilt on every publish, so new posts and categories appear automatically.
export const GET = async () => {
  const posts = await getPosts();
  const latest = (list: typeof posts) => list.reduce<Date | undefined>((m, p) => { const d = p.data.updated ?? p.data.date; return !m || d > m ? d : m; }, undefined);
  const entries: string[] = [url('', latest(posts))];

  for (const c of CATEGORIES) {
    const inCat = posts.filter((p) => p.data.vertical === c.slug);
    if (inCat.length) entries.push(url(`category/${c.slug}/`, latest(inCat)));
  }
  for (const p of posts) {
    const cover = p.data.cover ? `${SITE}${BASE}/${p.data.cover.replace(/^\//, '')}` : undefined;
    entries.push(url(`${p.id}/`, p.data.updated ?? p.data.date, cover));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
