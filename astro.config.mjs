import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://oakshadeacres.github.io',
  base: '/oakshade',
  integrations: [tailwind()],
});
