import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";

import authRoutes from "./routes/auth.routes";
import worklogsRoutes from "./routes/worklogs.routes";
import reportsRoutes from "./routes/reports.routes";
import notificationsRoutes from "./routes/notifications.routes";
import employeesRoutes from "./routes/employees.routes";
import tagsRoutes from "./routes/tags.routes";

export const app = express();

// Middlewares essenciais
app.use(
  cors({
    origin: true, // Permite chamadas do client com credenciais
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Servir uploads estáticos públicos (anexos comuns do atendimento)
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rotas da API REST
app.use("/api/auth", authRoutes);
app.use("/api/worklogs", worklogsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/tags", tagsRoutes);

// Servir frontend SPA compilado se existir (Modo Produção ou Build Estática)
const DIST_DIR = path.join(process.cwd(), "dist");
if (!fs.existsSync(DIST_DIR)) {
  // ok
} else {
  app.use(express.static(DIST_DIR));
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Se a rota começar com /api, não serve o index.html
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

// Handler de rotas não encontradas para API
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint de API não encontrado." });
});

// Handler central de erros
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("[ServerError]", err);
  const message = err instanceof Error ? err.message : "Erro interno no servidor.";
  res.status(500).json({ error: message });
});
