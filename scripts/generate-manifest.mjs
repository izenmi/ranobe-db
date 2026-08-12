// Reads public/data/source/*.json (hand-authored) and writes public/data/generated/*.json:
// denormalized, name-resolved data ready for direct rendering, plus reference-integrity
// checks so a typo'd id fails the build instead of silently rendering blank names.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(rootDir, "public", "data", "source");
const outDir = path.join(rootDir, "public", "data", "generated");

function readSource(name) {
  return JSON.parse(readFileSync(path.join(sourceDir, `${name}.json`), "utf-8"));
}

const works = readSource("works");
const authors = readSource("authors");
const illustrators = readSource("illustrators");
const publishers = readSource("publishers");
const themes = readSource("themes");
const awards = readSource("awards");

// Optional: built by `npm run fetch-covers` (scripts/fetch-covers.mjs), which resolves an ISBN
// per work via NDL Search and a cover image URL via openBD, then commits the result here so
// builds stay offline/deterministic. Absent entries just mean "no cover resolved yet".
const coversCachePath = path.join(sourceDir, "covers-cache.json");
const coversCache = existsSync(coversCachePath) ? JSON.parse(readFileSync(coversCachePath, "utf-8")) : {};

const authorsById = new Map(authors.map((a) => [a.id, a]));
const illustratorsById = new Map(illustrators.map((i) => [i.id, i]));
const publishersById = new Map(publishers.map((p) => [p.id, p]));
const themesById = new Map(themes.map((t) => [t.id, t]));
const awardsById = new Map(awards.map((a) => [a.id, a]));

const errors = [];

function checkRef(map, id, kind, workId) {
  if (!map.has(id)) errors.push(`work "${workId}": unknown ${kind} id "${id}"`);
}

for (const w of works) {
  w.authorIds.forEach((id) => checkRef(authorsById, id, "author", w.id));
  w.illustratorIds.forEach((id) => checkRef(illustratorsById, id, "illustrator", w.id));
  checkRef(publishersById, w.publisherId, "publisher", w.id);
  w.themeIds.forEach((id) => checkRef(themesById, id, "theme", w.id));
  (w.awardResults ?? []).forEach((r) => checkRef(awardsById, r.awardId, "award", w.id));
}

const workIds = new Set();
for (const w of works) {
  if (workIds.has(w.id)) errors.push(`duplicate work id "${w.id}"`);
  workIds.add(w.id);
}
for (const [label, list] of [
  ["author", authors],
  ["illustrator", illustrators],
  ["publisher", publishers],
  ["theme", themes],
  ["award", awards],
]) {
  const seen = new Set();
  for (const item of list) {
    if (seen.has(item.id)) errors.push(`duplicate ${label} id "${item.id}"`);
    seen.add(item.id);
  }
}

