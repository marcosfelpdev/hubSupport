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
      <div className="min-h-screen bg-[#f8f9fa] flex">
        {/* Barra lateral à esquerda */}
        <Sidebar user={user} />

        {/* Área de conteúdo principal à direita */}
        <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-[#f8f9fa]">
          <TopBar user={user} />
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </ScreenRecordingProvider>
  );
};
