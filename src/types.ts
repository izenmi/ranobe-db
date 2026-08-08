// ---- source data (public/data/source/*.json, hand-authored, committed) ----

export interface ExternalLinks {
  wikipediaUrl?: string;
  officialUrl?: string;
}

export interface AwardResult {
  awardId: string;
  year: number;
  result: string; // free text: "大賞" / "金賞" / "銀賞" / "読者賞" など
}

export type WorkStatus = "completed" | "ongoing" | "unknown";

export type WebNovelPlatform = "narou" | "kakuyomu";

export interface WorkSource {
  id: string;
  title: string;
  titleKana: string;
  authorIds: string[];
  illustratorIds: string[];
  publisherId: string;
  themeIds: string[];
  firstPublishedYear: number;
  latestPublishedYear?: number;
  status: WorkStatus;
  volumeCount?: number;
  synopsis: string;
  awardResults?: AwardResult[];
  /** Set when the work originated as a web novel on 小説家になろう or カクヨム before being
   *  published in print. We link to a site search rather than a specific story URL since we
   *  don't have verified per-work story IDs. */
  webNovelSource?: { platform: WebNovelPlatform };
  /** 姉妹サイト まんがDB の同一原作コミック作品ページへの相互リンク。
   *  manga-db の scripts/link-sister-works.mjs が3リポジトリ分まとめて書き込む(手動実行)。 */
  relatedComicUrl?: string;
  /** Media mix status (TV anime / manga adaptation), verified against the work's Wikipedia
   *  article. `true`/`false` are both written explicitly once confirmed either way. */
  mediaMix?: { anime?: boolean; comic?: boolean };
  externalLinks: ExternalLinks;
  sourceNote: string;
  updatedAt: string;
}

export interface AuthorSource {
  id: string;
  name: string;
  nameKana: string;
  description: string;
  birthYear?: number;
  externalLinks: ExternalLinks;
  sourceNote: string;
  updatedAt: string;
}

export type IllustratorSource = AuthorSource;

export interface PublisherSource {
  id: string;
  name: string;
  nameKana: string;
  parentCompany?: string;
  description: string;
  foundedYear?: number;
  externalLinks: ExternalLinks;
  sourceNote: string;
  updatedAt: string;
}

export interface ThemeSource {
  id: string;
  name: string;
  description?: string;
}

export interface AwardSource {
  id: string;
  name: string;
  organizer: string;
  description: string;
  firstYear?: number;
  externalLinks: ExternalLinks;
  sourceNote: string;
  updatedAt: string;
}

// ---- generated data (public/data/generated/*.json, built by scripts/generate-manifest.mjs) ----

/** Denormalized work: source fields plus resolved names for direct rendering. */
export interface WorkGenerated extends WorkSource {
  authorNames: string[];
  illustratorNames: string[];
  publisherName: string;
  themeNames: string[];
  awardSummaries: { awardId: string; awardName: string; year: number; result: string }[];
  /** Resolved at build time from public/data/source/covers-cache.json (see scripts/fetch-covers.mjs).
   *  Absent when no ISBN/cover could be matched — callers must fall back to the placeholder cover. */
  coverUrl?: string;
  /** covers-cache が解決したISBN。購入リンクの商品ページ直リンクに使う。 */
  isbn?: string;
  /** 楽天ブックスの商品ページURL。購入リンクをここへ直リンクする。 */
  rakutenItemUrl?: string;
  /** Ids of similar works, best first, computed at build time by generate-manifest.mjs.
   *  Only present in generated/works.json — the copies embedded in the author/illustrator/
   *  publisher/theme lists omit it to keep those files small. */
  relatedWorkIds?: string[];
}

/** Shared shape for authors/illustrators/publishers list+detail pages. */
export interface PersonOrPublisherGenerated {
  id: string;
  name: string;
  nameKana: string;
  description: string;
  externalLinks: ExternalLinks;
  workCount: number;
  works: WorkGenerated[];
}

export interface ThemeGenerated extends ThemeSource {
  workCount: number;
  works: WorkGenerated[];
}

export interface AwardWinner {
  workId: string;
  workTitle: string;
  year: number;
  result: string;
  /** 並べ替え用に result から取り出した順位。順位表記がないものは大賞系=0 / その他=900。 */
  rank: number;
}

export interface AwardGenerated extends AwardSource {
  workCount: number;
  winners: AwardWinner[];
}

export interface Counts {
  works: number;
  authors: number;
  illustrators: number;
  publishers: number;
  themes: number;
  awards: number;
}
