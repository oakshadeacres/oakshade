import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const animalSchema = z.object({
  name: z.string(),
  images: z.array(z.string()).default([]),
  description: z.string(),
  availability: z.enum(['available', 'limited', 'unavailable']),
});

const chickens = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/chickens' }),
  schema: animalSchema,
});

const goats = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/goats' }),
  schema: animalSchema,
});

export const collections = { chickens, goats };
