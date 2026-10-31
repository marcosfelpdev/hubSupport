import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  ShieldAlert,
  Layers,
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Download,
  ExternalLink,
  FileText,
  X,
  Activity,
  Check,
  Zap,
  Info,
  Calendar,
  Building,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import { ReportDetailsModal } from "@/components/dashboard/ReportDetailsModal";

export interface KanbanTicket {
  id: string;
  code: string;
  client: string;
  requester: string;
  problem: string;
  actionTaken: string;
  columnId: "queue" | "standard" | "specialist" | "investigation" | "audit";
  severity: "Baixa" | "Média" | "Alta" | "Crítica";
  status: string;
  assignedTech?: string;
  slaMinutesLeft: number;
  dueTime: string;
  thumbnailUrl?: string;
  thumbnailLabel?: string;
  metrics?: { label: string; value: string }[];
  confirmed?: boolean;
  confirmedTime?: string;
  technicalAction?: boolean;
  implementation?: boolean;
  rawLog?: WorkLogItem;
}

interface DecisionEvent {
  id: string;
  code: string;
  timestamp: string;
  action: string;
  ticketCode: string;
  targetOrEntity: string;
  detail?: string;
  isRecent?: boolean;
}

interface TechnicianKanbanBoardProps {
  logs: WorkLogItem[];
  currentUserId: string;
  employees: { name: string }[];
  onLogResolved?: () => void;
}

