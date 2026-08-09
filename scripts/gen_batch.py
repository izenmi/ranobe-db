#!/usr/bin/env python3
"""prep.py の結果 + 手書きの注釈TSV から apply_batch.py 用の batch.json を組み立てる。

  python3 scripts/gen_batch.py prep.json anno.tsv batch.json

anno.tsv(1行1作品、タブ区切り):
  <n> <themeIds(カンマ区切り)> <あらすじ(自分の言葉で要約)> [<flags>] [<overrides>]
    flags     … a=アニメ化, c=コミカライズ, o=ongoing, u=status不明, x=この作品を採用しない,
                n=あらすじの典拠が無く内容未確認(sourceNoteに明記する)
    overrides … key=value をセミコロン区切り。title / kana / pub(=publisherId) / illust(名前、
                カンマ区切り) / author(名前、カンマ区切り) / vol / year / id / award(=awardId)
                / result(=賞の表記) / ayear(=受賞年)

著者・イラストレーターは既存 authors.json / illustrators.json と名前で突き合わせ、無ければ
新規idを採番する(読みはNDLの creatorTranscription、無ければ著者名検索で引く)。
レーベルはNDLの dcndl:seriesTitle を publishers.json の名前と突き合わせる。
"""
import datetime
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prep import NDL, NS, clean_person, get, hiragana, norm, romaji, text  # noqa: E402

SRC = Path(__file__).resolve().parent.parent / "public" / "data" / "source"
TODAY = datetime.date.today().isoformat()
KANA_CACHE = Path(__file__).resolve().parent.parent / ".kana-cache.json"

SOURCE_NOTE = ("国立国会図書館サーチで書名・著者・レーベル・刊行年・巻数を、受賞歴はWikipedia日本語版の"
               "{award}受賞作一覧で確認({date}照会)。あらすじは楽天ブックスの書誌情報およびWikipedia記事を"
               "参考にした独自要約(コピペなし)。巻数はNDL収録分に基づく概数。")

# 受賞作ではなくカタログ列挙(suggest_ndl.py)から拾った作品用。賞に触れない文面にする
CATALOG_NOTE = ("国立国会図書館サーチで書名・著者・レーベル・刊行年・巻数を、著者/イラストレーター表記は"
                "楽天ブックス・楽天Koboの書誌で確認({date}照会)。あらすじは楽天/Koboの紹介文および"
                "Wikipedia記事を参考にした独自要約(コピペなし)。巻数はNDL収録分に基づく概数。")


def load(name):
    return json.load(open(SRC / f"{name}.json", encoding="utf-8"))


def kana_lookup(name, cache):
    """人物名の読みをNDLの著者検索から引く(イラストレーターの nameKana 用)。"""
    if name in cache:
        return cache[name]
    xml = get(NDL + "?" + urllib.parse.urlencode({"creator": name, "cnt": "10"}), sleep=2)
    time.sleep(1.5)
    got = ""
    if xml:
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            root = None
        if root is not None:
            for item in root.iter("item"):
                creators = [clean_person(n.text) for n in item.findall("dc:creator", namespaces=NS)]
                trans = [clean_person(n.text) for n in item.findall("dcndl:creatorTranscription", namespaces=NS)]
                for c, t in zip(creators, trans):
                    if norm(c) == norm(name) and t:
                        got = hiragana(t).replace(" ", "")
                        break
                if got:
                    break
    cache[name] = got
    return got


