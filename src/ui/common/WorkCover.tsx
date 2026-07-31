const COVER_COLORS = ["blue", "pink", "mint", "yellow", "peach", "purple"] as const;

function colorFor(title: string): (typeof COVER_COLORS)[number] {
  let sum = 0;
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  return COVER_COLORS[sum % COVER_COLORS.length];
}

/** Generated placeholder "cover" (title on a pastel card) — we deliberately don't source or
 *  host real book cover art, since that's copyrighted illustration work, not a fact. */
export function WorkCover({ title, size = "sm" }: { title: string; size?: "sm" | "lg" }) {
  return (
    <div className={`work-cover work-cover--${size} work-cover--${colorFor(title)}`}>
      <span className="work-cover__title">{title}</span>
    </div>
  );
}

export function amazonSearchUrl(title: string, authorNames: string[]): string {
  const query = [title, authorNames[0]].filter(Boolean).join(" ");
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`;
}

const WEB_NOVEL_SITE: Record<"narou" | "kakuyomu", { label: string; searchUrl: (title: string) => string }> = {
  narou: {
    label: "小説家になろう",
    searchUrl: (title) => `https://yomou.syosetu.com/search.php?word=${encodeURIComponent(title)}`,
  },
  kakuyomu: {
    label: "カクヨム",
    searchUrl: (title) => `https://kakuyomu.jp/search?q=${encodeURIComponent(title)}`,
  },
};

export function webNovelSearch(platform: "narou" | "kakuyomu", title: string) {
  const site = WEB_NOVEL_SITE[platform];
  return { label: site.label, url: site.searchUrl(title) };
}
