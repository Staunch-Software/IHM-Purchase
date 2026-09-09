import { Check, Package, Ship, BarChart3 } from "lucide-react";

import { LoginForm } from "../components/auth/LoginForm.jsx";
import { BrandMark } from "../components/ui/BrandMark.jsx";
import styles from "./LoginPage.module.css";

const HIGHLIGHTS = [
  {
    label: "Fleet-wide visibility",
    detail: "Every purchase order across every vessel in one unified place",
  },
  {
    label: "Always current",
    detail: "Automatically synced each day — no manual refresh needed",
  },
  {
    label: "Line-item depth",
    detail: "Drill into any order down to individual items and amounts",
  },
];

const STATS = [
  { value: "100%", label: "Vessel coverage" },
  { value: "Real-time", label: "PO sync" },
  { value: "1 view", label: "Full fleet" },
];

export function LoginPage() {
  return (
    <div className={styles.page}>
      {/* ── Left: Hero / Brand panel ─────────────────────────────────── */}
      <aside className={styles.brandPanel}>
        {/* Background layers */}
        <div className={styles.heroImage} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGlow2} aria-hidden="true" />

        {/* Content */}
        <div className={styles.brandContent}>
          {/* ── Project Name / Logo Row ── */}
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>
              <BrandMark size={32} />
            </span>
            <span className={styles.logoWordGroup}>
              <span className={styles.logoWordTag}>Fleet Procurement</span>
              <span className={styles.logoWord}>IHM-Purchase</span>
            </span>
          </div>

          {/* ── Headline ── */}
          <h1 className={styles.headline}>
            Every purchase order,{" "}
            <span className={styles.headlineAccent}>in one clear place.</span>
          </h1>

          <p className={styles.subhead}>
            A unified view of fleet procurement — organised for fast review
            and confident decisions across your entire vessel portfolio.
          </p>

          <hr className={styles.divider} />

          {/* ── Feature highlights ── */}
          <ul className={styles.highlights}>
            {HIGHLIGHTS.map((item) => (
              <li key={item.label} className={styles.highlight}>
                <span className={styles.highlightCheck} aria-hidden="true">
                  <Check size={12} strokeWidth={2.75} />
                </span>
                <div>
                  <span className={styles.highlightLabel}>{item.label}</span>
                  <span className={styles.highlightDetail}>{item.detail}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* ── Stats strip ── */}
          <div className={styles.statsRow}>
            {STATS.map((s) => (
              <div key={s.label} className={styles.statItem}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className={styles.brandFooter}>Fleet procurement workspace</p>
      </aside>

      {/* ── Right: Sign-in form ─────────────────────────────────────────── */}
      <main className={styles.formPanel}>
        <div className={styles.formInner}>
          {/* Mobile-only brand — the hero panel is hidden below 900 px */}
          <div className={styles.mobileBrand}>
            <span className={styles.logoMarkMobile}>
              <BrandMark size={22} />
            </span>
            <span className={styles.mobileBrandName}>IHM-Purchase</span>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
