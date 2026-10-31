import React, { useState, useMemo, useEffect } from "react";
import { Cog, Lightbulb, Search, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import { ReportDetailsModal } from "@/components/dashboard/ReportDetailsModal";

export type ColumnId = "backlog" | "pendencias" | "em_progresso" | "finalizadas";

interface ColumnDef {
  id: ColumnId;
  title: string;
  color: string;
  badgeBg: string;
  borderHover: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "backlog",
    title: "Backlog",
    color: "#818cf8",
    badgeBg: "rgba(99, 102, 241, 0.15)",
    borderHover: "rgba(99, 102, 241, 0.5)",
  },
  {
    id: "pendencias",
    title: "Pendências",
    color: "#fbbf24",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    borderHover: "rgba(245, 158, 11, 0.5)",
  },
  {
    id: "em_progresso",
    title: "Em progresso",
    color: "#60a5fa",
    badgeBg: "rgba(59, 130, 246, 0.15)",
    borderHover: "rgba(59, 130, 246, 0.5)",
  },
  {
    id: "finalizadas",
    title: "Finalizadas",
    color: "#34d399",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    borderHover: "rgba(16, 185, 129, 0.5)",
  },
];

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(userId?: string) {
  if (!userId) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name?: string) {
  if (!name) return "US";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "Solucionado":
    case "Finalizadas":
      return {
        label: "Solucionado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.15)",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "Em andamento":
    case "Em progresso":
      return {
        label: "Em progresso",
        color: "#60a5fa",
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.3)",
      };
    case "Pendências":
    case "Aguardando reunião":
      return {
        label: "Pendências",
        color: "#fbbf24",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.3)",
      };
    case "Não foi possível realizar":
      return {
        label: "Não foi possível realizar",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.3)",
      };
    default:
      return {
        label: status || "Backlog",
        color: "#818cf8",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.25)",
      };
  }
}

function getColumnForStatus(status: string): ColumnId {
  const normalized = (status || "").toLowerCase().trim();
  if (
    normalized === "solucionado" ||
    normalized === "finalizadas" ||
    normalized === "finalizado" ||
    normalized === "concluído" ||
    normalized === "concluido"
  ) {
    return "finalizadas";
  }
  if (normalized === "em progresso" || normalized === "em andamento") {
    return "em_progresso";
  }
  if (
    normalized === "pendências" ||
    normalized === "pendencias" ||
    normalized === "pendente" ||
    normalized === "aguardando reunião" ||
    normalized === "aguardando reuniao" ||
    normalized === "não foi possível realizar"
  ) {
    return "pendencias";
  }
  // Coluna padrão inalterável: novos cards de ação técnica e implementação entram aqui
  return "backlog";
}

function getStatusForColumn(colId: ColumnId): string {
  switch (colId) {
    case "finalizadas":
      return "Solucionado";
    case "em_progresso":
      return "Em progresso";
    case "pendencias":
      return "Pendências";
    case "backlog":
    default:
      return "Backlog";
  }
}

interface TechnicianKanbanBoardProps {
  logs: WorkLogItem[];
  currentUserId: string;
  employees: { name: string }[];
  onLogResolved?: () => void;
}

