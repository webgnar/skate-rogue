// The Stoken icon: the quantum particle (render/stoken-particle.ts) drawn flat, inked like the rest of the HUD. A
// purple core with a flame in it, three cyan electron orbits round it with an electron on each, and the faint shell they sit in.
// index.html's HUD carries the same drawing inline.
const orbit = (deg: number, ex: number, ey: number) =>
  `<g transform="rotate(${deg} 12 12)"><ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="#000" stroke-width="2.6"/><ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="#8af6ff" stroke-width="1.1"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="#8af6ff" stroke="#000" stroke-width="1.2"/></g>`;

export const STOKEN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="11.2" fill="#c890ff" fill-opacity="0.18" stroke="#c890ff" stroke-opacity="0.7" stroke-width="0.9"/>' +
  orbit(0, 22, 12) +
  orbit(60, 4.3, 14.2) +
  orbit(120, 9, 8.6) +
  '<circle cx="12" cy="12" r="5" fill="#6a1fb0" stroke="#000" stroke-width="1.6"/>' +
  '<path d="M12 7.9c1.9 1.9 3 3.4 3 5a3 3 0 0 1-6 0c0-1.1.6-2 1.3-2.7.1 1 .5 1.6 1.1 1.8-.3-1.5.1-2.9.6-4.1z" fill="#ff5a1c"/>' +
  '<path d="M12 11c.9 1 1.5 1.8 1.5 2.6a1.5 1.5 0 0 1-3 0c0-.9.7-1.6 1.5-2.6z" fill="#ffd23a"/>' +
  '</svg>';
