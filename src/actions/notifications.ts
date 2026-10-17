"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return { notifications: [], unreadCount: 0 };
    }

    const currentUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return { notifications: [], unreadCount: 0 };
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: currentUser.id,
      },
      include: {
        workLog: {
          select: {
            id: true,
            requester: true,
            clientOrOffice: true,
            technicalAction: true,
            implementation: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: currentUser.id,
        read: false,
      },
    });

    return { notifications, unreadCount };
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false };

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tecnico");
    return { success: true };
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    return { success: false };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) return { success: false };

    const currentUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      select: { id: true },
    });

    if (!currentUser) return { success: false };

    await prisma.notification.updateMany({
      where: {
        userId: currentUser.id,
        read: false,
      },
      data: { read: true },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tecnico");
    return { success: true };
  } catch (error) {
    console.error("Erro ao marcar todas as notificações como lidas:", error);
    return { success: false };
  }
}
