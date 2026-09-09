import { AlertTriangle, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/auth.jsx";
import { Button } from "../ui/Button.jsx";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return; // guard against double submission
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <span className={styles.eyebrow}>Welcome back</span>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.subtitle}>Enter your details to access the purchase workspace.</p>

      {error && (
        <div className={styles.error} role="alert">
          <AlertTriangle size={15} strokeWidth={1.9} className={styles.errorIcon} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email address
        </label>
        <div className={styles.inputWrap}>
          <Mail size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
          <input
            id="email"
            type="email"
            className={styles.input}
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <div className={styles.inputWrap}>
          <Lock size={15} strokeWidth={1.75} className={styles.inputIcon} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className={`${styles.input} ${styles.inputPassword}`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {/* Absolutely positioned inside the field, with the input reserving
              padding for it — toggling never reflows the value. */}
          <button
            type="button"
            className={styles.toggleVisibility}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff size={15} strokeWidth={1.75} />
            ) : (
              <Eye size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" variant="primary" fullWidth loading={isSubmitting} className={styles.submit}>
        {isSubmitting ? "Signing in…" : "Sign In"}
      </Button>

      <p className={styles.helper}>Trouble signing in? Contact your system administrator.</p>
    </form>
  );
}
