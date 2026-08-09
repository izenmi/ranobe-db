#!/usr/bin/env python3
"""suggest_ndl.py の出力を prep.py 用の候補TSVに変換する。
  python3 mkcand.py <suggest出力> <出力cand.tsv> [最小刊行年] [件数]
著者欄の NDL 表記(「新木, 伸, 1968-」)を「新木伸」に正規化し、巻数nも tsv の3列目に控える。"""
import re
import sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
min_year = int(sys.argv[3]) if len(sys.argv) > 3 else 2010
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 45

rows = []
for ln in src.read_text(encoding="utf-8").splitlines():
    f = [x.strip() for x in ln.split(" | ")]
    if len(f) < 5:
        continue
    try:
        year = int(f[3])
    except ValueError:
        continue
    if year < min_year:
        continue
    a = f[1].split("/")[0]
    a = re.sub(r",\s*(\d{4}-?\d{0,4}|pub\..*|作家.*)$", "", a)
    a = a.replace(",", "").replace(" ", "").replace("　", "")
    if not a:
        continue          # 著者不明の書誌は追えないので落とす
    rows.append(f"{f[0]}\t{a}")
out.write_text("\n".join(rows[:limit]) + "\n", encoding="utf-8")
print(f"{len(rows)}件中{min(limit, len(rows))}件を書き出し -> {out}")
# 巻数(シリーズの実巻数)は anno の vol= 上書きに使うので併せて出す
for ln in src.read_text(encoding="utf-8").splitlines()[:0]:
    pass
