import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HubSupport — Log de Atendimentos",
  description:
    "Sistema de registro e rastreamento de atendimentos diários para equipes de suporte.",
  keywords: ["suporte", "atendimento", "log", "equipe"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen bg-gray-950`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
