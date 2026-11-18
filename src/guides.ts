import { getCollection, type CollectionEntry } from 'astro:content';
import type { PlatformId } from './config';
import type { Lang } from './i18n';

export type Guide = CollectionEntry<'guides'>;

/// Where the guides live, per language.
export const GUIDES_PATH: Record<Lang, string> = { es: 'guias', en: 'guides' };

/// A guide's page path without language prefix, e.g. 'guias/bot-telegram-vinted'.
export const guidePage = (lang: Lang, slug: string) => `${GUIDES_PATH[lang]}/${slug}`;

/// The guides in a language, newest first; with a platform, only those about it.
export async function guides(lang: Lang, platform?: PlatformId) {
	const all = await getCollection('guides', (g) => g.data.lang === lang && (!platform || g.data.platforms.includes(platform)));
	return all.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}
