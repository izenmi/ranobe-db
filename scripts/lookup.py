#!/usr/bin/env python3
"""既存データの重複確認ユーティリティ(バッチ追加作業用)。

使い方:
  python3 scripts/lookup.py works "タイトルA" "タイトルB" ...
      候補タイトルが works.json に既に登録済みか判定し、未登録のものだけを出力する。
  python3 scripts/lookup.py name "著者名" "イラストレーター名" ...
      authors / illustrators / publishers を名前の部分一致で検索し、既存idを表示する。

works の判定は NFKC 正規化 + 記号・空白除去 + 「シリーズ」等の接尾辞除去による
正規化タイトル同士の完全一致、および片方が他方を含む場合の部分一致で行う。
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "public" / "data" / "source"

TRIM_SUFFIX = re.compile(r"(シリーズ)$")
DROP_CHARS = re.compile(r"[\s　ー～〜~\-−–—・,、.。!！?？:：;；'\"’”“‘()（）\[\]【】<>〈〉《》「」『』/／\\|]")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = DROP_CHARS.sub("", s)
    s = TRIM_SUFFIX.sub("", s)
    return s


def load(name):
    with open(SRC / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def cmd_works(candidates):
    works = load("works")
    index = [(norm(w["title"]), w["id"], w["title"]) for w in works]
    new, dup = [], []
    for c in candidates:
        n = norm(c)
        if not n:
            continue
        hit = None
        for wn, wid, wtitle in index:
            if wn == n or (len(n) >= 4 and (n in wn or wn in n)):
                hit = (wid, wtitle)
                break
        if hit:
            dup.append(f"{c}  →  既存: {hit[1]} ({hit[0]})")
        else:
            new.append(c)
    print("## 未登録(調査対象)  %d件" % len(new))
    for c in new:
        print(c)
    print()
    print("## 登録済み(スキップ)  %d件" % len(dup))
    for d in dup:
        print(d)


def cmd_name(names):
    pools = {k: load(k) for k in ("authors", "illustrators", "publishers")}
    for q in names:
        nq = norm(q)
        hits = []
        for kind, pool in pools.items():
            for e in pool:
                if norm(e["name"]) == nq or (len(nq) >= 2 and nq in norm(e["name"])):
                    hits.append(f"  {kind}: {e['id']}  {e['name']}")
        print(f"{q}: " + ("既存あり" if hits else "既存なし(新規idを作成)"))
        for h in hits:
            print(h)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == "works":
        cmd_works(args)
    elif mode == "name":
        cmd_name(args)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
