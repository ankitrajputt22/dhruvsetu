import type { MapLocationType } from "@/lib/types";

export const mapTypeLabels: Record<MapLocationType, string> = {
  station: "Research station",
  expedition_location: "Expedition location",
  other: "Other repository location",
};

// Each type has its own shape, so markers do not rely on colour alone.
const shapes: Record<MapLocationType, string> = {
  station:
    '<rect x="5" y="5" width="22" height="22" rx="6" fill="#075985" stroke="#ffffff" stroke-width="2"/>' +
    '<path d="M13 22V10m0 1h7l-2 2.5 2 2.5h-7" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  expedition_location:
    '<circle cx="16" cy="16" r="10" fill="#ffffff" stroke="#075985" stroke-width="3"/>' +
    '<circle cx="16" cy="16" r="4" fill="#075985"/>',
  other:
    '<path d="M16 5 27 16 16 27 5 16Z" fill="#475569" stroke="#ffffff" stroke-width="2"/>',
};

// Fixed SVG markup for a marker. It never contains repository text.
export function markerSvg(type: MapLocationType, selected = false): string {
  const ring = selected
    ? '<circle cx="16" cy="16" r="15" fill="none" stroke="#f59e0b" stroke-width="2"/>'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">${ring}${shapes[type]}</svg>`;
}
