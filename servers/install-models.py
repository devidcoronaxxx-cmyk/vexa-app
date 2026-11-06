"""Vexa model installer (OPTIONAL, offline generation).

Nothing is installed automatically by the Vexa installer. Run this only if you
want offline generation. Pick a tier that fits your PC.

Usage:
  python install-models.py --list              # show all models/tiers, no download
  python install-models.py --tier S             # download all Tier-S models (~6 GB)
  python install-models.py --tier M             # our original picks (~11 GB)
  python install-models.py --only qwen3-8b hunyuan3d
  python install-models.py --all                # everything (~60 GB, strong PC only)

See ../MODEL_TIERS.md for hardware requirements.
"""
import argparse
import os
import shutil
import subprocess
import sys

BASE = os.path.join(os.path.expanduser("~"), ".vexa", "models")

MODELS = [
    # --- LLM ---
    {"id": "phi4-mini", "tier": "S", "cat": "llm", "name": "Phi-4 Mini (LLM, weak PC)", "repo": "microsoft/Phi-4-mini-instruct", "size_gb": 2.5, "ram_gb": 8, "dir": os.path.join(BASE, "phi4-mini"), "note": "CPU 30-50 tok/s, best quality/size for weak PCs."},
    {"id": "gemma4-e2b", "tier": "S", "cat": "llm", "name": "Gemma 4 E2B (LLM, weak PC)", "repo": "google/gemma-4-E2B", "size_gb": 2.0, "ram_gb": 8, "dir": os.path.join(BASE, "gemma4-e2b"), "note": "Multimodal ultra-light."},
    {"id": "qwen3.5-4b", "tier": "S", "cat": "llm", "name": "Qwen 3.5 4B (LLM, weak PC)", "repo": "Qwen/Qwen3.5-4B", "size_gb": 3.4, "ram_gb": 8, "dir": os.path.join(BASE, "qwen3.5-4b"), "note": "Good general, 8 GB RAM."},
    {"id": "qwen3-8b", "tier": "M", "cat": "llm", "name": "Qwen3 8B (LLM, mid PC) [default]", "repo": "Qwen/Qwen3-8B", "size_gb": 5.0, "ram_gb": 12, "dir": os.path.join(BASE, "qwen3-8b"), "note": "Our original pick. 8-12 GB VRAM."},
    {"id": "gemma4-e4b", "tier": "M", "cat": "llm", "name": "Gemma 4 E4B/12B (LLM, mid PC)", "repo": "google/gemma-4-E4B", "size_gb": 6.6, "ram_gb": 12, "dir": os.path.join(BASE, "gemma4-e4b"), "note": "Multimodal, 8-12 GB VRAM."},
    {"id": "qwen3-14b", "tier": "L", "cat": "llm", "name": "Qwen3 14B (LLM, strong PC)", "repo": "Qwen/Qwen3-14B", "size_gb": 9.0, "ram_gb": 16, "dir": os.path.join(BASE, "qwen3-14b"), "note": "Strong all-rounder, 16-24 GB VRAM."},
    {"id": "gpt-oss-20b", "tier": "L", "cat": "llm", "name": "gpt-oss 20B (LLM, strong PC)", "repo": "openai/gpt-oss-20b", "size_gb": 12.0, "ram_gb": 16, "dir": os.path.join(BASE, "gpt-oss-20b"), "note": "Reasoning + tools, 16 GB VRAM."},
    {"id": "qwen3.8-27b", "tier": "XL", "cat": "llm", "name": "Qwen3.8 27B (LLM, workstation)", "repo": "Qwen/Qwen3.8-27B", "size_gb": 24.0, "ram_gb": 24, "dir": os.path.join(BASE, "qwen3.8-27b"), "note": "Best quality, 24+ GB VRAM."},
    # --- 3D ---
    {"id": "triposr", "tier": "S", "cat": "3d", "name": "TripoSR (3D, weak PC)", "repo": "stabilityai/TripoSR", "size_gb": 4.0, "ram_gb": 8, "dir": os.path.join(BASE, "triposr"), "note": "Fastest, 0.5s/mesh, 4-6 GB VRAM."},
    {"id": "hunyuan3d-2mini", "tier": "S", "cat": "3d", "name": "Hunyuan3D-2mini (3D, weak PC)", "repo": "tencent/Hunyuan3D-2mini", "size_gb": 6.0, "ram_gb": 8, "dir": os.path.join(BASE, "hunyuan3d-2mini"), "note": "Lighter shape-only, 6-8 GB VRAM."},
    {"id": "hunyuan3d", "tier": "M", "cat": "3d", "name": "Hunyuan3D-2 (3D, mid PC) [default]", "repo": "tencent/Hunyuan3D-2", "size_gb": 10.0, "ram_gb": 12, "dir": os.path.join(BASE, "hunyuan3d-2"), "note": "Our original pick (Hunyuan3D 2.1). 8-12 GB VRAM."},
    {"id": "hunyuan3d-2.1", "tier": "M", "cat": "3d", "name": "Hunyuan3D 2.1 (3D, mid PC)", "repo": "tencent/Hunyuan3D-2.1", "size_gb": 12.0, "ram_gb": 12, "dir": os.path.join(BASE, "hunyuan3d-2.1"), "note": "Our pick with texture stage. 10-12 GB VRAM."},
    {"id": "trellis2", "tier": "L", "cat": "3d", "name": "TRELLIS 2 (3D, strong PC)", "repo": "microsoft/TRELLIS.2-4B", "size_gb": 16.0, "ram_gb": 16, "dir": os.path.join(BASE, "trellis2"), "note": "Best fidelity + PBR. 16-24 GB VRAM."},
    # --- Audio ---
    {"id": "stable-audio-3-sfx", "tier": "S", "cat": "audio", "name": "Stable Audio 3 Small-SFX (audio, weak PC)", "repo": "stabilityai/stable-audio-3-small-sfx", "size_gb": 1.8, "ram_gb": 8, "dir": os.path.join(BASE, "stable-audio-3-sfx"), "note": "433M, CPU, 120s. No GPU needed."},
    {"id": "stable-audio-3-music", "tier": "S", "cat": "audio", "name": "Stable Audio 3 Small-Music (audio, weak PC)", "repo": "stabilityai/stable-audio-3-small-music", "size_gb": 1.8, "ram_gb": 8, "dir": os.path.join(BASE, "stable-audio-3-music"), "note": "433M, CPU, 120s. No GPU needed."},
    {"id": "tinyaudio", "tier": "S", "cat": "audio", "name": "TinyAudio (audio, weak PC)", "repo": "junxi25liu/TinyAudio", "size_gb": 0.1, "ram_gb": 4, "dir": os.path.join(BASE, "tinyaudio"), "note": "Ultra-light, real-time on 4 cores."},
    {"id": "stable-audio-open-small", "tier": "M", "cat": "audio", "name": "Stable Audio Open Small (audio, mid PC)", "repo": "stabilityai/stable-audio-open-small", "size_gb": 1.0, "ram_gb": 8, "dir": os.path.join(BASE, "stable-audio-open-small"), "note": "497M, ~1 GB INT8, 11s clips."},
    {"id": "stable-audio-3-medium", "tier": "M", "cat": "audio", "name": "Stable Audio 3 Medium (audio, mid PC)", "repo": "stabilityai/stable-audio-3-medium", "size_gb": 3.0, "ram_gb": 8, "dir": os.path.join(BASE, "stable-audio-3-medium"), "note": "1.4B, 6 min tracks, GPU."},
    {"id": "stable-audio-open", "tier": "L", "cat": "audio", "name": "Stable Audio Open 1.0 (audio, strong PC)", "repo": "stabilityai/stable-audio-open-1.0", "size_gb": 3.0, "ram_gb": 8, "dir": os.path.join(BASE, "stable-audio"), "note": "Longer clips, 8+ GB VRAM."},
    {"id": "musicgen-small", "tier": "L", "cat": "audio", "name": "MusicGen Small (audio, strong PC)", "repo": "facebook/musicgen-small", "size_gb": 1.5, "ram_gb": 8, "dir": os.path.join(BASE, "musicgen-small"), "note": "Music, MIT."},
    # --- Animation ---
    {"id": "kimodo", "tier": "M", "cat": "anim", "name": "Kimodo (animation, mid/strong PC)", "repo": "nvidia/Kimodo", "size_gb": 7.0, "ram_gb": 12, "dir": os.path.join(BASE, "kimodo"), "note": "Our pick. 12+ GB VRAM. May be gated on HF."},
]

