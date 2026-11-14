"""Deterministically shuffle MCQ option order so the correct answer is not
always in the same position. Remaps option-letter references inside reading
explanations (patterns like "B 項", "C『", "B、", "D 均").

Usage: python -I shuffle_options.py <data_dir> <c|c01,r01,...>
"""
import hashlib
import io
import json
import os
import re
import sys

LETTER_PAT = re.compile(r"([A-D])(?=項|『|、| 把| 均| 的| 與| 系統| 無| 明言| 服務| 儀式| 面試)")


def target_pos(key: str) -> int:
    digest = hashlib.md5(key.encode()).digest()
    return (digest[0] ^ digest[1]) % 4


def remap_letters(text: str, mapping: dict) -> str:
    return LETTER_PAT.sub(lambda m: mapping.get(m.group(1), m.group(1)), text)


def shuffle_question(sid: str, qi: int, q: dict, remap: bool) -> None:
    opts = q["options"]
    ans = q["answer"]
    p = target_pos(f"{sid}:{qi}")
    new_opts = [None] * len(opts)
    new_opts[p] = opts[ans]
    others = [o for i, o in enumerate(opts) if i != ans]
    slots = [i for i in range(len(opts)) if i != p]
    for slot, opt in zip(slots, others):
        new_opts[slot] = opt

    mapping = {}
    for old_i, old_opt in enumerate(opts):
        new_i = new_opts.index(old_opt)
        mapping["ABCD"[old_i]] = "ABCD"[new_i]

    q["options"] = new_opts
    q["answer"] = p
    if remap and q.get("note"):
        q["note"] = remap_letters(q["note"], mapping)


def main() -> None:
    data_dir, which = sys.argv[1], sys.argv[2]
    targets = set(which.split(","))

    for kind in ("cloze", "reading"):
        folder = os.path.join(data_dir, kind)
        for fname in sorted(os.listdir(folder)):
            sid = fname.split(".")[0]
            if sid not in targets:
                continue
            path = os.path.join(folder, fname)
            with io.open(path, encoding="utf-8") as f:
                data = json.load(f)
            remap = kind == "reading"
            for i, q in enumerate(data["questions"]):
                shuffle_question(sid, i, q, remap)
            with io.open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            answers = [q["answer"] for q in data["questions"]]
            print(sid, answers)


if __name__ == "__main__":
    main()
