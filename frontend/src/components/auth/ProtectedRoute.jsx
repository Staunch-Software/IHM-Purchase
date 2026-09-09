import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../lib/auth.jsx";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function AdminRoute() {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
