# Proposal: data format v2

Status: accepted

## Why

Prices are floats, so totals drift and a file can hold one currency only; a location and a list of
tags are text that every reader splits its own way. Version 2 stores each of them in the form the tool
works with. The change follows the policy in [DATA.md](../DATA.md), "Format evolution", and nothing
here relaxes it.

## The format

```json
{
  "version": 2,
  "items": [
    {
      "sku": "BOLT-M4",
      "name": "Bolt M4",
      "price": { "amount": 25, "currency": "EUR" },
      "qty": 100,
      "location": { "warehouse": "WH1", "bin": "B12" },
      "tags": ["metal", "small"]
    }
  ]
}
```

## Price

`price` becomes `{ "amount", "currency" }`. `amount` is an integer: the price in the minor units of
its currency, which is the number of decimals `data/currencies.json` gives for it (`EUR` has 2, so
12.5 euro is 1250).

A v1 price is converted with the top-level `currency` of its file, `EUR` when the file has none. The
v1 price is the decimal number as written in the file: `1.005` is exactly one and five thousandths,
not the binary number nearest to it. It is rounded to a whole number of minor units, half away from
zero, so `0.125` EUR is 13, `1.5` JPY is 2, `2.0005` KWD is 2001 and `1.005` EUR is 101.

The top-level `currency` field no longer exists in v2: it has moved into each price.

## Location

`location` becomes `{ "warehouse", "bin" }`. A v1 location is split at its first `/`: what comes
before it is the warehouse and everything after it the bin, so `WH1/A/3` is warehouse `WH1` and bin
`A/3`. A v1 location without a `/` is a warehouse with `"bin": null`.

## Tags

`tags` becomes an array of strings. A v1 tag list is split on commas; each tag is trimmed and
lower-cased, empty tags are dropped, and a tag that repeats is kept once, at its first position.

## Validation

`validateItem` checks the v2 fields and reports `{ field, code }` with these pairs.

| Code | Field | An item is invalid when |
| --- | --- | --- |
| `EPRICE` | `price.amount` | it is not a non-negative integer |
| `ECURRENCY` | `price.currency` | it is not a code of `data/currencies.json` |
| `ELOCATION` | `location.warehouse` | it is empty or not text |
| `ETAGS` | `tags` | it is not an array of non-empty strings |

The other fields and codes are as in DATA.md.

## Reports

`valuation(state)` returns an object from currency code to the total of `amount` times `qty` of the
items priced in it, in minor units: `{ "EUR": 2500, "JPY": 1500 }`. A currency appears when an item
is priced in it.

`byWarehouse(state)` returns an object from `location.warehouse` to the same kind of object, so
`{ "WH1": { "EUR": 2500 }, "WH2": { "EUR": 400, "USD": 1197 } }`.

## Search

`filterItems(state, { tag, location })` matches `tag`, after it is lower-cased, against the tags of an
item as whole tags. `location` is split at its first `/` like a v1 location: `WH1` matches the items
of warehouse `WH1` whatever their bin, and `WH1/B12` the items of that warehouse and that bin only.
Warehouses and bins are compared as they are written. An item must match every filter that is given.

## CSV

`exportCsv` writes the columns `sku,name,price_amount,price_currency,qty,warehouse,bin,tags`. The
amount is the integer of the file, an item without a bin has an empty `bin` field, and the tags are
joined with `;`.

`importCsv` accepts a file with that header row and a file with the v1 header row
`sku,name,price,qty,location,tags`, and decides by the header row. The v1 rows are converted as
in this document: the price is a v1 price in `EUR` (a v1 row has no currency, and a file in v2 has
none to give it), the location and the tags are v1 text. In a v2 row an empty `bin` field is no bin,
and `tags` is split on `;`, an empty field being no tags.

## Command line

- `add <sku> <name> --price <decimal> --currency <code>`: the price is a decimal in major units, read
  as written like a v1 price, and the currency is `EUR` when `--currency` is not given. `--tags`
  takes the comma-separated text of a v1 tag list. An unknown currency is refused with `ECURRENCY`.
- `move <sku> <warehouse>[/<bin>]` sets the location, split at its first `/`.
- `list` prints the price of an item as its `amount` written with the decimals of its currency, a
  space and the code (`12.50 EUR`, `1500 JPY`), and its location as `<warehouse>/<bin>`, or
  `<warehouse>` when there is no bin. The columns and their order stay as they are.
- `value` prints one line per currency, `<CODE> <amount>`, sorted by code. The amount is written with
  the decimals of the currency and no digit grouping: `EUR 25.00`, `JPY 1500`, `KWD 12.345`.
