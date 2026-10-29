# Sources

Adapter registry for Polish shopping sites. Add a row when you add a site; no code change needed unless the site needs a parser.

Status legend: **works** = verified from this machine · **blocked** = anti-bot · **unverified** = test on first use.

---

## ceneo.pl — price comparison, new products

**Status:** works (verified 2026-10-29)
**Channel:** `scripts/ceneo.mjs` (curl/node OK, no anti-bot)

```bash
node scripts/ceneo.mjs "drukarka 3d" --max 1500 --limit 20
node scripts/ceneo.mjs --url "https://www.ceneo.pl/Drukarki_3D;m1000-2000.htm" --table
```

| Item | Detail |
|---|---|
| Search URL | `https://www.ceneo.pl/;szukaj-<query with + for spaces>` |
| Price filter | `;m<from>-<to>.htm` appended to the category path, e.g. `/Drukarki_3D;m1000-2000.htm` |
| Sort by price | `;0112-0.htm` (cheapest first) |
| Rankings | `/rankingi/ranking-<category>` — curated "best of" lists, good for the "best product" part of a request |
| Page size | 30 products per page |
| Fields | title, price (from-price), rating, review count, shop count, free delivery |
| Caveat | prices are "from" prices — the cheapest shop may not ship, and variants differ |

**Why it is the first source:** it aggregates hundreds of Polish shops, so one fetch gives a real market picture with ratings.

---

## olx.pl — classifieds, used and local

**Status:** works through the harness web-fetch tool only (verified 2026-10-29)
**Channel:** web-fetch tool. **Do not script it.**

```
https://www.olx.pl/oferty/q-<query with dashes>/
https://www.olx.pl/oferty/q-<query>/?search[filter_float_price:from]=300&search[filter_float_price:to]=1500
https://www.olx.pl/oferty/q-<query>/?search[order]=filter_float_price:asc
https://www.olx.pl/oferty/q-<query>/?page=2
```

| Item | Detail |
|---|---|
| Blocking | CloudFront 403 for curl and node, even with full Chrome headers. The web-fetch tool passes. |
| Fields in the markdown | title, price, location, date, link, sometimes delivery flag |
| Sorting | `search[order]=filter_float_price:asc` works (the page header shows "Najtańsze (przedmiot)") — but it surfaces a wall of 1 zł service listings and spare parts, so prefer relevance order and filter the price range instead |
| Caveat | lots of accessories and "for parts" listings — relevance filtering matters more here than anywhere else |
| Caveat | filter and sort parameter names are OLX internals; if a filter URL returns unfiltered results, drop the parameters and filter locally |

---

## allegrolokalnie.pl — classifieds (Allegro group)

**Status:** works (verified 2026-10-29)
**Channel:** `scripts/allegro-lokalnie.mjs` or web-fetch

```bash
node scripts/allegro-lokalnie.mjs "drukarka 3d" --max 1500 --min 200 --pages 2 --limit 30
```

| Item | Detail |
|---|---|
| Search URL | `https://allegrolokalnie.pl/oferty/q/<query-with-dashes>` |
| Price filter | `?price_to=<pln>` — verified |
| Pagination | `?page=2` — verified |
| Sorting | `?order=` had no visible effect; sort locally |
| Page size | 60 offers, delivered as schema.org `ItemList` JSON-LD |
| Fields | title, url, price, currency, condition (new/used) |

**Best free substitute for allegro.pl.** No DataDome, structured data, 60 offers per request.

---

## allegro.pl — marketplace

**Status:** **blocked** (verified 2026-10-29)
**Channel:** none that is free.

| Attempt | Result |
|---|---|
| curl with full Chrome headers | HTTP 403, DataDome JS challenge (`dd={...}`) |
| node fetch | HTTP 403, same challenge |
| harness web-fetch tool | HTTP 403 |
| Allegro REST API `GET /offers/listing` | "verified applications only", and Allegro **suspended verification of new applications** |

Do not retry. Report the gap in the answer. Options if the user insists:

1. Allegro Lokalnie (free, different inventory — classifieds, not the main catalogue).
2. A paid scraper actor that handles DataDome (per-result pricing).
3. A real browser session on the user's profile (works sometimes, not reliable, needs a human present).

---

## Generic shop fallback

**Status:** unverified — test the first time you use a shop.

Pattern: `<shop domain>/<search path>?<query param>`. Find the search URL by fetching the homepage and following the search form, or by trying the common shapes:

| Shop | Search URL shape |
|---|---|
| x-kom.pl | `https://www.x-kom.pl/szukaj?q=<query>` |
| morele.net | `https://www.morele.net/wyszukiwarka/0/0/,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,/?q=<query>` |
| mediaexpert.pl | `https://www.mediaexpert.pl/search?query[menu_item_id]=0&query[term]=<query>` |
| euro.com.pl | `https://www.euro.com.pl/search.bhtml?keyword=<query>` |
| otomoto.pl (cars) | `https://www.otomoto.pl/osobowe/q-<query>` — same group as OLX, expect the same blocking |

Rules for generic shops:

- one fetch, extract title + price + link, do not crawl the catalogue;
- treat missing ratings as "unknown", not as "bad";
- if the shop returns 403 or a JS shell, say so and move on.

---

## Adding a source

1. Verify it with a plain `curl -A "<chrome ua>"` — if it returns 200 and the product data is in the HTML (or in JSON-LD), it can be scripted.
2. If it returns 403, check whether the harness web-fetch tool passes. If yes: web-fetch only, note it here.
3. If both fail, mark it **blocked** with the date and the reason. Do not attempt bypasses.
4. Add the row to this file, with the date of verification.