if (errors.length > 0) {
  console.error("generate-manifest: reference integrity errors:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ---- related works ("この作品が好きなら") ----
// Cosine similarity over IDF-weighted theme tags, plus a bonus for sharing an author or
// illustrator. IDF matters because the tag vocabulary is deliberately small and reused
// (see CLAUDE.md「テーマタグの方針」): a tag like 異世界転生 is on hundreds of works and says
// almost nothing about similarity, while a rare tag is highly informative. Weighting every
// shared tag equally would just surface the most generic works on every page.
const RELATED_COUNT = 6;
const SAME_AUTHOR_BONUS = 0.15;
const SAME_ILLUSTRATOR_BONUS = 0.05;

const worksById = new Map(works.map((w) => [w.id, w]));

const themeDocFreq = new Map();
for (const w of works) {
  for (const t of w.themeIds) themeDocFreq.set(t, (themeDocFreq.get(t) ?? 0) + 1);
}
// A tag carried by every work gets idf 0 and drops out of the scoring entirely.
const themeIdf = new Map([...themeDocFreq].map(([t, df]) => [t, Math.log(works.length / df)]));

const themeNorm = new Map(
  works.map((w) => {
    let sumSquares = 0;
    for (const t of w.themeIds) sumSquares += themeIdf.get(t) ** 2;
    return [w.id, Math.sqrt(sumSquares)];
  }),
);

const themeToWorks = new Map();
for (const w of works) {
  for (const t of w.themeIds) {
    if (!themeToWorks.has(t)) themeToWorks.set(t, []);
    themeToWorks.get(t).push(w);
  }
}

function relatedIdsFor(work) {
  // Accumulate the dot product only over works that share at least one tag, rather than
  // scanning all N works for each of N works.
  const dotProducts = new Map();
  for (const t of work.themeIds) {
    const weight = themeIdf.get(t) ** 2;
    if (weight === 0) continue;
    for (const other of themeToWorks.get(t)) {
      if (other.id === work.id) continue;
      dotProducts.set(other.id, (dotProducts.get(other.id) ?? 0) + weight);
    }
  }

  const ownAuthors = new Set(work.authorIds);
  const ownIllustrators = new Set(work.illustratorIds);
  // Same-author works are a strong recommendation even with no tag overlap, so seed them in.
  for (const other of works) {
    if (other.id === work.id || dotProducts.has(other.id)) continue;
    if (other.authorIds.some((id) => ownAuthors.has(id))) dotProducts.set(other.id, 0);
  }

  const ownNorm = themeNorm.get(work.id);
  const scored = [];
  for (const [otherId, dot] of dotProducts) {
    const other = worksById.get(otherId);
    const otherNorm = themeNorm.get(otherId);
    let score = ownNorm > 0 && otherNorm > 0 ? dot / (ownNorm * otherNorm) : 0;
    if (other.authorIds.some((id) => ownAuthors.has(id))) score += SAME_AUTHOR_BONUS;
    if (other.illustratorIds.some((id) => ownIllustrators.has(id))) score += SAME_ILLUSTRATOR_BONUS;
    if (score > 0) scored.push({ id: otherId, score });
  }

  // Tie-break by id so the output (and therefore the prerendered HTML) is stable across builds.
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, RELATED_COUNT).map((s) => s.id);
}

const relatedByWorkId = new Map(works.map((w) => [w.id, relatedIdsFor(w)]));

// ---- generated/works.json ----
const worksGenerated = works.map((w) => ({
  ...w,
  relatedWorkIds: relatedByWorkId.get(w.id),
  authorNames: w.authorIds.map((id) => authorsById.get(id).name),
  illustratorNames: w.illustratorIds.map((id) => illustratorsById.get(id).name),
  publisherName: publishersById.get(w.publisherId).name,
  themeNames: w.themeIds.map((id) => themesById.get(id).name),
  awardSummaries: (w.awardResults ?? []).map((r) => ({
    awardId: r.awardId,
    awardName: awardsById.get(r.awardId).name,
    year: r.year,
    result: r.result,
  })),
  coverUrl: coversCache[w.id]?.coverUrl ?? undefined,
  // 購入リンクを商品ページへ直リンクするために使う(covers-cache が解決したISBN)
  isbn: coversCache[w.id]?.isbn ?? undefined,
  // 楽天ブックスの商品ページURL(購入リンクの直リンク用)
  rakutenItemUrl: coversCache[w.id]?.rakutenItemUrl ?? undefined,
}));

// Cross-reference lists (author/illustrator/publisher/theme pages) embed the full
// denormalized work — same shape as generated/works.json — so those pages can render a full
// WorkCard (cover, publisher, awards, theme tags) instead of just a bare title+year link.
const worksGeneratedById = new Map(worksGenerated.map((w) => [w.id, w]));

function fullWork(w) {
  // Only the work detail page renders related works, and each work is embedded in roughly eight
  // of these cross-reference lists, so keeping relatedWorkIds out of the embedded copies avoids
  // about a megabyte of duplicated ids across generated/.
  const { relatedWorkIds, ...rest } = worksGeneratedById.get(w.id);
  return rest;
}

// ---- generated/{authors,illustrators,publishers}.json ----
function buildPersonList(people, worksByPersonId) {
  return people
    .map((p) => {
      const theirWorks = worksByPersonId.get(p.id) ?? [];
      return {
        id: p.id,
        name: p.name,
        nameKana: p.nameKana,
        description: p.description,
        externalLinks: p.externalLinks,
        workCount: theirWorks.length,
        works: theirWorks.map(fullWork).sort((a, b) => a.firstPublishedYear - b.firstPublishedYear),
      };
    })
    .sort((a, b) => a.nameKana.localeCompare(b.nameKana, "ja"));
}

function groupWorksBy(idsOf) {
  const map = new Map();
  for (const w of works) {
    for (const id of idsOf(w)) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(w);
    }
  }
  return map;
}

const authorsGenerated = buildPersonList(authors, groupWorksBy((w) => w.authorIds));
const illustratorsGenerated = buildPersonList(illustrators, groupWorksBy((w) => w.illustratorIds));
const publishersGenerated = buildPersonList(
  publishers,
  groupWorksBy((w) => [w.publisherId])
);

