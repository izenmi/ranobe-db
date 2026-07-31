import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { getPublishers, getThemes, getWorks } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState, EmptyState } from "../common/Status";
import { WorkCard } from "../common/WorkCard";

export function WorkListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const themeId = params.get("theme") ?? "";
  const publisherId = params.get("publisher") ?? "";

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
      return true;
    });
  }, [worksState, q, themeId, publisherId]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
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
      </div>

      {worksState.status === "loading" && <Loading />}
      {worksState.status === "error" && <ErrorState error={worksState.error} />}
      {worksState.status === "ready" && (
        <>
          <p className="page-subtitle">{filtered.length}件</p>
          {filtered.length === 0 && <EmptyState />}
          {filtered.map((w) => (
            <WorkCard work={w} key={w.id} />
          ))}
        </>
      )}
    </div>
  );
}
