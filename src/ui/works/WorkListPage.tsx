import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { getPublishers, getThemes, getWorks } from "../../data/manifest";
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

const PAGE_SIZE = 50;

export function WorkListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const themeId = params.get("theme") ?? "";
  const publisherId = params.get("publisher") ?? "";
  const status = params.get("status") ?? "";
  const webNovel = params.get("webNovel") ?? "";
  const pageParam = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const worksState = useAsyncData(getWorks, []);
  const themesState = useAsyncData(getThemes, []);
  const publishersState = useAsyncData(getPublishers, []);

  const filtered = useMemo(() => {
    if (worksState.status !== "ready") return [];
    const keyword = q.trim().toLowerCase();
    return worksState.data.filter((w) => {
      if (keyword) {
        const haystack = `${w.title}${w.titleKana}${w.authorNames.join("")}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (themeId && !w.themeIds.includes(themeId)) return false;
      if (publisherId && w.publisherId !== publisherId) return false;
      if (status && w.status !== status) return false;
      if (webNovel === "none" && w.webNovelSource) return false;
      if ((webNovel === "narou" || webNovel === "kakuyomu") && w.webNovelSource?.platform !== webNovel) return false;
      return true;
    });
  }, [worksState, q, themeId, publisherId, status, webNovel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageParam, totalPages);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next, { replace: true });
    window.scrollTo(0, 0);
  }

  return (
    <div className="page">
      <h1>作品一覧</h1>
      <input
        className="search-box"
        type="search"
        placeholder="作品名・著者名で検索"
        value={q}
        onChange={(e) => updateParam("q", e.target.value)}
      />
      <div className="filter-row">
        {themesState.status === "ready" && (
          <select value={themeId} onChange={(e) => updateParam("theme", e.target.value)}>
            <option value="">テーマで絞り込み</option>
            {themesState.data.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {publishersState.status === "ready" && (
          <select value={publisherId} onChange={(e) => updateParam("publisher", e.target.value)}>
            <option value="">レーベルで絞り込み</option>
            {publishersState.data.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
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
      </div>

      {worksState.status === "loading" && <Loading />}
      {worksState.status === "error" && <ErrorState error={worksState.error} />}
      {worksState.status === "ready" && (
        <>
          <p className="page-subtitle">
            {filtered.length}件{totalPages > 1 && `(${page} / ${totalPages}ページ)`}
          </p>
          {filtered.length === 0 && <EmptyState />}
          <div className="work-grid">
            {pageItems.map((w) => (
              <WorkCard work={w} key={w.id} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pager">
              <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                前へ
              </button>
              <span className="pager__label">
                {page} / {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
