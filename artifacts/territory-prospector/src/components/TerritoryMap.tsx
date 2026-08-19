import { useEffect } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { LeadMarker, ProspectMarker } from "./markers";
import type { Lead, Prospect, Selection } from "../types";

interface TerritoryMapProps {
  leads: Lead[];
  prospects: Prospect[]; // current search results not yet saved
  selection: Selection;
  onSelectLead: (lead: Lead) => void;
  onSelectProspect: (prospect: Prospect) => void;
}

const DALLAS = { lat: 32.7767, lng: -96.797 };

// Pans to the current selection and frames fresh search results.
function MapController({
  selection,
  leads,
  prospects,
}: {
  selection: Selection;
  leads: Lead[];
  prospects: Prospect[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selection) return;
    const target =
      selection.kind === "lead"
        ? leads.find((l) => l.placeId === selection.placeId)
        : prospects.find((p) => p.placeId === selection.placeId);
    if (target) map.panTo({ lat: target.lat, lng: target.lng });
  }, [map, selection, leads, prospects]);

  // Fit the viewport to a new batch of search results.
  useEffect(() => {
    if (!map || prospects.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of prospects) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 96);
  }, [map, prospects]);

  return null;
}

export function TerritoryMap({
  leads,
  prospects,
  selection,
  onSelectLead,
  onSelectProspect,
}: TerritoryMapProps) {
  // Advanced markers need a map id; DEMO_MAP_ID is Google's documented
  // development fallback when no Cloud-styled map id is configured.
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

  return (
    <div className="territory-map">
      <Map
        defaultCenter={DALLAS}
        defaultZoom={11}
        mapId={mapId}
        colorScheme="DARK"
        disableDefaultUI={true}
        zoomControl={true}
        clickableIcons={false}
        gestureHandling="greedy"
      >
        <MapController selection={selection} leads={leads} prospects={prospects} />
        {prospects.map((p) => (
          <ProspectMarker
            key={p.placeId}
            prospect={p}
            isSelected={selection?.kind === "prospect" && selection.placeId === p.placeId}
            onClick={onSelectProspect}
          />
        ))}
        {leads.map((l) => (
          <LeadMarker
            key={l.placeId}
            lead={l}
            isSelected={selection?.kind === "lead" && selection.placeId === l.placeId}
            onClick={onSelectLead}
          />
        ))}
      </Map>
    </div>
  );
}
