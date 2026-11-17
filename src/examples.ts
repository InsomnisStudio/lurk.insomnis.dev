import { WS_URL, type PlatformId } from './config';

// All listings below are fictional. They show the shape of a normalized event, not real
// data, sellers or ids.

const base = {
	description: null as string | null,
	brand: null as string | null,
	currency: 'EUR',
	domain_lang: 'es',
	vinted_hosts: [] as string[],
	attributes: [] as Record<string, unknown>[],
	attributes_fetched: false,
	completeness: 'Full',
};

const ITEMS: Record<PlatformId, Record<string, unknown>> = {
	vinted: {
		id: '9876543210',
		platform: 'vinted',
		title: 'Chaqueta The North Face Nuptse 700',
		...base,
		description: 'Talla M, usada dos inviernos. Sin roturas.',
		brand: 'The North Face',
		price_in_cent: 8500,
		url: 'https://www.vinted.es/items/9876543210-chaqueta-the-north-face-nuptse-700',
		host_url: 'www.vinted.es',
		vinted_hosts: ['www.vinted.es', 'www.vinted.fr', 'www.vinted.it'],
		url_photo: ['https://images.example/vinted/9876543210-01.webp'],
		shipping: true,
		location: { label: 'Ciudad de ejemplo', latitude: null, longitude: null },
		attributes: [
			{ code: 'size', title: 'Talla', value: 'M', id: 207 },
			{ code: 'status', title: 'Estado', value: 'Muy bueno', id: 2 },
			{ code: 'color', title: 'Color', value: 'Negro', id: 1 },
		],
		attributes_fetched: true,
		category: { Vinted: 1234 },
		user_id: '48291',
	},
	wallapop: {
		id: 'abc123xyz',
		platform: 'wallapop',
		title: 'PS5 Slim con dos mandos',
		...base,
		description: 'Perfecto estado, con caja y factura.',
		brand: 'Sony',
		price_in_cent: 31000,
		url: 'https://es.wallapop.com/item/ps5-slim-con-dos-mandos-000000000',
		host_url: 'es.wallapop.com',
		url_photo: ['https://images.example/wallapop/abc123xyz-01.jpg'],
		shipping: true,
		location: { label: 'Ciudad de ejemplo', latitude: 40.0, longitude: -3.0 },
		attributes: [{ code: 'condition', title: 'Estado', value: 'Como nuevo', id: null }],
		attributes_fetched: true,
		category: { Wallapop: [12900, 12901] },
		user_id: 'usuario_10293',
	},
	milanuncios: {
		id: '500000000',
		platform: 'milanuncios',
		title: 'Bicicleta MTB 29" talla M',
		...base,
		description: 'Revisada hace un mes. Frenos hidráulicos.',
		price_in_cent: 18000,
		url: 'https://www.milanuncios.com/bicicletas/bicicleta-mtb-29-500000000.htm',
		host_url: 'www.milanuncios.com',
		url_photo: ['https://images.example/milanuncios/500000000-01.jpg'],
		shipping: false,
		location: { label: 'Provincia de ejemplo', latitude: null, longitude: null },
		category: { Milanuncios: [42, 4210] },
		user_id: '77120',
	},
	todocoleccion: {
		id: '400000000',
		platform: 'todocoleccion',
		title: 'Lote 20 cómics Mortadelo años 80',
		...base,
		description: 'Buen estado general, ver fotos.',
		price_in_cent: 4500,
		url: 'https://www.todocoleccion.net/comics/lote-20-comics~x400000000',
		host_url: 'www.todocoleccion.net',
		url_photo: ['https://images.example/todocoleccion/400000000-01.jpg'],
		shipping: true,
		location: { label: 'Provincia de ejemplo', latitude: null, longitude: null },
		category: { TodoColeccion: 1650 },
		user_id: '33018',
	},
};

