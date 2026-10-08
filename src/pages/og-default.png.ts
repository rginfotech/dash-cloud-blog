import type { APIRoute } from 'astro';
import { ogImage } from '../og';
export const GET: APIRoute = async () =>
  new Response(await ogImage('Turn every lead into a conversation', 'DashCloud Blog'), { headers: { 'Content-Type': 'image/png' } });
