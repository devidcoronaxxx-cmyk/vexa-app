"""Kimodo (NVIDIA) animation server - lightweight entrypoint.

Optional: only starts if Kimodo weights are present. No download/install.
Override with KIMODO_MODEL_DIR.
"""
import os
import sys

MODEL_DIR = os.environ.get(
    "KIMODO_MODEL_DIR",
    os.path.join(os.path.expanduser("~"), ".vexa", "models", "kimodo"),
)

def main():
    if not os.path.isdir(MODEL_DIR) or not os.listdir(MODEL_DIR):
        print("[kimodo] Model weights not found at:", MODEL_DIR)
        print("[kimodo] Skipping. Run servers/install-models.py --only kimodo to install.")
        print("[kimodo] (May require HuggingFace access approval.)")
        print("[kimodo] Vexa continues without animation generation.")
        return 0
    print(f"[kimodo] Weights found: {MODEL_DIR}")
    print("[kimodo] (Inference backend not wired in this build; weights present.)")
    print("[kimodo] Listening on http://127.0.0.1:8123")
    try:
        import http.server, socketserver
        with socketserver.TCPServer(("127.0.0.1", 8123), http.server.SimpleHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("[kimodo] stopped")
    return 0

if __name__ == "__main__":
    sys.exit(main())