def main():
    prep_path, anno_path, out_path = sys.argv[1:4]
    award_name = sys.argv[4] if len(sys.argv) > 4 else "各賞"
    # NDLのシリーズ名が実際のレーベルと違うことがある(角川スニーカー文庫→「角川文庫」等)ので
    # バッチ既定のレーベルを指定できるようにする
    default_pub = sys.argv[5] if len(sys.argv) > 5 else ""
    prep = {r["n"]: r for r in json.load(open(prep_path, encoding="utf-8"))}

    authors, illustrators = load("authors"), load("illustrators")
    publishers, themes, works = load("publishers"), load("themes"), load("works")
    author_by_name = {norm(a["name"]): a["id"] for a in authors}
    illust_by_name = {norm(i["name"]): i["id"] for i in illustrators}
    pub_by_name = {norm(p["name"]): p["id"] for p in publishers}
    theme_ids = {t["id"] for t in themes}
    work_ids = {w["id"] for w in works}
    person_ids = {a["id"] for a in authors} | {i["id"] for i in illustrators}
    cache = json.loads(KANA_CACHE.read_text(encoding="utf-8")) if KANA_CACHE.exists() else {}

    new_authors, new_illustrators, out_works = [], [], []
    problems = []

    def uniq_id(base, taken):
        base = base or "work"
        cand, i = base, 2
        while cand in taken:
            cand = f"{base}-{i}"
            i += 1
        taken.add(cand)
        return cand

    def person_id(name, kana, taken):
        base = romaji(kana) if kana else romaji(name)
        if not base or not re.fullmatch(r"[a-z0-9\-]+", base):
            base = "p-" + str(abs(hash(name)) % 10 ** 6)
        return uniq_id(base, taken)

    for ln in open(anno_path, encoding="utf-8"):
        ln = ln.rstrip("\n")
        if not ln.strip() or ln.startswith("#"):
            continue
        f = ln.split("\t")
        n = int(f[0])
        theme_str, synopsis = f[1], f[2] if len(f) > 2 else ""
        flags = f[3] if len(f) > 3 else ""
        ov = {}
        if len(f) > 4 and f[4].strip():
            for kv in f[4].split(";"):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    ov[k.strip()] = v.strip()
        if "x" in flags:
            continue
        r = prep.get(n)
        if r is None or not r.get("ndl"):
            problems.append(f"n={n} prep結果なし")
            continue
        nd = r["ndl"]

        title = ov.get("title") or r["title"]
        kana = ov.get("kana") or r.get("titleKana", "")
        kana = re.sub(r"[:：].*$", "", kana)
        wid = ov.get("id") or uniq_id(r.get("workId", "").split(":")[0][:48].strip("-"), work_ids)

        # 著者
        a_names = [x.strip() for x in ov["author"].split(",")] if ov.get("author") else []
        if not a_names:
            a_names = [r["author"]]
        persons = {p["name"]: p for p in r.get("persons", [])}
        author_ids = []
        for nm in a_names:
            key = norm(re.sub(r"（.*?）", "", nm))
            if key in author_by_name:
                author_ids.append(author_by_name[key])
                continue
            p = None
            for pn, pv in persons.items():
                if norm(re.sub(r"（.*?）", "", pn)) == key:
                    p = pv
                    break
            k = (p or {}).get("kana") or kana_lookup(nm, cache)
            pid = person_id(nm, k, person_ids)
            new_authors.append({"id": pid, "name": nm, "nameKana": k or nm,
                                "description": "ライトノベルを手がける小説家。",
                                "externalLinks": {},
                                "sourceNote": f"国立国会図書館サーチの書誌で確認({TODAY})。",
                                "updatedAt": TODAY})
            author_by_name[key] = pid
            author_ids.append(pid)

        # イラストレーター
        i_names = []
        if ov.get("illust"):
            i_names = [x.strip() for x in ov["illust"].split(",") if x.strip() and x.strip() != "-"]
        elif ov.get("illust") != "" or True:
            # 注釈で指定が無ければ、Wikipedia記事のイラスト欄(記事が本作のものである場合のみ)から拾う
            wk = r.get("wiki") or {}
            raw = ""
            if wk.get("illust"):
                pt, tt = norm(wk.get("pageTitle", "")), norm(title)
                if pt and (pt in tt or tt in pt):
                    raw = wk["illust"]
            if not raw:
                # Wikipediaに無ければ楽天の著者欄「著者/イラストレーター」の後半を使う
                ra = (r.get("rakuten") or {}).get("author", "")
                if ra and "/" in ra:
                    a_key = norm(re.sub(r"（.*?）", "", a_names[0]))
                    rest = [x for x in ra.split("/") if norm(x) != a_key]
                    raw = "／".join(rest)
            for part in re.split(r"[、,／/・]|\s+", raw):
                part = re.sub(r"[（(].*?[）)]", "", part).strip()
                part = re.sub(r"[\s　]+", "", part)
                if part and part not in i_names:
                    i_names.append(part)
        illust_ids = []
        for nm in i_names:
            key = norm(nm)
            if key in illust_by_name:
                illust_ids.append(illust_by_name[key])
                continue
            k = kana_lookup(nm, cache)
            pid = person_id(nm, k, person_ids)
            new_illustrators.append({"id": pid, "name": nm, "nameKana": k or nm,
                                     "description": "ライトノベルの挿絵を手がけるイラストレーター。",
                                     "externalLinks": {},
                                     "sourceNote": f"国立国会図書館サーチ・楽天ブックスの書誌で確認({TODAY})。",
                                     "updatedAt": TODAY})
            illust_by_name[key] = pid
            illust_ids.append(pid)

        # レーベル
        pub_id = ov.get("pub", "") or default_pub
        if not pub_id:
            series = re.sub(r"\s*[;；].*$", "", nd.get("series", "") or "")
            # NDLは「電撃文庫 = DENGEKI BUNKO」のように欧文併記を入れることがある
            series = re.sub(r"\s*=.*$", "", series).strip()
            pub_id = pub_by_name.get(norm(series), "")
        if not pub_id:
            problems.append(f"n={n} {title}: レーベル未解決 (NDL series='{nd.get('series')}')")
            continue

        themes_l = [t.strip() for t in theme_str.split(",") if t.strip()]
        bad = [t for t in themes_l if t not in theme_ids]
        if bad:
            problems.append(f"n={n} {title}: 未知のテーマid {bad}")
            continue

        year = int(ov.get("year") or nd.get("firstYear") or r.get("year") or 0) or None
        vol = int(ov.get("vol") or nd.get("volumes") or 1)
        last = nd.get("lastYear") or year or 0
        if "o" in flags:
            status = "ongoing"
        elif "u" in flags:
            status = "unknown"
        else:
            status = "completed" if last and last <= 2022 else "unknown"

        award_id = ov.get("award") or r.get("awardId", "")
        ayear = int(ov.get("ayear") or r.get("year") or year or 0)
        result = ov.get("result") or r.get("prize") or "受賞"
        awards_res = []
        if award_id and ayear:
            awards_res.append({"awardId": award_id, "year": ayear, "result": result})

        out_works.append({
            "id": wid, "title": title, "titleKana": kana,
            "authorIds": author_ids, "illustratorIds": illust_ids,
            "publisherId": pub_id, "themeIds": themes_l,
            "firstPublishedYear": year, "volumeCount": vol, "status": status,
            "synopsis": synopsis,
            "awardResults": awards_res,
            "mediaMix": {"anime": "a" in flags, "comic": "c" in flags},
            "externalLinks": {},
            "sourceNote": (CATALOG_NOTE.format(date=TODAY) if award_name == "-"
                           else SOURCE_NOTE.format(award=ov.get("awardname", award_name), date=TODAY))
            + ("あらすじの典拠が見つからなかったため、内容の記述は書誌事項から確認できる範囲にとどめている。"
               if "n" in flags else ""),
            "updatedAt": TODAY,
        })

    KANA_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    batch = {"newAuthors": new_authors, "newIllustrators": new_illustrators,
             "newPublishers": [], "newThemes": [], "newAwards": [], "works": out_works}
    Path(out_path).write_text(json.dumps(batch, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"works={len(out_works)} newAuthors={len(new_authors)} newIllustrators={len(new_illustrators)}")
    for p in problems:
        print("! " + p)


if __name__ == "__main__":
    main()
