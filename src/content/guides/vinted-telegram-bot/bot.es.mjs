// Bot de Telegram que te avisa de los artículos nuevos de Vinted que buscas.
// Guía: https://lurk.insomnis.dev/guias/bot-telegram-vinted/
import WebSocket from "ws";

const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, LURK_KEY } = process.env;
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) throw new Error("Faltan TELEGRAM_TOKEN y TELEGRAM_CHAT_ID");

// Con tu key, el feed completo; sin ella, el demo público: anuncios reales, uno por segundo.
const LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + (LURK_KEY ? "feed" : "demo");

// Lo que buscas. Una lista vacía o null es "cualquiera".
const KEYWORDS = ["nike dunk", "jordan 1"]; // en el título o la marca
const MAX_PRICE = 80; // en euros
const SIZES = ["42", "M"]; // tal como las escribe Vinted: "42", "M", "W32"…
const VINTED_DOMAIN = "www.vinted.es"; // solo lo que se puede comprar en tu Vinted

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** El valor de un atributo del artículo (size, status, color…), o null. */
const attribute = (item, code) => item.attributes.find((a) => a.code === code)?.value ?? null;

function matches(item) {
  const text = `${item.title} ${item.brand ?? ""}`.toLowerCase();
  if (KEYWORDS.length && !KEYWORDS.some((k) => text.includes(k.toLowerCase()))) return false;
  if (MAX_PRICE != null && item.price_in_cent > MAX_PRICE * 100) return false;
  // "M / UK 12-14" → M, UK, 12-14
  const size = (attribute(item, "size") ?? "").replace(/\//g, " ").split(/\s+/);
  if (SIZES.length && !SIZES.some((s) => size.includes(s))) return false;
  if (VINTED_DOMAIN && !item.vinted_hosts.includes(VINTED_DOMAIN)) return false;
  return true;
}

// El artículo se abre en cualquiera de sus vinted_hosts: mejor en el tuyo.
const link = (item) =>
  item.vinted_hosts.includes(VINTED_DOMAIN) ? item.url.replace(item.host_url, VINTED_DOMAIN) : item.url;

function caption(item) {
  const details = [`${(item.price_in_cent / 100).toFixed(2)} ${item.currency}`];
  details.push(...[item.brand, attribute(item, "size"), attribute(item, "status")].filter(Boolean));
  return `<b>${escape(item.title)}</b>\n${escape(details.join(" · "))}`;
}

/** Llama a la Bot API. Si Telegram pide esperar (429), espera y repite. */
async function telegram(method, params) {
  for (;;) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, ...params }),
    });
    const body = await res.json();
    if (res.status === 429) {
      await sleep(body.parameters.retry_after * 1000);
      continue;
    }
    if (!body.ok) console.error(`Telegram ${method}: ${body.description}`);
    return body.ok;
  }
}

async function notify(item) {
  const options = {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "Ver en Vinted", url: link(item) }]] },
  };
  // Con foto; si Telegram no consigue descargarla, solo el texto.
  const [photo] = item.url_photo;
  if (photo && (await telegram("sendPhoto", { photo, caption: caption(item), ...options }))) return;
  await telegram("sendMessage", { text: caption(item), ...options });
}

// Leer de Lurk y mandar a Telegram van por separado: si Telegram va lento,
// el WebSocket sigue leyendo al día y Lurk no te corta por lento.
const queue = [];
const seen = new Set(); // los últimos avisados, para no repetir

async function sender() {
  for (;;) {
    const item = queue.shift();
    if (!item) {
      await sleep(250);
      continue;
    }
    try {
      await notify(item);
    } catch (err) {
      console.error("Telegram no responde:", err.message);
    }
    // Telegram admite un mensaje por segundo en un chat (20 por minuto en un grupo).
    await sleep(1000);
  }
}

function listen(delay = 1000) {
  const ws = new WebSocket(`${LURK_URL}?platforms=vinted&format=normalized`, {
    headers: LURK_KEY ? { Authorization: `Bearer ${LURK_KEY}` } : {},
  });
  // Siempre llegan anuncios: un minuto en silencio es una conexión muerta.
  let timer;
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ws.terminate(), 60_000);
  };

  ws.on("open", () => {
    console.log("Conectado a", LURK_URL);
    delay = 1000;
    alive();
  });
  ws.on("message", (data) => {
    alive();
    for (const item of JSON.parse(data.toString()).items) {
      if (seen.has(item.id) || !matches(item)) continue;
      seen.add(item.id);
      if (seen.size > 10_000) seen.delete(seen.values().next().value);
      if (queue.length < 100) queue.push(item);
      else console.error("Demasiados avisos para Telegram: afina los filtros");
    }
  });
  ws.on("error", (err) => {
    console.error("Lurk:", err.message);
    // Key o plataformas que no valen: reintentar no lo arregla.
    if (/: 40[013]$/.test(err.message)) process.exit(1);
  });
  // Reconecta con espera exponencial: 1 s, 2 s, 4 s… hasta 30 s.
  ws.on("close", () => {
    clearTimeout(timer);
    setTimeout(() => listen(Math.min(delay * 2, 30_000)), delay);
  });
}

listen();
sender();
