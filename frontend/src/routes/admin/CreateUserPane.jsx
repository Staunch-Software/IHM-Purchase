import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button.jsx";
import { useCreateUser } from "../../hooks/useUsers.js";
import styles from "./UserManagement.module.css";
import { UserFormFields, emptyUserForm, validateUserForm } from "./UserFormFields.jsx";

export function CreateUserPane() {
  const navigate = useNavigate();
  const createUser = useCreateUser();
  const [form, setForm] = useState(emptyUserForm);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validateUserForm(form, false);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    try {
      // confirmPassword is intentionally not sent — UserCreate takes only
      // these four fields.
      await createUser.mutateAsync({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
      });
      navigate("/admin/users");
    } catch (err) {
      setError(err.message || "Could not create the user.");
    }
  }

  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <div>
          <h2 className={styles.paneTitle}>Create User</h2>
          <p className={styles.paneSubtitle}>Create a new user account</p>
        </div>
      </div>

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {error && (
            <div className={styles.formError} role="alert">
              <AlertTriangle size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <UserFormFields form={form} setForm={setForm} isEditing={false} />

          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => navigate("/admin/users")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createUser.isPending}>
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
