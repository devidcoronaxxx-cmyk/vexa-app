"""Stable Audio server - lightweight entrypoint.

Optional: only starts if Stable Audio weights are present. No download/install.
Checks (in order) the tier variants produced by install-models.py:
  stable-audio-3-sfx, stable-audio-3-music, stable-audio-3-medium,
  stable-audio-open-small, stable-audio (1.0), musicgen-small, tinyaudio
Override with STABLE_AUDIO_MODEL_DIR. First non-empty dir wins.
"""
import os
import sys

CANDIDATES = [
    "stable-audio-3-sfx",
    "stable-audio-3-music",
    "stable-audio-3-medium",
    "stable-audio-open-small",
    "stable-audio",
    "musicgen-small",
    "tinyaudio",
]

def resolve_dir():
    override = os.environ.get("STABLE_AUDIO_MODEL_DIR")
    if override:
        return override
    base = os.path.join(os.path.expanduser("~"), ".vexa", "models")
    for name in CANDIDATES:
        d = os.path.join(base, name)
        if os.path.isdir(d) and os.listdir(d):
            return d
    return os.path.join(base, "stable-audio")

MODEL_DIR = resolve_dir()

def main():
    if not os.path.isdir(MODEL_DIR) or not os.listdir(MODEL_DIR):
        print("[stable-audio] No weights found in any candidate dir under ~/.vexa/models/")
        print("[stable-audio] Tried:", ", ".join(CANDIDATES))
        print("[stable-audio] Skipping. Run servers/install-models.py --tier S|M|L to install.")
        print("[stable-audio] Vexa continues without audio generation.")
        return 0
    print(f"[stable-audio] Weights found: {MODEL_DIR}")
    print("[stable-audio] (Inference backend not wired in this build; weights present.)")
    print("[stable-audio] Listening on http://127.0.0.1:8124")
    try:
        import http.server, socketserver
        with socketserver.TCPServer(("127.0.0.1", 8124), http.server.SimpleHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("[stable-audio] stopped")
    return 0

if __name__ == "__main__":
    sys.exit(main())
