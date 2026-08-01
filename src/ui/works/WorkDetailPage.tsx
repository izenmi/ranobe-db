import { Link, useParams } from "react-router-dom";
import { getWork } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState, EmptyState } from "../common/Status";
import { WorkCover, amazonSearchUrl, webNovelSearch } from "../common/WorkCover";

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
          <div className="work-detail__hero">
            <div className="work-detail__hero-cover">
              <WorkCover title={state.data.title} coverUrl={state.data.coverUrl} size="lg" />
              <a className="cover-link" href={amazonSearchUrl(state.data.title, "1巻")} target="_blank" rel="noreferrer">
                1巻をAmazonで探す
              </a>
              <a className="cover-link" href={amazonSearchUrl(state.data.title)} target="_blank" rel="noreferrer">
                シリーズ全体を探す
              </a>
            </div>
            <div className="work-card__body">
              <h1>{state.data.title}</h1>
              <p className="page-subtitle">
                {state.data.authorIds.map((authorId, i) => (
                  <span key={authorId}>
                    {i > 0 && "・"}
                    <Link to={`/authors/${authorId}`}>{state.data!.authorNames[i]}</Link>
                  </span>
                ))}
                {state.data.illustratorIds.length > 0 && (
                  <>
                    (イラスト:{" "}
                    {state.data.illustratorIds.map((illustratorId, i) => (
                      <span key={illustratorId}>
                        {i > 0 && "・"}
                        <Link to={`/illustrators/${illustratorId}`}>{state.data!.illustratorNames[i]}</Link>
                      </span>
                    ))}
                    )
                  </>
                )}
              </p>
              <p className="page-subtitle">
                <Link to={`/publishers/${state.data.publisherId}`}>{state.data.publisherName}</Link>
                {" / "}
                刊行{state.data.firstPublishedYear}年〜{state.data.latestPublishedYear ?? ""}
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
            </div>
          </div>

          <p>{state.data.synopsis}</p>

          <p>
            {state.data.externalLinks.wikipediaUrl && (
              <a href={state.data.externalLinks.wikipediaUrl} target="_blank" rel="noreferrer">
                Wikipediaで見る
              </a>
            )}
            {state.data.webNovelSource &&
              (() => {
                const web = webNovelSearch(state.data!.webNovelSource!.platform, state.data!.title);
                return (
                  <>
                    {state.data!.externalLinks.wikipediaUrl && " / "}
                    <a href={web.url} target="_blank" rel="noreferrer">
                      {web.label}でWeb版を探す
                    </a>
                  </>
                );
              })()}
          </p>

          <p className="source-note">{state.data.sourceNote}</p>
        </>
      )}
    </div>
  );
}
