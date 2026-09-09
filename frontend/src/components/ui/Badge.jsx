import styles from "./Badge.module.css";

/**
 * The single place badge colour is defined. Previously the same pill existed
 * in four stylesheets with four slightly different palettes.
 *
 * @param {"neutral"|"brand"|"success"|"warning"|"danger"|"info"} tone
 */
export function Badge({ tone = "neutral", size = "md", dot = false, className = "", children }) {
  const cls = [styles.base, styles[tone], styles[size], className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Maps a free-text PO status onto a tone. The scraper yields values like
 * "Finally Approved" / "Cancelled", so this matches on stems rather than an
 * enum — there is no status enum on the backend to switch on.
 */
export function toneForStatus(status) {
  if (!status) return "neutral";
  const s = String(status).toLowerCase();
  if (s.includes("approv")) return "success";
  if (s.includes("cancel") || s.includes("reject")) return "danger";
  if (s.includes("pend") || s.includes("partial")) return "warning";
  if (s.includes("process") || s.includes("sent") || s.includes("complet")) return "info";
  return "neutral";
}
