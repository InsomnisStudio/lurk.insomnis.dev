// The legal notice, privacy policy and terms of sale, in both languages. Paragraphs are
// HTML written here (links, emphasis); a list is an array of them.

import { CONNECTIONS, CONTACT_EMAIL, LEGAL, SITE_URL } from './config';
import { path, type Lang } from './i18n';

export type DocId = 'notice' | 'privacy' | 'terms';
type Block = string | string[];
type Section = { h: string; body: Block[] };
export type Doc = { title: string; description: string; h1: string; sections: Section[] };
/// The sections that apply: `false` ones (a part that depends on missing details) drop out.
const only = (...sections: (Section | false)[]) => sections.filter((x): x is Section => !!x);

/// Each document's path, per language.
export const DOC_PATHS: Record<DocId, Record<Lang, string>> = {
	notice: { es: 'aviso-legal', en: 'legal-notice' },
	privacy: { es: 'privacidad', en: 'privacy' },
	terms: { es: 'terminos', en: 'terms' },
};

export const DOC_LINKS: Record<Lang, Record<DocId, string>> = {
	es: { notice: 'Aviso legal', privacy: 'Privacidad', terms: 'Términos' },
	en: { notice: 'Legal notice', privacy: 'Privacy', terms: 'Terms' },
};

export const UPDATED: Record<Lang, string> = { es: 'Última actualización', en: 'Last updated' };

