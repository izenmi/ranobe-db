import { useParams } from "react-router-dom";
import { getAuthor, getIllustrator, getPublisher } from "../../data/manifest";
import { useAsyncData } from "./useAsyncData";
import { Loading, ErrorState, EmptyState } from "./Status";
import { WorkRefRow } from "./WorkCard";
import type { PersonKind } from "./PersonListPage";

const FETCHER: Record<PersonKind, (id: string) => ReturnType<typeof getAuthor>> = {
  author: getAuthor,
  illustrator: getIllustrator,
  publisher: getPublisher,
};

export function PersonDetailPage({ kind }: { kind: PersonKind }) {
  const { id } = useParams<{ id: string }>();
  const state = useAsyncData(() => FETCHER[kind](id!), [kind, id]);

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
          {state.data.externalLinks.wikipediaUrl && (
            <p>
              <a href={state.data.externalLinks.wikipediaUrl} target="_blank" rel="noreferrer">
                Wikipediaで見る
              </a>
            </p>
          )}
          {state.data.works.map((w) => (
            <WorkRefRow work={w} key={w.id} />
          ))}
        </>
      )}
    </div>
  );
}
