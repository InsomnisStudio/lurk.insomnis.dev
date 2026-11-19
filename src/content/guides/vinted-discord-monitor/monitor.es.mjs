// Monitor de Vinted para Discord: manda cada artículo nuevo que buscas a su canal.
// Guía: https://lurk.insomnis.dev/guias/monitor-vinted-discord/
import { readFileSync } from "node:fs";
import WebSocket from "ws";

const { LURK_KEY } = process.env;

// Con tu key, el feed completo; sin ella, el demo público: anuncios reales, uno por segundo.
const LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + (LURK_KEY ? "feed" : "demo");

// Tus monitores, cada uno con su canal (webhook) y sus filtros: ver monitors.json.
const MONITORS = JSON.parse(readFileSync(process.env.MONITORS ?? "monitors.json", "utf8"));

const NAMES = { vinted: "Vinted", wallapop: "Wallapop", milanuncios: "Milanuncios", todocoleccion: "Todocolección" };
const COLORS = { vinted: 0x4fd1c5, wallapop: 0x60a5fa, milanuncios: 0xf6ad55, todocoleccion: 0xb794f4 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** El valor de un atributo del artículo (size, status, color…), o null. */
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

// Un artículo de Vinted se abre en cualquiera de sus vinted_hosts: mejor en el del monitor.
const link = (monitor, item) =>
  monitor.domain && item.vinted_hosts.includes(monitor.domain) ? item.url.replace(item.host_url, monitor.domain) : item.url;

/** El mensaje de Discord: un embed con la foto y los datos, y un botón al anuncio. */
function message(monitor, platform, item) {
  const url = link(monitor, item);
  const fields = [{ name: "Precio", value: `${(item.price_in_cent / 100).toFixed(2)} ${item.currency}`, inline: true }];
  for (const [name, value] of [["Talla", attribute(item, "size")], ["Estado", attribute(item, "status")], ["Marca", item.brand]]) {
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
  const button = { type: 2, style: 5, label: `Ver en ${NAMES[platform]}`, url };
  const body = { embeds: [embed], components: [{ type: 1, components: [button] }], allowed_mentions: { parse: [] } };
  // Tu marca: el nombre y el avatar con los que escribe, si no quieres los del webhook.
  for (const key of ["username", "avatar_url"]) if (monitor[key]) body[key] = monitor[key];
  // La mención va en el texto, no en el embed: solo así avisa al rol.
  if (monitor.role) {
    body.content = `<@&${monitor.role}>`;
    body.allowed_mentions = { roles: [monitor.role] };
  }
  return body;
}

/** Manda un mensaje al webhook. Devuelve false si el webhook ya no existe. */
async function post(monitor, body) {
  const url = new URL(monitor.webhook);
  // wait: que Discord confirme el mensaje (si no, los errores no se ven).
  // with_components: sin él, Discord quita el botón.
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
      // Discord pide no volver a usar un webhook que da 404.
      console.error(`[${monitor.name}] El webhook no existe o su URL está mal: monitor parado`);
      return false;
    }
    if (!res.ok) console.error(`[${monitor.name}] Discord ${res.status}: ${await res.text()}`);
    // Si este webhook ha gastado sus peticiones, espera a que se renueven.
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      await sleep(Number(res.headers.get("x-ratelimit-reset-after") ?? 1) * 1000);
    }
    return true;
  }
}

// Leer de Lurk y mandar a Discord van por separado, con una cola por webhook:
// un canal lento no frena a los demás, y Lurk no te corta por leer lento.
const queues = MONITORS.map(() => []);
const seen = new Set(); // monitor:plataforma:id ya avisados, para no repetir

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
      console.error(`[${monitor.name}] Discord no responde: ${err.message}`);
    }
  }
}

function listen(delay = 1000) {
  const platforms = [...new Set(MONITORS.flatMap((m) => m.platforms ?? ["vinted"]))].sort();
  const ws = new WebSocket(`${LURK_URL}?platforms=${platforms.join(",")}&format=normalized`, {
    headers: LURK_KEY ? { Authorization: `Bearer ${LURK_KEY}` } : {},
  });
  // Siempre llegan anuncios: un minuto en silencio es una conexión muerta.
  let timer;
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ws.terminate(), 60_000);
  };

  ws.on("open", () => {
    console.log("Conectado a", LURK_URL, "·", platforms.join(", "));
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
        else console.error(`[${monitor.name}] Demasiados avisos para Discord: afina sus filtros`);
      });
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
MONITORS.forEach((monitor, i) => sender(monitor, queues[i]));
