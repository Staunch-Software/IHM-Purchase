import { ClipboardList } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { BrandMark } from "../components/ui/BrandMark.jsx";
import { ProfileMenu } from "../components/ui/ProfileMenu.jsx";
import styles from "./DashboardLayout.module.css";

/**
 * The authenticated shell: ONE premium navbar, no sidebar. Every vertical
 * pixel the topbar doesn't take is a row the data grid can show.
 */
export function DashboardLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        {/* ── Brand ── */}
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <BrandMark size={22} />
          </span>
          <span className={styles.brandTextGroup}>
            <span className={styles.brandTag}>Fleet Procurement</span>
            <span className={styles.brandName}>IHM-Purchase</span>
          </span>
        </div>

        <span className={styles.brandDivider} aria-hidden="true" />

        {/* ── Navigation ── */}
        <nav className={styles.nav} aria-label="Main">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? styles.navLinkActive : styles.navLink
            }
          >
            <ClipboardList size={15} strokeWidth={1.75} className={styles.navIcon} />
            Purchase Orders
          </NavLink>
        </nav>

        {/* ── Profile ── */}
        <ProfileMenu />
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

