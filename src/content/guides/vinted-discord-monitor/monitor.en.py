# Vinted monitor for Discord: sends every new item you are after to its channel.
# Guide: https://lurk.insomnis.dev/en/guides/vinted-discord-monitor/
import asyncio
import json
import os
from collections import OrderedDict
from datetime import datetime, timezone

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

LURK_KEY = os.environ.get("LURK_KEY")

# With your key, the full feed; without it, the public demo: real listings, one a second.
LURK_URL = "wss://api.lurk.insomnis.dev/v1/" + ("feed" if LURK_KEY else "demo")

# Your monitors, each with its channel (webhook) and filters: see monitors.json.
with open(os.environ.get("MONITORS", "monitors.json"), encoding="utf-8") as f:
    MONITORS = json.load(f)

NAMES = {"vinted": "Vinted", "wallapop": "Wallapop", "milanuncios": "Milanuncios", "todocoleccion": "Todocolección"}
COLORS = {"vinted": 0x4FD1C5, "wallapop": 0x60A5FA, "milanuncios": 0xF6AD55, "todocoleccion": 0xB794F4}


def attribute(item, code):
    """The value of one of the item's attributes (size, status, color…), or None."""
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
    # A Vinted item opens on any of its vinted_hosts: best on the monitor's.
    domain = monitor.get("domain")
    if domain and domain in item["vinted_hosts"]:
        return item["url"].replace(item["host_url"], domain, 1)
    return item["url"]


def message(monitor, platform, item):
    """The Discord message: an embed with the photo and details, and a button to the listing."""
    url = link(monitor, item)
    fields = [{"name": "Price", "value": f"{item['price_in_cent'] / 100:.2f} {item['currency']}", "inline": True}]
    for name, value in (("Size", attribute(item, "size")), ("Condition", attribute(item, "status")), ("Brand", item["brand"])):
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
    button = {"type": 2, "style": 5, "label": f"View on {NAMES[platform]}", "url": url}
    body = {"embeds": [embed], "components": [{"type": 1, "components": [button]}], "allowed_mentions": {"parse": []}}
    # Your brand: the name and avatar it posts as, if not the webhook's own.
    for key in ("username", "avatar_url"):
        if monitor.get(key):
            body[key] = monitor[key]
    # The mention goes in the text, not the embed: only there does it notify the role.
    if role := monitor.get("role"):
        body["content"] = f"<@&{role}>"
        body["allowed_mentions"] = {"roles": [role]}
    return body


async def post(client, monitor, body):
    """Sends a message to the webhook. Returns False if the webhook no longer exists."""
    while True:
        # wait: Discord confirms the message (otherwise errors go unseen).
        # with_components: without it, Discord drops the button.
        r = await client.post(monitor["webhook"], params={"wait": "true", "with_components": "true"}, json=body)
        if r.status_code == 429:
            await asyncio.sleep(float(r.headers.get("Retry-After", 5)))
            continue
        if r.status_code in (401, 404):
            # Discord asks not to use a webhook again once it returns 404.
            print(f"[{monitor['name']}] The webhook does not exist or its URL is wrong: monitor stopped")
            return False
        if r.is_error:
            print(f"[{monitor['name']}] Discord {r.status_code}: {r.text}")
        # If this webhook has used up its requests, waits for them to refill.
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
            print(f"[{monitor['name']}] Discord is not answering: {e}")


async def listen(queues):
    platforms = sorted({p for m in MONITORS for p in m.get("platforms", ["vinted"])})
    url = f"{LURK_URL}?platforms={','.join(platforms)}&format=normalized"
    headers = {"Authorization": f"Bearer {LURK_KEY}"} if LURK_KEY else {}
    seen = OrderedDict()  # (monitor, platform, id) already sent, so none repeats
    # connect() as an iterator reconnects by itself, with exponential backoff.
    async for ws in connect(url, additional_headers=headers):
        print("Connected to", LURK_URL, "·", ", ".join(platforms))
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
                            print(f"[{monitor['name']}] Too many alerts for Discord: narrow its filters")
        except ConnectionClosed:
            continue


async def main():
    # Reading from Lurk and sending to Discord run apart, with a queue per webhook:
    # a slow channel does not hold up the rest, and Lurk does not cut you off for lagging.
    queues = [(m, asyncio.Queue(maxsize=100)) for m in MONITORS]
    async with httpx.AsyncClient(timeout=30) as client:
        await asyncio.gather(listen(queues), *(sender(client, m, q) for m, q in queues))


asyncio.run(main())
