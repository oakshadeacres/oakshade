import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const breeds = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/breeds' }),
  schema: z.object({
    name: z.string(),
    specialty: z.boolean().default(false),
    order: z.number().default(0),
    description: z.string(),
    traits: z.array(z.object({ label: z.string(), val: z.string() })).default([]),
    varieties: z.array(z.string()).default([]),
    images: z
      .array(z.object({ url: z.string(), variety: z.string().optional() }))
      .default([]),
    spring: z.array(z.string()).default([]),
    fall: z.array(z.string()).default([]),
  }),
});

export const collections = { breeds };
