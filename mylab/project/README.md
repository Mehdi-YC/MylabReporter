# MyLab Reporter – Antibiotic efficacy indicator (AEI)

Rolling, laboratory-based antimicrobial resistance surveillance for Tyks Laboratories × Mylab
(JunctionX Turku). Built on SvelteKit + Drizzle (SQLite/libSQL), run with bun.

## Getting started

```sh
bun install
cp .env.example .env        # set BETTER_AUTH_SECRET
bun run db:push             # create the tables
bun run db:seed             # load the synthetic lab extract from data/*.csv (~15 s)
bun run dev
```

| Script                           | What it does                                                         |
| -------------------------------- | -------------------------------------------------------------------- |
| `bun run db:seed`                | Re-imports `data/*.csv` (idempotent, run it again for a new extract) |
| `bun run test`                   | Unit tests for the surveillance logic (`tests/`, bun test)           |
| `bun run check` / `bun run lint` | Type check / prettier + eslint                                       |

## How the numbers are computed

- **First isolate** per patient, organism and specimen type within the reporting period
  (CLSI M39, THL Finres, WHO GLASS) – `src/lib/amr/firstIsolate.ts`.
- Percentages are only shown as reliable with **≥ 30 isolates**, with a Wilson 95 % interval –
  `src/lib/amr/stats.ts`.
- **Hospital-onset** = inpatient sample taken on hospital day 3 or later (`admission_date`).
- The server keeps the dataset in memory and polls the database every 30 s; new results written by
  the laboratory feed appear without a restart – `src/lib/server/amr/dataset.ts`.

## Map (`/map`)

- **Regional view**: the patients' `home_area` (five synthetic areas around Tyks: Centre, North,
  East, South, West), drawn as a schematic catchment and coloured by % resistant to a drug, % ESBL,
  % MRSA or first-isolate count, with ward / specimen / date filters and a 4-week vs 12-month
  switch. Areas under 30 isolates are hatched – `src/lib/amr/regions.ts`.
- **European view**: real national EARS-Net 2024 figures (ECDC) in `data/ears-net.csv` (see
  `data/ears-net.md`), drawn as an SVG choropleth (`world-atlas` + `d3-geo`, projected on the server),
  with Finland highlighted next to the dataset's own blood-culture value.

## Ask the data (`/ask`, local LLM)

Questions in English, French or Finnish go through `src/lib/server/ai/`:

1. **Intent**: the model picks one of three tools (`resistance`, `therapy`, `alerts`) when it supports
   tool calling, otherwise it returns a JSON intent; a keyword parser (EN/FR/FI) fills the gaps and is
   the fallback when no model answers. Every field is validated against the dataset's own codes, and
   narrowing filters the question does not mention are dropped.
2. **Numbers**: computed by the same functions as the other pages (`antibiogram.ts`, `anomalies.ts`,
   `advisor.ts`) – never by the model.
3. **Wording**: the model only rephrases the computed summary in the question's language; figures in
   its text that are not in the data are flagged. Only aggregates are sent, never patient rows.

Backends (`AI_PROVIDER`): `ollama` (default, `OLLAMA_URL`, `OLLAMA_MODEL=mistral:latest`), `openai`
(any OpenAI-compatible endpoint) or `anthropic` (Claude through the Anthropic SDK, needs
`ANTHROPIC_API_KEY`). When the model is down the computed answer is still shown.

---

## About the template (sv)

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@1.1.1 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:typography,forms" drizzle="database:sqlite+sqlite:libsql" better-auth="demo:password" ai-tools="ide:opencode" --install bun ./
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
