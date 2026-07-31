import type { PersonOrPublisherGenerated } from "../../types";
import { getAuthors, getIllustrators, getPublishers } from "../../data/manifest";
import { useAsyncData } from "./useAsyncData";
import { Loading, ErrorState } from "./Status";
import { EntityList } from "./EntityList";

export type PersonKind = "author" | "illustrator" | "publisher";

const CONFIG: Record<PersonKind, { title: string; pathPrefix: string; fetcher: () => Promise<PersonOrPublisherGenerated[]> }> = {
  author: { title: "著者一覧", pathPrefix: "/authors", fetcher: getAuthors },
  illustrator: { title: "イラストレーター一覧", pathPrefix: "/illustrators", fetcher: getIllustrators },
  publisher: { title: "出版社(レーベル)一覧", pathPrefix: "/publishers", fetcher: getPublishers },
};

export function PersonListPage({ kind }: { kind: PersonKind }) {
  const { title, pathPrefix, fetcher } = CONFIG[kind];
  const state = useAsyncData(fetcher, [kind]);

  return (
    <div className="page">
      <h1>{title}</h1>
      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorState error={state.error} />}
      {state.status === "ready" && (
        <>
          <p className="page-subtitle">{state.data.length}件</p>
          <EntityList items={state.data} pathPrefix={pathPrefix} />
        </>
      )}
    </div>
  );
}
