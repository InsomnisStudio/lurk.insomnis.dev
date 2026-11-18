# Telegram bot that alerts you to new Vinted items you are looking for.
# Guide: https://lurk.insomnis.dev/en/guides/vinted-telegram-bot/
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

# With your key, the full feed; without it, the public demo: real listings, one a second.
LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + ("feed" if LURK_KEY else "demo")

# What you are after. An empty list or None means "any".
KEYWORDS = ["nike dunk", "jordan 1"]  # in the title or brand
MAX_PRICE = 80  # in euros
SIZES = ["42", "M"]  # as Vinted writes them: "42", "M", "W32"…
VINTED_DOMAIN = None  # e.g. "www.vinted.de": only what you can buy on your Vinted


def attribute(item, code):
    """The value of one of the item's attributes (size, status, color…), or None."""
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
    # The item opens on any of its vinted_hosts: best on yours.
    if VINTED_DOMAIN in item["vinted_hosts"]:
        return item["url"].replace(item["host_url"], VINTED_DOMAIN, 1)
    return item["url"]


def caption(item):
    details = [f"{item['price_in_cent'] / 100:.2f} {item['currency']}"]
    details += [v for v in (item["brand"], attribute(item, "size"), attribute(item, "status")) if v]
    return f"<b>{html.escape(item['title'])}</b>\n{html.escape(' · '.join(details))}"


async def telegram(client, method, **params):
    """Calls the Bot API. If Telegram asks to wait (429), waits and retries."""
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
        "reply_markup": {"inline_keyboard": [[{"text": "View on Vinted", "url": link(item)}]]},
    }
    # With the photo; if Telegram cannot fetch it, just the text.
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
                print("Telegram is not answering:", e)
            # Telegram allows one message a second in a chat (20 a minute in a group).
            await asyncio.sleep(1)


async def listen(queue):
    headers = {"Authorization": f"Bearer {LURK_KEY}"} if LURK_KEY else {}
    seen = OrderedDict()  # the latest ones sent, so none repeats
    # connect() as an iterator reconnects by itself, with exponential backoff.
    async for ws in connect(f"{LURK_URL}?platforms=vinted&format=normalized", additional_headers=headers):
        print("Connected to", LURK_URL)
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
                        print("Too many alerts for Telegram: narrow your filters")
        except ConnectionClosed:
            continue


async def main():
    # Reading from Lurk and sending to Telegram run apart: if Telegram is slow,
    # the WebSocket keeps up and Lurk does not cut you off for lagging.
    queue = asyncio.Queue(maxsize=100)
    await asyncio.gather(listen(queue), sender(queue))


asyncio.run(main())
