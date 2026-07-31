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
