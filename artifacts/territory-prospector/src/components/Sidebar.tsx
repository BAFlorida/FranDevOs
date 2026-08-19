import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Lead, Prospect, Selection, Tier } from "../types";
import { TIERS } from "../types";
import type { SearchState } from "./TopBar";

type NavMode = "prospects" | "leads";

interface SidebarProps {
  prospects: Prospect[];
  leads: Lead[];
  savedIds: Set<string>;
  selection: Selection;
  searchState: SearchState;
  activeNav: NavMode;
  onNavChange: (mode: NavMode) => void;
  onSelectProspect: (p: Prospect) => void;
  onSelectLead: (l: Lead) => void;
  onAddProspect: (p: Prospect) => void;
  onAddAll: () => void;
  onRemoveLead: (placeId: string) => void;
}

const navItems: { id: NavMode; icon: string; label: string }[] = [
  { id: "prospects", icon: "◎", label: "Prospecting Scan" },
  { id: "leads", icon: "▤", label: "Lead List" },
];

function tierBadgeClass(tier: Tier): string {
  return `tier-badge tier-${tier.split(" ")[1]}`;
}

function RatingLine({ rating, ratingCount }: { rating: number | null; ratingCount: number | null }) {
  if (rating == null) return <span className="lead-coords">NO RATING DATA</span>;
  return (
    <span className="lead-coords">
      ★ {rating.toFixed(1)}
      {ratingCount != null ? ` · ${ratingCount} reviews` : ""}
    </span>
  );
}

export function Sidebar({
  prospects,
  leads,
  savedIds,
  selection,
  searchState,
  activeNav,
  onNavChange,
  onSelectProspect,
  onSelectLead,
  onAddProspect,
  onAddAll,
  onRemoveLead,
}: SidebarProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [leadFilter, setLeadFilter] = useState("");

  const handleNavClick = (id: NavMode) => {
    if (activeNav === id && isPanelOpen) {
      setIsPanelOpen(false);
    } else {
      onNavChange(id);
      setIsPanelOpen(true);
    }
  };

  const tierOrder: Record<Tier, number> = { "Tier 1": 1, "Tier 2": 2, "Tier 3": 3 };
  const filteredLeads = leads
    .filter((l) => tierFilter === "all" || l.tier === tierFilter)
    .filter((l) => {
      const q = leadFilter.trim().toLowerCase();
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || (b.rating ?? 0) - (a.rating ?? 0));

  const unsavedCount = prospects.filter((p) => !savedIds.has(p.placeId)).length;

  return (
    <div className="sidebar">
      <div className="sidebar-rail">
        <div className="sidebar-logo">TP</div>

        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id && isPanelOpen ? "active" : ""}`}
            onClick={() => handleNavClick(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.id === "leads" && leads.length > 0 && (
              <span className="nav-count">{leads.length}</span>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            className="sidebar-panel"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="sidebar-panel-header">
              <h2 className="sidebar-panel-title">
                {activeNav === "prospects" ? "Prospecting Scan" : "Lead List"}
              </h2>
              <button className="close-btn" onClick={() => setIsPanelOpen(false)}>
                ✕
              </button>
            </div>

            {activeNav === "prospects" && (
              <div className="leads-list">
                {searchState.phase === "idle" && (
                  <div className="panel-hint">
                    <div className="panel-hint-icon">◎</div>
                    <p>
                      Scan Google Maps for businesses in your territory — try{" "}
                      <em>"commercial cleaning companies in Fort Worth, TX"</em>. Results land
                      here and on the map; add the ones worth pursuing to your lead list.
                    </p>
                  </div>
                )}

                {searchState.phase === "error" && (
                  <div className="panel-error">
                    <p className="panel-error-title">Scan failed</p>
                    <p>{searchState.message}</p>
                  </div>
                )}

                {(searchState.phase === "ready" || searchState.phase === "loading") && (
                  <>
                    <div className="scan-summary">
                      <div className="status-indicator">
                        <div className="status-dot" />
                        <span className="status-text">
                          {searchState.phase === "loading"
                            ? "SCANNING…"
                            : `${prospects.length} TARGETS FOUND`}
                        </span>
                      </div>
                      {searchState.phase === "ready" && unsavedCount > 0 && (
                        <button className="add-all-btn" onClick={onAddAll}>
                          + ADD ALL ({unsavedCount})
                        </button>
                      )}
                    </div>

                    {searchState.phase === "ready" && prospects.length === 0 && (
                      <div className="panel-hint">
                        <p>
                          No listings matched <em>"{searchState.query}"</em>. Try a broader
                          category or a wider area.
                        </p>
                      </div>
                    )}

                    {prospects.map((p) => {
                      const saved = savedIds.has(p.placeId);
                      return (
                        <motion.div
                          key={p.placeId}
                          className={`lead-card ${
                            selection?.kind === "prospect" && selection.placeId === p.placeId
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => onSelectProspect(p)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="lead-card-header">
                            <div>
                              <div className="lead-name">{p.name}</div>
                              <div className="lead-company">{p.category ?? "Business"}</div>
                            </div>
                            <button
                              className={`add-btn ${saved ? "added" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!saved) onAddProspect(p);
                              }}
                              title={saved ? "Already in lead list" : "Add to lead list"}
                            >
                              {saved ? "✓" : "+"}
                            </button>
                          </div>
                          <div className="lead-meta">
                            <span className={tierBadgeClass(p.suggestedTier)}>
                              {p.suggestedTier}
                            </span>
                            <RatingLine rating={p.rating} ratingCount={p.ratingCount} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {activeNav === "leads" && (
              <div className="leads-list">
                {leads.length === 0 ? (
                  <div className="panel-hint">
                    <div className="panel-hint-icon">▤</div>
                    <p>
                      Your target customer list is empty. Run a prospecting scan and add
                      businesses — they persist in this browser and export to CSV.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="status-indicator" style={{ marginBottom: 12 }}>
                      <div className="status-dot" />
                      <span className="status-text">
                        {filteredLeads.length} OF {leads.length} TARGETS
                      </span>
                    </div>

                    <input
                      type="text"
                      className="search-input list-filter"
                      placeholder="Filter by name, category, address…"
                      value={leadFilter}
                      onChange={(e) => setLeadFilter(e.target.value)}
                    />

                    <div className="tier-filter">
                      <button
                        className={`tier-chip ${tierFilter === "all" ? "active" : ""}`}
                        onClick={() => setTierFilter("all")}
                      >
                        ALL
                      </button>
                      {TIERS.map((t) => (
                        <button
                          key={t}
                          className={`tier-chip ${tierFilter === t ? "active" : ""}`}
                          onClick={() => setTierFilter(t)}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {filteredLeads.map((lead) => (
                      <motion.div
                        key={lead.placeId}
                        className={`lead-card ${
                          selection?.kind === "lead" && selection.placeId === lead.placeId
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => onSelectLead(lead)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="lead-card-header">
                          <div>
                            <div className="lead-name">{lead.name}</div>
                            <div className="lead-company">{lead.category ?? "Business"}</div>
                          </div>
                          <button
                            className="remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLead(lead.placeId);
                            }}
                            title="Remove from lead list"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="lead-meta">
                          <span className={tierBadgeClass(lead.tier)}>{lead.tier}</span>
                          <RatingLine rating={lead.rating} ratingCount={lead.ratingCount} />
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
