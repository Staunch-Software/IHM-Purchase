import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton.jsx";
import styles from "./Dialog.module.css";

export function Dialog({ open, onClose, title, children }) {
  // Escape-to-close was missing here (Sheet had it, Dialog didn't) — a modal
  // that only closes via the X or the backdrop feels broken.
  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  // Portaled for the same reason as Sheet: the real scroller is .content, so
  // this is what actually keeps the page behind from scrolling.
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
