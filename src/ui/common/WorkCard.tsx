import { Link } from "react-router-dom";
import type { WorkGenerated, WorkRef } from "../../types";

/** Compact row for a work reference (used inside author/theme/award detail pages). */
export function WorkRefRow({ work }: { work: WorkRef }) {
  return (
    <Link className="work-card" to={`/works/${work.id}`}>
      <div className="work-card__title">{work.title}</div>
      <div className="work-card__meta">{work.firstPublishedYear}年〜</div>
    </Link>
  );
}

/** Fuller card for the main work list page, including author/publisher/theme chips. */
export function WorkCard({ work }: { work: WorkGenerated }) {
  return (
    <Link className="work-card" to={`/works/${work.id}`}>
      <div className="work-card__title">{work.title}</div>
      <div className="work-card__meta">
        {work.authorNames.join("・")} / {work.publisherName} / {work.firstPublishedYear}年〜
      </div>
      {work.themeNames.length > 0 && (
        <div className="chip-row">
          {work.themeNames.map((name) => (
            <span className="chip" key={name}>
              {name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
