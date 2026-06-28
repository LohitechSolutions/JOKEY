# AGENTS.md

## Cursor Cloud specific instructions

### Project layout
- The app lives in `rork-JOKEY-main/expo/`. Run all commands from that directory.
- **Jokey** ("Blagues Audio") is a French audio‑jokes Expo / React Native app (Expo 54, React Native 0.81, expo-router, TanStack Query, Supabase). It runs on iOS, Android and web; in this cloud VM we test the **web** target.
- The package manager is **Bun** (see `bun.lock`). Standard scripts are in `rork-JOKEY-main/expo/package.json`.
- If you use **npm** instead of Bun, `npm install` fails with an `ERESOLVE` peer-dependency conflict (`lucide-react-native@0.475.0` / `@ai-sdk/react` declare React peer ranges that predate React 19). `rork-JOKEY-main/expo/.npmrc` sets `legacy-peer-deps=true` so plain `npm install` works; otherwise run `npm install --legacy-peer-deps`. Bun resolves this fine and needs no flag.

### Running the web dev server (important caveat)
- The `package.json` scripts (`start`, `start-web`) all pass `--tunnel`, which uses ngrok and does **not** work in this VM. Start the web server **without** `--tunnel` instead:
  - `bunx rork start --web -p azbb4413e811lknfmyslw --port 19006`
  - `rork` is the Expo/Metro wrapper from `@rork-ai/toolkit-sdk`; it bundles React Native for web and serves at `http://localhost:19006`. There is no separate backend process to start.
- App loads at `http://localhost:19006`. The UI is auth‑gated (login/register first).

### Backend / data
- The app talks **directly to Supabase** from the client. Supabase URL + anon key are hardcoded in `lib/supabase.ts`, so login, the joke catalog, and audio playback work out of the box with no extra secrets.
- If Supabase is unreachable, the app falls back to a **local-only mode** (AsyncStorage) — auth and comments work but the joke feed will be empty.
- `expo/backend/` (Hono + tRPC + SurrealDB) is **dead code**: it is not imported by the client. Do not try to start it.

### Lint / build
- Lint: `bun run lint` (`expo lint`). Note the repo currently has **pre-existing** lint errors in `app/delete-account.tsx` (unescaped apostrophes) and a few unused-var warnings — these are not caused by environment setup.
- There is no web "build" step used for development; the Metro dev server above is the dev workflow. Native builds use `expo prebuild` + Gradle / EAS and require Android SDK / Xcode (not available here).

### Notes
- Bun is installed at `~/.bun/bin` (persisted in the VM snapshot and on PATH via `~/.bashrc`). The update script invokes it by absolute path so it works in non-interactive shells.
