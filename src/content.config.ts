import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PLATFORMS, type PlatformId } from './config';

// The guides: one MDX file per language, in a folder per guide with the code it shows.
const guides = defineCollection({
	loader: glob({ pattern: '**/*.mdx', base: './src/content/guides' }),
	schema: z.object({
		lang: z.enum(['es', 'en']),
		// Its path under /guias/ or /en/guides/, and the entry's id.
		slug: z.string(),
		// The slug of the same guide in the other language.
		translation: z.string(),
		title: z.string(),
		description: z.string(),
		h1: z.string(),
		// What it is about: these platforms' pages link to it, and its closing offer names them.
		platforms: z.array(z.enum(PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]])),
		published: z.coerce.date(),
		updated: z.coerce.date().optional(),
	}),
});

export const collections = { guides };
