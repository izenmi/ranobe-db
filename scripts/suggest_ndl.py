#!/usr/bin/env python3
"""レーベル名を指定して、works.json に未登録のシリーズ候補を国立国会図書館サーチから列挙する。

候補タイトルを自分で思いつく方式は、works.json が育つほど DUP ばかりになって無駄が出る。
逆に「レーベルの刊行物を機械的に並べ、既登録を引いた残り」を見るほうが当たり率が高い。

  python3 scripts/suggest_ndl.py 電撃文庫 --pages 6 --sleep 2

出力は1行1シリーズ:
  <シリーズ名> | <著者(責任表示)> | <レーベル> | <最古の刊行年> | <巻数(NDL上の件数)>
"""
import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

API = "https://ndlsearch.ndl.go.jp/api/opensearch"
NS = {"dc": "http://purl.org/dc/elements/1.1/", "dcndl": "http://ndl.go.jp/dcndl/terms/", "dcterms": "http://purl.org/dc/terms/"}
SRC = Path(__file__).resolve().parent.parent / "public" / "data" / "source"

DROP = re.compile(r"[\s　ー～〜~\-−–—・,、.。!！?？:：;；'\"’”“‘()（）\[\]【】<>〈〉《》「」『』/／\\|]")
# 巻数・版次の表記を落としてシリーズ名にまとめる
VOL = re.compile(
    r"(\s*[0-9０-９]+\s*$)|(\s*[上中下]\s*$)|(\s*第?[0-9０-９]+巻.*$)|(\s*[0-9０-９]+\s*[:：].*$)"
)


def norm(s):
    s = unicodedata.normalize("NFKC", s).lower()
    return DROP.sub("", s)


def series_key(title):
    t = title.split(":")[0].split("：")[0]
    prev = None
    while prev != t:
        prev = t
        t = VOL.sub("", t).strip()
    return t.strip()


def fetch(params, sleep, tries=4):
    url = API + "?" + urllib.parse.urlencode(params)
    wait = sleep
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ranobe-db-suggest/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < tries - 1:
                wait *= 2
                time.sleep(wait)
                continue
            return None
        except Exception:
            if attempt < tries - 1:
                time.sleep(wait)
                continue
            return None
    return None


def text_of(item, tag):
    node = item.find(tag, namespaces=NS)
    return (node.text or "").strip() if node is not None and node.text else ""


def year_of(item):
    for tag in ("dcterms:issued", "dc:date"):
        node = item.find(tag, namespaces=NS)
        if node is not None and node.text:
            m = re.search(r"(\d{4})", node.text)
            if m:
                return int(m.group(1))
    return None


def responsibility_of(item):
    vals = [(n.text or "").strip() for n in item.findall("dc:creator", namespaces=NS)]
    return "/".join(v for v in vals if v)[:60]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("publisher")
    ap.add_argument("--pages", type=int, default=5)
    ap.add_argument("--per", type=int, default=200)
    ap.add_argument("--sleep", type=float, default=2.0)
    ap.add_argument("--min-vol", type=int, default=1)
    args = ap.parse_args()

    works = json.loads((SRC / "works.json").read_text(encoding="utf-8"))
    existing = [norm(w["title"]) for w in works]

    def is_dup(title):
        k = norm(title)
        if not k:
            return True
        for e in existing:
            if not e:
                continue
            # 完全一致は長さに関わらず重複。包含判定だけだと「陰陽ノ京」のような
            # 4文字タイトルが len>=5 のガードをすり抜ける
            if e == k or (e in k and len(e) >= 5) or (k in e and len(k) >= 5):
                return True
        return False

    groups = {}
    for page in range(args.pages):
        xml = fetch(
            {"any": args.publisher, "cnt": args.per, "idx": 1 + page * args.per},
            args.sleep,
        )
        if not xml:
            break
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            break
        items = list(root.iter("item"))
        if not items:
            break
        for item in items:
            cats = [(c.text or "") for c in item.findall("category")]
            if cats and "図書" not in cats:
                continue
            title = text_of(item, "dc:title")
            if not title:
                continue
            key = series_key(title)
            if len(key) < 3:
                continue
            g = groups.setdefault(key, {"n": 0, "resp": "", "year": None})
            g["n"] += 1
            if not g["resp"]:
                g["resp"] = responsibility_of(item)
            y = year_of(item)
            if y and (g["year"] is None or y < g["year"]):
                g["year"] = y
        time.sleep(args.sleep)

    out = []
    for key, g in groups.items():
        if g["n"] < args.min_vol or is_dup(key):
            continue
        out.append((g["n"], key, g))
    out.sort(key=lambda x: -x[0])
    for n, key, g in out:
        print(f"{key} | {g['resp']} | {args.publisher} | {g['year'] or '?'} | {n}")
    print(f"suggest_ndl: {len(out)} 件 ({args.publisher})", file=sys.stderr)


main()
