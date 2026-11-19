// Vinted monitor for Discord: sends every new item you are after to its channel.
// Guide: https://lurk.insomnis.dev/en/guides/vinted-discord-monitor/
import { readFileSync } from "node:fs";
import WebSocket from "ws";

const { LURK_KEY } = process.env;

// With your key, the full feed; without it, the public demo: real listings, one a second.
const LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + (LURK_KEY ? "feed" : "demo");

// Your monitors, each with its channel (webhook) and filters: see monitors.json.
const MONITORS = JSON.parse(readFileSync(process.env.MONITORS ?? "monitors.json", "utf8"));

const NAMES = { vinted: "Vinted", wallapop: "Wallapop", milanuncios: "Milanuncios", todocoleccion: "Todocolección" };
const COLORS = { vinted: 0x4fd1c5, wallapop: 0x60a5fa, milanuncios: 0xf6ad55, todocoleccion: 0xb794f4 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The value of one of the item's attributes (size, status, color…), or null. */
const attribute = (item, code) => item.attributes.find((a) => a.code === code)?.value ?? null;

function matches(monitor, platform, item) {
  if (!(monitor.platforms ?? ["vinted"]).includes(platform)) return false;
  const text = `${item.title} ${item.brand ?? ""}`.toLowerCase();
  if (monitor.keywords?.length && !monitor.keywords.some((k) => text.includes(k.toLowerCase()))) return false;
  if (monitor.max_price != null && item.price_in_cent > monitor.max_price * 100) return false;
  // "M / UK 12-14" → M, UK, 12-14
  const size = (attribute(item, "size") ?? "").replace(/\//g, " ").split(/\s+/);
  if (monitor.sizes?.length && !monitor.sizes.some((s) => size.includes(s))) return false;
  if (monitor.domain && platform === "vinted" && !item.vinted_hosts.includes(monitor.domain)) return false;
  return true;
}

// A Vinted item opens on any of its vinted_hosts: best on the monitor's.
const link = (monitor, item) =>
  monitor.domain && item.vinted_hosts.includes(monitor.domain) ? item.url.replace(item.host_url, monitor.domain) : item.url;

/** The Discord message: an embed with the photo and details, and a button to the listing. */
function message(monitor, platform, item) {
  const url = link(monitor, item);
  const fields = [{ name: "Price", value: `${(item.price_in_cent / 100).toFixed(2)} ${item.currency}`, inline: true }];
  for (const [name, value] of [["Size", attribute(item, "size")], ["Condition", attribute(item, "status")], ["Brand", item.brand]]) {
    if (value) fields.push({ name, value, inline: true });
  }
  const embed = {
    title: item.title.slice(0, 256),
    url,
    color: COLORS[platform],
    fields,
    footer: { text: `${monitor.name} · ${NAMES[platform]}` },
    timestamp: new Date().toISOString(),
  };
  if (item.url_photo.length) embed.image = { url: item.url_photo[0] };
  const button = { type: 2, style: 5, label: `View on ${NAMES[platform]}`, url };
  const body = { embeds: [embed], components: [{ type: 1, components: [button] }], allowed_mentions: { parse: [] } };
  // Your brand: the name and avatar it posts as, if not the webhook's own.
  for (const key of ["username", "avatar_url"]) if (monitor[key]) body[key] = monitor[key];
  // The mention goes in the text, not the embed: only there does it notify the role.
  if (monitor.role) {
    body.content = `<@&${monitor.role}>`;
    body.allowed_mentions = { roles: [monitor.role] };
  }
  return body;
}

/** Sends a message to the webhook. Returns false if the webhook no longer exists. */
async function post(monitor, body) {
  const url = new URL(monitor.webhook);
  // wait: Discord confirms the message (otherwise errors go unseen).
  // with_components: without it, Discord drops the button.
  url.searchParams.set("wait", "true");
  url.searchParams.set("with_components", "true");
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get("retry-after") ?? 5) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 404) {
      // Discord asks not to use a webhook again once it returns 404.
      console.error(`[${monitor.name}] The webhook does not exist or its URL is wrong: monitor stopped`);
      return false;
    }
    if (!res.ok) console.error(`[${monitor.name}] Discord ${res.status}: ${await res.text()}`);
    // If this webhook has used up its requests, waits for them to refill.
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      await sleep(Number(res.headers.get("x-ratelimit-reset-after") ?? 1) * 1000);
    }
    return true;
  }
}

// Reading from Lurk and sending to Discord run apart, with a queue per webhook:
// a slow channel does not hold up the rest, and Lurk does not cut you off for lagging.
const queues = MONITORS.map(() => []);
const seen = new Set(); // monitor:platform:id already sent, so none repeats

async function sender(monitor, queue) {
  for (;;) {
    const next = queue.shift();
    if (!next) {
      await sleep(250);
      continue;
    }
    try {
      if (!(await post(monitor, message(monitor, ...next)))) {
        monitor.stopped = true;
        return;
      }
    } catch (err) {
      console.error(`[${monitor.name}] Discord is not answering: ${err.message}`);
    }
  }
}

function listen(delay = 1000) {
  const platforms = [...new Set(MONITORS.flatMap((m) => m.platforms ?? ["vinted"]))].sort();
  const ws = new WebSocket(`${LURK_URL}?platforms=${platforms.join(",")}&format=normalized`, {
    headers: LURK_KEY ? { Authorization: `Bearer ${LURK_KEY}` } : {},
  });
  // Listings never stop: a silent minute is a dead connection.
  let timer;
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ws.terminate(), 60_000);
  };

  ws.on("open", () => {
    console.log("Connected to", LURK_URL, "·", platforms.join(", "));
    delay = 1000;
    alive();
  });
  ws.on("message", (data) => {
    alive();
    const { platform, items } = JSON.parse(data.toString());
    for (const item of items) {
      MONITORS.forEach((monitor, i) => {
        const key = `${i}:${platform}:${item.id}`;
        if (monitor.stopped || seen.has(key) || !matches(monitor, platform, item)) return;
        seen.add(key);
        if (seen.size > 50_000) seen.delete(seen.values().next().value);
        if (queues[i].length < 100) queues[i].push([platform, item]);
        else console.error(`[${monitor.name}] Too many alerts for Discord: narrow its filters`);
      });
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
MONITORS.forEach((monitor, i) => sender(monitor, queues[i]));
