import "dotenv/config";
import { app } from "./app";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`[HubSupport Backend] Servidor Express ativo em http://localhost:${PORT}`);
  console.log(`[HubSupport Backend] Health check disponível em http://localhost:${PORT}/api/health`);
});

// Encerramento limpo em sinais de interrupção
process.on("SIGTERM", () => {
  console.log("[HubSupport Backend] Recebido SIGTERM, encerrando servidor...");
  server.close(() => {
    console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[HubSupport Backend] Recebido SIGINT, encerrando servidor...");
  server.close(() => {
    console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
    process.exit(0);
  });
});
