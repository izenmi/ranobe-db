import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getTheme, getWorks } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState, EmptyState } from "../common/Status";
import { matchesKeyword, themeOptionsOf } from "../common/useWorkFilter";
import { BASE_PATH, breadcrumbJsonLd, useSeo } from "../common/useSeo";
import { WorkGrid } from "../common/WorkGrid";
import { useCoverView } from "../common/useCoverView";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "completed", label: "完結" },
  { value: "ongoing", label: "刊行中" },
  { value: "unknown", label: "不明" },
];

const WEB_NOVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "narou", label: "小説家になろう発" },
  { value: "kakuyomu", label: "カクヨム発" },
  { value: "none", label: "書き下ろし(Web小説以外)" },
];

const MEDIA_MIX_OPTIONS: { value: string; label: string }[] = [
  { value: "anime", label: "アニメ化" },
  { value: "comic", label: "コミカライズ" },
  { value: "none", label: "メディアミックスなし" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "year-desc", label: "刊行年が新しい順" },
  { value: "year-asc", label: "刊行年が古い順" },
  { value: "kana", label: "五十音順" },
];

export function ThemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsyncData(() => getTheme(id!), [id]);
  const { coverView, toggle } = useCoverView();
  const theme = state.status === "ready" ? state.data : undefined;

  // 作品の実データは works.json 側にあるので id から引き直す(テーマに埋め込むと themes.json が
  // 24MBになり、テーマ名を出すだけのページまで巻き添えになる)。取得済みならキャッシュから返る。
  const worksState = useAsyncData(getWorks, []);
  const themeWorks = useMemo(() => {
    if (!theme || worksState.status !== "ready") return undefined;
    const byId = new Map(worksState.data.map((w) => [w.id, w]));
    return theme.workIds.map((wid) => byId.get(wid)).filter((w) => w !== undefined);
  }, [theme, worksState]);

  useSeo({
    title: theme?.name,
    description: theme
      ? `「${theme.name}」テーマのライトノベル${theme.workCount}作品一覧。${theme.description ?? ""}`.trim()
      : undefined,
    jsonLd: theme
      ? breadcrumbJsonLd([
          { name: "らのべDB", path: BASE_PATH },
          { name: "テーマ一覧", path: `${BASE_PATH}themes` },
          { name: theme.name, path: `${BASE_PATH}themes/${id}` },
        ])
      : undefined,
  });

  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  // このページ自身のテーマは全作品が持っていて絞り込みにならないので選択肢から外す
  const otherTheme = params.get("theme") ?? "";
  const webNovel = params.get("webNovel") ?? "";
  const mediaMix = params.get("mediaMix") ?? "";
  const sort = params.get("sort") ?? "year-desc";

  const themeOptions = useMemo(
    () => themeOptionsOf(themeWorks, id),
    [themeWorks, id],
  );

  const filtered = useMemo(() => {
    if (!themeWorks) return [];
    const keyword = q.trim().toLowerCase();
    return themeWorks.filter((w) => {
      if (!matchesKeyword(w, keyword)) return false;
      if (otherTheme && !w.themeIds.includes(otherTheme)) return false;
      if (status && w.status !== status) return false;
      if (webNovel === "none" && w.webNovelSource) return false;
      if ((webNovel === "narou" || webNovel === "kakuyomu") && w.webNovelSource?.platform !== webNovel) return false;
      if (mediaMix === "anime" && !w.mediaMix?.anime) return false;
      if (mediaMix === "comic" && !w.mediaMix?.comic) return false;
      if (mediaMix === "none" && (w.mediaMix?.anime || w.mediaMix?.comic)) return false;
      return true;
    });
  }, [themeWorks, q, otherTheme, status, webNovel, mediaMix]);

  const sorted = useMemo(() => {
    if (sort === "year-asc") return [...filtered].sort((a, b) => a.firstPublishedYear - b.firstPublishedYear);
    if (sort === "year-desc") return [...filtered].sort((a, b) => b.firstPublishedYear - a.firstPublishedYear);
    if (sort === "kana") return [...filtered].sort((a, b) => a.titleKana.localeCompare(b.titleKana, "ja"));
    return filtered;
  }, [filtered, sort]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ["q", "theme", "status", "webNovel", "mediaMix"]) {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const hasActiveFilters = Boolean(q || otherTheme || status || webNovel || mediaMix);

  return (
    <div className="page">
      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorState error={state.error} />}
      {state.status === "ready" && !state.data && <EmptyState text="見つかりませんでした。" />}
      {state.status === "ready" && state.data && (
        <>
          <h1>{state.data.name}</h1>
          <p className="page-subtitle">{state.data.workCount}作品</p>
          {state.data.description && <p>{state.data.description}</p>}
          <div className="filter-row">
            <input
              type="search"
              value={q}
              placeholder="タイトル・作者で絞り込み"
              aria-label="タイトル・作者で絞り込み"
              onChange={(e) => updateParam("q", e.target.value)}
            />
            {themeOptions.length > 0 && (
              <select value={otherTheme} onChange={(e) => updateParam("theme", e.target.value)}>
                <option value="">他のテーマで絞り込み</option>
                {themeOptions.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <select value={status} onChange={(e) => updateParam("status", e.target.value)}>
              <option value="">完結状況で絞り込み</option>
              {STATUS_OPTIONS.map((s) => (
                <option value={s.value} key={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select value={webNovel} onChange={(e) => updateParam("webNovel", e.target.value)}>
              <option value="">Web小説原作で絞り込み</option>
              {WEB_NOVEL_OPTIONS.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={mediaMix} onChange={(e) => updateParam("mediaMix", e.target.value)}>
              <option value="">メディアミックスで絞り込み</option>
              {MEDIA_MIX_OPTIONS.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => updateParam("sort", e.target.value === "year-desc" ? "" : e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                フィルターをクリア
              </button>
            )}
            {toggle}
          </div>
          {sorted.length === 0 && <EmptyState />}
          <WorkGrid works={sorted} coverView={coverView} />
        </>
      )}
    </div>
  );
}
