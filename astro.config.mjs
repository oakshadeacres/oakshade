import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://oakshadeacres.github.io',
  base: '/oakshade',
  integrations: [sitemap()],
});
