import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  getSocketBaseUrl,
  getToken,
  type PhoneCardBatteryEvent,
  type PhoneCardItem,
  type PhoneCommandFeedback,
  type PhoneDeviceStatusEvent,
} from "../services/api";

export type PhoneSocketConnectionState =
  | "connecting"
  | "connected"
  | "disconnected";

export interface UsePhoneFinderSocketHandlers {
  enabled?: boolean;
  onDeviceStatus?: (event: PhoneDeviceStatusEvent) => void;
  onCardBattery?: (event: PhoneCardBatteryEvent) => void;
  onLocateFeedback?: (event: PhoneCommandFeedback) => void;
  onVibrateFeedback?: (event: PhoneCommandFeedback) => void;
  onCardCreated?: (card: PhoneCardItem) => void;
  onCardUpdated?: (card: PhoneCardItem) => void;
  onCardDeleted?: (payload: { cardId: string }) => void;
  onReconnect?: () => void;
}

export function usePhoneFinderSocket(
  handlers: UsePhoneFinderSocketHandlers = {}
): { connectionState: PhoneSocketConnectionState } {
  const enabled = handlers.enabled ?? true;
  const [connectionState, setConnectionState] =
    useState<PhoneSocketConnectionState>(
      enabled ? "connecting" : "disconnected"
    );

  const handlersRef = useRef<UsePhoneFinderSocketHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");
    let hasConnectedBefore = false;

    const socket: Socket = io(`${getSocketBaseUrl()}/panel`, {
      auth: (cb) => cb({ token: getToken() }),
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    const handleConnect = () => {
      setConnectionState("connected");
      if (hasConnectedBefore) {
        handlersRef.current.onReconnect?.();
      } else {
        hasConnectedBefore = true;
      }
    };

    const handleDisconnect = () => {
      setConnectionState("disconnected");
    };

    const handleConnectError = () => {
      setConnectionState("disconnected");
    };

    const handleReconnectAttempt = () => {
      setConnectionState("connecting");
    };

    const handleDeviceStatus = (event: PhoneDeviceStatusEvent) => {
      handlersRef.current.onDeviceStatus?.(event);
    };

    const handleCardBattery = (event: PhoneCardBatteryEvent) => {
      handlersRef.current.onCardBattery?.(event);
    };

    const handleLocateFeedback = (event: PhoneCommandFeedback) => {
      handlersRef.current.onLocateFeedback?.(event);
    };

    const handleVibrateFeedback = (event: PhoneCommandFeedback) => {
      handlersRef.current.onVibrateFeedback?.(event);
    };

    const handleCardCreated = (card: PhoneCardItem) => {
      handlersRef.current.onCardCreated?.(card);
    };

    const handleCardUpdated = (card: PhoneCardItem) => {
      handlersRef.current.onCardUpdated?.(card);
    };

    const handleCardDeleted = (payload: { cardId: string }) => {
      handlersRef.current.onCardDeleted?.(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("device:status", handleDeviceStatus);
    socket.on("card:battery", handleCardBattery);
    socket.on("locate:feedback", handleLocateFeedback);
    socket.on("vibrate:feedback", handleVibrateFeedback);
    socket.on("card:created", handleCardCreated);
    socket.on("card:updated", handleCardUpdated);
    socket.on("card:deleted", handleCardDeleted);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("device:status", handleDeviceStatus);
      socket.off("card:battery", handleCardBattery);
      socket.off("locate:feedback", handleLocateFeedback);
      socket.off("vibrate:feedback", handleVibrateFeedback);
      socket.off("card:created", handleCardCreated);
      socket.off("card:updated", handleCardUpdated);
      socket.off("card:deleted", handleCardDeleted);
      socket.disconnect();
    };
  }, [enabled]);

  return { connectionState };
}
