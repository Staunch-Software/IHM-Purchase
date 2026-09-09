import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button.jsx";
import { Stat, StatStrip } from "../../components/ui/StatStrip.jsx";
import { useUsers } from "../../hooks/useUsers.js";
import styles from "./UserManagement.module.css";

/**
 * User Management is the ONLY place in the app with a sidebar. The main
 * purchase-order workspace stays sidebar-free so the grid gets the width.
 *
 * The stat strip lives here rather than in a pane because the counts describe
 * the section, not one view — and both panes call useUsers(), which react-query
 * dedupes by key, so this costs no extra request.
 */
export function UserManagementLayout() {
  const navigate = useNavigate();
  const { data: users } = useUsers();

  const total = users?.length ?? 0;
  const active = users?.filter((u) => u.is_active).length ?? 0;
  const admins = users?.filter((u) => u.role === "admin").length ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingBlock}>
          <Button variant="link" icon={ArrowLeft} onClick={() => navigate("/")} className={styles.backLink}>
            Back to purchase orders
          </Button>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Create accounts, adjust roles, and manage access</p>
        </div>

        {total > 0 && (
          <StatStrip>
            <Stat value={total} label="Total" />
            <Stat value={active} label="Active" />
            <Stat value={admins} label="Admins" tone="accent" />
          </StatStrip>
        )}
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <span className={styles.sidebarTitle}>User Management</span>
          <nav className={styles.sidebarNav} aria-label="User management">
            {/* `end` is required, or /admin/users/new also marks this active */}
            <NavLink
              to="/admin/users"
              end
              className={({ isActive }) => (isActive ? styles.sideLinkActive : styles.sideLink)}
            >
              <Users size={15} strokeWidth={1.75} className={styles.sideIcon} aria-hidden="true" />
              All Users
            </NavLink>
            <NavLink
              to="/admin/users/new"
              className={({ isActive }) => (isActive ? styles.sideLinkActive : styles.sideLink)}
            >
              <UserPlus size={15} strokeWidth={1.75} className={styles.sideIcon} aria-hidden="true" />
              Create User
            </NavLink>
          </nav>
        </aside>

        <section className={styles.paneArea}>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