// The same listings with format=raw: each platform's own
// listing, field for field.
const RAW: Record<PlatformId, Record<string, unknown>> = {
	vinted: {
		id: 9876543210,
		title: 'Chaqueta The North Face Nuptse 700',
		description: 'Talla M, usada dos inviernos. Sin roturas.',
		url: 'https://www.vinted.es/items/9876543210-chaqueta-the-north-face-nuptse-700',
		catalog_id: 1234,
		status_id: 2,
		status: 'Muy bueno',
		brand: { id: 2319, title: 'The North Face', slug: 'the-north-face' },
		color1: 'Negro',
		color2: null,
		price: { amount: '85.0', currency_code: 'EUR' },
		total_item_price: { amount: '89.95', currency_code: 'EUR' },
		photos: [
			{
				id: '30000000001',
				is_main: true,
				width: 600,
				height: 800,
				dominant_color: '#2B2B2B',
				url: 'https://images.example/vinted/9876543210-01.webp',
				high_resolution: { timestamp: 1794330000 },
			},
		],
		attributes: [
			{ code: 'size', title: 'Talla', value: 'M', id: 207 },
			{ code: 'status', title: 'Estado', value: 'Muy bueno', id: 2 },
			{ code: 'color', title: 'Color', value: 'Negro', id: 1 },
		],
		favourite_count: 0,
		promoted: false,
		instant_buy: true,
		offline_verification: false,
		is_reserved: false,
		is_closed: false,
		is_hidden: false,
		is_draft: false,
		user: {
			id: 48291,
			login: 'usuario_ejemplo',
			city: 'Ciudad de ejemplo',
			business: false,
			feedback_count: 12,
			country_title_local: 'España',
			feedback_reputation: 1.0,
			item_count: 8,
			followers_count: 3,
			is_on_holiday: false,
			last_logged_on: 1794330000,
			badges: [],
		},
	},
	wallapop: {
		id: 'abc123xyz',
		title: 'PS5 Slim con dos mandos',
		description: 'Perfecto estado, con caja y factura.',
		user_id: 'usuario_10293',
		price: { amount: 310.0, currency: 'EUR' },
		images: [
			{
				urls: {
					small: 'https://images.example/wallapop/abc123xyz-01-small.jpg',
					medium: 'https://images.example/wallapop/abc123xyz-01-medium.jpg',
					big: 'https://images.example/wallapop/abc123xyz-01.jpg',
				},
			},
		],
		web_slug: 'ps5-slim-con-dos-mandos-000000000',
		taxonomy: [{ id: 12900 }, { id: 12901 }],
		location: {
			postal_code: '00000',
			city: 'Ciudad de ejemplo',
			country_code: 'ES',
			latitude: 40.0,
			longitude: -3.0,
			region: 'Provincia de ejemplo',
			region2: 'Comunidad de ejemplo',
		},
		shipping: { item_is_shippable: true, user_allows_shipping: true },
		attributes: [{ key: 'condition', value: 'as_good_as_new', title: 'Estado', text: 'Como nuevo' }],
	},
	milanuncios: {
		id: '500000000',
		images: ['images-re.milanuncios.com/images/ads/00000000-0000-0000-0000-000000000001'],
		isNew: false,
		isReserved: null,
		location: {
			city: { id: 1, name: 'Ciudad de ejemplo', slug: 'ciudad-de-ejemplo' },
			province: { id: 2, name: 'Provincia de ejemplo', slug: 'provincia-de-ejemplo' },
			region: null,
		},
		title: 'Bicicleta MTB 29" talla M',
		description: 'Revisada hace un mes. Frenos hidráulicos.',
		price: { cashPrice: { value: 180 } },
		shippingType: null,
		url: '/bicicletas/bicicleta-mtb-29-500000000.htm',
		categoryTree: [
			{ id: 42, name: 'Bicicletas', slug: 'bicicletas' },
			{ id: 4210, name: 'Bicicletas de montaña', slug: 'bicicletas-de-montana' },
		],
		publishDate: '2026-11-11T10:42:00Z',
		sellerType: 'private',
		userId: 77120,
	},
	todocoleccion: {
		id: 400000000,
		description_plain: 'Buen estado general, ver fotos.',
		price: '45.00',
		url: 'https://www.todocoleccion.net/comics/lote-20-comics~x400000000',
		images_list: [{ id_photo: 600000001, url_photo: 'https://images.example/todocoleccion/400000000-01.jpg' }],
		google_analytics: { brand: null },
		id_section: 1650,
		title: 'Lote 20 cómics Mortadelo años 80',
		seller: { country: 'España', province: 'Provincia de ejemplo', name: 'vendedor_ejemplo' },
	},
};

