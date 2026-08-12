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

/** Denormalized work: source fields plus resolved names for direct rendering.
 *  あらすじ・出典メモ・updatedAt は含まない — 作品詳細ページでしか使わないのに works.json の
 *  3分の1を占めていたので work-texts.json に分けてある(WorkTexts / getWorkTexts)。 */
export interface WorkGenerated extends Omit<WorkSource, "synopsis" | "sourceNote" | "updatedAt"> {
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
  /** 刊行年の古い順。実データは works.json 側にあり、表示側で id から引き直す
   *  (作品を埋め込むと同じ作品が平均8つのリストに重複して入り、生成JSONが数十MBになる)。 */
  workIds: string[];
}

export interface ThemeGenerated extends ThemeSource {
  workCount: number;
  /** 刊行年の古い順。works.json から引き直す(PersonOrPublisherGenerated.workIds と同じ理由)。 */
  workIds: string[];
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

/** 作品詳細ページだけが読む長文(generated/work-texts.json)。キーは作品id。 */
export type WorkTexts = Record<string, { synopsis: string; sourceNote: string }>;

/** 「好みからおすすめ」(/recommend)専用の軽量索引(generated/recommend-index.json)。
 *  テーマ選択チップとスコア計算にだけ使う。themes.json は各テーマに全作品を埋め込んでいて24MBあり、
 *  works.json も9MBあるので、テーマを選ぶ前からそれらを読ませないためにこの索引がある。 */
export interface RecommendIndex {
  /** 件数の多い順。workCount が 0 のテーマは入っていない。 */
  themes: { id: string; name: string; workCount: number }[];
  /** テーマが付いていない作品も含めた全作品。works.length と件数が一致する(IDFの分子になる)。 */
  works: { id: string; themeIds: string[] }[];
}

export interface Counts {
  works: number;
  authors: number;
  illustrators: number;
  publishers: number;
  themes: number;
  awards: number;
}
