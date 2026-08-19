import { useState } from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import type { Lead, Prospect, Tier } from "../types";

// Tier-based marker styling — the "Deep Space & Neon" system from the original
// Territory Map: Tier 1 neon green with pulse, Tier 2 electric blue, Tier 3
// slate. Prospects (search hits not yet saved) render amber so a scan's
// results read as a distinct layer over the saved lead list.

const tierStyles: Record<Tier, MarkerStyle> = {
  "Tier 1": {
    background: "#10b981",
    size: 18,
    pulse: true,
    glow: "0 0 12px rgba(16, 185, 129, 0.8), 0 0 24px rgba(16, 185, 129, 0.4)",
    hoverGlow: "0 0 20px rgba(16, 185, 129, 1), 0 0 40px rgba(16, 185, 129, 0.6)",
  },
  "Tier 2": {
    background: "#3b82f6",
    size: 14,
    pulse: false,
    glow: "0 0 8px rgba(59, 130, 246, 0.6)",
    hoverGlow: "0 0 16px rgba(59, 130, 246, 0.9), 0 0 32px rgba(59, 130, 246, 0.5)",
  },
  "Tier 3": {
    background: "#64748b",
    size: 10,
    pulse: false,
    glow: "none",
    hoverGlow: "0 0 8px rgba(100, 116, 139, 0.6)",
  },
};

const prospectStyle: MarkerStyle = {
  background: "#f59e0b",
  size: 14,
  pulse: false,
  glow: "0 0 10px rgba(245, 158, 11, 0.7)",
  hoverGlow: "0 0 18px rgba(245, 158, 11, 1), 0 0 36px rgba(245, 158, 11, 0.5)",
};

interface MarkerStyle {
  background: string;
  size: number;
  pulse: boolean;
  glow: string;
  hoverGlow: string;
}

interface DotMarkerProps {
  lat: number;
  lng: number;
  title: string;
  style: MarkerStyle;
  isSelected: boolean;
  isProspect?: boolean;
  onClick: () => void;
}

function DotMarker({ lat, lng, title, style, isSelected, isProspect, onClick }: DotMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const baseSize = style.size;
  const displaySize = isSelected ? baseSize * 1.3 : isHovered ? baseSize * 1.2 : baseSize;

  return (
    <AdvancedMarker position={{ lat, lng }} onClick={onClick}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={false}
        animate={{
          width: displaySize,
          height: displaySize,
          boxShadow: isSelected || isHovered ? style.hoverGlow : style.glow,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          borderRadius: "50%",
          background: isProspect ? "rgba(245, 158, 11, 0.25)" : style.background,
          border: isSelected
            ? "2px solid rgba(255,255,255,0.9)"
            : isProspect
              ? `2px solid ${style.background}`
              : "1px solid rgba(255,255,255,0.3)",
          cursor: "pointer",
          position: "relative",
        }}
        className={style.pulse ? "marker-pulse" : ""}
        title={title}
      >
        {isSelected && (
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${style.background}`,
            }}
          />
        )}
      </motion.div>
    </AdvancedMarker>
  );
}

export function LeadMarker({
  lead,
  isSelected,
  onClick,
}: {
  lead: Lead;
  isSelected: boolean;
  onClick: (lead: Lead) => void;
}) {
  return (
    <DotMarker
      lat={lead.lat}
      lng={lead.lng}
      title={`${lead.name} — ${lead.tier}`}
      style={tierStyles[lead.tier]}
      isSelected={isSelected}
      onClick={() => onClick(lead)}
    />
  );
}

export function ProspectMarker({
  prospect,
  isSelected,
  onClick,
}: {
  prospect: Prospect;
  isSelected: boolean;
  onClick: (prospect: Prospect) => void;
}) {
  return (
    <DotMarker
      lat={prospect.lat}
      lng={prospect.lng}
      title={`${prospect.name} — prospect`}
      style={prospectStyle}
      isSelected={isSelected}
      isProspect
      onClick={() => onClick(prospect)}
    />
  );
}
