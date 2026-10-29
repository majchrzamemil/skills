// Shared helpers for the shopping-pl scripts.
// Node 18+ built-ins only — no dependencies, so the skill stays portable.

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal `--key value` / `--flag` parser. Positional args land in `_`. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export async function fetchText(url, { timeout = 25000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'pl-PL,pl;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status >= 500 && attempt < retries) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(700);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(700);
    }
  }
  throw lastError;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  oacute: 'ó', aacute: 'á', eacute: 'é', ndash: '–', mdash: '—', hellip: '…',
  zl: 'zł', reg: '®', copy: '©', trade: '™',
};

export function decodeEntities(text = '') {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Strip tags, decode entities, collapse whitespace. */
export function clean(html = '') {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "9 830,00" / "9 830" / "1299.00" -> 9830 */
export function num(value) {
  if (value === null || value === undefined) return null;
  const normalised = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

export function slug(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Collapse offers that describe the same product; keep the cheapest. */
export function dedupe(offers) {
  const byKey = new Map();
  for (const offer of offers) {
    const key = slug(offer.title).replace(/\b(drukarka|nowa|nowy|uzywany|uzywana)\b/g, '').trim();
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, offer);
      continue;
    }
    const cheaper = (offer.price ?? Infinity) < (current.price ?? Infinity);
    byKey.set(key, {
      ...(cheaper ? offer : current),
      alsoAt: [...(current.alsoAt ?? []), { source: current.source, price: current.price, url: current.url }]
        .filter((entry) => entry.url !== offer.url),
    });
  }
  return [...byKey.values()];
}

export function pln(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export function toTable(offers) {
  const rows = offers.map((o, i) => {
    const extra = [o.rating ? `${o.rating}/5` : null, o.reviews ? `${o.reviews} rev` : null, o.condition]
      .filter(Boolean)
      .join(' · ');
    return `| ${i + 1} | ${o.title.replace(/\|/g, '/')} | ${pln(o.price)} | ${o.source} | ${extra || '—'} | ${o.url} |`;
  });
  return [
    '| # | Title | Price | Source | Signals | URL |',
    '|---|-------|-------|--------|---------|-----|',
    ...rows,
  ].join('\n');
}

export function emit(offers, args, meta = {}) {
  if (args.table) {
    console.log(toTable(offers));
    return;
  }
  console.log(
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        ...meta,
        count: offers.length,
        offers,
      },
      null,
      2,
    ),
  );
}

export function requireUrl(url, usage) {
  if (!url) {
    console.error(usage);
    process.exit(1);
  }
  return url;
}
