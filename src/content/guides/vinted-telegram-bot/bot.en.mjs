// Telegram bot that alerts you to new Vinted items you are looking for.
// Guide: https://lurk.insomnis.dev/en/guides/vinted-telegram-bot/
import WebSocket from "ws";

const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, LURK_KEY } = process.env;
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) throw new Error("Set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID");

// With your key, the full feed; without it, the public demo: real listings, one a second.
const LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + (LURK_KEY ? "feed" : "demo");

// What you are after. An empty list or null means "any".
const KEYWORDS = ["nike dunk", "jordan 1"]; // in the title or brand
const MAX_PRICE = 80; // in euros
const SIZES = ["42", "M"]; // as Vinted writes them: "42", "M", "W32"…
const VINTED_DOMAIN = null; // e.g. "www.vinted.de": only what you can buy on your Vinted

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The value of one of the item's attributes (size, status, color…), or null. */
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

// The item opens on any of its vinted_hosts: best on yours.
const link = (item) =>
  item.vinted_hosts.includes(VINTED_DOMAIN) ? item.url.replace(item.host_url, VINTED_DOMAIN) : item.url;

function caption(item) {
  const details = [`${(item.price_in_cent / 100).toFixed(2)} ${item.currency}`];
  details.push(...[item.brand, attribute(item, "size"), attribute(item, "status")].filter(Boolean));
  return `<b>${escape(item.title)}</b>\n${escape(details.join(" · "))}`;
}

/** Calls the Bot API. If Telegram asks to wait (429), waits and retries. */
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
    reply_markup: { inline_keyboard: [[{ text: "View on Vinted", url: link(item) }]] },
  };
  // With the photo; if Telegram cannot fetch it, just the text.
  const [photo] = item.url_photo;
  if (photo && (await telegram("sendPhoto", { photo, caption: caption(item), ...options }))) return;
  await telegram("sendMessage", { text: caption(item), ...options });
}

// Reading from Lurk and sending to Telegram run apart: if Telegram is slow,
// the WebSocket keeps up and Lurk does not cut you off for lagging.
const queue = [];
const seen = new Set(); // the latest ones sent, so none repeats

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
      console.error("Telegram is not answering:", err.message);
    }
    // Telegram allows one message a second in a chat (20 a minute in a group).
    await sleep(1000);
  }
}

function listen(delay = 1000) {
  const ws = new WebSocket(`${LURK_URL}?platforms=vinted&format=normalized`, {
    headers: LURK_KEY ? { Authorization: `Bearer ${LURK_KEY}` } : {},
  });
  // Listings never stop: a silent minute is a dead connection.
  let timer;
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ws.terminate(), 60_000);
  };

  ws.on("open", () => {
    console.log("Connected to", LURK_URL);
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
      else console.error("Too many alerts for Telegram: narrow your filters");
    }
  });
  ws.on("error", (err) => {
    console.error("Lurk:", err.message);
    // A key or platform that is not valid: retrying will not fix it.
    if (/: 40[013]$/.test(err.message)) process.exit(1);
  });
  // Reconnects with exponential backoff: 1 s, 2 s, 4 s… up to 30 s.
  ws.on("close", () => {
    clearTimeout(timer);
    setTimeout(() => listen(Math.min(delay * 2, 30_000)), delay);
  });
}

listen();
sender();
