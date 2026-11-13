# Vexa — Dev Log

Registro di lavorazione del progetto. Ogni sessione viene aggiunta in cima (più recente prima).

## Sessione 2026-09-05 — "Senior review" trasversale: validatore deterministico + repair effettivo

**Obiettivo**: l'utente vuole Vexa che progredisca "verso 4 anni di esperienza" su TUTTE le discipline (game/obby/animazioni/vfx/3d/suono/cinematica), non solo una. Chiarito che non si può "allenare" il modello (solo inferenza, niente training) → si alza la qualità costruendo il pipeline da "senior that reviews before shipping".

**Bug trovato e fixato**:
- `repairScripts` in `lib/ai.js` usava fallback `meta/llama-3.1-405b-instruct`/`70b` → **404/410 (EOL, come nano-30b)** → ogni review pass falliva sempre. Sostituiti con modelli vivi: super-120b + lightning-30b. Budget repair ridotto 180s→60s e ora va su super-120b (veloce) invece di ultra (che timeout spesso).

**Implementato**:
- `assessQuality` esportata e **sempre chiamata** dopo ogni build (prima girava solo per thin-salvage). Si aggancia a `__quality` + warning per l'utente.
- Nuovi controlli trasversali deterministici (nessuna chiamata AI, gratis):
  - **DANGLING REFERENCES**: ogni `WaitForChild/FindFirstChild(nome)` nello script deve risolversi a un'istanza prodotta (o a un prefisso di una sequenza tipo Checkpoint_1..3). Prefix-aware per evitare falsi positivi su iterazioni dinamiche.
  - **NO SPAWN POINT**: build game/obby senza SpawnLocation/StartPlatform.
  - **IMPOSSIBLE JUMPS**: fisica Roblox umanoide (max ~7.2 stud in altezza, ~15 stud in distanza). Ogni salto consecutiva fuori portata viene flaggato con quale e perché. Deduplicato (un salto troppo alto E troppo lontano = 1 issue).
  - **GAME**: controllo RemoteEvent validation (server-side), DataStore saving, presenza world instances.
  - **BARE CUBE**: model3d con singolo Part senza mesh_assets.
