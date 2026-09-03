# Contest Voting

Offline-first iPad voting web app for a live music festival contest.

Production URL:

https://suwaroj95-spec.github.io/contest-voting/

## Technologies

- React
- Vite
- TypeScript
- IndexedDB via `idb`
- Vitest
- PWA/offline caching via `vite-plugin-pwa`
- GitHub Actions + GitHub Pages
- Sarabun Thai font bundled from `@fontsource/sarabun`

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

Run lint:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

## Deployment

The app is configured for GitHub Pages at:

```ts
base: '/contest-voting/'
```

The workflow in `.github/workflows/deploy-pages.yml` builds the Vite app and deploys the `dist/` directory through GitHub Actions when changes are pushed to `main`.

## Contestant Data

Contestant names and numbers are centralized in:

```text
src/data/contestants.ts
```

V1 contains exactly 13 Thai placeholder names:

```text
ผู้เข้าประกวด 01
...
ผู้เข้าประกวด 13
```

Edit that one file when the real names are ready.

## Setup Mode And Photos

Setup mode lets the presenter add or replace each contestant photo using an iPad-compatible file input.

Photos are resized/compressed in the browser and stored locally in IndexedDB. They are not uploaded to any server and remain on the device/browser that added them.

## Voting Workflow

1. The officer taps one contestant.
2. The selected contestant is highlighted.
3. Tapping a card does not record a vote.
4. The presenter presses `ยืนยันและบันทึกผลการโหวต`.
5. One main vote record is written to IndexedDB.
6. The selection clears and the voter count updates.

The app shows only:

```text
โหวตแล้ว X คน
```

There is no predefined voter total.

## Results

`สรุปผลการโหวต` opens a public result screen for dense-ranked Top 3 results.

The public result screen does not show vote totals. Vote totals are only available through the presenter/admin action `ดูคะแนนทั้งหมด`.

If there are no votes, the result screen shows:

```text
ยังไม่มีผลการโหวต
```

## Tie Handling

Dense ranking is used:

```text
8, 8, 6, 5 => 1, 1, 2, 3
```

After the public result view is closed, the app checks for ties at dense ranks 1, 2, and 3 only. Ties at rank 4 or below are ignored.

Multiple tie groups are processed in order:

```text
อันดับ 1
อันดับ 2
อันดับ 3
```

The presenter may keep the joint rank or open a tie-break vote.

## Tie-Break Workflow

Tie-break mode displays only contestants in the tied rank group.

Tie-break votes are stored separately from main votes and never change the original main vote totals.

If a tie-break round remains tied, the app can create another round containing only the contestants that are still tied. Previous tie-break rounds are preserved.

## Undo And Reset

`ยกเลิกคะแนนล่าสุด` asks for confirmation and removes exactly one latest main vote. It does not affect tie-break votes.

`Reset คะแนน` asks for confirmation and clears:

- main vote records
- tie-break votes
- tie-break rounds
- voting result state

It keeps:

- contestant definitions
- contestant names
- contestant numbers
- contestant photos

## Export

`Export ข้อมูล` downloads a JSON file containing:

- export timestamp
- main vote records
- calculated totals
- tie-break rounds
- tie-break vote records

Binary contestant photos are not included.

## Offline/PWA Behavior

The app is installable and caches the application shell and static assets after initial load. It does not require a backend, external database, CDN JavaScript, CDN CSS, or remote font service during the event.

Important V1 limitation:

Voting data and contestant photos are stored locally in the browser/iPad. Clearing Safari website data, browser storage, or uninstalling/removing stored application data may remove locally stored votes and contestant photos.
