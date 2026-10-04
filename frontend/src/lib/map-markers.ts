import type { MapLocationType } from "@/lib/types";

export const mapTypeLabels: Record<MapLocationType, string> = {
  station: "Research station",
  expedition_location: "Expedition location",
  other: "Other repository location",
};

// Each type has its own shape, so markers do not rely on colour alone:
// a filled circle with a flag, an open ring, and a diamond.
const shapes: Record<MapLocationType, string> = {
  station:
    '<circle cx="16" cy="16" r="11" fill="#075985" stroke="#ffffff" stroke-width="2"/>' +
    '<path d="M13.5 22V10.5m0 .5h6l-1.8 2.3 1.8 2.2h-6" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  expedition_location:
    '<circle cx="16" cy="16" r="10" fill="#ffffff" stroke="#075985" stroke-width="3"/>' +
    '<circle cx="16" cy="16" r="3.5" fill="#075985"/>',
  other:
    '<path d="M16 5 27 16 16 27 5 16Z" fill="#475569" stroke="#ffffff" stroke-width="2"/>',
};

// Fixed SVG markup for a marker. It never contains repository text.
export function markerSvg(type: MapLocationType, selected = false): string {
  // The selected marker is drawn larger by the globe and gets a dark outline.
  const ring = selected
    ? '<circle cx="16" cy="16" r="14.5" fill="none" stroke="#062f4f" stroke-width="2"/>'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">${ring}${shapes[type]}</svg>`;
}
