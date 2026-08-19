import { motion, AnimatePresence } from "framer-motion";
import type { Lead, Prospect, Tier } from "../types";
import { TIERS } from "../types";
import { googleMapsUrl } from "../lib/places";

type Detail =
  | { kind: "prospect"; item: Prospect; saved: boolean }
  | { kind: "lead"; item: Lead }
  | null;

interface SelectedPanelProps {
  detail: Detail;
  onAdd: (p: Prospect) => void;
  onRemove: (placeId: string) => void;
  onTierChange: (placeId: string, tier: Tier) => void;
  onClose: () => void;
}

export function SelectedPanel({ detail, onAdd, onRemove, onTierChange, onClose }: SelectedPanelProps) {
  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          key={`${detail.kind}:${detail.item.placeId}`}
          className="selected-info glass-panel"
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <button className="close-btn selected-close" onClick={onClose}>
            ✕
          </button>

          <div className="selected-header">
            <div>
              <h3>{detail.item.name}</h3>
              <p className="company">{detail.item.category ?? "Business"}</p>
            </div>
            {detail.kind === "lead" ? (
              <select
                className="tier-select"
                value={detail.item.tier}
                onChange={(e) => onTierChange(detail.item.placeId, e.target.value as Tier)}
                title="Change tier"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`tier-badge tier-${detail.item.suggestedTier.split(" ")[1]}`}>
                {detail.item.suggestedTier}
              </span>
            )}
          </div>

          {detail.item.rating != null && (
            <div className="value">
              ★ {detail.item.rating.toFixed(1)}
              <span className="value-sub">
                {detail.item.ratingCount != null ? ` · ${detail.item.ratingCount} reviews` : ""}
              </span>
            </div>
          )}

          {detail.item.businessStatus && detail.item.businessStatus !== "OPERATIONAL" && (
            <p className="status-warning">{detail.item.businessStatus.replace(/_/g, " ")}</p>
          )}

          {detail.item.address && <p className="detail-line">{detail.item.address}</p>}

          <div className="detail-links">
            {detail.item.phone && (
              <a href={`tel:${detail.item.phone}`} onClick={(e) => e.stopPropagation()}>
                {detail.item.phone}
              </a>
            )}
            {detail.item.website && (
              <a
                href={detail.item.website}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                WEBSITE ↗
              </a>
            )}
            <a
              href={googleMapsUrl(detail.item)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              GOOGLE MAPS ↗
            </a>
          </div>

          <p className="coords">
            LAT {detail.item.lat.toFixed(6)} / LNG {detail.item.lng.toFixed(6)}
          </p>

          {detail.kind === "prospect" ? (
            detail.saved ? (
              <div className="panel-action saved-note">✓ IN LEAD LIST</div>
            ) : (
              <button className="panel-action add-action" onClick={() => onAdd(detail.item)}>
                + ADD TO LEAD LIST
              </button>
            )
          ) : (
            <button
              className="panel-action remove-action"
              onClick={() => onRemove(detail.item.placeId)}
            >
              ✕ REMOVE FROM LEAD LIST
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
