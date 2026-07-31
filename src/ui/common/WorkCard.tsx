import { Link } from "react-router-dom";
import type { WorkGenerated, WorkRef } from "../../types";
import { WorkCover } from "./WorkCover";

/** Compact row for a work reference (used inside author/theme/award detail pages). */
export function WorkRefRow({ work }: { work: WorkRef }) {
  return (
    <div className="work-card">
      <Link className="work-card__link" to={`/works/${work.id}`}>
        <WorkCover title={work.title} size="sm" />
        <div className="work-card__body">
          <div className="work-card__title">{work.title}</div>
          <div className="work-card__meta">{work.firstPublishedYear}年〜</div>
        </div>
      </Link>
    </div>
  );
}

function authorLine(work: WorkGenerated): string {
  const authors = work.authorNames.join("・");
  if (work.illustratorNames.length === 0) return authors;
  return `${authors}(${work.illustratorNames.join("・")})`;
}

/** Fuller card for the main work list page: cover thumbnail, author(illustrator), publisher,
 *  award badges, and clickable theme tags (kept outside the title Link to avoid nesting <a>). */
export function WorkCard({ work }: { work: WorkGenerated }) {
  return (
    <div className="work-card">
      <Link className="work-card__link" to={`/works/${work.id}`}>
        <WorkCover title={work.title} size="sm" />
        <div className="work-card__body">
          <div className="work-card__title">{work.title}</div>
          <div className="work-card__meta">
            {authorLine(work)} / {work.publisherName} / {work.firstPublishedYear}年〜
          </div>
          {work.awardSummaries.length > 0 && (
            <div className="work-card__awards">
              {work.awardSummaries.map((a) => (
                <span className="chip award-chip" key={`${a.awardId}-${a.year}`}>
                  {a.awardName} {a.result}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
      {work.themeIds.length > 0 && (
        <div className="chip-row">
          {work.themeIds.map((themeId, i) => (
            <Link className="chip" to={`/themes/${themeId}`} key={themeId}>
              {work.themeNames[i]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
