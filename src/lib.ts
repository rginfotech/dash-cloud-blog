import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (p) => !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const readingTime = (body = '') => Math.max(1, Math.round(body.split(/\s+/).length / 220));
export const MAIN = (import.meta.env.PUBLIC_MAIN_SITE ?? 'https://dashcloud.in').replace(/\/$/, '');
