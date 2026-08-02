import type { PersonOrPublisherGenerated } from "../../types";
import { getAuthors, getIllustrators, getPublishers } from "../../data/manifest";
import { useAsyncData } from "./useAsyncData";
import { Loading, ErrorState } from "./Status";
import { EntityList } from "./EntityList";
import { useSeo } from "./useSeo";

export type PersonKind = "author" | "illustrator" | "publisher";

const CONFIG: Record<
  PersonKind,
  { title: string; pathPrefix: string; fetcher: () => Promise<PersonOrPublisherGenerated[]>; descriptionNoun: string }
> = {
  author: { title: "著者一覧", pathPrefix: "/authors", fetcher: getAuthors, descriptionNoun: "著者" },
  illustrator: {
    title: "イラストレーター一覧",
    pathPrefix: "/illustrators",
    fetcher: getIllustrators,
    descriptionNoun: "イラストレーター",
  },
  publisher: {
    title: "出版社(レーベル)一覧",
    pathPrefix: "/publishers",
    fetcher: getPublishers,
    descriptionNoun: "出版社(レーベル)",
  },
};

export function PersonListPage({ kind }: { kind: PersonKind }) {
  const { title, pathPrefix, fetcher, descriptionNoun } = CONFIG[kind];
  const state = useAsyncData(fetcher, [kind]);

  useSeo({
    title,
    description:
      state.status === "ready"
        ? `ライトノベルの${descriptionNoun}${state.data.length}件の一覧。五十音順に探せます。`
        : undefined,
  });

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
