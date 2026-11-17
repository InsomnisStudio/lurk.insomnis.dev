// Everything you are likely to change lives here: domain, endpoint, contact, prices.

export const SITE_URL = 'https://lurk.insomnis.dev';
export const API_URL = 'wss://api.lurk.insomnis.dev';
// The same gateway over HTTPS: checkout and the "my platforms" page.
export const API_HTTP = 'https://api.lurk.insomnis.dev';
export const WS_URL = `${API_URL}/v1/feed`;
export const CONTACT_EMAIL = 'insomnisdev@gmail.com';

// Who runs Lurk, for the legal notice, privacy policy and terms. While null, the pages
// leave them out and name Lurk and the contact email; the LSSI asks for them once
// payments are real.
export const LEGAL: { name: string | null; taxId: string | null; address: string | null; updated: string } = {
	name: null,
	taxId: null,
	address: null,
	// When the texts last changed, shown on each page.
	updated: '2026-11-16',
};

// price: euros a month before VAT, for that platform's Stripe price. Customers pick any
// set; the gateway's billing.prices maps each Stripe price back to its platform.
export const PLATFORMS = [
	{ id: 'vinted', name: 'Vinted', slug: 'vinted-api', price: 49 },
	{ id: 'wallapop', name: 'Wallapop', slug: 'wallapop-api', price: 39 },
	{ id: 'milanuncios', name: 'Milanuncios', slug: 'milanuncios-api', price: 19 },
	{ id: 'todocoleccion', name: 'Todocolección', slug: 'todocoleccion-api', price: 19 },
] as const;

// Simultaneous connections a key can open, whatever its platforms (the gateway's
// billing.connections).
export const CONNECTIONS = 3;

export type PlatformId = (typeof PLATFORMS)[number]['id'];

// Public sample of the live feed (no key): the hero shows it, and anyone can try it.
// While null, the hero plays a scripted animation with sample data instead.
export const DEMO_WS_URL: string | null = `${API_URL}/v1/demo`;

// The pricing form posts the chosen platforms here; the gateway sends them on to Stripe's
// payment page, and emails the key once paid.
export const CHECKOUT_URL = `${API_HTTP}/v1/checkout`;

// Stripe's customer portal login link (card, invoices, cancelling). While null,
// the "manage subscription" link is hidden.
export const PORTAL_URL: string | null = 'https://billing.stripe.com/p/login/fZueVcawj0wh7bVaGt4gg00';

/// A mail link with its subject and, optionally, a body to fill in (the request form).
export function mailto(subject: string, body?: string) {
	const query = [`subject=${encodeURIComponent(subject)}`];
	if (body) query.push(`body=${encodeURIComponent(body)}`);
	return `mailto:${CONTACT_EMAIL}?${query.join('&')}`;
}