TIER_ORDER = {"S": 0, "M": 1, "L": 2, "XL": 3}
TIER_SIZES = {"S": 6, "M": 11, "L": 40, "XL": 60}


def free_disk_gb(path):
    try:
        return shutil.disk_usage(path).free / (1024 ** 3)
    except Exception:
        return 0


def list_models(tier=None):
    print("Vexa local models (offline generation, optional):")
    print("-" * 90)
    for m in MODELS:
        if tier and m["tier"] != tier:
            continue
        present = os.path.isdir(m["dir"]) and bool(os.listdir(m["dir"])) if os.path.isdir(m["dir"]) else False
        status = "INSTALLATO" if present else "mancante"
        print(f"  [{m['tier']}] {m['id']:<22} {m['name']}")
        print(f"       repo: {m['repo']}  size: ~{m['size_gb']} GB  RAM min: {m['ram_gb']} GB  stato: {status}")
        print(f"       {m['note']}")
    print("-" * 90)
    print(f"Spazio libero su {BASE}: {free_disk_gb(BASE):.1f} GB")
    if tier:
        tot = sum(m["size_gb"] for m in MODELS if m["tier"] == tier)
        print(f"Tier {tier} totale stimato: ~{tot} GB")


def install_one(m):
    print(f"\n==> {m['name']} ({m['repo']}) -> {m['dir']}")
    os.makedirs(m["dir"], exist_ok=True)
    if free_disk_gb(m["dir"]) < m["size_gb"] + 2:
        print(f"   ERRORE: spazio disco insufficiente (servono ~{m['size_gb'] + 2} GB).")
        return False
    cmd = ["hf", "download", m["repo"], "--local-dir", m["dir"]]
    print("   ", " ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
        print(f"   OK: {m['id']} installato.")
        return True
    except FileNotFoundError:
        print("   ERRORE: 'hf' CLI non trovato. Installa con: pip install -U huggingface_hub")
        return False
    except subprocess.CalledProcessError as e:
        print(f"   ERRORE download (exit {e.returncode}). Riprova o scarica manualmente.")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="Mostra modelli/tier, senza scaricare")
    ap.add_argument("--tier", choices=["S", "M", "L", "XL"], help="Scarica tutti i modelli di un tier")
    ap.add_argument("--all", action="store_true", help="Scarica tutto (~60 GB)")
    ap.add_argument("--only", nargs="*", help="ID modelli specifici")
    args = ap.parse_args()

    if args.list:
        list_models()
        return

    os.makedirs(BASE, exist_ok=True)

    if args.tier:
        chosen = [m["id"] for m in MODELS if m["tier"] == args.tier]
    elif args.all:
        chosen = [m["id"] for m in MODELS]
    elif args.only:
        chosen = args.only
    else:
        list_models()
        print("\nInserisci tier (S/M/L/XL) oppure ID separati da spazio, oppure 'all', invio per uscire:")
        raw = input("> ").strip()
        if not raw:
            print("Nessun download. Uscita.")
            return
        if raw.upper() in ("S", "M", "L", "XL"):
            chosen = [m["id"] for m in MODELS if m["tier"] == raw.upper()]
        elif raw.lower() == "all":
            chosen = [m["id"] for m in MODELS]
        else:
            chosen = raw.split()

    by_id = {m["id"]: m for m in MODELS}
    total = 0
    for cid in chosen:
        m = by_id.get(cid)
        if m:
            total += m["size_gb"]
    print(f"\nDownload totale stimato: ~{total} GB")
    print("Premi Invio per continuare, Ctrl+C per annullare...")
    try:
        input()
    except KeyboardInterrupt:
        print("\nAnnullato.")
        return

    ok = 0
    for cid in chosen:
        m = by_id.get(cid)
        if not m:
            print(f"ID sconosciuto: {cid}")
            continue
        if install_one(m):
            ok += 1
    print(f"\nCompletati: {ok}/{len(chosen)}")


if __name__ == "__main__":
    main()
