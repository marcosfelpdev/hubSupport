import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ScreenRecordingProvider } from "../contexts/ScreenRecordingContext";

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <ScreenRecordingProvider>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
        {/* Barra lateral à esquerda */}
        <Sidebar user={user} />

        {/* Área de conteúdo principal à direita */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <TopBar user={user} />
          <Outlet />
        </div>
      </div>
    </ScreenRecordingProvider>
  );
};
