#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app/localization/languages/en.generated.ts"
SCAN_EXTS = {".tsx", ".jsx", ".ts", ".js", ".json", ".lua"}
IGNORE_PARTS = {"node_modules", ".next", ".git", "dist", "build", "coverage"}
UI_KEYS = {
    "alt", "aria-label", "answer", "badge", "content", "cta", "desc", "description",
    "empty", "error", "feedback", "heading", "label", "message", "name", "note",
    "placeholder", "question", "reason", "sub", "subtitle", "summary", "text", "title",
}
SKIP_SUBSTRINGS = [
    "rgba", "rgb(", "var(", "linear-gradient", "radial-gradient", "clamp(", "calc(",
    "cubic-bezier", "@keyframes", "translate", "rotate(", "scale(", "blur(",
    "http://", "https://", "www.", "mailto:", "data:", "blob:",
    "/assets/", "/icons/", "/assistant/", "/api/", "bi-", "gSpin", "gFade", "gScale",
    "return (", "return(", "const ", "let ", "useState", "useRef", "charAt", "slice(", "=>", "process.env", "NEXT_", "SUPABASE_", "ROBLOX_", "DISCORD_",
    "select(", ".select", "insert(", "upsert(", "from(", "localStorage", "sessionStorage",
    "position:", "display:", "background:", "border:", "font", "padding:", "margin:",
]
CSS_WORDS = {
    "absolute", "auto", "block", "bold", "border-box", "center", "column", "contain",
    "cover", "default", "flex", "fixed", "grid", "hidden", "inherit", "initial",
    "none", "nowrap", "pointer", "relative", "solid", "sticky", "transparent",
}


def clean(value: str) -> str:
    value = value.replace("&apos;", "'").replace("&quot;", '"').replace("&amp;", "&")
    return re.sub(r"\s+", " ", value).strip()


def is_text(value: str) -> bool:
    value = clean(value)
    low = value.lower()
    if len(value) < 2 or len(value) > 1400:
        return False
    if low in CSS_WORDS:
        return False
    if value.startswith((".", ",", ";", ":", "(", "{", "[")):
        return False
    if any(part in value for part in SKIP_SUBSTRINGS):
        return False
    if "#" in value or re.search(r"\b\d+(px|vh|vw|rem|em|%)\b", value):
        return False
    if re.fullmatch(r"[{}()[\].,;:!?×·#\-–—_/\\\s0-9]+", value):
        return False
    if re.fullmatch(r"[A-Z0-9_]{3,}", value):
        return False
    if re.fullmatch(r"[a-z0-9_./:-]+", value) and " " not in value and len(value) > 14:
        return False
    return bool(re.search(r"[A-Za-zÀ-ÿА-Яа-яאבגדהוזחטיכלמנסעפצקרשתء-ي一-龯ぁ-んァ-ヶ가-힣]", value))


def slug(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", ".", value.lower()).strip(".")[:58].strip(".")
    return base or "text"


def file_key(path: Path) -> str:
    rel = path.relative_to(ROOT).with_suffix("")
    return ".".join(rel.parts).replace("[id]", "id").replace("-", "_")


def add(entries: list[tuple[str, str]], seen: set[tuple[str, str]], used: dict[str, int], path: Path, value: str) -> None:
    value = clean(value)
    if not is_text(value):
        return
    fk = file_key(path)
    marker = (fk, value)
    if marker in seen:
        return
    seen.add(marker)
    base = slug(value)
    used[base] = used.get(base, 0) + 1
    suffix = f".{used[base]}" if used[base] > 1 else ""
    entries.append((f"site.{fk}.{base}{suffix}", value))


def extract_code(path: Path, source: str, entries: list[tuple[str, str]], seen: set[tuple[str, str]]) -> None:
    used: dict[str, int] = {}
    if path.suffix in {".tsx", ".jsx"}:
        for match in re.finditer(r">([^<>{}\n][^<>{}]*)<", source):
            add(entries, seen, used, path, match.group(1))
    for key in UI_KEYS:
        for match in re.finditer(rf"\b{re.escape(key)}\s*[:=]\s*([\"'])(.*?)\1", source, re.S):
            add(entries, seen, used, path, match.group(2))
    for match in re.finditer(r"\bset(?:Error|SaveMsg|Status|Message|Toast|Modal|Title|Subtitle)\(([\"'])(.*?)\1\)", source, re.S):
        add(entries, seen, used, path, match.group(2))
    for match in re.finditer(r"\b(?:alert|confirm|addEmptyOutput|showToast|notify)\(([\"'])(.*?)\1", source, re.S):
        add(entries, seen, used, path, match.group(2))
    for match in re.finditer(r"\?\s*([\"'])([^\"']{2,160})\1\s*:\s*([\"'])([^\"']{2,160})\3", source):
        add(entries, seen, used, path, match.group(2))
        add(entries, seen, used, path, match.group(4))


def extract_json(path: Path, entries: list[tuple[str, str]], seen: set[tuple[str, str]]) -> None:
    used: dict[str, int] = {}
    try:
        data = json.loads(path.read_text())
    except Exception:
        return
    def walk(value):
        if isinstance(value, str):
            add(entries, seen, used, path, value)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)
    walk(data)


def extract_lua(path: Path, source: str, entries: list[tuple[str, str]], seen: set[tuple[str, str]]) -> None:
    used: dict[str, int] = {}
    for match in re.finditer(r"([\"'])(.*?)(?<!\\)\1", source):
        value = match.group(2)
        if " " in value or re.search(r"[A-Z][a-z]", value):
            add(entries, seen, used, path, value)


def main() -> None:
    entries: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SCAN_EXTS:
            continue
        if any(part in IGNORE_PARTS for part in path.parts):
            continue
        if "localization" in path.parts:
            continue
        if path == OUT:
            continue
        if path.suffix == ".json":
            if path.name == "site.config.json":
                extract_json(path, entries, seen)
            continue
        source = path.read_text(errors="ignore")
        if path.suffix == ".lua":
            extract_lua(path, source, entries, seen)
        else:
            extract_code(path, source, entries, seen)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = ["export const generatedSiteText = {"]
    for key, value in entries:
        body.append(f"  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)},")
    body.append("} as const")
    body.append("")
    body.append("export default generatedSiteText")
    OUT.write_text("\n".join(body) + "\n")
    print(f"{len(entries)} text entries written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
