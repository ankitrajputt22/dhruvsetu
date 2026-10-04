# DhruvSetu frontend

This folder contains the DhruvSetu web interface. It uses Next.js, React,
TypeScript, and Tailwind CSS.

## Run locally

Copy the safe API setting before starting the frontend:

```bash
cp .env.example .env.local
```

The default value connects the frontend to FastAPI at
`http://127.0.0.1:8000`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Check the frontend

```bash
npm run lint
npm test
npm run build
```

`npm test` runs the component tests in `src/**/*.test.tsx` with Vitest.

## Lite Mode

Lite Mode makes DhruvSetu usable on slow or expensive connections. It is
switched on and off with the "Lite Mode" switch in the header and uses the same
pages and links as normal mode.

What it does:

- Decorative images are not sent at all: the homepage hero and station photo,
  page hero backgrounds, and the photos on expedition and dataset cards and on
  the expedition page. The text, counts and search box stay.
- The Polar Map page does not load the map library or any map tiles. It shows
  the same locations as text: name, region, coordinates, station, verification
  status and related expeditions.
- Code is shown in the device's own monospace font instead of a downloaded one.

What stays the same: search (keyword and semantic), expeditions, scientists,
publications, datasets with their preview table, column statistics and chart,
documents and provenance, the assistant page, Outreach Studio, and Polar Data
Lab. The dataset chart stays because it is drawn in the browser from the
preview data and makes no extra request. A Data Lab session still starts only
when a dataset is opened in the Data Lab.

Loading the map on request: the Polar Map page has a "Load Interactive Map"
button in Lite Mode. It loads the map for that page only. Lite Mode stays on,
and after leaving or reloading the page the map is not loaded again until the
button is used.

How the choice is stored: in this browser only, in `localStorage`
(`dhruvsetu.liteMode`). It is copied into a small cookie (`dhruvsetu_lite`) so
that the server can leave the images out before the page is sent. Nothing is
stored in the database and no login is needed. Clearing the browser data
resets it.

Slow connections: if the browser reports data saving or a 2G connection
(`navigator.connection`), a one-time suggestion to turn on Lite Mode is shown.
Lite Mode is never switched on automatically, and browsers that report nothing
show no suggestion.

Switching from normal mode to Lite Mode stops further image and map requests.
Anything already downloaded stays in the browser cache.

Where it lives: `src/lib/lite-mode.ts` (saved choice), `src/lib/lite-mode-server.ts`
(server check), `src/components/lite-mode.tsx` (shared state and the switch).
Server pages call `isLiteMode()` and skip the image; client components use
`useLiteMode()`.
