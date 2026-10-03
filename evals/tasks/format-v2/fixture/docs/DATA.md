# Data

An inventory is one JSON file. This document describes the format and the policy for changing it.

## Format (version 1)

```json
{
  "version": 1,
  "currency": "EUR",
  "items": [
    { "sku": "BOLT-M4", "name": "Bolt M4", "price": 0.25, "qty": 100, "location": "WH1/B12", "tags": "metal, small" }
  ]
}
```

- `version` is the version of the format. `currency` is the ISO code of every price in the file, and
  is `EUR` when the file does not have it. The codes the tool knows, and the number of decimals each
  has, are in `data/currencies.json`.
- Every item has all six fields. `price` is a number in major units (12.5 is twelve euro and fifty
  cents), `qty` a count, `location` text of the form `<warehouse>/<bin>` or just `<warehouse>`, and
  `tags` a comma-separated list.
- Files written by other tools may hold more fields, at the top level and in items.

## Validation

`validateItem(item)` lists the problems of one item as `{ field, code }`, and `validateInventory(state)`
lists those of every item as `{ index, field, code }`, plus `EDUPLICATE` on the `sku` of an item that an
earlier item already has.

| Code | Field | An item is invalid when |
| --- | --- | --- |
| `ESKU` | `sku` | it is empty or not text |
| `ENAME` | `name` | it is empty or not text |
| `EPRICE` | `price` | it is not a number, or is negative |
| `EQTY` | `qty` | it is not a whole number, or is negative |
| `ELOCATION` | `location` | it is empty or not text |
| `ETAGS` | `tags` | it is not text |

A file that is not JSON, or has no `items` list, is refused with `EFORMAT`.

## CSV

`stock export` writes the inventory as CSV and `stock import` adds the rows of a CSV file to it. The
first row names the columns. A field that holds a comma, a double quote or a line break is wrapped in
double quotes, and a double quote inside it is doubled (RFC 4180). Rows end with a line feed. The
columns of version 1 are `sku,name,price,qty,location,tags`, with the fields as they are in the file.

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