export const TechnicianKanbanBoard: React.FC<TechnicianKanbanBoardProps> = ({
  logs,
  currentUserId,
  employees,
  onLogResolved,
}) => {
  // Live clock
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter state for Surge Queue
  const [queueFilter, setQueueFilter] = useState<"all" | "urgent" | "breach">("urgent");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>("CLM-78104");

  // Drag and Drop state
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Review / Reservation Modal state (corresponds to frame 11)
  const [pendingRouteTicket, setPendingRouteTicket] = useState<{
    ticket: KanbanTicket;
    targetColumn: "standard" | "specialist" | "investigation" | "audit";
  } | null>(null);
  const [modalAssignedTech, setModalAssignedTech] = useState<string>("");
  const [modalSeverity, setModalSeverity] = useState<"Baixa" | "Média" | "Alta" | "Crítica">("Alta");
  const [modalReason, setModalReason] = useState<string>("");
  const [modalForecast, setModalForecast] = useState<string>("41m · +1m para SLA");

  // Selected ticket for full inspection modal
  const [inspectingTicket, setInspectingTicket] = useState<WorkLogItem | null>(null);

  // Available technicians list
  const availableTechs = useMemo(() => {
    const names = employees.map((e) => e.name).filter(Boolean);
    if (!names.includes("Dana Whitfield")) names.unshift("Dana Whitfield");
    if (!names.includes("Lucas Técnico")) names.push("Lucas Técnico");
    if (!names.includes("Carlos Mendes")) names.push("Carlos Mendes");
    return Array.from(new Set(names));
  }, [employees]);

  // Initial Seed & Real DB Integration for Kanban Tickets
  const [tickets, setTickets] = useState<KanbanTicket[]>(() => {
    // Demo baseline tickets matching the video
    const demoTickets: KanbanTicket[] = [
      {
        id: "CLM-48097",
        code: "CLM-48097",
        client: "Ridgeline Marina",
        requester: "Helena Castro",
        problem: "Infiltração de maré e oscilação de link no Pier 3",
        actionTaken: "Isolamento de roteador primário e comutação para link backup",
        columnId: "queue",
        severity: "Média",
        status: "Realizado",
        slaMinutesLeft: 124,
        dueTime: "01:46",
        metrics: [
          { label: "Impacto financeiro", value: "R$ 88.410,00" },
          { label: "Equipamento", value: "Switch Core Pier 3" },
        ],
        technicalAction: true,
      },
      {
        id: "CLM-48102",
        code: "CLM-48102",
        client: "Dockside Cold Storage",
        requester: "Renato Silveira",
        problem: "Avaria no telhado e perda de telemetria de temperatura",
        actionTaken: "Inspeção visual preliminar e alerta de câmara fria",
        columnId: "queue",
        severity: "Média",
        status: "Realizado",
        slaMinutesLeft: 72,
        dueTime: "12:54",
        metrics: [
          { label: "Impacto térmico", value: "Câmara 04 / R$ 132.900,00" },
          { label: "Fotos verificadas", value: "4 anexos enviados" },
        ],
        technicalAction: true,
      },
      {
        id: "CLM-48110",
        code: "CLM-48110",
        client: "Quay 12 Fisheries",
        requester: "Bruno Nogueira",
        problem: "Porão alagado e travamento de CLP de bombeamento",
        actionTaken: "Desligamento preventivo de disjuntores da bomba 2",
        columnId: "queue",
        severity: "Alta",
        status: "Realizado",
        slaMinutesLeft: 58,
        dueTime: "12:40",
        metrics: [
          { label: "Nível de água", value: "48 cm acima do sensor" },
          { label: "Risco operacional", value: "Parada de linha" },
        ],
        technicalAction: true,
      },
      {
        id: "CLM-78104",
        code: "CLM-78104",
        client: "Harbor Lane Retail",
        requester: "Amanda Duarte",
        problem: "Infiltração no estoque e risco iminente de perda de inventário",
        actionTaken: "Cobertura de racks com lona plástica e vistoria elétrica",
        columnId: "queue",
        severity: "Alta",
        status: "Realizado",
        slaMinutesLeft: 42,
        dueTime: "12:24",
        thumbnailLabel: "IMG_78104_02 · 23:12",
        metrics: [
          { label: "Entrada de água", value: "24 cm no acesso doca" },
          { label: "Exposição de estoque", value: "Piso 2 parcial / R$ 214.880,00" },
          { label: "Fotos verificadas", value: "6 fotos validadas" },
          { label: "Interrupção comercial", value: "Previsão 6 dias" },
        ],
        technicalAction: true,
        implementation: true,
      },
      {
        id: "CLM-48126",
        code: "CLM-48126",
        client: "Pier Supply Co",
        requester: "Diego Ferreira",
        problem: "Perda de conteiner e desalinhamento de guindaste",
        actionTaken: "Sinalização perimetral e isolamento da área",
        columnId: "queue",
        severity: "Baixa",
        status: "Realizado",
        slaMinutesLeft: 211,
        dueTime: "03:13",
        metrics: [
          { label: "Carga", value: "Conteiner Pier 14 / R$ 64.233,10" },
        ],
        technicalAction: true,
      },
      // Column Standard (Portal 1)
      {
        id: "CLM-48081",
        code: "CLM-48081",
        client: "Atlantic Logistics",
        requester: "Carolina Santos",
        problem: "Perda de sinalização e leitor óptico",
        actionTaken: "Reinício de firmware do leitor óptico",
        columnId: "standard",
        severity: "Média",
        status: "Realizado",
        assignedTech: "Carlos Mendes",
        slaMinutesLeft: 164,
        dueTime: "02:44",
        technicalAction: true,
      },
      {
        id: "CLM-48088",
        code: "CLM-48088",
        client: "Marina Bay Center",
        requester: "Felipe Ramos",
        problem: "Dano no toldo de sensores externos",
        actionTaken: "Recolhimento manual e agendamento de troca",
        columnId: "standard",
        severity: "Baixa",
        status: "Realizado",
        assignedTech: "Carlos Mendes",
        slaMinutesLeft: 238,
        dueTime: "03:58",
        technicalAction: true,
      },
      // Column Specialist (Portal 2)
      {
        id: "CLM-78062",
        code: "CLM-78062",
        client: "Complex Property Group",
        requester: "Mariana Souza",
        problem: "Falha de barramento trifásico e no-break central",
        actionTaken: "Acionamento de gerador auxiliar e medição de harmônicas",
        columnId: "specialist",
        severity: "Alta",
        status: "Em andamento",
        assignedTech: "Dana Whitfield",
        slaMinutesLeft: 26,
        dueTime: "12:08",
        technicalAction: true,
      },
      {
        id: "CLM-78077",
        code: "CLM-78077",
        client: "Marine Cargo Int",
        requester: "Thiago Lima",
        problem: "Incompatibilidade no manifesto de carga alfandegária",
        actionTaken: "Correção de payload XML e retransmissão para SEFAZ",
        columnId: "specialist",
        severity: "Alta",
        status: "Em andamento",
        assignedTech: "Dana Whitfield",
        slaMinutesLeft: 34,
        dueTime: "12:16",
        implementation: true,
      },
      // Column Investigation (Portal 3)
      {
        id: "CLM-48054",
        code: "CLM-48054",
        client: "Risk Terminal 84",
        requester: "Patricia Moreira",
        problem: "Conflito de certificados SSL e chave de criptografia",
        actionTaken: "Coleta de logs de handshake e rastreio de certificado revogado",
        columnId: "investigation",
        severity: "Crítica",
        status: "Aguardando reunião",
        assignedTech: "Omar R.",
        slaMinutesLeft: 62,
        dueTime: "12:44",
        technicalAction: true,
      },
      {
        id: "CLM-48063",
        code: "CLM-48063",
        client: "Global Port Risk 79",
        requester: "Rodrigo Toledo",
        problem: "Duplicação de sinistro e divergência cadastral",
        actionTaken: "Bloqueio preventivo de registro e cruzamento de CPF/CNPJ",
        columnId: "investigation",
        severity: "Média",
        status: "Aguardando reunião",
        assignedTech: "Omar R.",
        slaMinutesLeft: 128,
        dueTime: "01:50",
        implementation: true,
      },
      // Column Audit / Solution (Portal 4)
      {
        id: "CLM-48039",
        code: "CLM-48039",
        client: "Counsel Legal Maritime",
        requester: "Tatiana Veiga",
        problem: "Retenção jurídica para perícia de sinistro de doca",
        actionTaken: "Emissão de relatório técnico pericial e assinatura digital",
        columnId: "audit",
        severity: "Média",
        status: "Solucionado",
        assignedTech: "Ingrid S.",
        slaMinutesLeft: 0,
        dueTime: "Concluído",
        technicalAction: true,
      },
      {
        id: "CLM-48045",
        code: "CLM-48045",
        client: "Recovery Subrogation",
        requester: "Eduardo Prado",
        problem: "Homologação de ressarcimento de carga avariada",
        actionTaken: "Termo de acordo homologado e chamado encerrado",
        columnId: "audit",
        severity: "Baixa",
        status: "Solucionado",
        assignedTech: "Ingrid S.",
        slaMinutesLeft: 0,
        dueTime: "Concluído",
        implementation: true,
      },
    ];

    // Merge real database logs seamlessly into the board
    const realDbTickets: KanbanTicket[] = logs.map((log, idx) => {
      const shortCode = `TK-${log.id.slice(-5).toUpperCase()}`;
      let targetCol: "queue" | "standard" | "specialist" | "investigation" | "audit" = "queue";

      if (log.status === "Solucionado") {
        targetCol = "audit";
      } else if (log.status === "Em andamento") {
        targetCol = "specialist";
      } else if (log.status === "Aguardando reunião" || log.status === "Não foi possível realizar") {
        targetCol = "investigation";
      } else if (idx % 2 === 0) {
        targetCol = "standard";
      } else {
        targetCol = "queue";
      }

      let parsedMedia: string[] = [];
      try {
        parsedMedia = JSON.parse(log.media || "[]");
      } catch {
        parsedMedia = [];
      }

      return {
        id: log.id,
        code: shortCode,
        client: log.clientOrOffice,
        requester: log.requester,
        problem: log.reportedProblem,
        actionTaken: log.actionTaken,
        columnId: targetCol,
        severity: log.technicalAction && log.implementation ? "Crítica" : log.technicalAction ? "Alta" : "Média",
        status: log.status,
        assignedTech: log.user?.name || "Lucas Técnico",
        slaMinutesLeft: targetCol === "audit" ? 0 : Math.max(15, 120 - idx * 10),
        dueTime: targetCol === "audit" ? "Concluído" : "12:35",
        thumbnailUrl: parsedMedia[0] || undefined,
        thumbnailLabel: parsedMedia[0] ? `ANEXO_${shortCode}` : undefined,
        metrics: [
          { label: "Registrado por", value: log.user?.name || "Usuário" },
          { label: "Status atual", value: log.status },
        ],
        technicalAction: log.technicalAction,
        implementation: log.implementation,
        rawLog: log,
      };
    });

    // Combine avoiding duplicate IDs
    const combined = [...demoTickets];
    realDbTickets.forEach((rt) => {
      if (!combined.some((ct) => ct.id === rt.id)) {
        combined.push(rt);
      }
    });

    return combined;
  });

  // Decision Log / Event Ledger (bottom stream)
  const [decisionEvents, setDecisionEvents] = useState<DecisionEvent[]>([
    {
      id: "DEC-7739",
      code: "DEC-7739",
      timestamp: "23:38:12",
      action: "Cobertura revisada",
      ticketCode: "CLM-48097",
      targetOrEntity: "Ridgeline Marina",
    },
    {
      id: "DEC-7740",
      code: "DEC-7740",
      timestamp: "23:40:05",
      action: "Encaminhado para Investigação",
      ticketCode: "CLM-48054",
      targetOrEntity: "Risco Terminal 84",
    },
    {
      id: "DEC-7741",
      code: "DEC-7741",
      timestamp: "23:41:44",
      action: "Severidade alterada Média → Alta",
      ticketCode: "CLM-78104",
      targetOrEntity: "Carlos Silva",
    },
  ]);

  // Columns definition
  const columns = [
    {
      id: "standard" as const,
      name: "Padrão",
      subtitle: "Triagem N1 & Ação Preliminar",
      maxCapacity: 24,
      accentColor: "#38bdf8",
      accentBg: "rgba(56, 189, 248, 0.15)",
    },
    {
      id: "specialist" as const,
      name: "Especialista",
      subtitle: "Engenharia N2 & Infraestrutura",
      maxCapacity: 10,
      accentColor: "#10b981",
      accentBg: "rgba(16, 185, 129, 0.18)",
    },
    {
      id: "investigation" as const,
      name: "Investigação",
      subtitle: "Diagnóstico Avançado & Auditoria",
      maxCapacity: 6,
      accentColor: "#f59e0b",
      accentBg: "rgba(245, 158, 11, 0.15)",
    },
    {
      id: "audit" as const,
      name: "Auditoria",
      subtitle: "Validação & Chamados Solucionados",
      maxCapacity: 5,
      accentColor: "#a855f7",
      accentBg: "rgba(168, 85, 247, 0.15)",
    },
  ];

  // Tickets filtered in Queue
  const queueTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (t.columnId !== "queue") return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matches =
          t.client.toLowerCase().includes(query) ||
          t.problem.toLowerCase().includes(query) ||
          t.code.toLowerCase().includes(query) ||
          t.requester.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (queueFilter === "urgent") return t.slaMinutesLeft < 60;
      if (queueFilter === "breach") return t.severity === "Crítica" || t.slaMinutesLeft <= 30;
      return true;
    });
  }, [tickets, queueFilter, searchTerm]);

  // Counts for KPIs
  const allQueueCount = useMemo(() => tickets.filter((t) => t.columnId === "queue").length, [tickets]);
  const urgentCount = useMemo(
    () => tickets.filter((t) => t.columnId === "queue" && t.slaMinutesLeft < 60).length,
    [tickets]
  );
  const breachCount = useMemo(
    () =>
      tickets.filter(
        (t) => (t.columnId === "queue" || t.columnId === "specialist") && (t.severity === "Crítica" || t.slaMinutesLeft <= 30)
      ).length,
    [tickets]
  );

  const columnCounts = useMemo(() => {
    return {
      standard: tickets.filter((t) => t.columnId === "standard").length,
      specialist: tickets.filter((t) => t.columnId === "specialist").length,
      investigation: tickets.filter((t) => t.columnId === "investigation").length,
      audit: tickets.filter((t) => t.columnId === "audit").length,
    };
  }, [tickets]);

  // Open Allocation Modal
  const openRouteModal = (
    ticket: KanbanTicket,
    targetCol: "standard" | "specialist" | "investigation" | "audit" = "specialist"
  ) => {
    setPendingRouteTicket({ ticket, targetColumn: targetCol });
    setModalAssignedTech(ticket.assignedTech || availableTechs[0] || "Dana Whitfield");
    setModalSeverity(ticket.severity);
    setModalReason(ticket.problem);
    setModalForecast(`${Math.max(10, ticket.slaMinutesLeft - 1)}m · +1m para SLA`);
  };

  // Confirm Route Action (corresponds to frame 11 -> frame 13/14)
  const handleConfirmRoute = async () => {
    if (!pendingRouteTicket) return;
    const { ticket, targetColumn } = pendingRouteTicket;

    const newDecId = `DEC-${Math.floor(7742 + Math.random() * 200)}`;
    const nowStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // Update ticket state with confirmed badge
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              columnId: targetColumn,
              assignedTech: modalAssignedTech,
              severity: modalSeverity,
              confirmed: true,
              confirmedTime: "+1m",
              status:
                targetColumn === "audit"
                  ? "Solucionado"
                  : targetColumn === "specialist"
                  ? "Em andamento"
                  : targetColumn === "investigation"
                  ? "Aguardando reunião"
                  : "Realizado",
            }
          : t
      )
    );

    // Add entry to Decision Log
    const targetColName = columns.find((c) => c.id === targetColumn)?.name || targetColumn;
    const newEvent: DecisionEvent = {
      id: newDecId,
      code: newDecId,
      timestamp: nowStr,
      action: `Encaminhado para ${targetColName}`,
      ticketCode: ticket.code,
      targetOrEntity: `${modalAssignedTech} · ${modalForecast.split("·")[0].trim()}`,
      isRecent: true,
    };

    setDecisionEvents((prev) => [newEvent, ...prev]);

    // Persist to backend if this is a real DB record
    if (ticket.rawLog?.id) {
      try {
        if (targetColumn === "audit") {
          await api.worklogs.resolve(ticket.rawLog.id);
          onLogResolved?.();
        } else {
          const newStatus =
            targetColumn === "specialist"
              ? "Em andamento"
              : targetColumn === "investigation"
              ? "Aguardando reunião"
              : "Realizado";
          await api.worklogs.updateStatus(ticket.rawLog.id, newStatus);
        }
      } catch (err) {
        console.error("Erro ao persistir mudança de status no banco:", err);
      }
    }

    setPendingRouteTicket(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (ticketId: string, e: React.DragEvent) => {
    setDraggingTicketId(ticketId);
    e.dataTransfer.setData("text/plain", ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: string) => {
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (colId: "standard" | "specialist" | "investigation" | "audit", e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
    const ticketId = e.dataTransfer.getData("text/plain") || draggingTicketId;
    if (!ticketId) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    // If dropped to a different column, open the reservation confirmation modal
    if (ticket.columnId !== colId) {
      openRouteModal(ticket, colId);
    }
    setDraggingTicketId(null);
  };

  // Helper color for severity
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "Crítica":
        return { color: "#f87171", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.35)" };
      case "Alta":
        return { color: "#fb923c", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.35)" };
      case "Média":
        return { color: "#facc15", bg: "rgba(234, 179, 8, 0.15)", border: "rgba(234, 179, 8, 0.3)" };
      default:
        return { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.3)" };
    }
  };

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#070b14",
        borderRadius: "16px",
        border: "1px solid rgba(56, 189, 248, 0.2)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.08)",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        color: "#e2e8f0",
        position: "relative",
      }}
    >
      {/* 1. TOP WINDOW CHROME / STATUS BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.625rem 1.25rem",
          background: "#0a0f1d",
          borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
          fontSize: "0.75rem",
        }}
      >
        {/* macOS window buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: "120px" }}>
          <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#eab308" }} />
          <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#22c55e" }} />
        </div>

        {/* Center Omnibar / Path */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(15, 23, 42, 0.7)",
            padding: "0.25rem 1rem",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#94a3b8",
            fontSize: "0.75rem",
            fontFamily: "monospace",
          }}
        >
          <span style={{ color: "#38bdf8" }}>🔒</span>
          <span>hubsupport.ops/triagem-tecnica/portais-sla</span>
        </div>

        {/* Right Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            color: "#64748b",
            fontSize: "0.72rem",
            fontFamily: "monospace",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 8px #10b981",
            }}
          />
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>PAINEL DE OPERAÇÕES TÉCNICAS</span>
          <span>&bull;</span>
          <span style={{ color: "#38bdf8" }}>ATUALIZADO {currentTime || "11:41:59"}</span>
        </div>
      </div>

      {/* 2. SUBHEADER: BRAND, BREADCRUMB & TECH USER IDENTITY */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1.5rem",
          background: "#0c1222",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Logo / Brand badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "0.35rem 0.75rem",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "4px",
                background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.75rem",
              }}
            >
              H
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc", margin: 0, lineHeight: 1.1 }}>
                HubSupport Ops
              </p>
              <p style={{ fontSize: "0.68rem", color: "#64748b", margin: 0 }}>Central Técnica</p>
            </div>
          </div>

          {/* Breadcrumb / Title */}
          <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            <span>Atendimentos</span>
            <span style={{ margin: "0 0.4rem", color: "#475569" }}>/</span>
            <span>Triagem Preventiva</span>
            <span style={{ margin: "0 0.4rem", color: "#475569" }}>/</span>
            <strong style={{ color: "#38bdf8" }}>Plantão Técnico N2</strong>
            <span style={{ margin: "0 0.4rem", color: "#475569" }}>&bull;</span>
            <span style={{ color: "#f87171", fontWeight: 600 }}>{urgentCount} pendentes no radar</span>
          </div>
        </div>

        {/* Current technician identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
              {availableTechs[0] || "Carlos Silva"}
            </p>
            <p style={{ fontSize: "0.68rem", color: "#10b981", margin: 0, display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "flex-end" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
              Plantão Ativo &bull; {currentTime || "11:41 PM"}
            </p>
          </div>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.8rem",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {availableTechs[0]?.slice(0, 2).toUpperCase() || "CS"}
          </div>
        </div>
      </div>

      {/* 3. PIPELINE GATES NAVIGATION TABS (Surge, Assess, Dispatch, Audit) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          background: "#090e1a",
          fontSize: "0.78rem",
        }}
      >
        {/* Gate 1: Surge / Triagem */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.65rem 1.25rem",
            borderRight: "1px solid rgba(255, 255, 255, 0.05)",
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              1
            </span>
            <span style={{ fontWeight: 600 }}>Triagem / Entrada</span>
          </div>
          <span style={{ color: "#f87171", fontSize: "0.72rem", fontWeight: 600, background: "rgba(239, 68, 68, 0.12)", padding: "0.1rem 0.45rem", borderRadius: "4px" }}>
            {urgentCount} SLA &lt; 60m
          </span>
        </div>

        {/* Gate 2: Assess / Diagnóstico */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.65rem 1.25rem",
            borderRight: "1px solid rgba(255, 255, 255, 0.05)",
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              2
            </span>
            <span style={{ fontWeight: 600 }}>Diagnóstico</span>
          </div>
          <span style={{ color: "#64748b", fontSize: "0.72rem" }}>Prioridade revisada</span>
        </div>

        {/* Gate 3: Dispatch / Kanban (ACTIVE ILLUMINATED TAB) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.65rem 1.25rem",
            borderRight: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(16, 185, 129, 0.08)",
            color: "#34d399",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "#10b981",
              boxShadow: "0 0 10px #10b981",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "#10b981",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              3
            </span>
            <span style={{ fontWeight: 700, color: "#f8fafc" }}>Despacho Kanban</span>
          </div>
          <span style={{ color: "#10b981", fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
            Portais Livres
          </span>
        </div>

        {/* Gate 4: Audit / Encerramento */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.65rem 1.25rem",
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(168, 85, 247, 0.15)",
                color: "#a855f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              4
            </span>
            <span style={{ fontWeight: 600 }}>Auditoria & Solução</span>
          </div>
          <span style={{ color: "#64748b", fontSize: "0.72rem" }}>
            {columnCounts.audit} concluídos
          </span>
        </div>
      </div>

      {/* 4. SLA STATUS TICKER BANNER (Exact glowing banner from demo video) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 1.5rem",
          background: "linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%)",
          borderBottom: "1px solid rgba(16, 185, 129, 0.25)",
          fontSize: "0.76rem",
          color: "#a7f3d0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Glowing Green Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#10b981",
              color: "#022c22",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              fontWeight: 800,
              fontSize: "0.75rem",
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.5)",
            }}
          >
            <span>FILA TÉCNICA &bull; SLA &lt; 60M</span>
            <span style={{ background: "#022c22", color: "#a7f3d0", padding: "0 0.35rem", borderRadius: "9999px", fontSize: "0.7rem" }}>
              {urgentCount}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontFamily: "monospace", fontSize: "0.76rem" }}>
            <span style={{ color: "#ffffff", fontWeight: 600 }}>{urgentCount} chamados urgentes &lt; 60m</span>
            <span style={{ color: "#34d399" }}>&bull;</span>
            <span style={{ color: "#f87171", fontWeight: 600 }}>{breachCount} risco de quebra SLA</span>
            <span style={{ color: "#34d399" }}>&bull;</span>
            <span>previsão média de despacho: <strong>41m</strong></span>
            <span style={{ color: "#34d399" }}>&bull;</span>
            <span style={{ color: "#34d399" }}>1 especialista com vaga imediata</span>
          </div>
        </div>

        <div style={{ fontSize: "0.72rem", color: "#6ee7b7", fontFamily: "monospace" }}>
          STATUS DE FLUXO: ESTÁVEL
        </div>
      </div>

      {/* 5. MAIN SPLIT CANVAS: SURGE QUEUE (LEFT) + 4-COLUMN KANBAN (RIGHT) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          minHeight: "680px",
          background: "#080c16",
        }}
      >
        {/* ============================================================== */}
        {/* LEFT PANEL: SURGE QUEUE (FILA DE ENTRADA)                       */}
        {/* ============================================================== */}
        <div
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            background: "#0a0f1d",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Header of Surge Queue */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Fila de Entrada
                </h3>
                <p style={{ fontSize: "0.7rem", color: "#64748b", margin: 0 }}>
                  {urgentCount} chamados com SLA &lt; 60m &bull; atualizado agora
                </p>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  background: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              >
                {allQueueCount} pendentes
              </span>
            </div>

            {/* Filter Tabs (All, Due < 60m, Breach) */}
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem" }}>
              <button
                onClick={() => setQueueFilter("all")}
                style={{
                  flex: 1,
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: queueFilter === "all" ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.06)",
                  background: queueFilter === "all" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                  color: queueFilter === "all" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Todos {allQueueCount}
              </button>
              <button
                onClick={() => setQueueFilter("urgent")}
                style={{
                  flex: 1,
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  borderRadius: "6px",
                  border: queueFilter === "urgent" ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.06)",
                  background: queueFilter === "urgent" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                  color: queueFilter === "urgent" ? "#34d399" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.3rem",
                }}
              >
                <span>SLA &lt; 60m</span>
                <span style={{ background: "#10b981", color: "#064e3b", borderRadius: "9999px", padding: "0 0.35rem", fontSize: "0.68rem" }}>
                  {urgentCount}
                </span>
              </button>
              <button
                onClick={() => setQueueFilter("breach")}
                style={{
                  flex: 1,
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: queueFilter === "breach" ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.06)",
                  background: queueFilter === "breach" ? "rgba(239, 68, 68, 0.15)" : "transparent",
                  color: queueFilter === "breach" ? "#f87171" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Risco SLA {breachCount}
              </button>
            </div>

            {/* Quick Search */}
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar chamado ou cliente..."
                style={{
                  width: "100%",
                  padding: "0.35rem 0.75rem 0.35rem 2rem",
                  fontSize: "0.75rem",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* List of Tickets in Queue */}
          <div
            style={{
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              overflowY: "auto",
              flex: 1,
              maxHeight: "calc(100vh - 440px)",
            }}
          >
            {queueTickets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "#64748b",
                  border: "1px dashed rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                }}
              >
                <CheckCircle2 size={28} style={{ margin: "0 auto 0.5rem", color: "#10b981", opacity: 0.6 }} />
                <p style={{ fontSize: "0.8rem", margin: 0, color: "#94a3b8" }}>Nenhum chamado pendente nesta visualização</p>
                <p style={{ fontSize: "0.7rem", margin: "0.25rem 0 0", color: "#64748b" }}>Todos os chamados foram despachados para os portais</p>
              </div>
            ) : (
              queueTickets.map((ticket) => {
                const isExpanded = expandedTicketId === ticket.id;
                const isDragging = draggingTicketId === ticket.id;
                const sevStyle = getSeverityStyle(ticket.severity);

                return (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(ticket.id, e)}
                    style={{
                      background: isExpanded ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.6)",
                      border: isExpanded
                        ? "1px solid #10b981"
                        : "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "8px",
                      padding: "0.75rem 0.875rem",
                      cursor: "grab",
                      transition: "all 0.15s ease",
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isExpanded ? "0 4px 20px rgba(16, 185, 129, 0.12)" : "none",
                    }}
                  >
                    {/* Top Row: Code, Client & SLA countdown */}
                    <div
                      onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.76rem", color: "#38bdf8" }}>
                            {ticket.code}
                          </span>
                          <span style={{ color: "#64748b" }}>&bull;</span>
                          <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ticket.client}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: "#94a3b8",
                            margin: "0.2rem 0 0",
                            lineHeight: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: isExpanded ? 4 : 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {ticket.problem}
                        </p>
                      </div>

                      {/* SLA Pill on right */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            color: ticket.slaMinutesLeft < 60 ? "#f87171" : "#34d399",
                          }}
                        >
                          {ticket.slaMinutesLeft}m rest.
                        </span>
                        <p style={{ fontSize: "0.65rem", color: "#64748b", margin: 0 }}>
                          vence {ticket.dueTime}
                        </p>
                      </div>
                    </div>

                    {/* Metadata line: Severity & tags */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        marginTop: "0.45rem",
                        fontSize: "0.68rem",
                      }}
                    >
                      <span
                        style={{
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          fontWeight: 600,
                          color: sevStyle.color,
                          background: sevStyle.bg,
                          border: `1px solid ${sevStyle.border}`,
                        }}
                      >
                        {ticket.severity}
                      </span>
                      {ticket.technicalAction && (
                        <span style={{ padding: "0.1rem 0.4rem", borderRadius: "4px", background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                          Ação Técnica
                        </span>
                      )}
                      {ticket.implementation && (
                        <span style={{ padding: "0.1rem 0.4rem", borderRadius: "4px", background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
                          Implementação
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", color: "#64748b" }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>

                    {/* EXPANDED ACCORDION VIEW (Exact structural match to frame 7) */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                          animation: "fadeIn 0.2s ease",
                        }}
                      >
                        {/* Grid: Image / Thumbnail + Metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                          {/* Left preview box */}
                          <div
                            style={{
                              width: "100%",
                              height: "90px",
                              background: "#030712",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            {ticket.thumbnailUrl ? (
                              <img
                                src={ticket.thumbnailUrl}
                                alt="Evidência"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <div style={{ textAlign: "center", padding: "0.5rem" }}>
                                <FileText size={24} style={{ color: "#38bdf8", margin: "0 auto 0.25rem", opacity: 0.7 }} />
                                <span style={{ fontSize: "0.62rem", color: "#94a3b8", display: "block" }}>
                                  {ticket.thumbnailLabel || "Evidência Técnica"}
                                </span>
                              </div>
                            )}
                            <div
                              style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: "rgba(0, 0, 0, 0.7)",
                                padding: "2px 4px",
                                fontSize: "0.58rem",
                                color: "#94a3b8",
                                textAlign: "center",
                                fontFamily: "monospace",
                              }}
                            >
                              {ticket.thumbnailLabel || "IMG_REGISTRADA"}
                            </div>
                          </div>

                          {/* Right metric list */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.7rem" }}>
                            {ticket.metrics?.map((m, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  borderBottom: "1px dashed rgba(255, 255, 255, 0.05)",
                                  paddingBottom: "2px",
                                }}
                              >
                                <span style={{ color: "#64748b" }}>{m.label}:</span>
                                <span style={{ color: "#e2e8f0", fontWeight: 500, textAlign: "right" }}>{m.value}</span>
                              </div>
                            )) || (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ color: "#64748b" }}>Solicitante:</span>
                                  <span style={{ color: "#e2e8f0" }}>{ticket.requester}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ color: "#64748b" }}>Ação Inicial:</span>
                                  <span style={{ color: "#94a3b8" }}>{ticket.actionTaken.slice(0, 24)}...</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Severity Selector Pills */}
                        <div style={{ marginBottom: "0.75rem" }}>
                          <p style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "0.3rem", fontWeight: 600 }}>
                            Ajustar Severidade Técnica:
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.25rem" }}>
                            {(["Baixa", "Média", "Alta", "Crítica"] as const).map((sev) => {
                              const isCur = ticket.severity === sev;
                              return (
                                <button
                                  key={sev}
                                  onClick={() => {
                                    setTickets((prev) =>
                                      prev.map((t) => (t.id === ticket.id ? { ...t, severity: sev } : t))
                                    );
                                  }}
                                  style={{
                                    padding: "0.25rem",
                                    fontSize: "0.68rem",
                                    fontWeight: isCur ? 700 : 500,
                                    borderRadius: "4px",
                                    border: isCur ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                                    background: isCur ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                    color: isCur ? "#38bdf8" : "#94a3b8",
                                    cursor: "pointer",
                                  }}
                                >
                                  {sev}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Action Buttons: Route to board & Details */}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {ticket.rawLog && (
                            <button
                              onClick={() => setInspectingTicket(ticket.rawLog!)}
                              style={{
                                padding: "0.45rem 0.65rem",
                                borderRadius: "6px",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                background: "rgba(255, 255, 255, 0.05)",
                                color: "#e2e8f0",
                                fontSize: "0.74rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                              }}
                            >
                              <FileText size={13} />
                              Detalhes
                            </button>
                          )}
                          <button
                            onClick={() => openRouteModal(ticket, "specialist")}
                            style={{
                              flex: 1,
                              padding: "0.45rem 0.75rem",
                              borderRadius: "6px",
                              border: "1px solid #10b981",
                              background: "linear-gradient(135deg, #059669, #10b981)",
                              color: "#ffffff",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.4rem",
                              boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            <span>Despachar para Kanban</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* DOCKED SHIFT ROSTER WIDGET AT BOTTOM OF LEFT PANEL */}
          <div
            style={{
              margin: "0.5rem 0.75rem 0.75rem",
              background: "rgba(10, 15, 29, 0.95)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "8px",
              padding: "0.6rem 0.85rem",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.04em" }}>
                PLANTÃO TÉCNICO &bull; 23:00 - 07:00
              </span>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.66rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Especialista &bull; banco/infra:</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>Dana W.</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Investigação &bull; redes:</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>Omar R.</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Auditoria &bull; homologação:</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>Ingrid S.</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.2rem", borderTop: "1px dashed rgba(255, 255, 255, 0.08)" }}>
                <span style={{ color: "#64748b" }}>Próxima revisão de onda:</span>
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>23:45</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT PANEL: 4-COLUMN KANBAN DISPATCH BOARD                    */}
        {/* ============================================================== */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "#080c16",
            minWidth: 0,
          }}
        >
          {/* Dispatch Board Top Header & Metrics */}
          <div
            style={{
              padding: "1rem 1.5rem",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#0a0f1d",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Portais de Operação Técnica
                </span>
                <span style={{ color: "#334155" }}>&bull;</span>
                <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 600 }}>4 Gates Ativos</span>
              </div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f8fafc", margin: "0.15rem 0 0" }}>
                Triagem Preventiva antes do SLA (Route before SLA)
              </h2>
            </div>

            {/* Metric pill indicators on top right (matches video frame 1) */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.62rem", color: "#64748b", margin: 0 }}>Padrão N1</p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#38bdf8", margin: 0, fontFamily: "monospace" }}>
                  {columnCounts.standard} / 24
                </p>
              </div>

              <div
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.62rem", color: "#6ee7b7", margin: 0 }}>Especialista N2</p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#34d399", margin: 0, fontFamily: "monospace" }}>
                  {columnCounts.specialist} / 10
                </p>
              </div>

              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.62rem", color: "#64748b", margin: 0 }}>Onda &lt; 60m</p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f87171", margin: 0, fontFamily: "monospace" }}>
                  {urgentCount} &bull; {breachCount} risco
                </p>
              </div>

              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.62rem", color: "#64748b", margin: 0 }}>Previsão Geral</p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#10b981", margin: 0, fontFamily: "monospace" }}>
                  41m &bull; -16m
                </p>
              </div>
            </div>
          </div>

          {/* 4 KANBAN GATES (COLUMNS) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "0.625rem",
              background: "rgba(255, 255, 255, 0.04)",
              flex: 1,
              padding: "1rem",
              minWidth: 0,
            }}
          >
            {columns.map((col) => {
              const colTickets = tickets.filter((t) => t.columnId === col.id);
              const count = colTickets.length;
              const fillPct = Math.min(100, Math.round((count / col.maxCapacity) * 100));
              const isOver = dragOverColumn === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(col.id, e)}
                  onDragLeave={() => handleDragLeave(col.id)}
                  onDrop={(e) => handleDrop(col.id, e)}
                  style={{
                    background: isOver ? "rgba(16, 185, 129, 0.06)" : "#0b101e",
                    borderRadius: "8px",
                    border: isOver
                      ? "2px dashed #10b981"
                      : "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: "all 0.15s ease",
                    padding: "0.875rem",
                  }}
                >
                  {/* Column Header with Capacity Bar */}
                  <div style={{ marginBottom: "0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                        {col.name}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace", fontWeight: 600 }}>
                        {count} / {col.maxCapacity}
                      </span>
                    </div>

                    {/* Progress capacity bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "rgba(255, 255, 255, 0.07)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${fillPct}%`,
                          height: "100%",
                          backgroundColor: col.accentColor,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* DROPZONE SLOT / PLACEHOLDER WHEN DRAGGING */}
                  {isOver && (
                    <div
                      style={{
                        padding: "1rem",
                        marginBottom: "0.75rem",
                        borderRadius: "8px",
                        border: "2px dashed #10b981",
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        textAlign: "center",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        animation: "pulse 1.5s infinite",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <Zap size={14} />
                      <span>1 vaga livre &bull; Solte para alocar</span>
                    </div>
                  )}

                  {/* Column Ticket Cards */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.625rem",
                      overflowY: "auto",
                      flex: 1,
                      maxHeight: "calc(100vh - 460px)",
                      paddingRight: "2px",
                    }}
                  >
                    {colTickets.length === 0 && !isOver ? (
                      <div
                        style={{
                          padding: "2rem 0.5rem",
                          textAlign: "center",
                          color: "#475569",
                          fontSize: "0.72rem",
                          border: "1px dashed rgba(255, 255, 255, 0.04)",
                          borderRadius: "6px",
                        }}
                      >
                        Nenhum chamado no portal
                      </div>
                    ) : (
                      colTickets.map((card) => {
                        const sevStyle = getSeverityStyle(card.severity);

                        return (
                          <div
                            key={card.id}
                            draggable
                            onDragStart={(e) => handleDragStart(card.id, e)}
                            onClick={() => {
                              if (card.rawLog) {
                                setInspectingTicket(card.rawLog);
                              }
                            }}
                            style={{
                              background: card.confirmed ? "rgba(16, 185, 129, 0.12)" : "rgba(15, 23, 42, 0.8)",
                              border: card.confirmed
                                ? "1px solid rgba(16, 185, 129, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: "8px",
                              padding: "0.75rem",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: card.confirmed ? "0 4px 14px rgba(16, 185, 129, 0.15)" : "none",
                            }}
                          >
                            {/* Card Header: Code & Confirmed Badge */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>
                                  {card.code}
                                </span>
                                <span style={{ color: "#64748b" }}>&bull;</span>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f8fafc" }}>
                                  {card.client}
                                </span>
                              </div>

                              {card.confirmed && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    padding: "0.1rem 0.4rem",
                                    borderRadius: "4px",
                                    background: "#10b981",
                                    color: "#022c22",
                                    fontSize: "0.65rem",
                                    fontWeight: 800,
                                  }}
                                >
                                  <Check size={10} strokeWidth={3} />
                                  Confirmado {card.confirmedTime || "+1m"}
                                </span>
                              )}
                            </div>

                            {/* Problem summary */}
                            <p
                              style={{
                                fontSize: "0.7rem",
                                color: "#94a3b8",
                                margin: "0.25rem 0 0.5rem",
                                lineHeight: 1.3,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {card.problem}
                            </p>

                            {/* Bottom row: Assigned tech, Severity pill, time */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.68rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <span
                                  style={{
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "4px",
                                    color: sevStyle.color,
                                    background: sevStyle.bg,
                                    border: `1px solid ${sevStyle.border}`,
                                    fontWeight: 600,
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  {card.severity}
                                </span>
                                <span style={{ color: "#cbd5e1", fontWeight: 500 }}>
                                  {card.assignedTech || "Lucas T."}
                                </span>
                              </div>

                              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.68rem" }}>
                                {card.slaMinutesLeft > 0 ? `${card.slaMinutesLeft}m` : "SLA OK"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* BOTTOM EVENT LEDGER / DECISION LOG (STREAM AT BOTTOM)          */}
          {/* ============================================================== */}
          <div
            style={{
              padding: "0.6rem 1.25rem",
              background: "#060913",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              overflowX: "auto",
              fontSize: "0.74rem",
              fontFamily: "monospace",
            }}
          >
            {/* Left Pill: Event count */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
              <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: "0.8rem" }}>
                131 eventos
              </span>
              <span style={{ color: "#64748b", fontSize: "0.7rem" }}>Registro de decisões &bull; onda 23</span>
            </div>

            {/* Stream of Decision events */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, overflowX: "auto" }}>
              {decisionEvents.slice(0, 5).map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.25rem 0.6rem",
                    background: evt.isRecent ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.03)",
                    border: evt.isRecent ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "4px",
                    flexShrink: 0,
                    color: evt.isRecent ? "#34d399" : "#94a3b8",
                  }}
                >
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>{evt.code}</span>
                  <span>&bull;</span>
                  <span>{evt.timestamp}</span>
                  <span>&bull;</span>
                  <span style={{ color: "#e2e8f0" }}>{evt.action}</span>
                  <span style={{ color: "#64748b" }}>&bull;</span>
                  <span style={{ color: "#f8fafc", fontWeight: 600 }}>{evt.ticketCode}</span>
                  {evt.targetOrEntity && (
                    <>
                      <span style={{ color: "#64748b" }}>&bull;</span>
                      <span style={{ color: "#cbd5e1" }}>{evt.targetOrEntity}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SLA Scale Tracker along bottom edge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.35rem 2rem",
          background: "#04070f",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          fontSize: "0.65rem",
          color: "#475569",
          fontFamily: "monospace",
        }}
      >
        <span>0 m</span>
        <div style={{ flex: 1, height: "2px", background: "rgba(16, 185, 129, 0.2)", margin: "0 1rem", position: "relative" }}>
          <div style={{ width: "35%", height: "100%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <div style={{ position: "absolute", left: "35%", top: "-3px", width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
        </div>
        <span>20 m</span>
        <span style={{ margin: "0 1rem" }}>40 m</span>
        <span style={{ margin: "0 1rem" }}>60 m</span>
        <span style={{ margin: "0 1rem" }}>80 m</span>
        <span style={{ margin: "0 1rem" }}>100 m</span>
        <span>120 m</span>
      </div>

      {/* ============================================================== */}
      {/* 7. REVIEW ALLOCATION MODAL (EXACT STRUCTURAL REPLICA OF FRAME 11) */}
      {/* ============================================================== */}
      {pendingRouteTicket && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#0f172a",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "12px",
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.15)",
              color: "#e2e8f0",
              animation: "fadeIn 0.2s ease",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Revisar Alocação de Especialista
                </h3>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.2rem 0 0" }}>
                  Alocação no portal: <strong style={{ color: "#34d399" }}>{columns.find((c) => c.id === pendingRouteTicket.targetColumn)?.name}</strong> &bull; {pendingRouteTicket.ticket.code}
                </p>
              </div>
              <button
                onClick={() => setPendingRouteTicket(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid Form (matching frame 11) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Field: Owner / Responsável */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
                  Responsável Técnico
                </label>
                <select
                  value={modalAssignedTech}
                  onChange={(e) => setModalAssignedTech(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#080c16",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.5rem",
                    outline: "none",
                  }}
                >
                  {availableTechs.map((tech) => (
                    <option key={tech} value={tech}>
                      {tech}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field: Severity */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
                  Nível de Severidade
                </label>
                <select
                  value={modalSeverity}
                  onChange={(e) => setModalSeverity(e.target.value as any)}
                  style={{
                    width: "100%",
                    background: "#080c16",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.5rem",
                    outline: "none",
                  }}
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>
            </div>

            {/* Field: Reason / Justificativa */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
                Motivo / Diagnóstico Preliminar
              </label>
              <textarea
                rows={2}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#080c16",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "0.8rem",
                  padding: "0.4rem 0.6rem",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            {/* Grid: Forecast & Shift/Skill */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "0.2rem" }}>
                  Previsão de SLA
                </label>
                <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399", margin: 0 }}>
                  {modalForecast}
                </p>
              </div>

              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "0.2rem" }}>
                  Turno / Competência
                </label>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", margin: 0 }}>
                  23:00 - 07:00 &bull; Suporte N2
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                Confirmação pendente &bull; Ação reversível
              </span>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  onClick={() => setPendingRouteTicket(null)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "transparent",
                    color: "#94a3b8",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRoute}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "6px",
                    border: "1px solid #10b981",
                    background: "linear-gradient(135deg, #059669, #10b981)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  Confirmar Alocação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. FULL DETAILS MODAL (ReportDetailsModal) */}
      {inspectingTicket && (
        <ReportDetailsModal
          log={inspectingTicket}
          onClose={() => setInspectingTicket(null)}
        />
      )}
    </div>
  );
};
