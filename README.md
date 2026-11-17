# DashCloud Blog

Astro static blog served at `dashcloud.in/blog`. Posts are Markdown in `src/content/blog/`, categories in `src/data/categories.json`.

## Publishing (SEO / content team)
Use the admin at `/blog/admin/` (login required). Save a post and it goes live in about 20 seconds and is committed and pushed to this repo automatically.

## Local development
```bash
npm install
npm run dev      # http://localhost:4321/blog/
npm run build    # output in dist/
```
Set `PUBLIC_MAIN_SITE` at build time to the main site origin (default `https://dashcloud.in`).

## How the staging server works
- `scripts/publisher.mjs` watches for admin edits, builds, swaps the live site, commits and pushes to `main`. It also pulls changes pushed here.
- `public/admin/index.html` configures Decap CMS (fields, categories, SEO keywords).
- Posts: frontmatter fields are validated in `src/content.config.ts`; a bad post fails the build and the live site is not replaced.

## Editor notes

- **URL slug:** every post has a `URL slug` field. It sets the page address (`/blog/<slug>/`) and the file name. Choose it before the first publish; changing it later changes the URL.
- **Pasting from Word / Google Docs:** headings, lists, bold, italic and links are kept when pasting into the rich-text body (see `public/admin/word-paste.js`). Tables are pasted as plain rows separated by `|`.
