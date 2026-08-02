#!/usr/bin/env python3
"""汎用バッチ反映スクリプト。
使い方: python3 scripts/apply_batch.py <batch.json>

batch.json の形式:
{
  "newAuthors": [...],
  "newIllustrators": [...],
  "newPublishers": [...],
  "newThemes": [...],
  "newAwards": [...],
  "works": [...]
}

- 新規id(author/illustrator/publisher/theme/award)は既存と重複していればスキップ
- work は authorIds/illustratorIds/publisherId/themeIds/awardResults[].awardId が
  (既存 + このバッチで追加される新規id) の中に存在するか検証し、
  存在しない参照があればその work 自体を反映せずレポートする
- 既存work idと重複するworkはスキップ
"""
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "public" / "data" / "source"

def load(name):
    with open(SRC / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)

def save(name, data):
    with open(SRC / f"{name}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

def main():
    if len(sys.argv) != 2:
        print("usage: apply_batch.py <batch.json>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        batch = json.load(f)

    authors = load("authors")
    illustrators = load("illustrators")
    publishers = load("publishers")
    themes = load("themes")
    awards = load("awards")
    works = load("works")

    author_ids = {a["id"] for a in authors}
    illustrator_ids = {i["id"] for i in illustrators}
    publisher_ids = {p["id"] for p in publishers}
    theme_ids = {t["id"] for t in themes}
    award_ids = {a["id"] for a in awards}
    work_ids = {w["id"] for w in works}

    report = {"added": {}, "skipped_duplicates": {}, "rejected_works": []}

    def add_new(pool, id_set, key_name, kind):
        added, skipped = [], []
        for item in batch.get(key_name, []):
            if item["id"] in id_set:
                skipped.append(item["id"])
            else:
                pool.append(item)
                id_set.add(item["id"])
                added.append(item["id"])
        report["added"][kind] = added
        report["skipped_duplicates"][kind] = skipped

    add_new(authors, author_ids, "newAuthors", "authors")
    add_new(illustrators, illustrator_ids, "newIllustrators", "illustrators")
    add_new(publishers, publisher_ids, "newPublishers", "publishers")
    add_new(themes, theme_ids, "newThemes", "themes")
    add_new(awards, award_ids, "newAwards", "awards")

    added_works = []
    for w in batch.get("works", []):
        if w["id"] in work_ids:
            report["rejected_works"].append({"id": w["id"], "reason": "duplicate work id"})
            continue

        missing = []
        for aid in w.get("authorIds", []):
            if aid not in author_ids:
                missing.append(f"authorId:{aid}")
        for iid in w.get("illustratorIds", []):
            if iid not in illustrator_ids:
                missing.append(f"illustratorId:{iid}")
        pid = w.get("publisherId")
        if pid and pid not in publisher_ids:
            missing.append(f"publisherId:{pid}")
        for tid in w.get("themeIds", []):
            if tid not in theme_ids:
                missing.append(f"themeId:{tid}")
        for ar in w.get("awardResults", []):
            if ar.get("awardId") not in award_ids:
                missing.append(f"awardId:{ar.get('awardId')}")

        if missing:
            report["rejected_works"].append({"id": w["id"], "reason": f"missing refs: {missing}"})
            continue

        works.append(w)
        work_ids.add(w["id"])
        added_works.append(w["id"])

    report["added"]["works"] = added_works

    save("authors", authors)
    save("illustrators", illustrators)
    save("publishers", publishers)
    save("themes", themes)
    save("awards", awards)
    save("works", works)

    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
