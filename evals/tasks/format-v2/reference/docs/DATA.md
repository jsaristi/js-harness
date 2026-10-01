# Data

An inventory is one JSON file. This document describes the format and the policy for changing it.

## Format (version 2)

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

- `version` is the version of the format.
- Every item has all six fields. `price.amount` is a whole number of the minor units of
  `price.currency`; the codes the tool knows, and the number of decimals of each, are in
  `data/currencies.json` (`EUR` has 2, so 12.5 euro is 1250). `qty` is a count, `location.bin` is
  `null` for an item that is kept in a warehouse without bins, and `tags` is an array of lower-case
  strings.
- Files written by other tools may hold more fields, at the top level and in items.

Version 1 had one `currency` for the whole file (`EUR` when it was missing), a `price` that was a
number in major units, a `location` of the form `<warehouse>/<bin>` or `<warehouse>`, and `tags` as a
comma-separated string. The tool still reads it; see
[the proposal that introduced version 2](proposals/format-v2.md) for how each field is migrated.

## Validation

`validateItem(item)` lists the problems of one item as `{ field, code }`, and `validateInventory(state)`
lists those of every item as `{ index, field, code }`, plus `EDUPLICATE` on the `sku` of an item that an
earlier item already has.

| Code | Field | An item is invalid when |
| --- | --- | --- |
| `ESKU` | `sku` | it is empty or not text |
| `ENAME` | `name` | it is empty or not text |
| `EPRICE` | `price.amount` | it is not a non-negative integer |
| `ECURRENCY` | `price.currency` | it is not a code of `data/currencies.json` |
| `EQTY` | `qty` | it is not a whole number, or is negative |
| `ELOCATION` | `location.warehouse` | it is empty or not text |
| `ETAGS` | `tags` | it is not an array of non-empty strings |

A file that is not JSON, or has no `items` list, is refused with `EFORMAT`.

## CSV

`stock export` writes the inventory as CSV and `stock import` adds the rows of a CSV file to it. The
first row names the columns. A field that holds a comma, a double quote or a line break is wrapped in
double quotes, and a double quote inside it is doubled (RFC 4180). Rows end with a line feed. The
columns of version 2 are `sku,name,price_amount,price_currency,qty,warehouse,bin,tags`; the tags are
joined with `;`. An import also accepts the columns of version 1, `sku,name,price,qty,location,tags`.

An import is refused with `ECSV` when its header row is not a header the tool knows or a row has the
wrong number of fields, and with `EINVALID` when the inventory it would produce is not valid (a
duplicate `sku` among them). A refused import changes nothing.

## Format evolution

This is the standing policy for every change of the format, whatever the change is.

1. Every file has a `version`. Readers accept every earlier version and migrate it in memory, one
   step at a time (v1 to v2, v2 to v3, and so on). Migrations are pure functions and idempotent on
   their own output: reading a file that is already at the newest version changes nothing.
2. Writers always write the newest version.
3. Fields the reader does not know, at the top level and in items, are kept unchanged on a round
   trip.
4. The first time a command rewrites a file that is in an older version, it first writes a backup,
   `<file>.v<old>.bak`, with the original bytes of the file. An existing backup is never overwritten.
5. A file with a version newer than the tool knows is refused with the error code `EVERSION`, and
   the command line exits with 3. The file is never rewritten.
6. The read-only commands (`list`, `value` and `export`) never rewrite the file.
