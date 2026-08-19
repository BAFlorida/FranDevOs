import { useState } from "react";
import type { FormEvent } from "react";

export type SearchState =
  | { phase: "idle" }
  | { phase: "loading"; query: string }
  | { phase: "ready"; query: string; count: number }
  | { phase: "error"; query: string; message: string };

interface TopBarProps {
  searchState: SearchState;
  searchReady: boolean; // Places library loaded
  leadCount: number;
  onSearch: (query: string) => void;
  onExport: () => void;
}

export function TopBar({ searchState, searchReady, leadCount, onSearch, onExport }: TopBarProps) {
  const [query, setQuery] = useState("");
  const searching = searchState.phase === "loading";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 2 && !searching) onSearch(q);
  };

  return (
    <div className="top-bar glass-panel">
      <form className="search-container" onSubmit={handleSubmit}>
        <span className="search-icon">⌕</span>
        <input
          type="text"
          className="search-input"
          placeholder='Scan Google Maps — try "roofing companies in Dallas, TX"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!searchReady}
          aria-label="Search Google Maps for businesses"
        />
        <button
          type="submit"
          className="scan-btn"
          disabled={!searchReady || searching || query.trim().length < 2}
        >
          {searching ? "SCANNING…" : "SCAN"}
        </button>
      </form>

      <div
        className={`status-indicator ${
          searchState.phase === "error" ? "status-error" : ""
        }`}
      >
        <div className="status-dot" />
        <span className="status-text">
          {searchState.phase === "error"
            ? "SCAN FAILED"
            : searching
              ? "SCANNING"
              : searchReady
                ? "GOOGLE LINK ONLINE"
                : "LINKING…"}
        </span>
      </div>

      <button
        className="export-btn"
        onClick={onExport}
        disabled={leadCount === 0}
        title="Download the lead list as CSV"
      >
        ⇩ EXPORT CSV{leadCount > 0 ? ` (${leadCount})` : ""}
      </button>
    </div>
  );
}
