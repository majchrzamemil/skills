# Scoring

How to turn a pile of offers into "the best one under the budget".

The score is not the answer — it is a way to keep the ranking consistent between runs. Always show the reasoning in one line per pick.

## Weights

| Criterion | Weight | What it means |
|---|---|---|
| Product fit | 30 | Does it actually do what the user needs? Spec, size, capacity, model generation |
| Price fit | 20 | Value inside the budget — not "cheapest", but "best use of the budget" |
| Reviews / ratings | 20 | Rating and number of reviews; fewer than 5 reviews = low confidence |
| Seller trust | 15 | Known shop, Allegro Super Sprzedawca, OLX account age, business seller |
| Warranty & returns | 10 | New with 24-month warranty scores high; used with no returns scores low |
| Delivery | 5 | Free and fast beats paid and slow; pickup matters when the user is local |

Total 100. Round to whole numbers.

## Penalties (subtract, do not skip)

| Signal | Penalty |
|---|---|
| Used, no warranty | −15 |
| "Uszkodzone", "na części", "nie testowane" | −40 (usually disqualifying) |
| Price more than 40% below the median for that model | −20 and flag it as suspicious |
| No photos, one-line description (OLX) | −10 |
| "Od" price where the real variant costs more | −10 |
| Listing older than 60 days (OLX) | −5 |
| Accessory or spare part matched by keyword | disqualify |

## Category profiles

Adjust the weights per category; keep the total at 100.

**3D printers** — product fit 30 (build volume, FDM vs resin, enclosure, auto-levelling), reviews 20, price 20, seller 15, warranty 10, delivery 5.
**Laptops / phones** — product fit 35 (CPU/GPU/RAM/battery), warranty 15, reviews 15, price 20, seller 10, delivery 5.
**Power tools** — product fit 25, seller 20 (fakes are common), warranty 15, price 25, reviews 10, delivery 5.
**Home appliances** — product fit 25, warranty 20, reviews 20, price 20, seller 10, delivery 5.

## Tie-breakers

1. Lower price wins.
2. Then more reviews.
3. Then closer pickup location, if the user cares.
4. Then a known shop over an unknown one.

## Confidence

State it explicitly in the answer:

- **high** — at least 3 offers with 10+ reviews each, price spread under 30%.
- **medium** — few reviews, or a spread of 30–40%.
- **low** — under 5 usable offers, or a spread above 40%, or the top pick is used without warranty.

## Worked example

Request: "najlepsza drukarka 3D do 1500 zł", new only.

| Offer | Fit | Price | Reviews | Seller | Warranty | Delivery | Penalties | Total |
|---|---|---|---|---|---|---|---|---|
| Bambu Lab A1 mini — 1099 zł, 4.9/5 (312), known shop | 28 | 18 | 20 | 14 | 10 | 5 | 0 | **95** |
| Creality Ender-3 V3 SE — 689 zł, 4.6/5 (4), Allegro | 22 | 20 | 8 | 12 | 10 | 4 | 0 | **76** |
| Anycubic Kobra 2 — 650 zł, OLX, used | 18 | 20 | 0 | 6 | 0 | 3 | −15 | **32** |

Answer: the A1 mini wins — the 410 zł premium buys a materially better printer, and the review base is 78× larger.

## What not to do

- Do not average prices from different variants into one "market price".
- Do not rank a 1 zł placeholder listing as a bargain.
- Do not let a single 5.0/5 with 2 reviews beat 4.6/5 with 300 reviews.
- Do not hide the used/new distinction inside the score — it must be visible in the table.