// ---- generated/themes.json ----
const worksByTheme = groupWorksBy((w) => w.themeIds);
const themesGenerated = themes
  .map((t) => {
    const theirWorks = worksByTheme.get(t.id) ?? [];
    return {
      ...t,
      workCount: theirWorks.length,
      works: theirWorks.map(fullWork).sort((a, b) => a.firstPublishedYear - b.firstPublishedYear),
    };
  })
  .sort((a, b) => b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"));

// ---- generated/recommend-index.json ----
// 「好みからおすすめ」(/recommend)専用の軽量索引。テーマ選択チップとスコア計算に必要な分だけを持つ。
// themes.json は各テーマに全作品をフル展開しているため 24MB あり、テーマ名と件数のためだけに
// 読ませるわけにはいかない。works.json(9MB)も、テーマを選ぶ前から読ませる理由がない。
//
// works は themeIds が空の作品も含めて全件入れる。index.works.length がそのまま IDF の分子 N になり、
// ビルド時のレコメンド(relatedIdsFor)と同じ N を使えるため。
//
// **このファイルの読み手は /recommend だけ。ページを消すならこの生成も消すこと**
// (横断検索を削除したとき、専用の search-index.json が読み手のいないまま残りかけた)。
const recommendIndex = {
  themes: themesGenerated
    .filter((t) => t.workCount > 0)
    .map((t) => ({ id: t.id, name: t.name, workCount: t.workCount })),
  works: works.map((w) => ({ id: w.id, themeIds: w.themeIds })),
};

// ---- generated/awards.json ----
// 受賞歴の result は「2013年版 国内編 第1位」「大賞」「第5位」のような自由文なので、
// 並べ替え用の順位をここで一度だけ取り出す。順位を持たない賞(大賞・特別賞など)は
// 大賞系を先頭、それ以外を末尾に置く。
function rankOf(result) {
  const m = /第\s*(\d+)\s*位/.exec(result ?? "");
  if (m) return Number(m[1]);
  if (/大賞|1位|第一位/.test(result ?? "")) return 0;
  return 900;
}

const winnersByAward = new Map();
for (const w of works) {
  for (const r of w.awardResults ?? []) {
    if (!winnersByAward.has(r.awardId)) winnersByAward.set(r.awardId, []);
    winnersByAward.get(r.awardId).push({ workId: w.id, workTitle: w.title, year: r.year, result: r.result, rank: rankOf(r.result) });
  }
}
const awardsGenerated = awards
  .map((a) => {
    // 年の降順 → 部門(result から順位表記を除いた部分)→ 順位の昇順。
    const section = (r) => (r.result ?? "").replace(/第\s*\d+\s*位.*$/, "").trim();
    const winners = (winnersByAward.get(a.id) ?? []).sort(
      (x, y) =>
        y.year - x.year ||
        section(x).localeCompare(section(y), "ja") ||
        x.rank - y.rank ||
        (x.workTitle ?? x.gameTitle ?? "").localeCompare(y.workTitle ?? y.gameTitle ?? "", "ja"),
    );
    return { ...a, workCount: winners.length, winners };
  })
  // 受賞作の多い賞ほど見たい情報なので件数の降順。同数は名前順で並びを安定させる。
  .sort((a, b) => b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"));

// ---- generated/counts.json ----
const counts = {
  works: works.length,
  authors: authors.length,
  illustrators: illustrators.length,
  publishers: publishers.length,
  themes: themes.length,
  awards: awards.length,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "works.json"), JSON.stringify(worksGenerated), "utf-8");
writeFileSync(path.join(outDir, "authors.json"), JSON.stringify(authorsGenerated), "utf-8");
writeFileSync(path.join(outDir, "illustrators.json"), JSON.stringify(illustratorsGenerated), "utf-8");
writeFileSync(path.join(outDir, "publishers.json"), JSON.stringify(publishersGenerated), "utf-8");
writeFileSync(path.join(outDir, "themes.json"), JSON.stringify(themesGenerated), "utf-8");
writeFileSync(path.join(outDir, "awards.json"), JSON.stringify(awardsGenerated), "utf-8");
writeFileSync(path.join(outDir, "recommend-index.json"), JSON.stringify(recommendIndex), "utf-8");
writeFileSync(path.join(outDir, "counts.json"), JSON.stringify(counts), "utf-8");

console.log(`generate-manifest: wrote ${works.length} works, ${authors.length} authors, ${illustrators.length} illustrators, ${publishers.length} publishers, ${themes.length} themes, ${awards.length} awards`);


// ---- sitemap.xml ----
// Lives at the site root (not data/generated/) so it's served at /ranobe-db/sitemap.xml, but is
// just as deterministically derived from public/data/source/*.json — see the .gitignore note.
const SITE_URL = "https://izenmi.github.io/ranobe-db";
const today = new Date().toISOString().slice(0, 10);

function urlEntry(loc, lastmod) {
  return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${lastmod ?? today}</lastmod>\n  </url>`;
}

const sitemapEntries = [
  urlEntry("/"),
  urlEntry("/works"),
  ...works.map((w) => urlEntry(`/works/${w.id}`, w.updatedAt?.slice(0, 10))),
  urlEntry("/themes"),
  urlEntry("/recommend"),
  ...themes.map((t) => urlEntry(`/themes/${t.id}`)),
  urlEntry("/authors"),
  ...authors.map((a) => urlEntry(`/authors/${a.id}`, a.updatedAt?.slice(0, 10))),
  urlEntry("/illustrators"),
  ...illustrators.map((i) => urlEntry(`/illustrators/${i.id}`, i.updatedAt?.slice(0, 10))),
  urlEntry("/publishers"),
  ...publishers.map((p) => urlEntry(`/publishers/${p.id}`, p.updatedAt?.slice(0, 10))),
  urlEntry("/awards"),
  ...awards.map((a) => urlEntry(`/awards/${a.id}`, a.updatedAt?.slice(0, 10))),
  urlEntry("/about"),
];

const sitemapXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join("\n")}\n</urlset>\n`;

writeFileSync(path.join(rootDir, "public", "sitemap.xml"), sitemapXml, "utf-8");
console.log(`generate-manifest: wrote sitemap.xml with ${sitemapEntries.length} URLs`);
