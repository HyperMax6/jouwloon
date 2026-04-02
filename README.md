# jouwloon

Node.js client for fetching data from [Jouwloon](https://jouwloon.nl), including calendar shifts.

## Requirements

- Node.js 20 or newer
- A valid Jouwloon account

This library is intended for Node.js. It depends on the modern built-in `fetch` implementation and Node's cookie-related response headers.

## Installation

```bash
npm install jouwloon
```

## Usage

### Create and log in in one step

```ts
import { Jouwloon } from 'jouwloon';

const client = await Jouwloon.create('username', 'password');

const shifts = await client.getCalendar(
  new Date('2026-04-01T00:00:00'),
  new Date('2026-04-30T23:59:59'),
);

console.log(shifts);
```

### Create first, then log in

```ts
import { Jouwloon } from 'jouwloon';

const client = new Jouwloon();

await client.login('username', 'password');

const shifts = await client.getCalendar(
  new Date('2026-04-01T00:00:00'),
  new Date('2026-04-30T23:59:59'),
  { timeZone: 'Europe/Amsterdam' },
);
```

## API

### `Jouwloon.create(username, password)`

Creates a client and logs in immediately.

Returns a `Promise<Jouwloon>`.

### `client.login(username, password)`

Authenticates the client and prepares it for later requests.

Returns a `Promise<this>`.

### `client.getCalendar(start, end, options?)`

Fetches calendar shifts for the given range.

Arguments:

- `start: Date`
- `end: Date`
- `options?: { timeZone?: string }`

Returns:

```ts
Array<{
  id: string;
  vestiging: number;
  start: Date;
  end: Date;
  klant?: number;
  afdeling?: string;
  weergeven?: boolean;
  afkorting?: string;
  isCollega?: unknown;
  classNaam?: string;
}>
```

## Notes

- Call `login()` before `getCalendar()` unless you use `Jouwloon.create(...)`.
- This package talks to an external website that you do not control. If Jouwloon changes its HTML or API responses, this library may need updates.
- Credentials should be loaded from environment variables or a secure secret store, not hard-coded in source files.

## Development

```bash
npm install
npm run check
npm run build
```

## License

`UNLICENSED`
