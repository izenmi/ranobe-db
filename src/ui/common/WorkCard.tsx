import { Link, useNavigate } from "react-router-dom";
import type { WorkGenerated } from "../../types";
import { WorkCover } from "./WorkCover";

const STATUS_LABEL: Record<string, string> = {
  completed: "完結",
  ongoing: "刊行中",
  unknown: "不明",
};

function authorLine(work: WorkGenerated): string {
  const authors = work.authorNames.join("・");
  if (work.illustratorNames.length === 0) return authors;
  return `${authors}(${work.illustratorNames.join("・")})`;
}

function mediaMixLabel(work: WorkGenerated): string | null {
  const parts = [];
  if (work.mediaMix?.anime) parts.push("アニメ化");
  if (work.mediaMix?.comic) parts.push("コミカライズ");
  return parts.length > 0 ? parts.join("・") : null;
}

/** Fuller card for the main work list page: cover thumbnail on the left, and a right-hand
 *  column (title/author/publisher/awards + clickable theme tags). The whole card navigates to the
 *  work page on click (including the empty space below the tags), so it's a div rather than an
 *  <a> — nesting the theme tags' own <Link>s inside an outer <a> isn't valid HTML. Theme tag
 *  clicks stop propagation so they go to the theme page instead of the work page. */
export function WorkCard({ work }: { work: WorkGenerated }) {
  const navigate = useNavigate();
  const goToWork = () => navigate(`/works/${work.id}`);

  return (
    <div
      className="work-card"
      role="link"
      tabIndex={0}
      onClick={goToWork}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToWork();
        }
      }}
    >
      <WorkCover title={work.title} coverUrl={work.coverUrl} size="sm" />
      <div className="work-card__content">
        <div className="work-card__title">{work.title}</div>
        <div className="work-card__meta">
          {authorLine(work)} / {work.publisherName} / {work.firstPublishedYear}年〜 / {STATUS_LABEL[work.status]}
          {mediaMixLabel(work) && ` / ${mediaMixLabel(work)}`}
        </div>
        {work.awardSummaries.length > 0 && (
          <div className="work-card__awards">
            {work.awardSummaries.slice(0, 2).map((a) => (
              <span className="chip award-chip" key={`${a.awardId}-${a.year}`}>
                {a.awardName} {a.result}
              </span>
            ))}
          </div>
        )}
        {work.themeIds.length > 0 && (
          <div className="chip-row">
            {work.themeIds.map((themeId, i) => (
              <Link className="chip" to={`/themes/${themeId}`} key={themeId} onClick={(e) => e.stopPropagation()}>
                {work.themeNames[i]}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
