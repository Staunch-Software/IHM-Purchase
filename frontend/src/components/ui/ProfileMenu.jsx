import { ChevronDown, LogOut, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useDismiss } from "../../hooks/useDismiss.js";
import { useAuth } from "../../lib/auth.jsx";
import { Avatar } from "./Avatar.jsx";
import { Badge } from "./Badge.jsx";
import styles from "./ProfileMenu.module.css";

export function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useDismiss(open, () => setOpen(false), [containerRef]);

  if (!user) return null;

  function goTo(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={open ? styles.triggerOpen : styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <Avatar name={user.full_name} email={user.email} size="sm" />
        <span className={styles.triggerText}>
          <span className={styles.triggerName}>{user.full_name}</span>
          <span className={styles.triggerRole}>{isAdmin ? "Administrator" : "User"}</span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.9}
          className={open ? styles.chevronOpen : styles.chevron}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.card} role="menu">
          <div className={styles.cardHeader}>
            <Avatar name={user.full_name} email={user.email} size="lg" />
            <div className={styles.cardIdentity}>
              <span className={styles.cardName}>{user.full_name}</span>
              <span className={styles.cardEmail}>{user.email}</span>
            </div>
          </div>

          <div className={styles.cardMeta}>
            <Badge tone={isAdmin ? "brand" : "neutral"} size="sm">
              {isAdmin ? "Administrator" : "Normal user"}
            </Badge>
          </div>

          <div className={styles.cardBody}>
            {isAdmin && (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => goTo("/admin/users")}
                role="menuitem"
              >
                <Users size={16} strokeWidth={1.75} className={styles.menuIcon} aria-hidden="true" />
                User Management
              </button>
            )}

            <button type="button" className={styles.menuItemDanger} onClick={logout} role="menuitem">
              <LogOut size={16} strokeWidth={1.75} className={styles.menuIcon} aria-hidden="true" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
