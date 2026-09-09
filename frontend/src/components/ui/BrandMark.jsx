/**
 * IHM-Purchase product mark.
 *
 * The one hand-authored SVG in the app — every other icon comes from
 * lucide-react. A logo is brand identity, not UI iconography, so it does not
 * belong to the icon set's vocabulary or stroke weight.
 *
 * Composition, reading bottom to top:
 *   · two ocean swells        — maritime, the operating environment
 *   · a hull riding them      — the vessel, the unit every PO is tied to
 *   · a mast with three nodes — procurement data converging on that vessel
 *
 * Drawn on a 24×24 grid at 1.75 stroke so it holds up at 18px inside the
 * navbar's 34px mark and scales cleanly to the 52px login hero.
 */
export function BrandMark({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* data network — three nodes converging on the mast */}
      <path d="M12 3.25v7.5" opacity="0.95" />
      <path d="M12 6.4 8.1 4.6M12 6.4l3.9-1.8" opacity="0.55" />
      <circle cx="12" cy="2.9" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="4.35" r="0.95" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="16.5" cy="4.35" r="0.95" fill="currentColor" stroke="none" opacity="0.7" />

      {/* hull */}
      <path d="M4.15 11.6h15.7l-2.2 5.1a2.6 2.6 0 0 1-2.39 1.57H8.74a2.6 2.6 0 0 1-2.39-1.57L4.15 11.6Z" />

      {/* ocean swells */}
      <path d="M2.6 20.9c1.5 0 1.5-1.3 3-1.3s1.5 1.3 3 1.3 1.5-1.3 3-1.3 1.5 1.3 3 1.3 1.5-1.3 3-1.3 1.5 1.3 3 1.3" opacity="0.6" />
    </svg>
  );
}
