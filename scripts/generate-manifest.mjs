// Reads public/data/source/*.json (hand-authored) and writes public/data/generated/*.json:
// denormalized, name-resolved data ready for direct rendering, plus reference-integrity
// checks so a typo'd id fails the build instead of silently rendering blank names.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

// ---- generated/works.json ----
const worksGenerated = works.map((w) => ({
  ...w,
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
}));

// Cross-reference lists (author/illustrator/publisher/theme pages) embed the full
// denormalized work — same shape as generated/works.json — so those pages can render a full
// WorkCard (cover, publisher, awards, theme tags) instead of just a bare title+year link.
const worksGeneratedById = new Map(worksGenerated.map((w) => [w.id, w]));

function fullWork(w) {
  return worksGeneratedById.get(w.id);
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

// ---- generated/awards.json ----
const winnersByAward = new Map();
for (const w of works) {
  for (const r of w.awardResults ?? []) {
    if (!winnersByAward.has(r.awardId)) winnersByAward.set(r.awardId, []);
    winnersByAward.get(r.awardId).push({ workId: w.id, workTitle: w.title, year: r.year, result: r.result });
  }
}
const awardsGenerated = awards
  .map((a) => {
    const winners = (winnersByAward.get(a.id) ?? []).sort((x, y) => y.year - x.year);
    return { ...a, workCount: winners.length, winners };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "ja"));

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
writeFileSync(path.join(outDir, "counts.json"), JSON.stringify(counts), "utf-8");

console.log(`generate-manifest: wrote ${works.length} works, ${authors.length} authors, ${illustrators.length} illustrators, ${publishers.length} publishers, ${themes.length} themes, ${awards.length} awards`);
