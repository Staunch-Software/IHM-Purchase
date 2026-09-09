import styles from "./Button.module.css";

/**
 * @param {"primary"|"secondary"|"ghost"|"danger"|"link"} variant
 * @param {"sm"|"md"} size
 * @param {React.ComponentType} icon      lucide component, rendered leading
 * @param {boolean} fullWidth
 * @param {boolean} loading               shows a spinner and blocks re-submit
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const cls = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = size === "sm" ? 13 : 14;

  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {!loading && Icon && <Icon size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
