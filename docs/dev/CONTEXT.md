# Vexa — Project Context (resume here)

Cartella: repository locale del progetto `vexa`
Branch: `main`, working tree pulito, **nessun git remote** (commit solo locali).

## Ultimo stato
- **Versione**: 1.2.21
- **HEAD**: `f9ca3de`
- **Ultimi commit**: `f9ca3de` (plugin v1.2.21) → `4bd3a81` (bump 1.2.21 install) → `6d83c1c` (obby spec) → `42b5cb6` (fix 410) → `931f43f` (auto-apply) → `dfa8a1b` (textures) → `a472bd8` (NVIDIA timeout) → `24c4d61` (v1.2.20).

## Architettura chiave
- `lib/ai.js`: motore generazione AI (NVIDIA API). Contiene modelli, fallback, TYPE_FOCUS (game/obby/cinematic/...), `runGenerate`, `runDirector`, `isGameRequest`, `isObbyRequest`, `OBBY_REQUEST_PATTERNS`.
- `lib/cloud-proxy.ts`: `CLOUD_API_URL = https://vexaaai.vercel.app`.
- `electron/main.js`: app desktop Electron (483 righe), update check via `/api/app/latest`.
- `app/plugin/Vexa Plugin.lua` + `VexaCompanion.lua`: plugin Studio, `PLUGIN_VERSION` hardcoded riga 15.
- `app/api/app/latest/route.ts`, `app/api/app/download/route.ts`: versione + link installer (versione hardcoded riga 9 — da centralizzare).
- `app/api/plugin/version/route.ts`, `app/api/plugin/source/route.ts`: versione plugin + sorgente.
- `app/download/page.tsx`: pagina download (pulsanti app + plugin).
- `package.json`: version, scripts (`electron:build` = next build + electron-builder).

## Modelli NVIDIA attuali (lib/ai.js)
- Build pesanti: `nvidia/nemotron-3-super-120b-a12b` (~170 tok/s)
- STEPS/THINKING/fill/fallback: `nvidia/nemotron-3.5-lightning-30b-a3b`
- `MAX_TOKENS = 8192`, genMaxTokens heavy = 16000

## Distribuzione
- Installer: `release/Vexa Setup 1.2.21.exe` (204.788.948 byte, MD5 `CD1BF58DD99CBCE50253EC4BA219F2B6`)
- Link GoFile (guest, ~10gg): `https://gofile.io/d/dlR5SI3Z`
- Vercel: progetto `vexa`, alias `vexaaai.vercel.app` → latest deploy
  - `/api/app/latest` → `{"version":"1.2.21","url":"https://gofile.io/d/dlR5SI3Z","name":"Vexa"}`
  - `/api/app/download` → 302 al link
  - `/api/plugin/version` → `{"version":"1.2.21","url":null,"changelog":null}`
  - `/api/plugin/source` → `PLUGIN_VERSION = "1.2.21"`

## Credenziali (MAI committare)
`env.local` (NVIDIA_API_KEY, Supabase, Discord, VERCEL_OIDC_TOKEN). GoFile: guest token non più valido per gestione file (serve Premium); per upload usa guest token fresco da `/api`, file in upload dà `downloadPage`.

## Errori/vincoli noti
- Output Vercel CLI sempre sporcato da warning `MODULE_TYPELESS_PACKAGE_JSON` (innocuo; pipeline a volte faila se leggo stderr non filtrato).
- Obby test passato: `__eff_type: obby`, 12 inst, script completo, 47s, no 410.
- Fill thin salvage a volte dà output corto — tenere d'occhio.

## Come riprendere
1. `git log --oneline -10` per stato.
2. Apri `docs/dev/DEVLOG.md` e `docs/dev/IMPROVEMENTS.md`.
3. Per deploy: `vercel --prod --yes` poi riallinea alias `vercel alias set <deploy-url> vexaaai.vercel.app` (verificare SEMPRE che l'alias punti all'ultimo deploy; `vercel --prod` non sempre lo sposta).
4. Test generazioni: script node con `runGenerate()` import da `lib/ai.js` (vedi note nei DEVLOG).
5. `vercel env` per aggiornare `APP_DOWNLOAD_URL` / variabili.

## Note velocità
- Ciclo fix+test+deploy ≈ 10-15 min (NVIDIA ~45s, electron-builder ~4 min, upload GoFile ~3 min, deploy Vercel ~1 min).
- Strategia: fare fix piccoli verificabili, raggruppare i deploy, non rifare l'installer se cambia solo la parte cloud (il plugin si scarica dal cloud, il desktop non lo installerà mai).
