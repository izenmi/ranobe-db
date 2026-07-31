import { Link, useParams } from "react-router-dom";
import { getWork } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState, EmptyState } from "../common/Status";

const STATUS_LABEL: Record<string, string> = {
  completed: "完結",
  ongoing: "刊行中",
  unknown: "不明",
};

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsyncData(() => getWork(id!), [id]);

  return (
    <div className="page">
      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorState error={state.error} />}
      {state.status === "ready" && !state.data && <EmptyState text="見つかりませんでした。" />}
      {state.status === "ready" && state.data && (
        <>
          <h1>{state.data.title}</h1>
          <p className="page-subtitle">
            {state.data.authorNames.join("・")}
            {state.data.illustratorNames.length > 0 && ` / イラスト: ${state.data.illustratorNames.join("・")}`}
          </p>
          <p className="page-subtitle">
            <Link to={`/publishers/${state.data.publisherId}`}>{state.data.publisherName}</Link>
            {" / "}
            {state.data.firstPublishedYear}年〜{state.data.latestPublishedYear ?? ""}
            {" / "}
            {STATUS_LABEL[state.data.status]}
            {state.data.volumeCount != null && ` / 既刊${state.data.volumeCount}巻`}
          </p>

          {state.data.themeNames.length > 0 && (
            <div className="chip-row">
              {state.data.themeIds.map((themeId, i) => (
                <Link className="chip" to={`/themes/${themeId}`} key={themeId}>
                  {state.data!.themeNames[i]}
                </Link>
              ))}
            </div>
          )}

          {state.data.awardSummaries.length > 0 && (
            <div className="chip-row">
              {state.data.awardSummaries.map((a) => (
                <Link className="chip award-chip" to={`/awards/${a.awardId}`} key={`${a.awardId}-${a.year}`}>
                  {a.awardName} {a.result}({a.year})
                </Link>
              ))}
            </div>
          )}

          <p>{state.data.synopsis}</p>

          {state.data.externalLinks.wikipediaUrl && (
            <p>
              <a href={state.data.externalLinks.wikipediaUrl} target="_blank" rel="noreferrer">
                Wikipediaで見る
              </a>
            </p>
          )}

          <p className="source-note">{state.data.sourceNote}</p>
        </>
      )}
    </div>
  );
}
