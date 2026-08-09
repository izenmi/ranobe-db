#!/usr/bin/env python3
"""候補タイトルの著者・イラストレーター・紹介文を楽天Koboから1行ずつ取る。

楽天ブックス(紙)は絶版レーベル(MF文庫J等)をほとんど持たないが、Koboには電子版が残っている。
出力: <n>\t<Koboの書名>\t<著者欄>\t<紹介文>
著者欄は「作画/原作/挿絵」の順で並ぶことがある(コミカライズ版を掴んだ場合)ので、
小説版らしい巻(コミック系レーベル名を含まないもの)を優先して選ぶ。

  kobo_info.py <cand.tsv> [--chars 140] [--sleep 1.2]
"""
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426"
APP = "1542c42b-fc8f-47d1-a250-e0331a8bb6f1"
KEY = "pk_kCm14lKtlCPlYETTv7CKKE5TXxzFp5AHLQ0qbtcdaqn"
HDR = {"Referer": "https://izenmi.github.io/ranobe-db/", "Origin": "https://izenmi.github.io"}
COMIC = re.compile(r"(コミック|COMIC|comic|漫画|まんが)")


def norm(s):
    return re.sub(r"[\s　・:：!！?？〜~\-—–ー、。,.（）()『』「」/【】\[\]0-9０-９]", "", s or "").lower()


ap = argparse.ArgumentParser()
ap.add_argument("cand")
ap.add_argument("--chars", type=int, default=140)
ap.add_argument("--sleep", type=float, default=1.2)
args = ap.parse_args()

for n, ln in enumerate(open(args.cand, encoding="utf-8")):
    if not ln.strip():
        continue
    title = ln.split("\t")[0].strip()
    core = re.split(r"[:：]", title)[0]
    p = {"applicationId": APP, "accessKey": KEY, "format": "json", "hits": 30, "keyword": core}
    items = []
    for attempt in range(3):
        try:
            u = API + "?" + urllib.parse.urlencode(p)
            items = [i["Item"] for i in json.load(
                urllib.request.urlopen(urllib.request.Request(u, headers=HDR), timeout=30)).get("Items", [])]
            break
        except Exception:
            time.sleep(3 * (attempt + 1))
    best = None
    for it in items:
        if norm(core) not in norm(it.get("title", "")):
            continue
        if COMIC.search(it.get("seriesName", "") or "") or COMIC.search(it.get("publisherName", "") or ""):
            continue
        # 1巻(または巻数表記のないもの)を優先する
        vol = re.search(r"([0-9０-９]+)\s*$", it.get("title", ""))
        rank = int(vol.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789"))) if vol else 0
        if best is None or rank < best[0]:
            best = (rank, it)
    if not best:
        print(f"{n}\tMISS\t\t")
    else:
        it = best[1]
        cap = re.sub(r"\s+", " ", it.get("itemCaption") or "")[:args.chars]
        print("\t".join([str(n), it.get("title", "")[:44], it.get("author", ""), cap]))
    time.sleep(args.sleep)
