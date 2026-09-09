import { Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute, ProtectedRoute } from "./components/auth/ProtectedRoute.jsx";
import { DashboardLayout } from "./routes/DashboardLayout.jsx";
import { LoginPage } from "./routes/LoginPage.jsx";
import { PurchaseOrdersPage } from "./routes/PurchaseOrdersPage.jsx";
import { AllUsersPane } from "./routes/admin/AllUsersPane.jsx";
import { CreateUserPane } from "./routes/admin/CreateUserPane.jsx";
import { UserManagementLayout } from "./routes/admin/UserManagementLayout.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<PurchaseOrdersPage />} />

          {/* AdminRoute renders an <Outlet/>, so it still guards the whole
              subtree — both panes are descendants. */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/users" element={<UserManagementLayout />}>
              <Route index element={<AllUsersPane />} />
              <Route path="new" element={<CreateUserPane />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
