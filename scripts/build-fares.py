#!/usr/bin/env python3
"""Build data/fares.json from the hkbus route/fare list.

Independent ETA apps (hkbus.app, hk-bus-eta) read
https://data.hkbus.app/routeFareList.min.json — CORS-enabled, rebuilt from
the Transport Department GTFS (fare_attributes.txt) plus KMB/CTB stop ids.
That feed has one adult price per boarding stop. KMB's own getstops AirFare
and the Citybus GTFS price match it. Neither feed publishes a concession
price for KMB or Citybus; a future adult/concession pair can be stored as
"12.0/6.0".

Direction is kept when only one bound has a fare, so an alighting-only visit
does not inherit the other direction's price.
"""
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

URL = "https://data.hkbus.app/routeFareList.min.json"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "fares.json"
COMPANIES = ("kmb", "ctb")


def money(raw):
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not value > 0:
        return None
    return f"{value:.1f}"


def load():
    request = urllib.request.Request(URL, headers={"User-Agent": "heui-bin-fares"})
    with urllib.request.urlopen(request, timeout=120) as response:
        updated = response.headers.get("Last-Modified")
        payload = json.load(response)
    if updated:
        stamp = parsedate_to_datetime(updated).astimezone(timezone.utc).date().isoformat()
    else:
        stamp = datetime.now(timezone.utc).date().isoformat()
    return payload, stamp


def aligned_count(stops, fares):
    if not stops or not fares:
        return 0
    if len(fares) == len(stops) or len(fares) == len(stops) - 1:
        return len(fares)
    return 0


def encode(slots):
    clean = {key: price for key, price in slots.items() if price}
    if not clean:
        return None
    prices = set(clean.values())
    directions = {direction for direction, _service in clean}
    if len(prices) == 1 and len(directions) > 1:
        return next(iter(prices))
    by_dir = defaultdict(list)
    for (direction, service), price in clean.items():
        by_dir[direction].append((service, price))
    parts = []
    for direction in ("O", "I"):
        items = by_dir.get(direction)
        if not items:
            continue
        unique = {price for _service, price in items}
        if len(unique) == 1:
            parts.append(f"{direction}:{next(iter(unique))}")
            continue
        for service, price in sorted(items, key=lambda item: item[0]):
            parts.append(f"{direction}{service}:{price}")
    return ",".join(parts) if parts else None


def build(payload):
    cell = defaultdict(dict)
    skipped = 0
    for entry in payload["routeList"].values():
        companies = entry.get("co") or []
        fares = entry.get("fares") or []
        route = str(entry.get("route") or "")
        service = str(entry.get("serviceType") or "1")
        if not route:
            continue
        for company in COMPANIES:
            if company not in companies:
                continue
            stops = (entry.get("stops") or {}).get(company) or []
            count = aligned_count(stops, fares)
            bound = (entry.get("bound") or {}).get(company)
            if not count or bound not in ("O", "I"):
                if stops or fares:
                    skipped += 1
                continue
            for index in range(count):
                price = money(fares[index])
                if not price:
                    continue
                slot = cell[(company, stops[index], route)]
                key = (bound, service)
                previous = slot.get(key)
                if previous is None:
                    slot[key] = price
                elif previous != price:
                    slot[key] = ""
    books = {company: {} for company in COMPANIES}
    for (company, stop_id, route), slots in cell.items():
        spec = encode(slots)
        if not spec:
            continue
        books[company].setdefault(stop_id, {})[route] = spec
    for company in COMPANIES:
        books[company] = {
            stop_id: dict(sorted(routes.items(), key=lambda item: item[0]))
            for stop_id, routes in sorted(books[company].items())
        }
    return books, skipped


def main():
    payload, updated = load()
    books, skipped = build(payload)
    document = {
        "updated": updated,
        "source": URL,
        "kmb": books["kmb"],
        "ctb": books["ctb"],
    }
    OUT.write_text(json.dumps(document, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"wrote {OUT} {size} bytes updated {updated} skipped_entries {skipped}")
    for company in COMPANIES:
        stops = books[company]
        pairs = sum(len(routes) for routes in stops.values())
        print(f"  {company} stops {len(stops)} route-stops {pairs}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
