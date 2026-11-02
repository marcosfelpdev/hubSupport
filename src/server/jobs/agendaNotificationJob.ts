import { prisma } from "../../lib/prisma";

export async function checkUpcomingAgendaMeetings(): Promise<void> {
  try {
    const now = new Date();

    // Busca eventos com funcionário atribuído, não finalizados e que ainda não notificaram
    const pendingEvents = await prisma.agendaEvent.findMany({
      where: {
        completed: false,
        notificationSent: false,
        employeeId: {
          not: null,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (pendingEvents.length === 0) return;

    for (const event of pendingEvents) {
      if (!event.employeeId || !event.date || !event.time) continue;

      // Decompõe a data (YYYY-MM-DD) e hora (HH:mm)
      const dateParts = event.date.split("-").map(Number);
      const timeParts = event.time.split(":").map(Number);

      if (dateParts.length !== 3 || timeParts.length < 2) continue;

      const [year, month, day] = dateParts;
      const [hours, minutes] = timeParts;

      const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const diffInMs = eventDateTime.getTime() - now.getTime();
      const diffInMinutes = diffInMs / (1000 * 60);

      // Notifica se faltar 15 minutos ou menos (com tolerância de até 5 minutos após o início)
      if (diffInMinutes <= 15 && diffInMinutes >= -5) {
        // Cria a notificação para o funcionário responsável
        await prisma.notification.create({
          data: {
            userId: event.employeeId,
            title: "Lembrete de Reunião (em 15 min)",
            message: `Você tem a reunião "${event.title}" agendada para às ${event.time}. Prepare-se!`,
            read: false,
          },
        });

        // Marca como notificado no evento para não duplicar
        await prisma.agendaEvent.update({
          where: { id: event.id },
          data: { notificationSent: true },
        });

        console.log(
          `[Agenda Notification] Notificação enviada para ${event.employee?.name} sobre o evento "${event.title}" (${event.time})`
        );
      }
    }
  } catch (err) {
    console.error("[Agenda Notification Job] Erro ao verificar lembretes de agenda:", err);
  }
}

let jobInterval: NodeJS.Timeout | null = null;

export function startAgendaNotificationJob(): void {
  if (jobInterval) return;

  // Executa imediatamente na inicialização
  checkUpcomingAgendaMeetings();

  // Executa a cada 30 segundos
  jobInterval = setInterval(checkUpcomingAgendaMeetings, 30 * 1000);
  console.log("[Agenda Notification Job] Worker de monitoramento de reuniões (15 min) iniciado.");
}

export function stopAgendaNotificationJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log("[Agenda Notification Job] Worker finalizado.");
  }
}