export type Format = 'normalized' | 'raw';

export function payload(platform: PlatformId, format: Format = 'raw') {
	const source = platform === 'vinted' ? 'detail' : 'listing';
	const item = (format === 'raw' ? RAW : ITEMS)[platform];
	return JSON.stringify({ format, platform, source, items: [item] }, null, 2);
}

/// raw is the default: only normalized needs saying.
export function streamUrl(platforms: string, format: Format = 'raw') {
	return `${WS_URL}?${format === 'raw' ? '' : 'format=normalized&'}platforms=${platforms}`;
}

export function snippets(platforms = 'vinted,wallapop') {
	const url = streamUrl(platforms);
	return [
		{
			id: 'python',
			label: 'Python',
			lang: 'python',
			install: 'pip install websockets',
			code: `import asyncio, json
from websockets.asyncio.client import connect

async def main():
    async with connect(
        "${url}",
        additional_headers={"Authorization": "Bearer YOUR_API_KEY"},
    ) as ws:
        async for message in ws:
            event = json.loads(message)
            for item in event["items"]:
                print(event["platform"], event["source"], item)

asyncio.run(main())`,
		},
		{
			id: 'node',
			label: 'Node.js',
			lang: 'javascript',
			install: 'npm install ws',
			code: `import WebSocket from "ws";

const ws = new WebSocket("${url}", {
  headers: { Authorization: "Bearer YOUR_API_KEY" },
});

ws.on("message", (data) => {
  const event = JSON.parse(data.toString());
  for (const item of event.items) {
    console.log(event.platform, event.source, item);
  }
});`,
		},
		{
			id: 'rust',
			label: 'Rust',
			lang: 'rust',
			install: 'cargo add futures-util tokio -F tokio/full && cargo add tokio-tungstenite -F rustls-tls-webpki-roots',
			code: `use futures_util::StreamExt;
use tokio_tungstenite::{connect_async, tungstenite::client::ClientRequestBuilder};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let request = ClientRequestBuilder::new("${url}".parse()?)
        .with_header("Authorization", "Bearer YOUR_API_KEY");

    let (mut ws, _) = connect_async(request).await?;
    while let Some(message) = ws.next().await {
        println!("{}", message?);
    }
    Ok(())
}`,
		},
		{
			id: 'cli',
			label: 'CLI',
			lang: 'bash',
			install: 'Node.js (npx)',
			code: `npx wscat -c "${url}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
		},
	];
}

// Lines for the animated feed in the hero.
export const DEMO_FEED: [PlatformId, string, number][] = [
	['vinted', 'iPhone 13 Pro 128 GB', 540],
	['wallapop', 'PS5 Slim + 2 mandos', 310],
	['milanuncios', 'Bicicleta MTB 29"', 180],
	['todocoleccion', 'Lote cómics años 80', 45],
	['vinted', 'Zapatillas Nike Dunk 42', 65],
	['wallapop', 'MacBook Air M2 8/256', 720],
	['vinted', 'Chaqueta The North Face M', 80],
	['milanuncios', 'Nintendo Switch OLED', 230],
	['wallapop', 'Lego Star Wars 75192', 590],
	['todocoleccion', 'Moneda 5 pesetas 1949', 12],
	['vinted', 'Bolso Longchamp Le Pliage', 55],
	['milanuncios', 'Taladro Bosch percutor', 45],
	['todocoleccion', 'Álbum cromos Mundial 82', 60],
	['milanuncios', 'Mesa de comedor roble', 120],
	['todocoleccion', 'Figura Star Wars Kenner 1983', 35],
	['milanuncios', 'Patinete eléctrico Xiaomi', 190],
	['todocoleccion', 'Postal antigua Barcelona', 8],
	['wallapop', 'GoPro Hero 11', 210],
];
