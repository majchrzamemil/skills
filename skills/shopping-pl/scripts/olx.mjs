#!/usr/bin/env node
/**
 * OLX.pl listing -> compact JSON (or a markdown table).
 *
 * OLX ships the offers in the server-rendered HTML as `data-cy="l-card"`
 * blocks, so a plain HTTP fetch works from some networks. Others get a
 * CloudFront 403; when that happens fall back to the harness web-fetch tool
 * (see adapters/). Price filtering and sorting happen locally, because the
 * OLX filter query params are internals that may be ignored.
 *
 * Usage:
 *   node olx.mjs "drukarka 3d" --max 1000 --limit 30
 *   node olx.mjs --url "https://www.olx.pl/oferty/q-bar-kite/" --table
 *
 * Flags: --max <pln> --min <pln> --limit <n> --pages <n> --table --url <listing url>
 */
import { parseArgs, fetchText, clean, num, dedupe, emit } from './lib/util.mjs';

const USAGE = `usage: node olx.mjs "<query>" [--max 1000] [--min 100] [--pages 2] [--limit 30]
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
  const u = new URL(`https://www.olx.pl/oferty/q-${slug}/`);
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
  source: 'olx.pl',
  query: query || null,
  pages,
});

function parse(html) {
  const out = [];
  const cards = html.split(/data-cy="l-card"/).slice(1);

  for (const card of cards) {
    const href = (card.match(/href="([^"]+)"/) || [])[1];
    if (!href || !/\/d\/oferta\//.test(href)) continue;

    const title =
      clean((card.match(/<h[456][^>]*>([\s\S]*?)<\/h[456]>/i) || [])[1] ?? '') ||
      clean((card.match(/data-testid="ad-title"[^>]*>([\s\S]*?)<\//) || [])[1] ?? '');
    if (!title) continue;

    const priceRaw = clean((card.match(/data-testid="ad-price[^"]*"[^>]*>([\s\S]*?)<\//) || [])[1] ?? '');
    const location = clean((card.match(/data-testid="location-date"[^>]*>([\s\S]*?)<\//) || [])[1] ?? '');

    out.push({
      title,
      price: num(priceRaw),
      currency: 'PLN',
      url: `https://www.olx.pl${href.split('?')[0]}`,
      source: 'olx.pl',
      condition: null,
      location: location || null,
    });
  }

  return out;
}
