#!/usr/bin/env node
/**
 * Allegro Lokalnie (allegrolokalnie.pl) -> compact JSON (or a markdown table).
 *
 * The listing page ships a schema.org `ItemList` in JSON-LD, so parsing is
 * stable and cheap: 60 offers per page, with title, url, price and condition.
 * Unlike allegro.pl this domain has no DataDome challenge for plain HTTP.
 *
 * Usage:
 *   node allegro-lokalnie.mjs "drukarka 3d" --max 1500 --pages 2 --limit 30
 *   node allegro-lokalnie.mjs --url "https://allegrolokalnie.pl/oferty/q/drukarka-3d?price_to=1500"
 *
 * Flags: --max <pln> --limit <n> --pages <n> --table --url <listing url>
 */
import { parseArgs, fetchText, num, dedupe, emit } from './lib/util.mjs';

const USAGE = `usage: node allegro-lokalnie.mjs "<query>" [--max 1500] [--pages 2] [--limit 30]
                              [--table] [--url <listing url>]`;

const args = parseArgs(process.argv.slice(2));
const query = args._.join(' ').trim();
const max = num(args.max);
const min = num(args.min);
const pages = Math.max(1, Math.min(5, num(args.pages) ?? 1));

const buildUrl = (page) => {
  if (typeof args.url === 'string') {
    const u = new URL(args.url);
    if (page > 1) u.searchParams.set('page', String(page));
    return u.toString();
  }
  const slug = query.toLowerCase().replace(/\s+/g, '-');
  const u = new URL(`https://allegrolokalnie.pl/oferty/q/${encodeURIComponent(slug)}`);
  if (max !== null) u.searchParams.set('price_to', String(max));
  if (page > 1) u.searchParams.set('page', String(page));
  return u.toString();
};

if (!query && typeof args.url !== 'string') {
  console.error(USAGE);
  process.exit(1);
}

let offers = [];
for (let page = 1; page <= pages; page++) {
  const url = buildUrl(page);
  const html = await fetchText(url);
  const pageOffers = parse(html);
  if (pageOffers.length === 0) break;
  offers.push(...pageOffers);
}

if (max !== null) offers = offers.filter((o) => o.price === null || o.price <= max);
if (min !== null) offers = offers.filter((o) => o.price === null || o.price >= min);
offers = dedupe(offers).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

const limit = num(args.limit) ?? 30;
emit(offers.slice(0, limit), args, {
  source: 'allegrolokalnie.pl',
  query: query || null,
  pages,
});

function parse(html) {
  const out = [];
  const blocks = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );

  for (const [, raw] of blocks) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const lists = Array.isArray(data) ? data : [data];
    for (const list of lists) {
      if (list?.['@type'] !== 'ItemList' || !Array.isArray(list.itemListElement)) continue;
      for (const entry of list.itemListElement) {
        const item = entry?.item;
        if (!item?.name || !item?.url) continue;
        out.push({
          title: item.name,
          price: num(item.offers?.price),
          currency: item.offers?.priceCurrency ?? 'PLN',
          url: item.url,
          source: 'allegrolokalnie.pl',
          condition: conditionLabel(item.itemCondition),
          image: item.image?.url ?? item.image ?? null,
        });
      }
    }
  }

  return out;
}

function conditionLabel(value = '') {
  if (typeof value !== 'string') return null;
  if (value.endsWith('UsedCondition')) return 'used';
  if (value.endsWith('NewCondition')) return 'new';
  return null;
}
