# parcel-quote

Prices a shipment of parcels. Given an order (destination, service level, parcel weights and
sizes, optional declared value and promo code) it returns a breakdown in euro cents: the base
charge from the rate table of the day, fuel, remote-area, oversize and insurance surcharges, the
best available discount, tax and the total.

`docs/SPEC.md` is the contract: it defines every rule the library applies, with a section number
for each. The zone and rate tables live in `data/` and are maintained by the pricing team.

## Use

```js
import { quote, formatQuote } from './src/index.mjs';

const result = quote({
  orderDate: '2025-03-15',
  service: 'standard',
  destination: { country: 'DE', postalCode: '10115' },
  parcels: [{ weightKg: 7.5, length: 30, width: 20, height: 15 }],
});
console.log(formatQuote(result));
```

Orders that break the rules of section 2 throw a `QuoteError` with a `code`.

## Notes

- Money is always whole cents, never a float.
- A promo code stops working on its expiry date.
- An order is priced with the rate table of its order date, never of the day it is quoted.

## Tests

```sh
npm test
```

The suite needs Node 20 or newer and has no dependencies.
