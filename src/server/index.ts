import "dotenv/config";
import http from "node:http";
import { app } from "./app";
import { startAgendaNotificationJob, stopAgendaNotificationJob } from "./jobs/agendaNotificationJob";
import { phoneFinderRuntime } from "./phoneFinder";
import { attachPhoneFinderSocketServer } from "./phoneFinder/socketServer";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// Suporte a uploads extensos (até 1GB) com timeout expandido para 15 minutos
server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 16 * 60 * 1000;

const io = attachPhoneFinderSocketServer(server, phoneFinderRuntime);

server.listen(PORT, () => {
  console.log(`[HubSupport Backend] Servidor Express + Socket.IO ativo em http://localhost:${PORT}`);
  console.log(`[HubSupport Backend] Health check disponível em http://localhost:${PORT}/api/health`);
  // Inicia worker de monitoramento e lembretes da agenda (15 min antes)
  startAgendaNotificationJob();
});

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`[HubSupport Backend] Recebido ${signal}, encerrando servidor...`);
  stopAgendaNotificationJob();
  phoneFinderRuntime.stop();
  io.close(() => {
    if (server.listening) {
      server.close(() => {
        console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
        process.exit(0);
      });
    } else {
      console.log("[HubSupport Backend] Servidor finalizado com sucesso.");
      process.exit(0);
    }
  });
}

// Encerramento limpo em sinais de interrupção
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
