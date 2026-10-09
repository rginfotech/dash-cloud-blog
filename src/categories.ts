import data from './data/categories.json';

export type Category = { slug: string; name: string; description?: string };
export const CATEGORIES: Category[] = data.categories;
// slug -> display name. Edited in the admin under "Categories".
export const VERTICALS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));
export const categoryDescription = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.description ?? '';
