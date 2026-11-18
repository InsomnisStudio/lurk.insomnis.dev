# Bot de Telegram que te avisa de los artículos nuevos de Vinted que buscas.
# Guía: https://lurk.insomnis.dev/guias/bot-telegram-vinted/
import asyncio
import html
import json
import os
from collections import OrderedDict

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
LURK_KEY = os.environ.get("LURK_KEY")

# Con tu key, el feed completo; sin ella, el demo público: anuncios reales, uno por segundo.
LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + ("feed" if LURK_KEY else "demo")

# Lo que buscas. Una lista vacía o None es "cualquiera".
KEYWORDS = ["nike dunk", "jordan 1"]  # en el título o la marca
MAX_PRICE = 80  # en euros
SIZES = ["42", "M"]  # tal como las escribe Vinted: "42", "M", "W32"…
VINTED_DOMAIN = "www.vinted.es"  # solo lo que se puede comprar en tu Vinted


def attribute(item, code):
    """El valor de un atributo del artículo (size, status, color…), o None."""
    for a in item["attributes"]:
        if a["code"] == code:
            return a["value"]
    return None


def matches(item):
    text = f"{item['title']} {item['brand'] or ''}".lower()
    if KEYWORDS and not any(k.lower() in text for k in KEYWORDS):
        return False
    if MAX_PRICE is not None and item["price_in_cent"] > MAX_PRICE * 100:
        return False
    # "M / UK 12-14" → M, UK, 12-14
    if SIZES and not set(SIZES) & set((attribute(item, "size") or "").replace("/", " ").split()):
        return False
    if VINTED_DOMAIN and VINTED_DOMAIN not in item["vinted_hosts"]:
        return False
    return True


def link(item):
    # El artículo se abre en cualquiera de sus vinted_hosts: mejor en el tuyo.
    if VINTED_DOMAIN in item["vinted_hosts"]:
        return item["url"].replace(item["host_url"], VINTED_DOMAIN, 1)
    return item["url"]


def caption(item):
    details = [f"{item['price_in_cent'] / 100:.2f} {item['currency']}"]
    details += [v for v in (item["brand"], attribute(item, "size"), attribute(item, "status")) if v]
    return f"<b>{html.escape(item['title'])}</b>\n{html.escape(' · '.join(details))}"


async def telegram(client, method, **params):
    """Llama a la Bot API. Si Telegram pide esperar (429), espera y repite."""
    while True:
        r = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}",
            json={"chat_id": TELEGRAM_CHAT_ID, **params},
        )
        body = r.json()
        if r.status_code == 429:
            await asyncio.sleep(body["parameters"]["retry_after"])
            continue
        if not body["ok"]:
            print(f"Telegram {method}: {body['description']}")
        return body["ok"]


async def notify(client, item):
    options = {
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": [[{"text": "Ver en Vinted", "url": link(item)}]]},
    }
    # Con foto; si Telegram no consigue descargarla, solo el texto.
    photos = item["url_photo"]
    if photos and await telegram(client, "sendPhoto", photo=photos[0], caption=caption(item), **options):
        return
    await telegram(client, "sendMessage", text=caption(item), **options)


async def sender(queue):
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            item = await queue.get()
            try:
                await notify(client, item)
            except (httpx.HTTPError, ValueError) as e:
                print("Telegram no responde:", e)
            # Telegram admite un mensaje por segundo en un chat (20 por minuto en un grupo).
            await asyncio.sleep(1)


async def listen(queue):
    headers = {"Authorization": f"Bearer {LURK_KEY}"} if LURK_KEY else {}
    seen = OrderedDict()  # los últimos avisados, para no repetir
    # connect() como iterador reconecta solo, con espera exponencial.
    async for ws in connect(f"{LURK_URL}?platforms=vinted&format=normalized", additional_headers=headers):
        print("Conectado a", LURK_URL)
        try:
            async for message in ws:
                for item in json.loads(message)["items"]:
                    if item["id"] in seen or not matches(item):
                        continue
                    seen[item["id"]] = True
                    if len(seen) > 10_000:
                        seen.popitem(last=False)
                    try:
                        queue.put_nowait(item)
                    except asyncio.QueueFull:
                        print("Demasiados avisos para Telegram: afina los filtros")
        except ConnectionClosed:
            continue


async def main():
    # Leer de Lurk y mandar a Telegram van por separado: si Telegram va lento,
    # el WebSocket sigue leyendo al día y Lurk no te corta por lento.
    queue = asyncio.Queue(maxsize=100)
    await asyncio.gather(listen(queue), sender(queue))


asyncio.run(main())