- **Repair pass** ora parte: (a) sempre sui build pesanti (voluto dall'utente), (b) su errori critici anche sui leggeri. `hasCriticalQuality` allineato ai veri prefissi dei messaggi.

**Test deterministici (senza inferenza, con build fasulle)**:
- Obby con salti `P1→P2 (+40 alto, 47 gap)` → `IMPOSSIBLE JUMPS` (deduplicato), `DANGLING REFERENCES` (ghostpart), `STUB SCRIPTS`.
- Game senza world/datastore → `NO DATASTORE`, `NO WORLD INSTANCES`, `CORE SYSTEMS MISSING`.
- Caso reale `Checkpoint_1..3` + script che itera `"Checkpoint_"` → **nessun falso positivo**; solo il vero ref rotto `ghostplatform` flaggato. Prefix-aware funziona.

**Live-test (1 run riuscita su chiave instabile)**:
- `fammi un obby facile` → ultra-550b, 27 instances, 3 scripts, 0 lint error, 224s. `__quality` ha messo in warning `DANGLING REFERENCES` (prima c'erano 11 falsi positivi `checkpoint_` — ora risolti dal prefix-aware).

**Nota chiave confermata**: la chiave NVIDIA rimane instabile (ultra-550b va e viene: a volte 185-224s buoni, a volte timeout totale → fallback). Il fix del repair (modelli vivi + super veloce) riduce i timout a cascata. Qualità reale di ultra >= super (2-3x istanze/script).

## Sessione 2026-09-05 — modello build: super-120b → ultra-550b (55B attivi)

**Obiettivo**: l'utente ha testato la v1.2.21 e ha detto che "tutto fa ancora pena". Causa vera non era il pipeline (fixato) ma il **tetto di qualità = modello** (nemotron-super-120b è un modello generico NVIDIA, non code-specializzato). Deciso con l'utente di alzare il modello dei build.

**Scelta modello (solo chiave NVIDIA)** — testati tutti i candidati con entrambe le chiavi dell'utente, su build.nvidia.com:
- `nvidia/nemotron-3-ultra-550b-a55b` (55B attivi, ~44 tok/s) ← **scelto come ANIMATION_MODEL** (tutti i build pesanti: game/obby/cinematic/animation/vfx/model3d/sound)
- `moonshotai/kimi-k3` (1T, potenzialmente il migliore) → **429 rate-limit persistente su NVIDIA** → non serve nella catena
- `openai/gpt-oss-20b` (veloce+2s, ma 3.6B attivi) → candidato per fill/refine rapidi
- DeepSeek v3/v4, Qwen3-coder, GLM, minimax → 404/410 (non serviti)
- `ANIMATION_FALLBACK_ORDER` = [super-120b, lightning-30b] (super ~170 tok/s rifinisce ciò che ultra non chiude nel window)
- Chiave NVIDIA dell'utente (redatta, len 70) sostituita come NVIDIA_API_KEY in `.env.local`. **Attenzione: la chiave NVIDIA va e viene** — often 429/timeout variabile (test: run buona 185s → run successiva "all models failed" 285s). La catena di fallback copre i momenti no.

**Test reali (runGenerate, prompt "fammi un obby facile", ultra-550b)**:
- Run OK (1): 25 instances, 4 script (`ObbyCheckpointSystem`, `ObbyWinSystem`, `ObbyWinClient`, `ObbyLightingSetup`), 116.7s.
- Run OK (2): 14 instances, 3 script funzionali (CheckpointScript con attributi `RespawnPosition`, RespawnHandler su PlayerAdded/CharacterAdded, WinScript), 116-117s.
- Run OK (3): 32 instances, 4 script (`ObbyConfig`, `ObbyServer` 4223ch, `ObbyClient` 2776ch, `LightingSetup`), 26976ch, 185.4s, parse OK, fellBack=false.
- Confronto super-120b: 12 instances, 1 script, 47s → **ultra produce 2-3x di più, script reali multi-file, respawn/checkpoint/win funzionanti.**

**Problemi aperti / prossimi passi**:
- [ ] Affidabilità chiave NVIDIA (429/timeout) — monitorare; se persiste valutare chiave dedicata per modelli (l'utente può fornire solo NVIDIA).
- [ ] kimi-k3 resta "teoricamente migliore, praticamente 429" su NVIDIA — riprovare se la coda si libera.
- [ ] (dal basso) Link GoFile guest ~10gg; nessun git remote; versioni hardcoded da centralizzare.

---

## Sessione 2026-09-01 — v1.2.21 (fix 410 + obby specialization)

**Obiettivo**: sistemare la qualità delle generazioni AI (l'utente aveva testato un obby "che faceva schifo"). Trovare la causa, fixare, e distribuire.

**Velocità di lavoro (nota)**: il lavoro è proceduto bene ma ogni "giro" di fix + test + deploy richiede ~10-15 min di attesa (NVIDIA inference 45-48s per test, build Electron ~4 min, upload GoFile ~3 min, deploy Vercel ~1 min). I tempi morti sono i colpi NVIDIA e la build.

**Cosa è stato fatto**:
1. **Root cause 410**: `nvidia/nemotron-3-nano-30b-a3b` è stato ritirato (EOL 2026-09-01T09:00:00Z). Ogni fill/refine/thinking moriva con "All NVIDIA models failed" → build troncate. Sostituito con `nvidia/nemotron-3.5-lightning-30b-a3b` (6 occorrenze in `lib/ai.js`). **Commit `42b5cb6`**.
2. **Fix bug detection obby**: `/\bobbie?s?\b/` aveva un typo (`i` al posto di `y`) e non matchava "obby". Riscritto come pattern separati per-parola: `/\bobb(y|ie|ies|ys)\b/i`, obstacle/jump course, parkour, percorso a/di ostacoli, "fammi un obby". **Commit `6d83c1c`**.
3. **Bug budget**: "obby" era in `GAME_REQUEST_PATTERNS` → `gameRequest=true` → girava comunque il `runDirector`. Ora skip del director per obby (`gameRequest && !obbyRequest`). **Commit `6d83c1c`**.
4. **OBBY DOCTRINE**: nuovo `TYPE_FOCUS.obby` (sequenced jump course): 15-30 piattaforme sequenziali con Size+Position, spawn, checkpoint ogni 4-6 ostacoli, sistema morte/respawn/checkpoint/vinci, niente VFX/audio/cinematic (che rubavano il budget). **Commit `6d83c1c`**.
5. **Bump versione 1.2.21 + rebuild installer + upload GoFile + deploy Vercel**. **Commit `4bd3a81`**, `f9ca3de`.
   - Installer: `release/Vexa Setup 1.2.21.exe`, 204.788.948 byte, MD5 `CD1BF58DD99CBCE50253EC4BA219F2B6`
   - Link: `https://gofile.io/d/dlR5SI3Z` (guest, scade ~10 giorni)
   - Deploy: `vexaaai.vercel.app` riallineato → `/api/app/latest` = `{"version":"1.2.21","url":"https://gofile.io/d/dlR5SI3Z"}`
   - Plugin: versione bumpata a 1.2.21 (`/api/plugin/source`), nessun cambi funzionale.

**Test reali**:
- Obby via `runGenerate({prompt:'fammi un obby facile', type:'game'})` → `__eff_type: obby`, 12 instances con Position/CFrame (`SpawnPlatform, SpawnLocation, Platform1-8, Checkpoint, FinishPlatform`), 1 script completo (checkpoint table + respawn + Humanoid + win), 47s, `fellBack:false`, super-120b, nessun 410.

**Problemi aperti / prossimi passi**:
- [ ] Link GoFile guest scade ~10 giorni: valutare account stabile per distribuzione.
- [ ] Fill "thin salvage" con lightning-30b a volte produce `output length: 43` (parse fallito, gestito con keep draft) — tenere d'occhio se diventa ricorrente.
- [ ] L'utente vuole provare la v1.2.21 prima di valutare modelli migliori (es. Kimi K3 via Vercel AI Gateway, che però costa ~$15/M output — non gratis).
- [ ] `runDirector` fallisce "All NVIDIA models failed" per budget — by design (fallback raw prompt), ma il budget director (45s) è stretto.
- [ ] Nessun git remote configurato: i commit sono solo locali. Considerare push su GitHub.

---

## Sessione precedente (prima del contesto registrato) — v1.2.20
**(storia recuperata dal contesto iniziale)**
- Fix auto-apply (`931f43f`): deadlock validazione token MCP companion (primo poll senza heartbeat) risolto via mappa token→user.
- Texture mesh procedurali (`dfa8a1b`): UV per-corner in OBJ + PNG texture engine (metal/gold/wood/gem/stone/ceramic/neon).
- Fix generazione NVIDIA (`a472bd8`): riconoscere `APIUserAbortError` come timeout + riserva budget fallback.
- Installer 1.2.20 caricato su GoFile (link precedente non riusabile — chiave guest, GoFile richiede Premium per gestire cartelle esistenti).
