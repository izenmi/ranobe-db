import { getThemes } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState } from "../common/Status";
import { EntityList } from "../common/EntityList";

export function ThemeListPage() {
  const state = useAsyncData(getThemes, []);

  return (
    <div className="page">
      <h1>テーマ</h1>
      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorState error={state.error} />}
      {state.status === "ready" && (
        <>
          <p className="page-subtitle">{state.data.length}件</p>
          <EntityList items={state.data} pathPrefix="/themes" />
        </>
      )}
    </div>
  );
}
