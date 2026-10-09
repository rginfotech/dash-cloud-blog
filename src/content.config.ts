import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

import { VERTICALS } from './categories';
export { VERTICALS };

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    vertical: z.string().refine((v) => v in VERTICALS, { message: 'Unknown category. Add it under Categories in the admin.' }),
    keywords: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    author: z.string().default('DashCloud Team'),
    cover: z.string().optional(),
    coverAlt: z.string().default(''),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