const mail = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const link = (lang: Lang, id: DocId, text: string) => `<a href="${path(lang, DOC_PATHS[id][lang])}">${text}</a>`;
const site = SITE_URL.replace(/^https?:\/\//, '');
const { taxId, address } = LEGAL;
// Who, as the texts name it: the owner when filled in, else the service.
const name = LEGAL.name ?? 'Lurk';
/// The owner's details that are filled in, as list lines.
const identity = (labels: { name: string; taxId: string; address: string }) =>
	[
		LEGAL.name && `${labels.name}: ${LEGAL.name}`,
		taxId && `${labels.taxId}: ${taxId}`,
		address && `${labels.address}: ${address}`,
	].filter((x): x is string => !!x);
/// "name, tax ID, address, " with only what is filled in.
const who = (taxLabel: string) => [LEGAL.name, taxId && `${taxLabel} ${taxId}`, address].filter(Boolean).join(', ');

const es: Record<DocId, Doc> = {
	notice: {
		title: 'Aviso legal — Lurk',
		description: 'Quién presta Lurk y las condiciones de uso de esta web.',
		h1: 'Aviso legal',
		sections: [
			{
				h: LEGAL.name ? 'Titular' : 'Contacto',
				body: [
					[...identity({ name: 'Titular', taxId: 'NIF', address: 'Domicilio' }), `Email: ${mail}`, `Web: ${site}`],
				],
			},
			{
				h: 'Objeto',
				body: [
					`Lurk entrega por API, en tiempo real, los anuncios nuevos que se publican en Vinted, Wallapop, Milanuncios y Todocolección. La contratación se rige por los ${link('es', 'terms', 'términos de venta')} y el tratamiento de datos, por la ${link('es', 'privacy', 'política de privacidad')}.`,
				],
			},
			{
				h: 'Marcas',
				body: [
					'Lurk es un servicio independiente. No está afiliado, asociado ni respaldado por Vinted, Wallapop, Milanuncios ni Todocolección. Sus nombres y marcas pertenecen a sus dueños y aquí solo se usan para decir con qué plataformas funciona el servicio.',
				],
			},
			{
				h: 'Propiedad intelectual',
				body: ['Los textos, el diseño y el código de esta web son del titular, salvo que se indique lo contrario. Puedes copiar y usar libremente los ejemplos de código para conectarte a Lurk.'],
			},
			{
				h: 'Responsabilidad',
				body: ['Procuramos que la información de esta web sea correcta y esté al día, pero puede contener errores. Los enlaces a webs de terceros son solo informativos y no respondemos de su contenido.'],
			},
		],
	},
	privacy: {
		title: 'Política de privacidad — Lurk',
		description: 'Qué datos trata Lurk, para qué, con quién y cuáles son tus derechos.',
		h1: 'Política de privacidad',
		sections: only(
			!!who('NIF') && {
				h: 'Responsable',
				body: [`${who('NIF')}. Para cualquier cosa sobre tus datos: ${mail}.`],
			},
			{
				h: 'Qué datos tratamos',
				body: [
					[
						'<strong>Si visitas la web:</strong> no usamos cookies ni analítica. El alojamiento de la web (GitHub Pages) y nuestro servidor registran la dirección IP y los datos técnicos de cada petición.',
						'<strong>Si usas la demo:</strong> tu dirección IP, solo para limitar las conexiones simultáneas mientras estás conectado.',
						'<strong>Si te suscribes:</strong> tu email; los datos de facturación que das en Stripe (nombre, dirección y, si eres empresa, NIF-IVA); los identificadores de cliente y suscripción de Stripe; y tu API key, que guardamos como un hash que no permite leerla. Durante como mucho una hora tras el pago la guardamos tal cual, para enseñártela una vez en la página de confirmación; después solo queda el hash. Los datos de tu tarjeta u otro medio de pago los trata Stripe: nosotros no los vemos.',
						'<strong>Si usas tu API key:</strong> la IP y la hora de cada conexión, y cuándo se usó la key por última vez.',
						'<strong>Si nos escribes:</strong> tu email y lo que nos cuentes.',
					],
				],
			},
			{
				h: 'Para qué y con qué base legal',
				body: [
					[
						'Prestarte el servicio, cobrarlo, gestionar tu suscripción y mandarte la key y avisos sobre el servicio: la ejecución del contrato (art. 6.1.b del RGPD).',
						'Emitir facturas y cumplir obligaciones fiscales: una obligación legal (art. 6.1.c).',
						'Proteger el servicio de abusos y resolver fallos (límites de la demo, registros técnicos): nuestro interés legítimo (art. 6.1.f).',
						'Responder a tus mensajes: tu consentimiento al escribirnos o, si eres cliente, el contrato.',
					],
					'No hacemos perfiles ni te mandamos publicidad.',
				],
			},
			{
				h: 'Con quién los compartimos',
				body: [
					'Solo con los proveedores que necesitamos para prestar el servicio, que los tratan por cuenta nuestra:',
					[
						'Stripe (Stripe Payments Europe, Irlanda): pagos, facturas y suscripciones.',
						'Resend (Resend, Inc., EE. UU.): el envío del email con tu key.',
						'OVH (OVH SAS, Francia): el servidor de la API.',
						'GitHub (GitHub, Inc., EE. UU.): el alojamiento de esta web.',
					],
					'Resend y GitHub están en EE. UU.: esas transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo de la Comisión Europea. No vendemos tus datos, y solo los daríamos a una autoridad si la ley nos obliga.',
				],
			},
			{
				h: 'Cuánto tiempo los guardamos',
				body: [
					'Los de tu suscripción, mientras esté activa. Después, los que exige la ley (facturas) se conservan bloqueados durante los plazos legales, en general hasta seis años, y luego se borran. Los registros técnicos, el tiempo imprescindible para la seguridad y el diagnóstico.',
				],
			},
			{
				h: 'Tus derechos',
				body: [
					`Puedes pedir acceso a tus datos, corregirlos, borrarlos, oponerte a su tratamiento, limitarlo o llevártelos: escríbenos a ${mail}. Si crees que no los respetamos, puedes reclamar ante la <a href="https://www.aepd.es" rel="noopener">Agencia Española de Protección de Datos</a>.`,
				],
			},
			{
				h: 'Lo que se guarda en tu navegador',
				body: [
					'No usamos cookies. Al ir a pagar, la pestaña guarda un código aleatorio para enseñarte la key una sola vez al volver; se borra al usarlo. Los ejemplos de código recuerdan qué lenguaje elegiste. Nada de esto sirve para seguirte.',
				],
			},
		),
	},
	terms: {
		title: 'Términos de venta — Lurk',
		description: 'Las condiciones de la suscripción a Lurk: servicio, precio, cancelación, desistimiento y uso.',
		h1: 'Términos de venta',
		sections: [
			{
				h: 'Quién vende',
				body: [
					`${name} (ver el ${link('es', 'notice', 'aviso legal')}). Contacto: ${mail}. Estos términos regulan la suscripción a Lurk; al suscribirte los aceptas.`,
				],
			},
			{
				h: 'El servicio',
				body: [
					`Con la suscripción recibes una API key para recibir por WebSocket los anuncios nuevos que se publican en las plataformas que contratas, en formato raw o normalized, como se explica en la <a href="${path('es', 'docs')}">documentación</a>. Cada key admite ${CONNECTIONS} conexiones simultáneas. El servicio no incluye histórico ni búsqueda.`,
				],
			},
			{
				h: 'Lo que no podemos garantizar',
				body: [
					'Lurk es independiente de las plataformas y depende de cómo funcionan sus webs. Hacemos lo posible para que el servicio esté disponible y sea rápido y completo, pero no garantizamos una disponibilidad, una velocidad o una cobertura concretas: una plataforma puede cambiar o bloquear el acceso, y el servicio puede verse afectado mientras lo resolvemos. Si una plataforma deja de funcionar de forma duradera, te avisaremos y podrás quitarla de tu suscripción o cancelarla.',
				],
			},
			{
				h: 'Precio y pago',
				body: [
					'El precio de cada plataforma es el que aparece en la web, en euros al mes, más el IVA que corresponda. Pagas cada mes por adelantado con Stripe, y la suscripción se renueva sola hasta que la canceles.',
					'Si añades plataformas a mitad de mes, se cobra en el momento la parte proporcional a los días que quedan; si quitas alguna, la diferencia se descuenta de tu siguiente factura. Si un cobro falla, Stripe lo reintenta; si al final no se puede cobrar, la key se desactiva hasta que se pague.',
				],
			},
			{
				h: 'Cancelación',
				body: [
					`Puedes cancelar cuando quieras desde <a href="${path('es', 'cuenta')}">tu cuenta</a>. La suscripción sigue activa hasta el final del periodo pagado y no se vuelve a cobrar. Fuera del desistimiento, no devolvemos periodos ya empezados.`,
				],
			},
			{
				h: 'Derecho de desistimiento',
				body: [
					'Si contratas como consumidor, tienes 14 días naturales desde la contratación para desistir sin dar explicaciones. Como al suscribirte pides que el servicio empiece de inmediato, si desistes te devolveremos lo pagado menos la parte proporcional al tiempo que lo has tenido activo.',
					`Para desistir, mándanos una declaración clara a ${mail}; puedes usar el formulario de abajo, aunque no es obligatorio. Te devolveremos el importe en un plazo de 14 días, por el mismo medio de pago.`,
					'Si contratas como empresa o profesional, no tienes este derecho.',
				],
			},
			{
				h: 'Uso aceptable',
				body: [
					'Puedes usar los anuncios en tus propios productos y reenviarlos a tus usuarios, por ejemplo en un bot de alertas. La key es tuya: no la compartas, no la publiques y no revendas el acceso a la API. Si se filtra, escríbenos y te damos otra. Tampoco puedes eludir los límites del servicio ni usarlo para nada ilegal.',
					'Los anuncios incluyen datos que publican los vendedores, a veces personales (por ejemplo, su nombre de usuario o su ciudad). Eres responsable de usarlos conforme a la ley, incluida la de protección de datos, y a las condiciones de las plataformas que te sean aplicables.',
					'Si incumples estos términos, podemos suspender o cancelar tu key; si el incumplimiento es grave, sin devolución.',
				],
			},
			{
				h: 'Responsabilidad',
				body: [
					'No respondemos de daños indirectos ni de beneficios perdidos (por ejemplo, una compra que no llegaste a hacer a tiempo). En todo caso, nuestra responsabilidad total se limita a lo que nos hayas pagado en los últimos 12 meses. Nada de esto limita los derechos que la ley te reconoce como consumidor ni nuestra responsabilidad por dolo o culpa grave.',
				],
			},
			{
				h: 'Cambios',
				body: ['Podemos cambiar estos términos o los precios. Te avisaremos por email al menos 30 días antes; si no estás de acuerdo, puedes cancelar antes de que se apliquen.'],
			},
			{
				h: 'Ley aplicable',
				body: ['Estos términos se rigen por la ley española. Si eres consumidor, puedes acudir a los tribunales de tu domicilio.'],
			},
			{
				h: 'Modelo de formulario de desistimiento',
				body: [
					'(Solo debe cumplimentar y enviar el presente formulario si desea desistir del contrato)',
					[
						`A la atención de ${[name, address, mail].filter(Boolean).join(', ')}:`,
						'Por la presente le comunico que desisto de mi contrato de prestación del siguiente servicio: suscripción a Lurk.',
						'Contratado el:',
						'Nombre del consumidor:',
						'Domicilio del consumidor:',
						'Firma del consumidor (solo si el presente formulario se presenta en papel):',
						'Fecha:',
					],
				],
			},
		],
	},
};

const en: Record<DocId, Doc> = {
	notice: {
		title: 'Legal notice — Lurk',
		description: 'Who provides Lurk and the terms for using this website.',
		h1: 'Legal notice',
		sections: [
			{
				h: LEGAL.name ? 'Owner' : 'Contact',
				body: [
					[...identity({ name: 'Owner', taxId: 'Tax ID', address: 'Address' }), `Email: ${mail}`, `Website: ${site}`],
				],
			},
			{
				h: 'Purpose',
				body: [
					`Lurk delivers, by API and in real time, the new listings posted on Vinted, Wallapop, Milanuncios and Todocolección. Subscriptions are governed by the ${link('en', 'terms', 'terms of sale')} and personal data by the ${link('en', 'privacy', 'privacy policy')}.`,
				],
			},
			{
				h: 'Trademarks',
				body: [
					'Lurk is an independent service. It is not affiliated with, associated with or endorsed by Vinted, Wallapop, Milanuncios or Todocolección. Their names and trademarks belong to their owners and are used here only to say which platforms the service works with.',
				],
			},
			{
				h: 'Intellectual property',
				body: ['The texts, design and code of this website belong to the owner unless stated otherwise. You may freely copy and use the code examples to connect to Lurk.'],
			},
			{
				h: 'Liability',
				body: ['We try to keep the information on this website accurate and up to date, but it may contain errors. Links to third-party websites are for information only, and we are not responsible for their content.'],
			},
		],
	},
	privacy: {
		title: 'Privacy policy — Lurk',
		description: 'What data Lurk processes, why, with whom, and your rights.',
		h1: 'Privacy policy',
		sections: only(
			!!who('tax ID') && {
				h: 'Controller',
				body: [`${who('tax ID')}. For anything about your data: ${mail}.`],
			},
			{
				h: 'What data we process',
				body: [
					[
						'<strong>If you visit the website:</strong> we use no cookies and no analytics. The website’s host (GitHub Pages) and our server log the IP address and technical details of each request.',
						'<strong>If you use the demo:</strong> your IP address, only to limit simultaneous connections while you are connected.',
						'<strong>If you subscribe:</strong> your email; the billing details you give Stripe (name, address and, for businesses, VAT number); your Stripe customer and subscription IDs; and your API key, which we store as a hash that cannot be read back. For at most one hour after payment we keep it as it is, to show it to you once on the confirmation page; after that only the hash remains. Your card or other payment details are handled by Stripe: we never see them.',
						'<strong>If you use your API key:</strong> the IP and time of each connection, and when the key was last used.',
						'<strong>If you write to us:</strong> your email and what you tell us.',
					],
				],
			},
			{
				h: 'Why, and on what legal basis',
				body: [
					[
						'To provide and charge for the service, manage your subscription, and send you your key and notices about the service: performance of the contract (Art. 6(1)(b) GDPR).',
						'To issue invoices and meet tax obligations: a legal obligation (Art. 6(1)(c)).',
						'To protect the service from abuse and fix faults (demo limits, technical logs): our legitimate interest (Art. 6(1)(f)).',
						'To answer your messages: your consent by writing to us or, if you are a customer, the contract.',
					],
					'We do no profiling and send no advertising.',
				],
			},
			{
				h: 'Who we share it with',
				body: [
					'Only with the providers we need to run the service, who process it on our behalf:',
					[
						'Stripe (Stripe Payments Europe, Ireland): payments, invoices and subscriptions.',
						'Resend (Resend, Inc., USA): sending the email with your key.',
						'OVH (OVH SAS, France): the API server.',
						'GitHub (GitHub, Inc., USA): hosting this website.',
					],
					'Resend and GitHub are in the USA: those transfers rely on the EU-US Data Privacy Framework or on the European Commission’s standard contractual clauses. We do not sell your data, and we would only hand it to an authority if the law required us to.',
				],
			},
			{
				h: 'How long we keep it',
				body: [
					'Your subscription data, while it is active. After that, what the law requires (invoices) is kept locked for the legal periods, generally up to six years, and then deleted. Technical logs, only as long as needed for security and diagnosis.',
				],
			},
			{
				h: 'Your rights',
				body: [
					`You can ask to access, correct, delete or take your data with you, and to object to or restrict its processing: write to ${mail}. If you think we are not respecting them, you can complain to the <a href="https://www.aepd.es" rel="noopener">Spanish Data Protection Agency (AEPD)</a>.`,
				],
			},
			{
				h: 'What is stored in your browser',
				body: [
					'We use no cookies. When you go to pay, the tab keeps a random code to show you the key once when you return; it is deleted once used. The code examples remember which language you picked. None of this is used to track you.',
				],
			},
		),
	},
	terms: {
		title: 'Terms of sale — Lurk',
		description: 'The terms of a Lurk subscription: service, price, cancelling, withdrawal and use.',
		h1: 'Terms of sale',
		sections: [
			{
				h: 'Who sells',
				body: [`${name} (see the ${link('en', 'notice', 'legal notice')}). Contact: ${mail}. These terms govern a Lurk subscription; by subscribing you accept them.`],
			},
			{
				h: 'The service',
				body: [
					`A subscription gives you an API key to receive over WebSocket the new listings posted on the platforms you subscribe to, in raw or normalized format, as described in the <a href="${path('en', 'docs')}">documentation</a>. Each key allows ${CONNECTIONS} simultaneous connections. The service does not include history or search.`,
				],
			},
			{
				h: 'What we cannot guarantee',
				body: [
					'Lurk is independent from the platforms and depends on how their websites work. We do our best to keep the service available, fast and complete, but we do not guarantee any specific availability, speed or coverage: a platform may change or block access, and the service may be affected while we fix it. If a platform stops working for good, we will tell you, and you can remove it from your subscription or cancel.',
				],
			},
			{
				h: 'Price and payment',
				body: [
					'Each platform’s price is the one shown on the website, in euros per month, plus any applicable VAT. You pay monthly in advance through Stripe, and the subscription renews automatically until you cancel it.',
					'If you add platforms mid-month, the share for the days left is charged at once; if you remove one, the difference comes off your next invoice. If a payment fails, Stripe retries it; if it still cannot be charged, the key is turned off until it is paid.',
				],
			},
			{
				h: 'Cancelling',
				body: [
					`You can cancel any time from <a href="${path('en', 'account')}">your account</a>. The subscription stays active until the end of the paid period and is not charged again. Apart from withdrawal, we do not refund periods already started.`,
				],
			},
			{
				h: 'Right of withdrawal',
				body: [
					'If you subscribe as a consumer, you have 14 calendar days from subscribing to withdraw without giving a reason. Since you ask for the service to start straight away when you subscribe, if you withdraw we will refund what you paid minus the share for the time it was active.',
					`To withdraw, send us a clear statement at ${mail}; you can use the form below, but you do not have to. We will refund you within 14 days, using the same payment method.`,
					'If you subscribe as a business or professional, this right does not apply.',
				],
			},
			{
				h: 'Acceptable use',
				body: [
					'You may use the listings in your own products and forward them to your users, for example in an alert bot. The key is yours: do not share it, publish it or resell access to the API. If it leaks, write to us and we will give you a new one. You may not get around the service’s limits or use it for anything unlawful.',
					'Listings include data posted by sellers, sometimes personal (for example, their username or city). You are responsible for using it lawfully, including under data protection law, and under any platform terms that apply to you.',
					'If you breach these terms, we may suspend or cancel your key; for serious breaches, without a refund.',
				],
			},
			{
				h: 'Liability',
				body: [
					'We are not liable for indirect damage or lost profits (for example, a purchase you did not make in time). In any case, our total liability is limited to what you paid us in the last 12 months. None of this limits your statutory rights as a consumer or our liability for wilful misconduct or gross negligence.',
				],
			},
			{
				h: 'Changes',
				body: ['We may change these terms or the prices. We will email you at least 30 days in advance; if you do not agree, you can cancel before they apply.'],
			},
			{
				h: 'Governing law',
				body: ['These terms are governed by Spanish law. If you are a consumer, you may go to the courts where you live.'],
			},
			{
				h: 'Model withdrawal form',
				body: [
					'(Complete and return this form only if you wish to withdraw from the contract)',
					[
						`To ${[name, address, mail].filter(Boolean).join(', ')}:`,
						'I hereby give notice that I withdraw from my contract for the provision of the following service: a Lurk subscription.',
						'Ordered on:',
						'Name of consumer:',
						'Address of consumer:',
						'Signature of consumer (only if this form is notified on paper):',
						'Date:',
					],
				],
			},
		],
	},
};

export const DOCS: Record<Lang, Record<DocId, Doc>> = { es, en };
