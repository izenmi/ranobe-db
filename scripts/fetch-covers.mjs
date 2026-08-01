// Resolves a representative ISBN + cover image URL per work via the Rakuten Books search API
// (BooksTotal/Search) and caches the result in public/data/source/covers-cache.json (committed,
// read by generate-manifest.mjs). Not run on every build — run manually with `npm run
// fetch-covers` when adding new works or retrying misses. works.json only holds series-level
// data (no per-volume ISBNs), so this searches by series title, keeps only items that look like
// an actual book of that series (non-empty isbn — Blu-ray/DVD/CD items use `jan` instead — and a
// title that starts with the normalized series title, to exclude 4-koma anthologies etc.), sorts
// by release date ascending, and takes the earliest as a best-effort "volume 1" match.
//
// We tried openBD first (ISBN -> cover), but its cover images only come from 版元ドットコム
// member publishers, which excludes KADOKAWA/SB Creative/Kodansha — i.e. almost every
// light-novel publisher in this dataset — so real-world coverage was ~0%. Rakuten Books
// actually sells these titles, so its own cover images are far more complete.
//
// Requires a Rakuten Web Service app — free, instant self-serve (no sales-history approval like
// Amazon PA-API): register at https://webservice.rakuten.co.jp/, create an app with
// "アプリケーションURL" set to this site's URL (https://izenmi.github.io/ranobe-db/), and copy
// its "アプリケーションID" and "アクセスキー". Pass them via env vars; never commit them.
// The API enforces Referer/Origin headers matching the app's registered URL — see REFERER_URL
// below — which this script sends explicitly since it isn't a browser request.
//
// Usage:
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=xxx npm run fetch-covers
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=xxx npm run fetch-covers -- --force
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=xxx npm run fetch-covers -- --only=sword-art-online,re-zero
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(rootDir, "public", "data", "source");
const worksPath = path.join(sourceDir, "works.json");
const cachePath = path.join(sourceDir, "covers-cache.json");

const REFERER_URL = "https://izenmi.github.io/ranobe-db/";
const ORIGIN_URL = "https://izenmi.github.io";

const APP_ID = process.env.RAKUTEN_APP_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
if (!APP_ID || !ACCESS_KEY) {
  console.error("RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY env vars are required (see the header comment in this file).");
  process.exit(1);
}

const works = JSON.parse(readFileSync(worksPath, "utf-8"));
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf-8")) : {};

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",") : undefined;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(title) {
  return title.replace(/[\s　・:：!?！？―—\-ー()（）「」『』]/g, "").toLowerCase();
}

/** Bump the thumbnail service's requested resolution (default 200x200) for a crisper cover. */
function upscale(imageUrl) {
  return imageUrl.replace(/_ex=\d+x\d+/, "_ex=400x400");
}

async function searchRakuten(keyword) {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    keyword,
    hits: "30",
    sort: "+releaseDate",
    format: "json",
  });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404?${params.toString()}`;
  const res = await fetch(url, { headers: { Referer: REFERER_URL, Origin: ORIGIN_URL } });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(data.errors?.errorMessage || data.error_description || `HTTP ${res.status}`);
  }
  return (data.Items ?? []).map((wrapped) => wrapped.Item);
}

function pickBestMatch(items, work) {
  const target = normalize(work.title);
  // Already sorted oldest-first by the API (sort=+releaseDate). Require a 978-4 (Japan
  // registrant group) ISBN so a short/generic English title (e.g. "Overlord") can't false-match
  // an unrelated foreign book that happens to start with the same word, and exclude the "001001"
  // top-level genre (コミック) so a same-titled manga adaptation volume doesn't outrank the novel.
  return items.find(
    (it) =>
      it.isbn &&
      it.isbn.startsWith("9784") &&
      !(it.booksGenreId ?? "").startsWith("001001") &&
      normalize(it.title ?? "").startsWith(target),
  );
}

async function run() {
  const targets = works.filter((w) => (ONLY ? ONLY.includes(w.id) : true));
  let updated = 0;
  let skipped = 0;

  for (const work of targets) {
    if (!FORCE && cache[work.id]) {
      skipped++;
      continue;
    }
    try {
      const items = await searchRakuten(work.title);
      const best = pickBestMatch(items, work);
      if (!best) {
        cache[work.id] = { title: work.title, isbn: null, coverUrl: null, resolvedAt: new Date().toISOString() };
        console.log(`[miss] ${work.title}: 該当書誌が見つかりませんでした`);
        await sleep(1100);
        continue;
      }
      const coverUrl = best.largeImageUrl ? upscale(best.largeImageUrl) : null;
      cache[work.id] = {
        title: work.title,
        isbn: best.isbn,
        matchedTitle: best.title,
        coverUrl,
        resolvedAt: new Date().toISOString(),
      };
      console.log(`[${coverUrl ? "ok" : "no-cover"}] ${work.title} -> matched "${best.title}" (ISBN ${best.isbn})`);
      updated++;
    } catch (err) {
      console.error(`[error] ${work.title}: ${err.message}`);
    }
    await sleep(1100);
  }

  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(cachePath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`完了: ${updated}件更新, ${skipped}件スキップ(既存キャッシュ)。 -> ${cachePath}`);
}

run();
