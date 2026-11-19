# Monitor de Vinted para Discord: manda cada artículo nuevo que buscas a su canal.
# Guía: https://lurk.insomnis.dev/guias/monitor-vinted-discord/
import asyncio
import json
import os
from collections import OrderedDict
from datetime import datetime, timezone

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

LURK_KEY = os.environ.get("LURK_KEY")

# Con tu key, el feed completo; sin ella, el demo público: anuncios reales, uno por segundo.
LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + ("feed" if LURK_KEY else "demo")

# Tus monitores, cada uno con su canal (webhook) y sus filtros: ver monitors.json.
with open(os.environ.get("MONITORS", "monitors.json"), encoding="utf-8") as f:
    MONITORS = json.load(f)

NAMES = {"vinted": "Vinted", "wallapop": "Wallapop", "milanuncios": "Milanuncios", "todocoleccion": "Todocolección"}
COLORS = {"vinted": 0x4FD1C5, "wallapop": 0x60A5FA, "milanuncios": 0xF6AD55, "todocoleccion": 0xB794F4}


def attribute(item, code):
    """El valor de un atributo del artículo (size, status, color…), o None."""
    for a in item["attributes"]:
        if a["code"] == code:
            return a["value"]
    return None


def matches(monitor, platform, item):
    if platform not in monitor.get("platforms", ["vinted"]):
        return False
    text = f"{item['title']} {item['brand'] or ''}".lower()
    keywords = monitor.get("keywords")
    if keywords and not any(k.lower() in text for k in keywords):
        return False
    max_price = monitor.get("max_price")
    if max_price is not None and item["price_in_cent"] > max_price * 100:
        return False
    # "M / UK 12-14" → M, UK, 12-14
    sizes = monitor.get("sizes")
    if sizes and not set(sizes) & set((attribute(item, "size") or "").replace("/", " ").split()):
        return False
    domain = monitor.get("domain")
    if domain and platform == "vinted" and domain not in item["vinted_hosts"]:
        return False
    return True


def link(monitor, item):
    # Un artículo de Vinted se abre en cualquiera de sus vinted_hosts: mejor en el del monitor.
    domain = monitor.get("domain")
    if domain and domain in item["vinted_hosts"]:
        return item["url"].replace(item["host_url"], domain, 1)
    return item["url"]


def message(monitor, platform, item):
    """El mensaje de Discord: un embed con la foto y los datos, y un botón al anuncio."""
    url = link(monitor, item)
    fields = [{"name": "Precio", "value": f"{item['price_in_cent'] / 100:.2f} {item['currency']}", "inline": True}]
    for name, value in (("Talla", attribute(item, "size")), ("Estado", attribute(item, "status")), ("Marca", item["brand"])):
        if value:
            fields.append({"name": name, "value": value, "inline": True})
    embed = {
        "title": item["title"][:256],
        "url": url,
        "color": COLORS[platform],
        "fields": fields,
        "footer": {"text": f"{monitor['name']} · {NAMES[platform]}"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if item["url_photo"]:
        embed["image"] = {"url": item["url_photo"][0]}
    button = {"type": 2, "style": 5, "label": f"Ver en {NAMES[platform]}", "url": url}
    body = {"embeds": [embed], "components": [{"type": 1, "components": [button]}], "allowed_mentions": {"parse": []}}
    # Tu marca: el nombre y el avatar con los que escribe, si no quieres los del webhook.
    for key in ("username", "avatar_url"):
        if monitor.get(key):
            body[key] = monitor[key]
    # La mención va en el texto, no en el embed: solo así avisa al rol.
    if role := monitor.get("role"):
        body["content"] = f"<@&{role}>"
        body["allowed_mentions"] = {"roles": [role]}
    return body


async def post(client, monitor, body):
    """Manda un mensaje al webhook. Devuelve False si el webhook ya no existe."""
    while True:
        # wait: que Discord confirme el mensaje (si no, los errores no se ven).
        # with_components: sin él, Discord quita el botón.
        r = await client.post(monitor["webhook"], params={"wait": "true", "with_components": "true"}, json=body)
        if r.status_code == 429:
            await asyncio.sleep(float(r.headers.get("Retry-After", 5)))
            continue
        if r.status_code in (401, 404):
            # Discord pide no volver a usar un webhook que da 404.
            print(f"[{monitor['name']}] El webhook no existe o su URL está mal: monitor parado")
            return False
        if r.is_error:
            print(f"[{monitor['name']}] Discord {r.status_code}: {r.text}")
        # Si este webhook ha gastado sus peticiones, espera a que se renueven.
        if r.headers.get("X-RateLimit-Remaining") == "0":
            await asyncio.sleep(float(r.headers.get("X-RateLimit-Reset-After", 1)))
        return True


async def sender(client, monitor, queue):
    while True:
        platform, item = await queue.get()
        try:
            if not await post(client, monitor, message(monitor, platform, item)):
                monitor["stopped"] = True
                return
        except httpx.HTTPError as e:
            print(f"[{monitor['name']}] Discord no responde: {e}")


async def listen(queues):
    platforms = sorted({p for m in MONITORS for p in m.get("platforms", ["vinted"])})
    url = f"{LURK_URL}?platforms={','.join(platforms)}&format=normalized"
    headers = {"Authorization": f"Bearer {LURK_KEY}"} if LURK_KEY else {}
    seen = OrderedDict()  # (monitor, plataforma, id) ya avisados, para no repetir
    # connect() como iterador reconecta solo, con espera exponencial.
    async for ws in connect(url, additional_headers=headers):
        print("Conectado a", LURK_URL, "·", ", ".join(platforms))
        try:
            async for raw in ws:
                event = json.loads(raw)
                platform = event["platform"]
                for item in event["items"]:
                    for i, (monitor, queue) in enumerate(queues):
                        key = (i, platform, item["id"])
                        if monitor.get("stopped") or key in seen or not matches(monitor, platform, item):
                            continue
                        seen[key] = True
                        if len(seen) > 50_000:
                            seen.popitem(last=False)
                        try:
                            queue.put_nowait((platform, item))
                        except asyncio.QueueFull:
                            print(f"[{monitor['name']}] Demasiados avisos para Discord: afina sus filtros")
        except ConnectionClosed:
            continue


async def main():
    # Leer de Lurk y mandar a Discord van por separado, con una cola por webhook:
    # un canal lento no frena a los demás, y Lurk no te corta por leer lento.
    queues = [(m, asyncio.Queue(maxsize=100)) for m in MONITORS]
    async with httpx.AsyncClient(timeout=30) as client:
        await asyncio.gather(listen(queues), *(sender(client, m, q) for m, q in queues))


asyncio.run(main())
