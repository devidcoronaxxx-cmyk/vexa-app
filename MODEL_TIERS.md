# Vexa — Tiered Local Models (no cloud fallback required)

Vexa works **without** any local model (cloud NVIDIA generation). If you want
offline generation, pick the tier that matches your PC. Nothing is installed
automatically; use `servers/install-models.py`.

## LLM (text/code) tiers

| Tier | Hardware | Model (HF repo) | Size | Notes |
|---|---|---|---|---|
| S (weak, CPU only) | ≤8 GB RAM, no GPU | Phi-4 Mini (`microsoft/Phi-4-mini-instruct`) | ~2.5 GB | CPU 30-50 tok/s, best quality/size |
| S (weak) | ≤8 GB RAM, no GPU | Gemma 4 E2B (`google/gemma-4-E2B`) | ~2 GB | multimodal, ultra-light |
| S (weak) | ≤8 GB RAM, no GPU | Qwen 3.5 4B (`Qwen/Qwen3.5-4B`) | ~3.4 GB | good general |
| M (mid) | 12-16 GB RAM, 8-12 GB VRAM | Qwen3 8B (`Qwen/Qwen3-8B`) | ~5 GB | **default chosen** |
| M (mid) | 12-16 GB RAM, 8-12 GB VRAM | Gemma 4 E4B / 12B (`google/gemma-4-E4B`) | ~6.6 GB | multimodal |
| L (strong) | 16-24 GB VRAM | Qwen3 14B (`Qwen/Qwen3-14B`) | ~9 GB | strong all-rounder |
| L (strong) | 16-24 GB VRAM | gpt-oss 20B (`openai/gpt-oss-20b`) | ~12 GB | reasoning + tools |
| XL (workstation) | ≥24 GB VRAM | Qwen3.8 27B (`Qwen/Qwen3.8-27B`) | ~18-24 GB | best quality |

## 3D generation tiers

| Tier | Hardware | Model | Size | Notes |
|---|---|---|---|---|
| S (weak) | 4-6 GB VRAM | TripoSR (`stabilityai/TripoSR`) | ~4 GB | fastest, 0.5s/mesh, lower quality |
| S (weak) | 4-6 GB VRAM | Stable Fast 3D | ~4 GB | real-time |
| M (mid) | 8-12 GB VRAM | Hunyuan3D-2 (`tencent/Hunyuan3D-2`) | ~10 GB | **default chosen** (Hunyuan3D 2.1) |
| M (mid) | 8-12 GB VRAM | Hunyuan3D-2mini | ~6 GB | lighter shape-only |
| L (strong) | 16-24 GB VRAM | TRELLIS 2 (`microsoft/TRELLIS.2-4B`) | ~16 GB | best fidelity + PBR |
| L (strong) | 16-24 GB VRAM | Hunyuan3D 2.1 (`tencent/Hunyuan3D-2.1`) | ~12 GB | **our pick**, texture stage |

## Audio tiers

| Tier | Hardware | Model | Size | Notes |
|---|---|---|---|---|
| S (weak, CPU) | CPU only | Stable Audio 3 Small-SFX (`stabilityai/stable-audio-3-small-sfx`) | ~1.8 GB | 433M, CPU, 120s |
| S (weak, CPU) | CPU only | Stable Audio 3 Small-Music (`stabilityai/stable-audio-3-small-music`) | ~1.8 GB | 433M, CPU, 120s |
| S (weak) | CPU only | TinyAudio (~20M decoder) | ~0.1 GB | ultra-light, real-time on 4 cores |
| M (mid) | 4-8 GB VRAM | Stable Audio Open Small (`stabilityai/stable-audio-open-small`) | ~1 GB (INT8) | 497M, 11s clips |
| M (mid) | 4-8 GB VRAM | Stable Audio 3 Medium (`stabilityai/stable-audio-3-medium`) | ~1.4B | 6 min tracks, GPU |
| L (strong) | 8+ GB VRAM | Stable Audio Open 1.0 (`stabilityai/stable-audio-open-1.0`) | ~3 GB | longer clips |
| alt | 4+ GB VRAM | MusicGen Small (`facebook/musicgen-small`) | ~1.5 GB | music, MIT |

## Animation tiers

| Tier | Hardware | Model | Size | Notes |
|---|---|---|---|---|
| M (mid) | 12+ GB VRAM | Kimodo (NVIDIA) | ~7 GB | **our pick**, GPU required |
| fallback | any | Cloud/offline skip | 0 | Vexa disables animation gen if no model |

## Installer variants (in `release/`)

| Installer | Default tier | Target PC | Models to install |
|---|---|---|---|
| `Vexa-Low Setup 1.8.0.exe` | S | ≤8 GB RAM, 4-6 GB VRAM | Phi-4 Mini + TripoSR + Stable Audio 3 Small-SFX (~6 GB) |
| `Vexa Setup 1.8.0.exe` | M | 16 GB RAM, 8-12 GB VRAM | Qwen3 8B + Hunyuan3D-2 + Stable Audio Open Small (~11 GB) |
| `Vexa-High Setup 1.8.0.exe` | L | 24+ GB RAM, 16-24 GB VRAM | Qwen3 14B + TRELLIS 2 + Stable Audio 3 Medium (~40 GB) |

After install, run `servers/install-models.py --tier <S|M|L>` (or `--all`) to download the matching models.

## How to choose

Run `python servers/install-models.py --list` to see what fits. The script checks free disk space.
Weak PCs: install only Tier S models (Phi-4 Mini + TripoSR + Stable Audio 3 Small-SFX) ≈ 6 GB total.
Mid PCs: our original picks (Qwen3 8B + Hunyuan3D-2 + Stable Audio Open Small) ≈ 11 GB.
Strong PCs: top tiers (Qwen3.8 27B + TRELLIS 2 + Stable Audio 3 Medium) ≈ 40 GB.

## PC requirements summary

- **Minimum (no local models)**: 8 GB RAM, any CPU, no GPU. Vexa uses cloud generation.
- **Tier S**: 8 GB RAM, 4-6 GB VRAM. ~6 GB disk.
- **Tier M**: 16 GB RAM, 8-12 GB VRAM. ~11 GB disk. (our default picks)
- **Tier L**: 24 GB RAM, 16-24 GB VRAM. ~40 GB disk.
- **Tier XL**: 32+ GB RAM, 24+ GB VRAM. ~60 GB disk.
