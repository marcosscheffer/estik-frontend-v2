import { Navigate, Route, Routes } from "react-router-dom";
import { access } from "@/lib/roles";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestRoute, ProtectedRoute, RoleRoute } from "@/components/layout/RouteGuards";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { TicketsPage } from "@/pages/tickets/TicketsPage";
import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
import { ComputersPage } from "@/pages/computers/ComputersPage";
import { ComputerDetailPage } from "@/pages/computers/ComputerDetailPage";
import { HistoriesPage } from "@/pages/computers/HistoriesPage";
import { FacilitiesPage } from "@/pages/admin/FacilitiesPage";
import { FacilityDetailPage } from "@/pages/admin/FacilityDetailPage";
import { DepartamentsPage } from "@/pages/admin/DepartamentsPage";
import { DepartamentDetailPage } from "@/pages/admin/DepartamentDetailPage";
import { CategoriesPage } from "@/pages/catalog/CategoriesPage";
import { ItemsPage } from "@/pages/catalog/ItemsPage";
import { BalancesPage } from "@/pages/stock/BalancesPage";
import { MovementsPage } from "@/pages/stock/MovementsPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { UserDetailPage } from "@/pages/users/UserDetailPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { MapPage } from "@/pages/map/MapPage";

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route element={<RoleRoute role={access.computers} />}>
            <Route path="map" element={<MapPage />} />
            <Route path="computers" element={<ComputersPage />} />
            <Route path="computers/:id" element={<ComputerDetailPage />} />
            <Route path="histories" element={<HistoriesPage />} />
          </Route>

          <Route element={<RoleRoute role={access.stock} />}>
            <Route path="stock" element={<Navigate to="/stock/balances" replace />} />
            <Route path="stock/balances" element={<BalancesPage />} />
            <Route path="stock/movements" element={<MovementsPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
          </Route>

          <Route element={<RoleRoute role={access.facilities} />}>
            <Route path="facilities" element={<FacilitiesPage />} />
            <Route path="facilities/:id" element={<FacilityDetailPage />} />
            <Route path="departaments" element={<DepartamentsPage />} />
            <Route path="departaments/:id" element={<DepartamentDetailPage />} />
          </Route>

          <Route element={<RoleRoute role={access.users} />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
