import styles from "./IconButton.module.css";

/**
 * Square, icon-only button. `label` is REQUIRED — an icon-only control with no
 * accessible name is invisible to screen readers, and it doubles as the
 * native tooltip.
 */
export function IconButton({
  icon: Icon,
  label,
  size = "md",
  variant = "ghost",
  active = false,
  className = "",
  type = "button",
  ...rest
}) {
  if (import.meta.env.DEV && !label) {
    // eslint-disable-next-line no-console
    console.error("IconButton: `label` is required (accessible name + tooltip).");
  }

  const cls = [styles.base, styles[size], styles[variant], active ? styles.active : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      <Icon size={size === "sm" ? 14 : 16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
