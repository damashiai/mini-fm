# MiniFM

> **Moods into music.** Describe how you feel and get a mix — or skip the AI entirely and browse by genre, artist, album, and language. Free, no account needed.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-DB_%26_Storage-emerald?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploys_on-Vercel-black?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Try it in 60 seconds

```bash
git clone https://github.com/damashiai/mini-fm.git
cd mini-fm
npm install
cp .env.example .env.local   # then fill in your keys (below)
npm run dev                  # http://localhost:3000
```

You'll need a free [Supabase](https://supabase.com) project first: run
`supabase/schema.sql` in the SQL Editor (one file — tables, permissions,
storage buckets, seed genres/languages; safe to re-run), and create one admin
user under Authentication. That's the whole backend.

## What you get

- **Mood mixes** — free-text mood → Jev decision model picks genres → a ~12-track mix with a real title (never parroted prompt text), genre chips, runtime, and a confidence note. Saved only when you tap Save/Share; shared links expire in 7 days.
- **Full browsing** — genre / language / artist / decade filters, four sort orders, and search across songs, artists, albums. Only facets with actual songs are ever offered.
- **Player** — signed-URL streaming, lock-screen controls, reorderable queue, auto-continue, synced-lyrics overlay with tap-to-seek, mobile bottom-sheet player, space-bar toggle, resume-where-you-left-off.
- **Library without accounts** — likes and history keyed to a device id.
- **Charts** — all-time + rolling 30-day, from real play counts.
- **Admin** (`/admin`) — batch upload with ID3 pre-fill, keyless MusicBrainz enrichment, lyrics backfill, inline editing for songs/artists/releases/genres, duplicate-proof storage, orphan janitor, play-history wipe.

## Environment variables

| Key | Where | Purpose |
| --- | ----- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public client access |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (keep secret!) | Server-side reads/writes |
| `ENABLE_WRITE_OPERATIONS` | `true`/`false` | Global read-only kill-switch on top of admin auth |
| `CRON_SECRET` | Any random string | Authenticates the daily playlist-cleanup cron |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (local dev only) | Mood classification + language detection; automatic on Vercel, graceful keyword/script fallback without it |

No Spotify keys. No lyrics keys. Enrichment is MusicBrainz + Cover Art Archive + lrclib — all keyless.

## Adding music (admin)

1. Sign in at `/admin/login` with the user you created in Supabase Auth.
2. `/admin/upload` → drop audio files. Each file is SHA-256 hashed (duplicates skipped before a byte uploads), tagged from embedded metadata, enriched (cover, date, ISRC, genres, lyrics, language), and held in a review queue.
3. Edit anything, **Save**. Files land in storage under their content hash — retries can never duplicate them.

## Deploying

Import the repo into Vercel (Next.js preset), set the env vars above, deploy.
`vercel.json` registers the daily expired-playlist cleanup; Vercel authenticates
it with `CRON_SECRET` automatically. Add your domain under Supabase Auth → URL
Configuration so admin login redirects correctly.

## How it works (30-second version)

- **Streaming:** the server mints 2-hour Supabase signed URLs; `<audio>` streams straight from their CDN with native seeking. Bytes never touch serverless functions.
- **Mood:** live genre list → Jev `choice`/`score`/`boolean` evaluation (with confidence gating + title mood filters) → weighted shuffle → templated title. Nothing is written to the DB until you save.
- **Uploads:** browser PUTs audio straight to storage via signed upload URLs; the API only ever sees small JSON metadata.
- **Lyrics:** resolved once via lrclib, cached on the song row, parsed client-side for scrolling.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `album save failed: Could not find the 'musicbrainz_id' column` | Schema predates the rename — run: `alter table artists rename column spotify_id to musicbrainz_id;` (same for `albums`, `songs`) |
| Player spins / `sign failed` | The DB row points at a missing storage object — delete the song, re-upload; run the dashboard janitor for old orphans |
| Enrichment warns but upload works | MusicBrainz/lrclib unreachable — fill fields manually, everything still saves |
| Mood says "nothing fits" | Small catalog + strict filters — add music or use Explore |
| `?` No genres/artists in filters | Facets with zero songs are hidden by design |

## Layout

```
app/            routes (song, artist, album, genre, language, playlist, charts, …)
  api/          mood, stream, lyrics, likes/plays, admin/*, cron/*
components/     player, lyrics overlay, upload queue, filters, skeletons
lib/            catalog queries, mood/Jev, musicbrainz, lrclib, rate-limit
supabase/       schema.sql (tables, RLS, buckets, seeds — single file)
public/         PWA manifest + offline shell worker + icon
```

## License

MIT — see `LICENSE`.
