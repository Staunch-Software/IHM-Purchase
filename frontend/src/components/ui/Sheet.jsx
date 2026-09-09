import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton.jsx";
import styles from "./Sheet.module.css";

const DURATION = 260;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Right-side slide-over.
 *
 * Two things here are less obvious than they look:
 *
 * 1. PORTAL = SCROLL LOCK. globals.css gives html/body/#root height:100% and
 *    the real scroller is DashboardLayout's .content, so setting
 *    body.style.overflow would be a no-op. Portaled to <body>, this overlay's
 *    ancestor chain contains nothing scrollable, so wheel events have nowhere
 *    to chain — the page behind simply cannot move. It also makes the panel
 *    immune to any future transform/filter on an ancestor, which would
 *    silently break position:fixed.
 *
 * 2. EXIT ANIMATION needs a mounted-but-closing state. `if (!open) return null`
 *    can't animate out, so we hold a phase and only unmount at the end. Motion
 *    is driven by `transition` rather than `animation` so the exit interpolates
 *    from wherever the panel currently is. The timeout is a real fallback, not
 *    belt-and-braces: under prefers-reduced-motion transitions are removed, so
 *    transitionend never fires and the sheet would stick in `exiting`.
 */
export function Sheet({ open, onClose, onExited, width = "wide", labelledBy, children }) {
  const [phase, setPhase] = useState(open ? "open" : "closed");
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // Held in a ref so the phase effect can stay keyed on `open` alone — call
  // sites pass an inline arrow, and a new identity every render would restart
  // the exit timer mid-flight.
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setPhase((p) => (p === "closed" ? "entering" : p));
      // Advance to `open` once the browser has had a chance to paint the
      // start value, so the transition has something to animate from.
      //
      // rAF alone is NOT safe here: it never fires while the page is
      // occluded or backgrounded, which would strand the panel in `entering`
      // (invisible, but mounted and trapping focus) until the tab is looked
      // at again. The timeout is the guarantee; rAF just makes the common
      // case land a frame sooner. Both are idempotent.
      const raf = requestAnimationFrame(() => setPhase("open"));
      const t = setTimeout(() => setPhase("open"), 32);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    setPhase((p) => (p === "closed" ? p : "exiting"));
    const t = setTimeout(() => {
      setPhase("closed");
      onExitedRef.current?.();
    }, DURATION + 40);
    return () => clearTimeout(t);
  }, [open]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(
        (n) => n.offsetParent !== null
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === panelRef.current)
      ) {
        e.preventDefault();
        last.focus();
      }
    },
    [onClose]
  );

  // Focus capture/restore is deliberately kept in its own effect, keyed ONLY
  // on phase. Folding it in with the keydown listener below would tie it to
  // handleKeyDown's identity — which changes whenever the parent re-renders
  // with a fresh onClose — so the cleanup would fire mid-session and snap
  // focus back to the trigger while the sheet was still open.
  useEffect(() => {
    if (phase !== "open") return undefined;
    restoreRef.current = document.activeElement;
    // Focus the panel itself, NOT the close button — focusing "Close" would
    // make Enter dismiss the sheet the user just opened.
    panelRef.current?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return undefined;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleKeyDown]);

  if (phase === "closed") return null;

  return createPortal(
    <div className={`${styles.overlay} ${styles[phase]}`} onClick={onClose}>
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[width]}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({ children, actions, onClose }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>{children}</div>
      {(actions || onClose) && (
        <div className={styles.headerActions}>
          {actions}
          {onClose && (
            <IconButton 
              icon={X} 
              label="Close" 
              onClick={onClose}
              variant="outline"
              style={{
                backgroundColor: "var(--color-danger-subtle, #fee2e2)",
                color: "var(--color-danger, #dc2626)",
                borderColor: "var(--color-danger-subtle, #fca5a5)",
                boxShadow: "var(--shadow-sm)"
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function SheetBody({ children }) {
  return <div className={styles.body}>{children}</div>;
}
