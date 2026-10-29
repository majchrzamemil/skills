#!/usr/bin/env node
/**
 * Ceneo.pl listing -> compact JSON (or a markdown table).
 *
 * Ceneo is server-rendered and does not block plain HTTP, so this runs anywhere
 * Node runs. Price filtering and sorting happen locally, which keeps the URL
 * simple and avoids depending on Ceneo's undocumented URL parameters.
 *
 * Usage:
 *   node ceneo.mjs "drukarka 3d" --max 1500 --limit 20
 *   node ceneo.mjs --url "https://www.ceneo.pl/Drukarki_3D;m1000-2000.htm" --table
 *
 * Flags: --max <pln> --min <pln> --limit <n> --sort price|rating|reviews
 *        --table  --url <listing url>  --keep-duplicates
 */
import { parseArgs, fetchText, clean, num, dedupe, emit, requireUrl } from './lib/util.mjs';

const USAGE = `usage: node ceneo.mjs "<query>" [--max 1500] [--min 100] [--limit 20]
                      [--sort price|rating|reviews] [--table] [--url <listing url>]`;

const args = parseArgs(process.argv.slice(2));
const query = args._.join(' ').trim();

const searchUrl = (q) => `https://www.ceneo.pl/;szukaj-${encodeURIComponent(q).replace(/%20/g, '+')}`;
const url = requireUrl(typeof args.url === 'string' ? args.url : query ? searchUrl(query) : null, USAGE);

const html = await fetchText(url);
let offers = parse(html);

const max = num(args.max);
const min = num(args.min);
if (max !== null) offers = offers.filter((o) => o.price === null || o.price <= max);
if (min !== null) offers = offers.filter((o) => o.price === null || o.price >= min);
if (!args['keep-duplicates']) offers = dedupe(offers);

const sort = typeof args.sort === 'string' ? args.sort : 'price';
offers.sort((a, b) => {
  if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
  if (sort === 'reviews') return (b.reviews ?? 0) - (a.reviews ?? 0);
  return (a.price ?? Infinity) - (b.price ?? Infinity);
});

const limit = num(args.limit) ?? 30;
emit(offers.slice(0, limit), args, { source: 'ceneo.pl', query: query || null, url });

function parse(html) {
  const rows = html.split(/(?=<div\s+class="\s*cat-prod-row\b)/).slice(1);
  const out = [];

  for (const row of rows) {
    const pid = (row.match(/data-pid="(\d+)"/) || [])[1];
    if (!pid) continue;

    const title =
      clean((row.match(/<span class="font-bold">([\s\S]*?)<\/span>/) || [])[1] ?? '') ||
      clean((row.match(/data-product-name="([^"]+)"/) || [])[1] ?? '') ||
      clean((row.match(/<img[^>]*alt="([^"]+)"/) || [])[1] ?? '');
    if (!title) continue;

    const priceMatch = row.match(
      /<span class="value">([\d\s\u00a0]+)<\/span><span class="penny">,(\d+)<\/span>/,
    );
    const price = priceMatch ? num(`${priceMatch[1]}.${priceMatch[2]}`) : null;

    const ratingRaw = (row.match(/<span class="product-score">\s*([\d,]+)/) || [])[1];
    const reviewsRaw = (row.match(/([\d\s]+)\s*(?:opinia|opinie|opinii)\b/) || [])[1];
    const shopsRaw = (row.match(/w (\d+)\s*sklep/) || [])[1];

    out.push({
      title,
      price,
      currency: 'PLN',
      priceFrom: row.includes('price-prefix">od'),
      url: `https://www.ceneo.pl/${pid}`,
      source: 'ceneo.pl',
      rating: ratingRaw ? num(ratingRaw) : null,
      reviews: reviewsRaw ? num(reviewsRaw) : null,
      shops: shopsRaw ? num(shopsRaw) : null,
      freeDelivery: /Darmowa wysyłka/.test(row),
    });
  }

  return out;
}
