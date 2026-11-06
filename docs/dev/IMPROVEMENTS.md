# Vexa — Cosa migliorare (backlog)

Lista priorizzata di miglioramenti. Priorità: P1 (blocca usabilità/distribuzione), P2 (qualità), P3 (nice-to-have).

## P1 — Bloccanti
- [ ] **Distribuzione GoFile instabile**: gli upload sono guest → scadono ~10 giorni e i link precedenti non si possono gestire/rifare (GoFile richiede Premium per gestire cartelle esistenti). L'utente perde il link e va rifatto ogni volta.
  - Fix ideale: account GoFile (gratuito va bene per upload; Premium solo per gestione cartelle) + salvare il link in un posto stabile. Oppure host concorrente (Catbox è permanente, vedi sotto).
- [ ] **Nessun git remote**: tutti i commit sono locali. Se il PC muore/il progetto si corrompe, si perde tutto il lavoro (fix 410, Obby, texture, ecc.). Pushare su GitHub + documentare.
- [ ] **Server-side knowledge del PATH**: in sessione ogni volta va riscoperto lo stato via grep/vercel/git. Serve un CONTEXT.md aggiornato a ogni commit significativo (vedi docs/dev/CONTEXT.md).

## P2 — Qualità generazioni
- [ ] **Fill "thin salvage" fragile**: a volte lightning-30b produce output corto (`output length: 43`), parse fallisce, si tiene il draft. Se ricorrente: aggiungere fallback più robusto o aumentare min_tokens di fill.
- [ ] **Budget `runDirector` stretto** (45s): fallisce "All NVIDIA models failed" → fallback raw prompt. Valutare di aumentare la finestra o usare un modello più veloce per il director.
- [ ] **Modelli per build pesanti**: testare se super-120b è il giusto trade-off qualità/velocità, oppure valutare (a pagamento) K2/K3 via Vercel AI Gateway. Non gratis.
- [ ] **`genMaxTokens` 16k per giochi**: potrebbe non bastare per giochi molto ambiziosi. Valutare 24k (secondario alla specializzazione).

## P2 — Distribuzione/versioning
- [ ] **Versioni hardcoded sdoppiate**: version negli installer, `/api/app/latest`, `/api/plugin/version`, `/api/plugin/source`, `PLUGIN_VERSION` nel .lua, `/download` page. Ogni bump tocca ~6 punti a mano → rischio di dimenticarne uno (successo stavolta con `6d83c1c`... in realtà l'ho scovato) → centralizzare la versione (es. legge da package.json o un single source).

## P3 — Nice-to-have
- [ ] README del progetto (non esiste in root).
- [ ] Il plugin non ha un update-banner funzionante (`url:null` in `/api/plugin/version`, `PLUGIN_DOWNLOAD_URL` env non settata su Vercel).
- [ ] Tanti file di test sparsi in root (`avatar-test.png`, `test-*.png`, `sbtest.ts`, `proxy.ts`, `test-dim*.png`, `video-analyse/`) — pulire/archiviare.
- [ ] Documentare il flusso plugin-Studio (pairing → token gx-local → companion → poll → execute) in README.

## Note trasversali
- `Vercel CLI` su PowerShell emette sempre warning `MODULE_TYPELESS_PACKAGE_JSON` — innocui ma sporcano l'output; usare `2>$null` dove serve pulizia (però attenzione: se serve catturare stderr per errori veri, filtrarli per "MODULE_TYPELESS").
- `.env.local` contiene credenziali reali (NVIDIA, Supabase, Discord, Vercel OIDC) — MAI committare. GoFile è guest e non ha più la gestione dei file.
- La velocità di lavoro (vedi DEVLOG) è dominata da attese di build/test nat (NVIDIA inferenza, electron-builder, upload, deploy). Per accelerare: fare prima i fix piccoli verificabili (regex/logica) e raggruppare i deploy, come fatto in questa sessione.
