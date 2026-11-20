import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Unlink,
  WifiOff,
  X,
} from "lucide-react";
import {
  api,
  type PhoneCardBatteryEvent,
  type PhoneCardItem,
  type PhoneCommandFeedback,
  type PhoneDeviceStatusEvent,
  type PhonePairingCodeResponse,
  type PhonePresenceStatus,
} from "../services/api";
import { usePhoneFinderSocket } from "../hooks/usePhoneFinderSocket";
import PhoneCardFormModal from "../components/phoneFinder/PhoneCardFormModal";
import PairingCodeModal from "../components/phoneFinder/PairingCodeModal";
import AppDownloadModal from "../components/phoneFinder/AppDownloadModal";
import PhoneCardTile, {
  type PhoneDispatchAction,
} from "../components/phoneFinder/PhoneCardTile";

type StatusFilter = "all" | PhonePresenceStatus;

const FEEDBACK_AUTO_CLEAR_MS = 8000;

export default function PhoneFinderPage() {
  const [cards, setCards] = useState<PhoneCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filtros e busca
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Banner de sucesso global
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  // Modal de download do App Android (QR Code)
  const [appDownloadOpen, setAppDownloadOpen] = useState(false);

  // Modal de criar/editar card
  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PhoneCardItem | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal de pareamento
  const [pairingCardId, setPairingCardId] = useState<string | null>(null);
  const [pairingData, setPairingData] =
    useState<PhonePairingCodeResponse | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairedJustNow, setPairedJustNow] = useState(false);
  const pairingCardIdRef = useRef<string | null>(null);
  const pairingBaselineDeviceIdRef = useRef<string | null>(null);
  pairingCardIdRef.current = pairingCardId;

  // Modais de confirmação (desvincular e excluir)
  const [unpairTarget, setUnpairTarget] = useState<PhoneCardItem | null>(null);
  const [unpairLoading, setUnpairLoading] = useState(false);
  const [unpairError, setUnpairError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PhoneCardItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Estado por card de disparo e feedback inline
  const [dispatchingByCard, setDispatchingByCard] = useState<
    Record<string, PhoneDispatchAction>
  >({});
  const [feedbackByCard, setFeedbackByCard] = useState<
    Record<string, PhoneCommandFeedback>
  >({});
  const feedbackTimersRef = useRef<Record<string, number>>({});

  const showSuccessBanner = useCallback((msg: string) => {
    setSuccessMessage(msg);
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimerRef.current = null;
    }, 3500);
  }, []);

  const setCardFeedback = useCallback(
    (cardId: string, feedback: PhoneCommandFeedback) => {
      setFeedbackByCard((prev) => ({ ...prev, [cardId]: feedback }));

      if (feedbackTimersRef.current[cardId]) {
        window.clearTimeout(feedbackTimersRef.current[cardId]);
      }

      feedbackTimersRef.current[cardId] = window.setTimeout(() => {
        setFeedbackByCard((prev) => {
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
        delete feedbackTimersRef.current[cardId];
      }, FEEDBACK_AUTO_CLEAR_MS);
    },
    []
  );

  // Limpa todos os timers ao desmontar
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
      Object.values(feedbackTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  // Fechamento por ESC dos modais de confirmação
  useEffect(() => {
    if (!unpairTarget && !deleteTarget) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (unpairTarget && !unpairLoading) {
        setUnpairTarget(null);
        setUnpairError(null);
      }
      if (deleteTarget && !deleteLoading) {
        setDeleteTarget(null);
        setDeleteError(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [unpairTarget, unpairLoading, deleteTarget, deleteLoading]);

  const fetchCards = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setPageError(null);
      }
      const data = await api.phoneFinder.getCards();
      setCards(Array.isArray(data) ? data : []);
      if (silent) {
        setPageError(null);
      }
    } catch (err) {
      console.error("[PhoneFinderPage] Erro ao carregar cards:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao carregar dispositivos do Phone Finder.";
      if (!silent) {
        setPageError(message);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCards(false);
  }, [fetchCards]);

  // Handlers de eventos Socket.IO em tempo real
  const handleDeviceStatus = useCallback((event: PhoneDeviceStatusEvent) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== event.cardId) return card;
        return {
          ...card,
          status: event.status,
          pairedDeviceId:
            event.deviceId !== undefined
              ? event.deviceId
              : event.status === "unpaired"
                ? null
                : card.pairedDeviceId,
          hasPushToken:
            event.hasPushToken !== undefined
              ? event.hasPushToken
              : event.status === "unpaired"
                ? false
                : card.hasPushToken,
          appVersionCode:
            event.appVersionCode !== undefined
              ? event.appVersionCode
              : event.status === "unpaired"
                ? null
                : card.appVersionCode,
          appVersionName:
            event.appVersionName !== undefined
              ? event.appVersionName
              : event.status === "unpaired"
                ? null
                : card.appVersionName,
          battery:
            event.status === "unpaired" ||
            (event.deviceId !== undefined &&
              event.deviceId !== card.pairedDeviceId)
              ? null
              : card.battery,
        };
      })
    );

    // Se o modal de pareamento estiver aberto para este card, detecta confirmação automática
    if (pairingCardIdRef.current === event.cardId) {
      const baseline = pairingBaselineDeviceIdRef.current;
      const isNewPairedDevice =
        Boolean(event.deviceId) && event.deviceId !== baseline;
      const becameOnlineFromUnpaired =
        baseline === null && event.status === "online";

      if (isNewPairedDevice || becameOnlineFromUnpaired) {
        setPairedJustNow(true);
      }
    }
  }, []);

  const handleCardBattery = useCallback((event: PhoneCardBatteryEvent) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === event.cardId
          ? {
              ...card,
              battery: {
                level: event.level,
                isCharging: event.isCharging,
                updatedAt: event.updatedAt,
              },
            }
          : card
      )
    );
  }, []);

  const handleRealtimeFeedback = useCallback(
    (event: PhoneCommandFeedback) => {
      if (event.cardId) {
        setCardFeedback(event.cardId, event);
      }
    },
    [setCardFeedback]
  );

  const handleSocketReconnect = useCallback(() => {
    fetchCards(true);
  }, [fetchCards]);

  const { connectionState } = usePhoneFinderSocket({
    enabled: true,
    onDeviceStatus: handleDeviceStatus,
    onCardBattery: handleCardBattery,
    onLocateFeedback: handleRealtimeFeedback,
    onVibrateFeedback: handleRealtimeFeedback,
    onReconnect: handleSocketReconnect,
  });

  // Contagens por status
  const counts = useMemo(() => {
    let online = 0;
    let offline = 0;
    let unpaired = 0;

    for (const card of cards) {
      if (card.status === "online") online += 1;
      else if (card.status === "offline") offline += 1;
      else unpaired += 1;
    }

    return {
      all: cards.length,
      online,
      offline,
      unpaired,
    };
  }, [cards]);

  // Cards filtrados por status + busca
  const filteredCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return cards.filter((card) => {
      if (statusFilter !== "all" && card.status !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const inName = card.name.toLowerCase().includes(query);
      const inDesc = (card.description || "").toLowerCase().includes(query);
      return inName || inDesc;
    });
  }, [cards, statusFilter, searchTerm]);

  const activePairingCard = useMemo(() => {
    if (!pairingCardId) return null;
    return cards.find((c) => c.id === pairingCardId) ?? null;
  }, [cards, pairingCardId]);

  // Ações de CRUD
  function handleOpenCreate() {
    setEditingCard(null);
    setFormError(null);
    setFormOpen(true);
  }

  function handleOpenEdit(card: PhoneCardItem) {
    setEditingCard(card);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: {
    name: string;
    description: string;
  }) {
    setFormSaving(true);
    setFormError(null);

    try {
      if (editingCard) {
        const updated = await api.phoneFinder.updateCard(editingCard.id, {
          name: values.name,
          description: values.description || null,
        });
        setCards((prev) =>
          prev.map((c) => (c.id === editingCard.id ? updated : c))
        );
        setFormOpen(false);
        setEditingCard(null);
        showSuccessBanner(`Card "${updated.name}" atualizado com sucesso.`);
      } else {
        const created = await api.phoneFinder.createCard({
          name: values.name,
          description: values.description || undefined,
        });
        setCards((prev) => [created, ...prev]);
        setFormOpen(false);
        showSuccessBanner(`Card "${created.name}" criado com sucesso.`);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Não foi possível salvar o card."
      );
    } finally {
      setFormSaving(false);
    }
  }

  // Pareamento
  const requestPairingCode = useCallback(async (cardId: string) => {
    setPairingLoading(true);
    setPairingError(null);
    try {
      const response = await api.phoneFinder.generatePairingCode(cardId);
      setPairingData(response);
    } catch (err) {
      setPairingError(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o código de pareamento."
      );
    } finally {
      setPairingLoading(false);
    }
  }, []);

  function handleOpenPairing(card: PhoneCardItem) {
    pairingBaselineDeviceIdRef.current = card.pairedDeviceId;
    setPairingCardId(card.id);
    setPairingData(null);
    setPairingError(null);
    setPairedJustNow(false);
    requestPairingCode(card.id);
  }

  function handleClosePairing() {
    setPairingCardId(null);
    setPairingData(null);
    setPairingError(null);
    setPairedJustNow(false);
    pairingBaselineDeviceIdRef.current = null;
  }

  // Desvincular
  async function handleConfirmUnpair() {
    if (!unpairTarget) return;
    setUnpairLoading(true);
    setUnpairError(null);
    try {
      await api.phoneFinder.unpairCard(unpairTarget.id);
      setCards((prev) =>
        prev.map((c) =>
          c.id === unpairTarget.id
            ? {
                ...c,
                status: "unpaired",
                pairedDeviceId: null,
                hasPushToken: false,
                battery: null,
                appVersionCode: null,
                appVersionName: null,
              }
            : c
        )
      );
      const cardName = unpairTarget.name;
      setUnpairTarget(null);
      showSuccessBanner(`Dispositivo desvinculado de "${cardName}".`);
    } catch (err) {
      setUnpairError(
        err instanceof Error
          ? err.message
          : "Não foi possível desvincular o dispositivo."
      );
    } finally {
      setUnpairLoading(false);
    }
  }

  // Excluir
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.phoneFinder.deleteCard(deleteTarget.id);
      const removedId = deleteTarget.id;
      const removedName = deleteTarget.name;
      setCards((prev) => prev.filter((c) => c.id !== removedId));
      setDeleteTarget(null);
      showSuccessBanner(`Card "${removedName}" excluído com sucesso.`);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Não foi possível excluir o card."
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // Disparo híbrido (Localizar / Vibrar)
  async function handleDispatchCommand(
    card: PhoneCardItem,
    action: PhoneDispatchAction
  ) {
    if (dispatchingByCard[card.id]) return;

    setDispatchingByCard((prev) => ({ ...prev, [card.id]: action }));

    try {
      const feedback =
        action === "locate"
          ? await api.phoneFinder.locateCard(card.id)
          : await api.phoneFinder.vibrateCard(card.id);
      setCardFeedback(card.id, feedback);
    } catch (err) {
      setCardFeedback(card.id, {
        cardId: card.id,
        commandId: "",
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Falha ao enviar comando ao dispositivo.",
      });
    } finally {
      setDispatchingByCard((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
    }
  }

  const filterChips: Array<{
    key: StatusFilter;
    label: string;
    count: number;
    dotClass?: string;
  }> = [
    { key: "all", label: "Todos", count: counts.all },
    {
      key: "online",
      label: "Online",
      count: counts.online,
      dotClass: "bg-emerald-500",
    },
    {
      key: "offline",
      label: "Offline",
      count: counts.offline,
      dotClass: "bg-amber-500",
    },
    {
      key: "unpaired",
      label: "Não pareados",
      count: counts.unpaired,
      dotClass: "bg-slate-400 dark:bg-slate-500",
    },
  ];

  const hasActiveFilter =
    statusFilter !== "all" || searchTerm.trim().length > 0;

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </span>
              <span>Phone Finder</span>
            </h1>

            {/* Pílula discreta de status da conexão WebSocket */}
            {connectionState === "connected" ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                title="Conectado ao canal de eventos em tempo real"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tempo real ativo</span>
              </span>
            ) : connectionState === "connecting" ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                title="Estabelecendo conexão em tempo real"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Reconectando...</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                title="Conexão em tempo real indisponível"
              >
                <WifiOff className="w-3 h-3" />
                <span>Desconectado</span>
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Localize e gerencie celulares pareados com alerta sonoro, vibração e telemetria em tempo real
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAppDownloadOpen(true)}
            title="Baixar App Android (QR Code)"
            aria-label="Baixar App Android via QR Code"
            className="p-2.5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors shadow-xs cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => fetchCards(true)}
            title="Atualizar lista de dispositivos"
            className="p-2.5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl px-4 py-2.5 text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Card</span>
          </button>
        </div>
      </div>

      {/* Feedback global de sucesso */}
      {successMessage && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
          <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Barra de filtros clicáveis + busca */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-4 sm:px-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        {/* Chips de resumo / filtro */}
        <div
          className="flex items-center gap-2 flex-wrap"
          role="tablist"
          aria-label="Filtrar dispositivos por status"
        >
          {filterChips.map((chip) => {
            const isActive = statusFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatusFilter(chip.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                    : "bg-slate-50/80 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                }`}
              >
                {chip.dotClass && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-current opacity-80" : chip.dotClass
                    }`}
                  />
                )}
                <span>{chip.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-white/20 dark:bg-slate-900/15"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Busca por nome ou descrição */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-slate-700 dark:text-slate-300 animate-spin" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Carregando dispositivos do Phone Finder...
          </span>
        </div>
      ) : pageError ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl p-5 text-sm flex items-center justify-between flex-wrap gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{pageError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchCards(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center py-16 px-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3 shadow-2xs">
            <Smartphone className="w-6 h-6" />
          </div>

          {cards.length === 0 ? (
            <>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                Nenhum card criado ainda
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                Crie um card para cada celular da bancada ou equipe, gere o código de 6 dígitos e acione alertas sonoros ou vibração em segundos.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Card</span>
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                Nenhum dispositivo encontrado
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                Não há cards correspondentes aos filtros ou termo de busca atuais.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearchTerm("");
                  }}
                  className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar filtros</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <PhoneCardTile
              key={card.id}
              card={card}
              dispatchingAction={dispatchingByCard[card.id] ?? null}
              feedback={feedbackByCard[card.id] ?? null}
              onEdit={handleOpenEdit}
              onPair={handleOpenPairing}
              onUnpair={(target) => {
                setUnpairError(null);
                setUnpairTarget(target);
              }}
              onDelete={(target) => {
                setDeleteError(null);
                setDeleteTarget(target);
              }}
              onLocate={(target) => handleDispatchCommand(target, "locate")}
              onVibrate={(target) => handleDispatchCommand(target, "vibrate")}
            />
          ))}
        </div>
      )}

      {/* Modal: Criar / Editar Card */}
      <PhoneCardFormModal
        open={formOpen}
        editingCard={editingCard}
        saving={formSaving}
        error={formError}
        onSubmit={handleFormSubmit}
        onClose={() => {
          if (!formSaving) {
            setFormOpen(false);
            setEditingCard(null);
            setFormError(null);
          }
        }}
      />

      {/* Modal: Código de Pareamento */}
      <PairingCodeModal
        card={activePairingCard}
        pairingData={pairingData}
        loading={pairingLoading}
        error={pairingError}
        pairedJustNow={pairedJustNow}
        onRegenerate={() => {
          if (pairingCardId) {
            requestPairingCode(pairingCardId);
          }
        }}
        onClose={handleClosePairing}
      />

      {/* Modal de Confirmação: Desvincular Dispositivo */}
      {unpairTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={() => !unpairLoading && setUnpairTarget(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unpair-modal-title"
              className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 max-w-md w-full animate-scale-in flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/60 shadow-xs">
                  <Unlink className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3
                    id="unpair-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    Desvincular Dispositivo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Deseja desvincular o celular conectado ao card{" "}
                    <strong className="text-slate-900 dark:text-white font-semibold">
                      &quot;{unpairTarget.name}&quot;
                    </strong>
                    ? O aparelho será desconectado e precisará de um novo código de 6 dígitos para parear novamente.
                  </p>
                </div>
              </div>

              {unpairError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{unpairError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={unpairLoading}
                  onClick={() => {
                    setUnpairTarget(null);
                    setUnpairError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={unpairLoading}
                  onClick={handleConfirmUnpair}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {unpairLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Desvinculando...</span>
                    </>
                  ) : (
                    <span>Sim, desvincular</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal de Confirmação: Excluir Card */}
      {deleteTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={() => !deleteLoading && setDeleteTarget(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-card-modal-title"
              className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 max-w-md w-full animate-scale-in flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3
                    id="delete-card-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    Excluir Card
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Tem certeza que deseja excluir o card{" "}
                    <strong className="text-slate-900 dark:text-white font-semibold">
                      &quot;{deleteTarget.name}&quot;
                    </strong>
                    ?{" "}
                    {deleteTarget.status !== "unpaired"
                      ? "O aparelho pareado será desvinculado imediatamente e esta ação não poderá ser desfeita."
                      : "Esta ação removerá o card permanentemente."}
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <span>Sim, excluir</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <AppDownloadModal
        isOpen={appDownloadOpen}
        onClose={() => setAppDownloadOpen(false)}
      />
    </main>
  );
}
