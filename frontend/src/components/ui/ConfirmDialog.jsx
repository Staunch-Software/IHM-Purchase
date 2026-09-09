import { AlertTriangle } from "lucide-react";

import { Button } from "./Button.jsx";
import { Dialog } from "./Dialog.jsx";
import styles from "./ConfirmDialog.module.css";

/**
 * Replaces window.confirm, which is unstyled, unbrandable and blocks the
 * main thread.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className={styles.body}>
        {tone === "danger" && (
          <span className={styles.icon} aria-hidden="true">
            <AlertTriangle size={18} strokeWidth={1.9} />
          </span>
        )}
        <p className={styles.message}>{message}</p>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
