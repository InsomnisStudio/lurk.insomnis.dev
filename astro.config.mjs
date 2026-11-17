// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.ts';

export default defineConfig({
	site: SITE_URL,
	trailingSlash: 'always',
	integrations: [
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
