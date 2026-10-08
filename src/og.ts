import sharp from 'sharp';

const COLORS: Record<string, [string, string]> = {
  'real-estate': ['#1a5fe0', '#101b45'],
  'd2c-ecommerce': ['#5749bb', '#1a5fe0'],
  'b2b-smes': ['#0aa864', '#101b45'],
  'ai-automation': ['#101b45', '#5749bb'],
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

export async function ogImage(title: string, label: string, vertical = 'ai-automation') {
  const [a, b] = COLORS[vertical] ?? COLORS['ai-automation'];
  const lines = wrap(title, 26, 4);
  const tspans = lines.map((l, i) => `<tspan x="80" dy="${i ? 76 : 0}">${esc(l)}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <pattern id="d" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#fff" fill-opacity=".15"/></pattern></defs>
  <rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#d)"/>
  <circle cx="1100" cy="60" r="260" fill="#fff" fill-opacity=".07"/>
  <rect x="80" y="70" rx="22" width="${label.length * 15 + 48}" height="44" fill="#fff" fill-opacity=".18"/>
  <text x="104" y="100" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="#fff">${esc(label.toUpperCase())}</text>
  <text x="80" y="230" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="800" fill="#fff">${tspans}</text>
  <text x="80" y="570" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">DashCloud</text>
  <text x="275" y="570" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#fff" fill-opacity=".75">Blog · dashcloud.in</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
