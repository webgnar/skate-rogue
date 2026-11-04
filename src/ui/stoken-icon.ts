// The Stoken icon: the quantum particle (render/stoken-particle.ts) drawn flat, inked like the rest of the HUD. A
// purple core, three cyan electron orbits round it with an electron on each, and the faint shell they sit in.
// index.html's HUD carries the same drawing inline.
const orbit = (deg: number, ex: number, ey: number) =>
  `<g transform="rotate(${deg} 12 12)"><ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="#000" stroke-width="2.6"/><ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="#8af6ff" stroke-width="1.1"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="#8af6ff" stroke="#000" stroke-width="1.2"/></g>`;

export const STOKEN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="11.2" fill="#c890ff" fill-opacity="0.18" stroke="#c890ff" stroke-opacity="0.7" stroke-width="0.9"/>' +
  orbit(0, 22, 12) +
  orbit(60, 4.3, 14.2) +
  orbit(120, 9, 8.6) +
  '<circle cx="12" cy="12" r="4.3" fill="#d04cff" stroke="#000" stroke-width="1.8"/><circle cx="10.6" cy="10.6" r="1.4" fill="#f4d2ff"/>' +
  '</svg>';
