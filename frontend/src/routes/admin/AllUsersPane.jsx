import { Ban, Pencil, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "../../components/ui/Avatar.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { useDeleteUser, useUpdateUser, useUsers } from "../../hooks/useUsers.js";
import { formatDate } from "../../lib/format.js";
import styles from "./UserManagement.module.css";
import { UserFormFields, validateUserForm } from "./UserFormFields.jsx";

export function AllUsersPane() {
  const navigate = useNavigate();
  const { data: users, isLoading, isError } = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  function openEditDialog(user) {
    setEditingUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      password: "",
      confirmPassword: "",
    });
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validateUserForm(form, true);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    try {
      const payload = { full_name: form.full_name, role: form.role, is_active: form.is_active };
      if (form.password) payload.password = form.password;
      await updateUser.mutateAsync({ id: editingUser.id, ...payload });
      setEditingUser(null);
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  }

  async function confirmDelete() {
    try {
      await deleteUser.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setPendingDelete(null);
    }
  }

  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <div>
          <h2 className={styles.paneTitle}>All Users</h2>
          <p className={styles.paneSubtitle}>Everyone with access to IHM-Purchase</p>
        </div>
        <Button variant="primary" icon={UserPlus} onClick={() => navigate("/admin/users/new")}>
          Create User
        </Button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th className={styles.actionsHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  Loading users…
                </td>
              </tr>
            )}

            {isError && !isLoading && (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  <span className={styles.emptyTitle}>Couldn’t load users</span>
                  <span className={styles.emptyText}>Check your connection and try again.</span>
                </td>
              </tr>
            )}

            {!isLoading && !isError && users?.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  <Users size={22} strokeWidth={1.5} className={styles.emptyIcon} aria-hidden="true" />
                  <span className={styles.emptyTitle}>No users yet</span>
                  <span className={styles.emptyText}>Create the first account to get started.</span>
                </td>
              </tr>
            )}

            {users?.map((user) => (
              <tr key={user.id} className={user.is_active ? undefined : styles.inactiveRow}>
                <td>
                  <div className={styles.userCell}>
                    <Avatar name={user.full_name} email={user.email} size="md" />
                    <div className={styles.userText}>
                      <span className={styles.userName}>{user.full_name}</span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={user.role === "admin" ? "brand" : "neutral"} size="sm">
                    {user.role === "admin" ? "Administrator" : "Normal user"}
                  </Badge>
                </td>
                <td>
                  <Badge tone={user.is_active ? "success" : "neutral"} size="sm" dot>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className={styles.dateCell}>{formatDate(user.created_at)}</td>
                <td>
                  <div className={styles.actionsCell}>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEditDialog(user)}>
                      Edit
                    </Button>
                    {user.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Ban}
                        className={styles.dangerAction}
                        onClick={() => setPendingDelete(user)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingUser} onClose={() => setEditingUser(null)} title="Edit user">
        {form && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.formError} role="alert">
                {error}
              </div>
            )}
            <UserFormFields form={form} setForm={setForm} isEditing />
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={updateUser.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Deactivate user"
        message={`Deactivate ${pendingDelete?.email}? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        loading={deleteUser.isPending}
      />
    </div>
  );
}
