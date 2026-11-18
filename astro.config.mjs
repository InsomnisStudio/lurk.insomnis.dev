// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.ts';

export default defineConfig({
	site: SITE_URL,
	trailingSlash: 'always',
	// Code blocks in the guides look like the examples elsewhere.
	markdown: { shikiConfig: { theme: 'vitesse-black' } },
	integrations: [
		mdx(),
		sitemap({
			// Where Checkout returns after paying: not a page to find.
			filter: (page) => !/\/(gracias|en\/thanks|cuenta|en\/account)\/$/.test(page),
			i18n: {
				defaultLocale: 'es',
				locales: { es: 'es-ES', en: 'en' },
			},
		}),
	],
});
