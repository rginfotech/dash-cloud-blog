import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const VERTICALS = {
  'real-estate': 'Real Estate',
  'd2c-ecommerce': 'D2C eCommerce',
  'b2b-smes': 'B2B & SMEs',
  'ai-automation': 'AI Automation',
} as const;

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    vertical: z.enum(['real-estate', 'd2c-ecommerce', 'b2b-smes', 'ai-automation']),
    tags: z.array(z.string()).default([]),
    author: z.string().default('DashCloud Team'),
    cover: z.string().optional(),
    coverAlt: z.string().default(''),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