export const TechnicianKanbanBoard: React.FC<TechnicianKanbanBoardProps> = ({
  logs: initialLogs,
  employees,
  onLogResolved,
}) => {
  const [logs, setLogs] = useState<WorkLogItem[]>(initialLogs);
  const [selectedLogForModal, setSelectedLogForModal] = useState<WorkLogItem | null>(null);

  // Drag and Drop state
  const [draggingLogId, setDraggingLogId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Filtros simples
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"" | "technical" | "implementation">("");
  const [filterAuthor, setFilterAuthor] = useState("");

  // Sincroniza quando initialLogs mudar
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const authorOptions = useMemo(() => {
    const list = Array.from(new Set(logs.map((l) => l.user?.name).filter(Boolean)));
    list.sort();
    return list;
  }, [logs]);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          log.requester.toLowerCase().includes(query) ||
          log.clientOrOffice.toLowerCase().includes(query) ||
          log.reportedProblem.toLowerCase().includes(query) ||
          (log.user?.name && log.user.name.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }
      if (filterType === "technical" && !log.technicalAction) return false;
      if (filterType === "implementation" && !log.implementation) return false;
      if (filterAuthor && log.user?.name !== filterAuthor) return false;
      return true;
    });
  }, [logs, searchTerm, filterType, filterAuthor]);

  // Agrupamento por colunas
  const columnsData = useMemo(() => {
    const groups: Record<ColumnId, WorkLogItem[]> = {
      backlog: [],
      pendencias: [],
      em_progresso: [],
      finalizadas: [],
    };

    filteredLogs.forEach((log) => {
      const colId = getColumnForStatus(log.status);
      groups[colId].push(log);
    });

    return groups;
  }, [filteredLogs]);

  // Handlers de Drag and Drop
  const handleDragStart = (logId: string, e: React.DragEvent) => {
    setDraggingLogId(logId);
    e.dataTransfer.setData("text/plain", logId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingLogId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (colId: ColumnId, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: ColumnId, e: React.DragEvent) => {
    // Só limpa se o cursor realmente saiu do container da coluna e não para um elemento interno
    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn((prev) => (prev === colId ? null : prev));
    }
  };

  // Listener global de segurança para limpar o estado de drag quando a ação for finalizada ou cancelada
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggingLogId(null);
      setDragOverColumn(null);
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  const handleDrop = async (targetColId: ColumnId, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const logId = e.dataTransfer.getData("text/plain") || draggingLogId;
    if (!logId) return;

    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const currentColumn = getColumnForStatus(log.status);
    if (currentColumn === targetColId) {
      setDraggingLogId(null);
      return;
    }

    const newStatus = getStatusForColumn(targetColId);

    // Atualização otimista no estado local
    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: newStatus } : l))
    );
    setDraggingLogId(null);

    // Persistência no backend via API
    try {
      if (targetColId === "finalizadas") {
        await api.worklogs.resolve(logId);
      } else {
        await api.worklogs.updateStatus(logId, newStatus);
      }
      onLogResolved?.();
    } catch (err) {
      console.error("[Kanban] Erro ao mover card:", err);
      // Reverte caso dê erro
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: log.status } : l))
      );
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Barra de Filtros limpa e compacta */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "0.875rem 1rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
          {/* Busca por texto */}
          <div style={{ position: "relative", minWidth: "220px", flex: "1 1 240px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              className="input-dark"
              placeholder="Buscar por solicitante, cliente ou problema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "2rem", width: "100%", fontSize: "0.825rem" }}
            />
          </div>

          {/* Filtro por tipo (Ação Técnica / Implementação) */}
          <select
            className="input-dark"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ maxWidth: "180px", flex: "1 1 180px", cursor: "pointer", fontSize: "0.825rem" }}
          >
            <option value="">Todos os tipos</option>
            <option value="technical">Ação Técnica</option>
            <option value="implementation">Implementação</option>
          </select>

          {/* Filtro por autor */}
          <select
            className="input-dark"
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            style={{ maxWidth: "200px", flex: "1 1 200px", cursor: "pointer", fontSize: "0.825rem" }}
          >
            <option value="">Todos os autores</option>
            {authorOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Resumo totalizador */}
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Total exibido: <strong style={{ color: "var(--text-primary)" }}>{filteredLogs.length}</strong> chamados
        </div>
      </div>

      {/* Grid das 4 Colunas do Kanban */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          alignItems: "start",
          minHeight: "calc(100vh - 280px)",
        }}
      >
        {COLUMNS.map((col) => {
          const cardsInCol = columnsData[col.id];
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              data-column-id={col.id}
              onDragOver={(e) => handleDragOver(col.id, e)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(col.id, e)}
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: isOver
                  ? `2px dashed ${col.color}`
                  : "1px solid var(--border)",
                borderRadius: "0.75rem",
                display: "flex",
                flexDirection: "column",
                minHeight: "calc(100vh - 280px)",
                maxHeight: "calc(100vh - 280px)",
                transition: "all 0.15s ease",
                padding: "0.875rem",
                overflow: "hidden",
              }}
            >
              {/* Cabeçalho da Coluna */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.75rem",
                  marginBottom: "0.75rem",
                  borderBottom: `2px solid ${col.color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {col.title}
                  </span>
                  {col.id === "backlog" && (
                    <span
                      title="Coluna padrão onde novos chamados técnicos e implementações são inseridos"
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Padrão
                    </span>
                  )}
                </div>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "22px",
                    height: "22px",
                    padding: "0 0.4rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: col.color,
                    background: col.badgeBg,
                  }}
                >
                  {cardsInCol.length}
                </span>
              </div>

              {/* Slot / Dropzone quando arrastando sobre */}
              {isOver && (
                <div
                  style={{
                    padding: "0.75rem",
                    marginBottom: "0.75rem",
                    borderRadius: "8px",
                    border: `1px dashed ${col.color}`,
                    background: col.badgeBg,
                    color: col.color,
                    textAlign: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Solte aqui para mover para {col.title}
                </div>
              )}

              {/* Lista de Cards da Coluna (Sempre Reduzidos / Compactos) */}
              <div
                onDragOver={(e) => handleDragOver(col.id, e)}
                onDrop={(e) => handleDrop(col.id, e)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  overflowY: "auto",
                  flex: 1,
                  paddingRight: "0.2rem",
                }}
              >
                {cardsInCol.length === 0 && !isOver ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "3rem 1rem",
                      color: "var(--text-muted)",
                      border: "1px dashed var(--border)",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                    }}
                  >
                    Nenhum chamado em {col.title}
                  </div>
                ) : (
                  cardsInCol.map((log) => {
                    const avatarColor = getAvatarColor(log.userId);
                    const statusConfig = getStatusBadgeConfig(log.status);
                    const isSolved = log.status === "Solucionado";
                    const isDragging = draggingLogId === log.id;

                    return (
                      <div
                        key={log.id}
                        data-card-id={log.id}
                        draggable
                        onDragStart={(e) => handleDragStart(log.id, e)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverColumn !== col.id) {
                            setDragOverColumn(col.id);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDrop(col.id, e);
                        }}
                        onClick={() => setSelectedLogForModal(log)}
                        className="card card-hover animate-fade-in"
                        style={{
                          cursor: "grab",
                          position: "relative",
                          padding: "0.875rem",
                          borderColor: isSolved ? "rgba(16, 185, 129, 0.3)" : "var(--border)",
                          background: "var(--bg-card)",
                          opacity: isDragging ? 0.35 : 1,
                          transition: "all 0.15s ease",
                          pointerEvents: draggingLogId && draggingLogId !== log.id ? "none" : "auto",
                        }}
                      >
                        {/* Tags de tipo no canto superior direito */}
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            display: "flex",
                            gap: "4px",
                            zIndex: 10,
                          }}
                        >
                          {log.technicalAction && (
                            <div
                              title="Ação Técnica"
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                background: "#f59e0b",
                                display: "flex",
                                alignItems: "center",
                                justifyCenter: "center",
                                border: "1.5px solid #0d1322",
                              }}
                            >
                              <Cog size={10} color="white" style={{ margin: "auto" }} />
                            </div>
                          )}
                          {log.implementation && (
                            <div
                              title="Implementação"
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                background: "#3b82f6",
                                display: "flex",
                                alignItems: "center",
                                justifyCenter: "center",
                                border: "1.5px solid #0d1322",
                              }}
                            >
                              <Lightbulb size={10} color="white" style={{ margin: "auto" }} />
                            </div>
                          )}
                        </div>

                        {/* Header do Card Reduzido: Avatar e Autor */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.5rem",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <div
                            className="avatar"
                            style={{
                              background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}aa)`,
                              width: "26px",
                              height: "26px",
                              fontSize: "0.68rem",
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(log.user?.name)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {log.user?.name || "Autor desconhecido"}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{ marginBottom: "0.5rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              color: statusConfig.color,
                              background: statusConfig.bg,
                              border: `1px solid ${statusConfig.border}`,
                            }}
                          >
                            {isSolved && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Solicitante & Escritório (Grid 2 colunas) */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0.5rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "0 0 0.1rem" }}>
                              Solicitante
                            </p>
                            <p
                              style={{
                                fontSize: "0.76rem",
                                color: "var(--text-primary)",
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {log.requester}
                            </p>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "0 0 0.1rem" }}>
                              Escritório
                            </p>
                            <p
                              style={{
                                fontSize: "0.76rem",
                                color: "#e0e7ff",
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {log.clientOrOffice}
                            </p>
                          </div>
                        </div>

                        {/* Problema relatado (compacto, até 2 linhas) */}
                        <div>
                          <p style={{ fontSize: "0.68rem", color: "#f87171", margin: "0 0 0.1rem", fontWeight: 600 }}>
                            Problema relatado
                          </p>
                          <p
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-secondary)",
                              lineHeight: 1.35,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              margin: 0,
                            }}
                          >
                            {log.reportedProblem}
                          </p>
                        </div>

                        {/* Rodapé: Data */}
                        <div
                          style={{
                            marginTop: "0.5rem",
                            paddingTop: "0.35rem",
                            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            justifyContent: "flex-end",
                            fontSize: "0.65rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          <span>{formatDate(log.createdAt)}</span>
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

      {/* Modal de Detalhes Completo ao Clicar no Card */}
      {selectedLogForModal && (
        <ReportDetailsModal
          log={selectedLogForModal}
          onClose={() => setSelectedLogForModal(null)}
        />
      )}
    </div>
  );
};
