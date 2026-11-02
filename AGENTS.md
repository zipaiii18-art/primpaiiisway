# AGENTS.md — Primpaii's Way

Personal sales-recap journal (Indonesian/English UI) for a small digital-subscription reseller.

## Architecture
- `index.html` — the whole app: inline `<style>` + inline `<script>`, no framework, no build step. Pages are `<section class="page">` toggled by `go(page)`.
- Data lives in `localStorage`:
  - `primpaii_orders_v1` — orders (format must stay unchanged; it mirrors the Google Sheet columns in `Code.gs`).
  - `primpaii_settings_v1` — theme, font, toolbar symbol set, sheet URLs.
  - `primpaii_playlist_v1` / `primpaii_music_v1` — My Little Playlist tracks and player preferences.
- `Code.gs` — Google Apps Script web app (POST upsert by Order ID, GET JSONP import). The site posts with `mode:'no-cors'`.
- `netlify/functions/spotify.mjs` — optional Spotify OAuth (`/api/spotify/login|callback|status|playlists|logout`). Tokens are AES-GCM encrypted in an httpOnly cookie scoped to `/api/spotify`; never expose them to client JS. Requires `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`; without them `status` reports `configured:false` and the UI says so.

## Music player notes
- Three sources: Spotify (official iFrame API, falls back to a plain embed), YouTube (IFrame Player API), custom URL (HTML Audio). Scripts for Spotify/YouTube load lazily on first play.
- `stopAll()` bumps `M.token`; every async callback checks its token so a stale source can never keep playing or overwrite UI. Only one source plays at a time.
- Never autoplay on page load. Spotify volume cannot be controlled from the page (controls are disabled for it).
- Spotify/YouTube links are never treated as direct audio; they are auto-routed to the right source.

## Conventions
- Keep the owner's palette: #FBF7F2, #E5D1C5, #4D0E13, #EEE4DA, #594448, #AA8584, #FEEFF3; playlist accents #FDE3EB, #F2B0CD, #F195BC, #D2ECFB.
- Dark mode is `body.dark` CSS overrides — don't set inline styles for theming.
- Match the compact, single-line-per-rule code style; avoid adding dependencies.
- Don't rename or remove menus (Dashboard, Rekapan, Reminder, Riwayat Order, Setting).
