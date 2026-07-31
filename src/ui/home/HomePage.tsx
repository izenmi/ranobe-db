import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCounts } from "../../data/manifest";
import { useAsyncData } from "../common/useAsyncData";
import { Loading, ErrorState } from "../common/Status";

const BADGES: { key: keyof Awaited<ReturnType<typeof getCounts>>; label: string; to: string; color: string }[] = [
  { key: "works", label: "作品", to: "/works", color: "blue" },
  { key: "authors", label: "著者", to: "/authors", color: "pink" },
  { key: "illustrators", label: "イラストレーター", to: "/illustrators", color: "mint" },
  { key: "publishers", label: "出版社", to: "/publishers", color: "yellow" },
  { key: "themes", label: "テーマ", to: "/themes", color: "purple" },
  { key: "awards", label: "アワード", to: "/awards", color: "peach" },
];

export function HomePage() {
  const state = useAsyncData(getCounts, []);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/works?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="page">
      <div className="home-hero">
        <h1 className="font-display">らのべDB</h1>
        <p className="page-subtitle">日本語ライトノベルを著者・イラストレーター・受賞歴・テーマから探せるデータベース</p>
      </div>

      <form onSubmit={handleSearch}>
        <input
          className="search-box"
          type="search"
          placeholder="作品名・著者名で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorState error={state.error} />}
      {state.status === "ready" && (
        <div className="count-badges">
          {BADGES.map((badge) => (
            <Link className={`count-badge count-badge--${badge.color}`} to={badge.to} key={badge.key}>
              <span className="count-badge__number">{state.data[badge.key]}</span>
              <span className="count-badge__label">{badge.label}</span>
            </Link>
          ))}
        </div>
      )}

      <p className="source-note">
        本サイトの記述はWikipedia日本語版等の公開情報を参考に独自にまとめたものです。詳しくは
        <Link to="/about">このサイトについて</Link>
        をご覧ください。
      </p>
    </div>
  );
}
