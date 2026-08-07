#!/usr/bin/env python3
"""候補タイトルの書誌と出版社紹介文(itemCaption)を楽天ブックスAPIから取りまとめる。

あらすじを自分の言葉で要約するための下敷きを、1タイトル1行で安く集めるためのスクリプト。
**itemCaptionの転記は禁止**(コピペ禁止ルールは出版社紹介文にも及ぶ)。あくまで内容を知るために使う。

  RAKUTEN_APP_ID=... RAKUTEN_ACCESS_KEY=... \
    python3 scripts/caption.py candidates.txt --sleep 1 --chars 170

candidates.txt は1行1タイトル(`|`以降は無視するので suggest_ndl.py の出力をそのまま渡せる)。
出力: <n>\t<タイトル>\t<著者(訳者・画も含む)>\t<出版社>\t<発売日>\t<紹介文>
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"
REFERER = "https://izenmi.github.io/ranobe-db/"
ORIGIN = "https://izenmi.github.io"


def clean(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    s = re.sub(r"[\r\n\t]+", " ", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def search(title, app_id, access_key, sleep, tries=3):
    params = {
        "applicationId": app_id,
        "accessKey": access_key,
        "format": "json",
        "title": title,
        "hits": 10,
        "sort": "+releaseDate",
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Referer": REFERER, "Origin": ORIGIN})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if attempt < tries - 1:
                time.sleep(sleep * (attempt + 2))
                continue
            return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--sleep", type=float, default=1.0)
    ap.add_argument("--chars", type=int, default=170)
    args = ap.parse_args()

    app_id = os.environ.get("RAKUTEN_APP_ID")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY")
    if not app_id or not access_key:
        print("RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY が必要です", file=sys.stderr)
        sys.exit(1)

    rows = []
    with open(args.file, encoding="utf-8") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|")]
            t = parts[0]
            # suggest_ndl.py の責任表示は「姓, 名, 生年」形式なので姓だけ取り出して照合に使う
            who = ""
            if len(parts) > 1 and parts[1]:
                who = re.split(r"[,、/]", parts[1])[0].strip()
            if t and not t.startswith("#"):
                rows.append((t, who))

    for i, (t, who) in enumerate(rows, 1):
        data = search(t, app_id, access_key, args.sleep)
        time.sleep(args.sleep)
        items = (data or {}).get("Items") or []
        # 著者名(姓)が一致する候補を優先する。短いタイトルは楽譜や英語教材が混ざるため
        it = None
        for cand in items:
            c = cand["Item"]
            if who and who in clean(c.get("author", "")):
                it = c
                break
        if it is None and items and not who:
            it = items[0]["Item"]
        if it is None:
            print(f"{i}\t{t}\tMISS")
            continue
        cap = clean(it.get("itemCaption", ""))[: args.chars]
        print(
            f"{i}\t{clean(it.get('title'))[:60]}\t{clean(it.get('author'))[:40]}\t"
            f"{clean(it.get('publisherName'))[:20]}\t{it.get('salesDate','')}\t{cap}"
        )


main()
