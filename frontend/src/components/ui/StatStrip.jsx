import { Children } from "react";

import styles from "./StatStrip.module.css";

/**
 * Compact metric strip. Dividers are inserted automatically so call sites
 * don't hand-place them (the previous duplicated markup did, in two pages,
 * inconsistently).
 *
 * Deliberately small: this is an enterprise data workspace, not a dashboard —
 * these are a supporting readout beside the page title, not hero cards.
 */
export function StatStrip({ children, className = "" }) {
  const items = Children.toArray(children);
  return (
    <div className={`${styles.strip} ${className}`}>
      {items.map((child, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className={styles.cell}>
          {i > 0 && <span className={styles.divider} aria-hidden="true" />}
          {child}
        </div>
      ))}
    </div>
  );
}

export function Stat({ value, label, tone }) {
  return (
    <div className={styles.stat}>
      <span className={tone ? `${styles.value} ${styles[tone]}` : styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
