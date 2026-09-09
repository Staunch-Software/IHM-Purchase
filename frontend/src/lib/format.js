/**
 * Shared value formatters.
 *
 * These previously existed as four overlapping implementations (poColumns.js,
 * PODetailSheet.jsx, POLineItemsTable.jsx) that disagreed about what an empty
 * value looks like — "" in the grid, "—" in the detail sheet. That was a
 * user-visible inconsistency, not just duplication.
 *
 * Every function takes an `empty` option so a caller can still choose: the
 * dense grid wants "" (an em dash in 30 columns × 50 rows is visual noise),
 * the detail sheet wants "—" (an empty field there looks like a bug).
 */

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

export function formatDate(value, { empty = "—" } = {}) {
  if (isBlank(value)) return empty;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, DATE_FORMAT);
}

/** Fixed 2 decimals — money and quantities read as columns, not prose. */
export function formatMoney(value, { empty = "—" } = {}) {
  if (isBlank(value)) return empty;
  const n = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatInt(value, { empty = "—" } = {}) {
  if (isBlank(value)) return empty;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString();
}

/** Whole-number currency for headline figures (stat strips). */
export function formatCompactMoney(value, { empty = "—" } = {}) {
  if (isBlank(value)) return empty;
  const n = Number(value);
  if (Number.isNaN(n)) return empty;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatText(value, { empty = "—" } = {}) {
  return isBlank(value) ? empty : String(value);
}

/**
 * Up to two initials from a name, falling back to the email local-part.
 * Was duplicated byte-for-byte in ProfileMenu and UserManagementPage.
 */
export function initialsOf(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
