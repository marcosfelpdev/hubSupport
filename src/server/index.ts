import "dotenv/config";
import { app } from "./app";
import { startAgendaNotificationJob, stopAgendaNotificationJob } from "./jobs/agendaNotificationJob";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`[HubSupport Backend] Servidor Express ativo em http://localhost:${PORT}`);
  console.log(`[HubSupport Backend] Health check disponível em http://localhost:${PORT}/api/health`);
  // Inicia worker de monitoramento e lembretes da agenda (15 min antes)
  startAgendaNotificationJob();
});

// Encerramento limpo em sinais de interrupção
process.on("SIGTERM", () => {
  console.log("[HubSupport Backend] Recebido SIGTERM, encerrando servidor...");
  stopAgendaNotificationJob();
  server.close(() => {
    console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[HubSupport Backend] Recebido SIGINT, encerrando servidor...");
  stopAgendaNotificationJob();
  server.close(() => {
    console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
    process.exit(0);
  });
});
