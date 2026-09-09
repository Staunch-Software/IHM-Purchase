import { useEffect } from "react";

/**
 * Close a floating surface on outside pointer-down or Escape.
 *
 * Deliberately a hook and not a <Popover> component: the three call sites
 * (profile dropdown, column menu, filter popover) share dismissal but not
 * positioning — one is right-aligned under a trigger, one is a right-aligned
 * panel, one is an arrow-anchored card inside a scroll container. Extracting
 * the shared half and leaving positioning local avoids pulling in a
 * positioning engine we don't need yet.
 *
 * @param {boolean}  open   Only listens while true.
 * @param {Function} onClose
 * @param {Array<React.RefObject>} refs  Clicks inside any of these are "inside".
 */
export function useDismiss(open, onClose, refs) {
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e) {
      const inside = refs.some((ref) => ref.current?.contains(e.target));
      if (!inside) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
    // `refs` is a fresh array literal at every call site, so spread its
    // contents rather than the array itself — otherwise this re-subscribes
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, ...refs]);
}
