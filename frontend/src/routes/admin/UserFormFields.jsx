import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useState } from "react";

import styles from "./UserManagement.module.css";

export const emptyUserForm = {
  email: "",
  full_name: "",
  role: "user",
  is_active: true,
  password: "",
  confirmPassword: "",
};

/**
 * Client-side only. `confirmPassword` is never sent — UserCreate accepts
 * { email, password, full_name, role } and nothing else, so this adds no API
 * surface.
 */
export function validateUserForm(form, isEditing) {
  if (!isEditing && !form.email.trim()) return "Email address is required.";
  if (!form.full_name.trim()) return "Full name is required.";
  if (!isEditing && form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (form.password && form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

function PasswordField({ id, label, value, onChange, required, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.field}>
      <label className={styles.formLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <Lock size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
        <input
          id={id}
          className={`${styles.formInput} ${styles.formInputPassword}`}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.toggleVisibility}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}

export function UserFormFields({ form, setForm, isEditing }) {
  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <>
      {!isEditing && (
        <div className={styles.field}>
          <label className={styles.formLabel} htmlFor="user-email">
            Email Address
          </label>
          <div className={styles.inputWrap}>
            <Mail size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
            <input
              id="user-email"
              className={styles.formInput}
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.formLabel} htmlFor="user-name">
          Full Name
        </label>
        <div className={styles.inputWrap}>
          <User size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
          <input
            id="user-name"
            className={styles.formInput}
            type="text"
            placeholder="Jane Mariner"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.formLabel} htmlFor="user-role">
          Role
        </label>
        <div className={styles.inputWrap}>
          <ShieldCheck size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
          <select
            id="user-role"
            className={styles.formInput}
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          >
            <option value="user">Normal User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {isEditing && (
        <label className={styles.formCheckboxRow}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          Account is active
        </label>
      )}

      <PasswordField
        id="user-password"
        label={isEditing ? "New Password (optional)" : "Password"}
        value={form.password}
        onChange={(v) => set("password", v)}
        required={!isEditing}
        autoComplete="new-password"
      />

      {/* On edit, only shown once the admin actually starts typing a new one */}
      {(!isEditing || form.password) && (
        <PasswordField
          id="user-confirm-password"
          label="Confirm Password"
          value={form.confirmPassword}
          onChange={(v) => set("confirmPassword", v)}
          required={!isEditing}
          autoComplete="new-password"
        />
      )}
    </>
  );
}
