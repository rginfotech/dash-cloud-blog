import type { APIRoute } from 'astro';
import { VERTICALS } from '../../categories';
import { getPosts } from '../../lib';
import { ogImage } from '../../og';

export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((p) => ({ params: { slug: p.id }, props: { title: p.data.title, vertical: p.data.vertical } }));
}
export const GET: APIRoute = async ({ props }) =>
  new Response(await ogImage(props.title, VERTICALS[props.vertical as keyof typeof VERTICALS], props.vertical), { headers: { 'Content-Type': 'image/png' } });
