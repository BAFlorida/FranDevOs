import { useCallback, useEffect, useMemo, useState } from "react";
import { APIProvider, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { TerritoryMap } from "./components/TerritoryMap";
import { Sidebar } from "./components/Sidebar";
import { TopBar, type SearchState } from "./components/TopBar";
import { SelectedPanel } from "./components/SelectedPanel";
import { searchPlaces } from "./lib/places";
import { loadLeads, saveLeads } from "./lib/storage";
import { downloadLeadsCsv } from "./lib/csv";
import { prospectToLead, type Lead, type Prospect, type Selection, type Tier } from "./types";
import "./index.css";

// Shown when no browser key is configured — the tool can't render a map or
// scan Places without one.
function SetupScreen() {
  return (
    <div className="app-container">
      <div className="setup-screen">
        <div className="setup-card glass-panel">
          <div className="sidebar-logo" style={{ margin: "0 auto 20px" }}>
            TP
          </div>
          <h2>Territory Prospector</h2>
          <p className="setup-lede">
            Google Maps powered prospecting — scan business listings and build a target
            customer list.
          </p>
          <div className="setup-steps">
            <p>
              <span className="step-num">1</span> Create a browser API key in the Google Cloud
              console with <strong>Maps JavaScript API</strong> and{" "}
              <strong>Places API (New)</strong> enabled.
            </p>
            <p>
              <span className="step-num">2</span> Copy <code>.env.example</code> to{" "}
              <code>.env</code> and set <code>VITE_GOOGLE_MAPS_API_KEY</code>.
            </p>
            <p>
              <span className="step-num">3</span> Restart the dev server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectorApp() {
  const map = useMap();
  const placesLib = useMapsLibrary("places");

  const [leads, setLeads] = useState<Lead[]>(() => loadLeads());
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({ phase: "idle" });
  const [selection, setSelection] = useState<Selection>(null);
  const [activeNav, setActiveNav] = useState<"prospects" | "leads">("prospects");

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  const savedIds = useMemo(() => new Set(leads.map((l) => l.placeId)), [leads]);
  const lastQuery = searchState.phase === "idle" ? null : searchState.query;

  const handleSearch = useCallback(
    async (query: string) => {
      if (!placesLib) return;
      setSearchState({ phase: "loading", query });
      setActiveNav("prospects");
      try {
        // Bias toward the current viewport so "plumbers" scans the territory
        // on screen; explicit locations in the query still win.
        const results = await searchPlaces(placesLib, query, map?.getBounds() ?? null);
        setProspects(results);
        setSelection(null);
        setSearchState({ phase: "ready", query, count: results.length });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Google Places rejected the request. Check the key's API access.";
        setSearchState({ phase: "error", query, message });
      }
    },
    [placesLib, map],
  );

  const addLead = useCallback(
    (p: Prospect) => {
      setLeads((prev) =>
        prev.some((l) => l.placeId === p.placeId) ? prev : [...prev, prospectToLead(p, lastQuery)],
      );
    },
    [lastQuery],
  );

  const addAll = useCallback(() => {
    setLeads((prev) => {
      const existing = new Set(prev.map((l) => l.placeId));
      const fresh = prospects
        .filter((p) => !existing.has(p.placeId))
        .map((p) => prospectToLead(p, lastQuery));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [prospects, lastQuery]);

  const removeLead = useCallback((placeId: string) => {
    setLeads((prev) => prev.filter((l) => l.placeId !== placeId));
    setSelection((sel) => (sel?.kind === "lead" && sel.placeId === placeId ? null : sel));
  }, []);

  const changeTier = useCallback((placeId: string, tier: Tier) => {
    setLeads((prev) => prev.map((l) => (l.placeId === placeId ? { ...l, tier } : l)));
  }, []);

  // Prospect markers only for results not already saved (saved ones render as
  // tier-colored lead markers instead).
  const unsavedProspects = useMemo(
    () => prospects.filter((p) => !savedIds.has(p.placeId)),
    [prospects, savedIds],
  );

  const detail = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "lead") {
      const item = leads.find((l) => l.placeId === selection.placeId);
      return item ? ({ kind: "lead", item } as const) : null;
    }
    const item = prospects.find((p) => p.placeId === selection.placeId);
    return item
      ? ({ kind: "prospect", item, saved: savedIds.has(item.placeId) } as const)
      : null;
  }, [selection, leads, prospects, savedIds]);

  return (
    <div className="app-container">
      <div className="map-layer">
        <TerritoryMap
          leads={leads}
          prospects={unsavedProspects}
          selection={selection}
          onSelectLead={(l) => setSelection({ kind: "lead", placeId: l.placeId })}
          onSelectProspect={(p) => setSelection({ kind: "prospect", placeId: p.placeId })}
        />
      </div>

      <div className="ui-layer">
        <Sidebar
          prospects={prospects}
          leads={leads}
          savedIds={savedIds}
          selection={selection}
          searchState={searchState}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onSelectProspect={(p) => setSelection({ kind: "prospect", placeId: p.placeId })}
          onSelectLead={(l) => setSelection({ kind: "lead", placeId: l.placeId })}
          onAddProspect={addLead}
          onAddAll={addAll}
          onRemoveLead={removeLead}
        />

        <TopBar
          searchState={searchState}
          searchReady={placesLib != null}
          leadCount={leads.length}
          onSearch={handleSearch}
          onExport={() => downloadLeadsCsv(leads)}
        />

        <SelectedPanel
          detail={detail}
          onAdd={(p) => {
            addLead(p);
            setSelection({ kind: "lead", placeId: p.placeId });
          }}
          onRemove={removeLead}
          onTierChange={changeTier}
          onClose={() => setSelection(null)}
        />
      </div>
    </div>
  );
}

function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) return <SetupScreen />;

  return (
    <APIProvider apiKey={apiKey}>
      <ProspectorApp />
    </APIProvider>
  );
}

export default App;
