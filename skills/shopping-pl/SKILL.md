---
name: shopping-pl
description: "Finds, filters and ranks purchase offers on Polish sites (Ceneo, OLX, Allegro Lokalnie, online shops) and returns a shortlist with verified links. Use when the user wants to buy something, compare prices, or pick the best product within a budget — triggers: \"znajdź mi\", \"kup\", \"najlepszy\", \"do X zł\", \"porównaj ceny\", \"wyszukaj ofertę\", \"aukcja\", \"ogłoszenie\", \"ile kosztuje\", \"find me\", \"best ... under\", \"price comparison\"."
---

# shopping-pl

Turn a shopping request into a ranked shortlist of real, clickable offers.

The output is always: a table of candidates, the top 3 with a one-line justification, and a short "what to avoid" note.

## Non-negotiables

These override everything else in this file. Violating any of them means the answer is wrong, even if the analysis is good.

1. **Every row carries a clickable URL.** A table without links is a failed answer. If you cannot produce a link for an offer, drop the offer.
2. **Links come from pages you fetched in this session.** Never construct, guess, or "reconstruct" a product URL from an ID pattern.
3. **The timestamp is in the answer.** Prices go stale within days.
4. **Used and no-warranty are stated explicitly**, never implied away.
5. **Read-only.** Never log in, never buy, never bid, never fill a checkout.
6. **Failed sources are named**, never silently omitted.

## 1. Parse the request

Extract and write down before searching:

| Field | Default when missing |
|---|---|
| Product (and model, if given) | — (must have) |
| Budget in PLN | none — do not invent one |
| Hard requirements (size, capacity, condition, shipping, city) | none |
| Condition | `new` — unless the user says "cheap", "used", or names OLX |
| Delivery vs pickup | either, but report the difference |

Ask at most one clarifying question, only when the product itself is ambiguous. Otherwise proceed.

## 2. Pick sources

Read `references/sources.md` when the user names specific sites, or the category is unusual.

Default mix for "best X under Y":

1. **Ceneo** — new products from shops, ratings, price spread.
2. **OLX** — used and local, good for bargains.
3. **Allegro Lokalnie** — used, cheap, small sellers.

If the user gives a list of sites, map each one through `references/sources.md`. For a domain that is not listed, use the generic fallback: fetch the site's own search URL and extract titles, prices and links.

## 3. Fetch

Use the cheapest working channel first:

| Order | Channel | When |
|---|---|---|
| 1 | `scripts/ceneo.mjs`, `scripts/allegro-lokalnie.mjs` via shell | Always, when a shell is available — returns compact JSON |
| 2 | Harness web-fetch tool | OLX, shops, anything without a script |
| 3 | Browser tool | Sites behind JS or a login (only if available) |

Tool names differ per harness — see `references/harness.md`.

### Two hard facts, do not fight them

- **allegro.pl is blocked.** DataDome returns HTTP 403 to every plain request (curl, node, and harness fetch). Do not retry it, do not try to "work around" it. Report the gap and offer Allegro Lokalnie instead.
- **olx.pl blocks scripts.** CloudFront returns 403 to curl/node even with full browser headers, but the harness web-fetch tool works. Never script OLX.

If a source fails, say which one and why. Never silently drop a source.

### Budget discipline

- One page per source, at most two. Never crawl.
- Never paste raw HTML into the answer.
- Fetch only what you will actually rank (10–30 offers per source is plenty).

## 4. Normalise

Every offer becomes the same shape:

```json
{
  "title": "...",
  "price": 1299.0,
  "currency": "PLN",
  "url": "https://...",
  "source": "ceneo.pl",
  "condition": "new | used | null",
  "rating": 4.6,
  "reviews": 35,
  "seller": "shop name or null",
  "delivery": "free | paid | pickup | unknown"
}
```

Deduplicate: the same model across several shops is **one row** with the lowest price; list the other shops under "also at".

## 5. Filter

Drop, and count how many you dropped:

- price above budget (unless the user explicitly allows +10%);
- accessories, spare parts, upgrades, filament, spools, "for X" items when the user wants X;
- bundles of several different products;
- listings without a price, or with a price that is clearly a placeholder (1 zł, 0,01 zł);
- offers that are obviously the wrong product type (resin printer vs FDM when it matters).

## 6. Score

Read `references/scoring.md` for the weights. Rule of thumb: product quality first, then price-to-budget fit, then seller trust, then warranty, then delivery.

Show the top 3 and the full table. If the spread between the cheapest and the median is above 40%, say it out loud — it usually means different variants or a scam.

## 7. Answer

```markdown
## <Product> under <budget> — <date, time>

**Sources:** ceneo.pl, olx.pl, allegrolokalnie.pl · **Found:** 41 → **after filters:** 17
**Not covered:** allegro.pl (DataDome blocks automated access)

| # | Product | Price | Source | Signals | Link |
|---|---------|-------|--------|---------|------|
| 1 | ... | 1099 zł | ceneo.pl | 92/100 · 4.9/5 · 312 reviews · new | https://... |

**Top 3**
1. **<name> — <price>** — why it wins, in one line. [link](https://...)
2. ...
3. ...

**Watch out:** <the trap in this specific result set>

**Recommendation:** <one sentence, including whether paying more is worth it>
```

Template rules:

- **Keep the `Link` column. Never replace it with a score column** — the score belongs in `Signals`.
- The link is the full URL, not a bare ID, not a domain, not "see above".
- The top 3 repeats the link again, so the user can click without scanning the table.

### Self-check before sending

Run this literally; if any box is unchecked, fix it first.

- [ ] every table row ends with an `https://` URL
- [ ] every URL appeared in output you actually received this session
- [ ] the timestamp is present
- [ ] each source you tried is either represented in the table or named as not covered
- [ ] no two rows are the same product at the same shop
- [ ] used items and missing warranty are visible, not buried


Keep it short. The table plus three lines of justification beats an essay — but never at the cost of the link column. The binding rules live in **Non-negotiables** at the top of this file.

## Cost

Zero. Everything here runs on public pages and built-in Node. No paid APIs, no keys.

If the user later wants allegro.pl coverage, the only sane options are a paid scraper API or a real browser session — mention it as an option, do not attempt a workaround.
