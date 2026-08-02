import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getTheme } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState, EmptyState } from "../common/Status";
import { WorkCard } from "../common/WorkCard";

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
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const webNovel = params.get("webNovel") ?? "";
  const mediaMix = params.get("mediaMix") ?? "";
  const sort = params.get("sort") ?? "year-desc";

  const filtered = useMemo(() => {
    if (state.status !== "ready" || !state.data) return [];
    return state.data.works.filter((w) => {
      if (status && w.status !== status) return false;
      if (webNovel === "none" && w.webNovelSource) return false;
      if ((webNovel === "narou" || webNovel === "kakuyomu") && w.webNovelSource?.platform !== webNovel) return false;
      if (mediaMix === "anime" && !w.mediaMix?.anime) return false;
      if (mediaMix === "comic" && !w.mediaMix?.comic) return false;
      if (mediaMix === "none" && (w.mediaMix?.anime || w.mediaMix?.comic)) return false;
      return true;
    });
  }, [state, status, webNovel, mediaMix]);

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
    for (const key of ["status", "webNovel", "mediaMix"]) {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const hasActiveFilters = Boolean(status || webNovel || mediaMix);

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
          </div>
          {sorted.length === 0 && <EmptyState />}
          <div className="work-grid">
            {sorted.map((w) => (
              <WorkCard work={w} key={w.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
