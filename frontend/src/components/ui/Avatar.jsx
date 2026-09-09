import { initialsOf } from "../../lib/format.js";
import styles from "./Avatar.module.css";

/**
 * Initials avatar. Computes its own initials so no call site has to carry a
 * copy of initialsOf — it previously lived, byte-identical, in two components.
 */
export function Avatar({ name, email, size = "md", className = "" }) {
  return (
    <span className={`${styles.base} ${styles[size]} ${className}`} aria-hidden="true">
      {initialsOf(name, email)}
    </span>
  );
}
