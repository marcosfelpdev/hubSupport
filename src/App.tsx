import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TechnicianPage from "./pages/TechnicianPage";
import EmployeesPage from "./pages/EmployeesPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rota pública de login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rota raiz redirecionando para o dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Rotas protegidas do Dashboard */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            
            <Route
              path="/dashboard/tecnico"
              element={
                <ProtectedRoute allowedRoles={["TECHNICIAN", "ADMIN"]}>
                  <TechnicianPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/funcionarios"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback 404 para rotas desconhecidas */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
