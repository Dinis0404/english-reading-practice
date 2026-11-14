"""Build a compact E-C dictionary subset from ECDICT (MIT license).

Reads the full ECDICT csv, keeps common / exam-relevant headwords, trims
translations, and derives an inflected-form -> base-word reverse map from the
exchange column (for lemmatization at lookup time).

Usage: python -I build_dict.py <ecdict.csv> <out_dir>
Outputs: <out_dir>/dict.json, <out_dir>/forms.json
"""
import csv
import json
import re
import sys

KEEP_TAGS = {"zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre"}
WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z'\-]*$")
DOMAIN_TAG_RE = re.compile(r"^\[.{1,10}\]\s*")
# headwords whose whole translation is a cross-ref like "mean的过去式和过去分词"
XREF_RE = re.compile(r"^([a-zA-Z][a-zA-Z'\-]*)的(过去式|过去分词|现在分词|复数|原形|比较级|最高级)")
MAX_SENSE_LINES = 3
MAX_CHARS = 110


def clean_translation(t: str) -> str:
    lines = []
    for ln in t.split("\\n"):  # ECDICT stores escapes as literal backslash-n
        ln = DOMAIN_TAG_RE.sub("", ln.strip())
        if not ln:
            continue
        lines.append(ln)
        if len(lines) >= MAX_SENSE_LINES:
            break
    out = "\n".join(lines)
    if len(out) > MAX_CHARS:
        out = out[:MAX_CHARS].rstrip() + "…"
    return out


def main() -> None:
    src, out_dir = sys.argv[1], sys.argv[2]
    kept = {}
    forms = {}  # inflected -> base (only inflected forms not kept as headwords)

    with open(src, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx = {name: i for i, name in enumerate(header)}
        for row in reader:
            if len(row) < len(header):
                continue
            word = row[idx["word"]].strip()
            if not word or not WORD_RE.match(word):
                continue
            low = word.lower()
            if " " in low:  # skip multi-word phrases; lookup is per-word
                continue
            tag = row[idx["tag"]] or ""
            try:
                frq = int(row[idx["frq"]] or 0)
                bnc = int(row[idx["bnc"]] or 0)
            except ValueError:
                frq = bnc = 0
            tags = set(tag.split()) if tag else set()
            keep = bool(tags & KEEP_TAGS) or frq > 0 or bnc > 0
            if not keep:
                continue
            trans = clean_translation(row[idx["translation"]] or "")
            if not trans:
                continue
            phon = (row[idx["phonetic"]] or "").strip()
            kept.setdefault(low, [phon, trans])

            # collect inflected forms for lemmatization
            exchange = row[idx["exchange"]] or ""
            for part in exchange.split("/"):
                if len(part) < 3 or ":" not in part:
                    continue
                key, val = part.split(":", 1)
                val = val.strip().lower()
                if key not in {"p", "d", "i", "3", "s", "r", "t"} or not val:
                    continue
                if not WORD_RE.match(val):
                    continue
                if val != low and val not in forms:
                    forms[val] = low

    # only keep forms whose base survived filtering, and drop forms that are
    # themselves headwords (direct hit takes priority at lookup time)
    forms = {k: v for k, v in forms.items() if v in kept and k not in kept}

    # enrich: headwords that are pure cross-refs ("mean的过去式和过去分词")
    # point back to their base word, so the client can prefer the full entry
    for w in list(kept):
        m = XREF_RE.match(kept[w][1])
        if m and w not in forms:
            base = m.group(1).lower()
            if base in kept and base != w:
                forms[w] = base

    with open(out_dir + "/dict.json", "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, separators=(",", ":"))
    with open(out_dir + "/forms.json", "w", encoding="utf-8") as f:
        json.dump(forms, f, ensure_ascii=False, separators=(",", ":"))
    print(f"headwords={len(kept)} forms={len(forms)}")


if __name__ == "__main__":
    main()
