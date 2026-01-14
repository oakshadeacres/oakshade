import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chickens = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/chickens' }),
  schema: z.object({
    name: z.string(),
    image: z.string(),
    description: z.string(),
    availability: z.enum(['available', 'limited', 'unavailable']),
  }),
});

const goats = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/goats' }),
  schema: z.object({
    name: z.string(),
    image: z.string(),
    description: z.string(),
    availability: z.enum(['available', 'limited', 'unavailable']),
  }),
});

export const collections = { chickens, goats };
