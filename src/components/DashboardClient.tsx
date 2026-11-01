

import { useMemo, useState } from "react";
import { Cog, Lightbulb } from "lucide-react";
import WorkLogForm from "@/components/WorkLogForm";
import ScreenRecorderButton from "@/components/ScreenRecorderButton";
import AiReportSection from "@/components/AiReportSection";
import TagBadge from "@/components/TagBadge";
import { WorkLog } from "@/components/WorkLogFeed";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";

interface DashboardProps {
  logs: any[];
  currentUserId: string;
  employees: { name: string }[];
  onLogCreated?: () => void;
}

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "Solucionado":
      return {
        label: "Solucionado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.15)",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "Realizado":
    case "Já realizado":
      return {
        label: "Já realizado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.3)",
      };
    case "Em andamento":
      return {
        label: "Em andamento",
        color: "#60a5fa",
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.3)",
      };
    case "Aguardando reunião":
      return {
        label: "Aguardando reunião",
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
        label: status || "Registrado",
        color: "#818cf8",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.25)",
      };
  }
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function getMediaPaths(log: WorkLog): string[] {
  try {
    return JSON.parse(log.media || "[]");
  } catch {
    return [];
  }
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
}

export default function DashboardClient({ logs, currentUserId, employees, onLogCreated }: DashboardProps) {
  const { isRecording } = useScreenRecording();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<File | null>(null);
  const [filters, setFilters] = useState({
    requester: "",
    clientOrOffice: "",
    date: "",
    status: "",
    employee: "",
    tag: "",
  });

  const handleRecordingComplete = (file: File) => {
    setRecordedVideo(file);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (recordedVideo) {
      if (
        confirm(
          "Você possui uma gravação de tela anexada. Deseja realmente fechar o formulário e descartar o vídeo?"
        )
      ) {
        setRecordedVideo(null);
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(false);
    }
  };

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaCurrentIndex, setMediaCurrentIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<string[]>([]);

  const tagOptions = useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.tag?.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [logs]);

  const employeeOptions = useMemo(() => {
    const unique = Array.from(new Set(employees.map((e) => e.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [employees]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.status).filter(Boolean)));
    unique.sort();
    return unique;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRequester = filters.requester
        ? log.requester.toLowerCase().includes(filters.requester.toLowerCase())
        : true;
      const matchesClient = filters.clientOrOffice
        ? log.clientOrOffice.toLowerCase().includes(filters.clientOrOffice.toLowerCase())
        : true;
      const matchesDate = filters.date
        ? new Date(log.createdAt).toISOString().split("T")[0] === filters.date
        : true;
      const matchesStatus = filters.status ? log.status === filters.status : true;
      const matchesEmployee = filters.employee ? log.user.name === filters.employee : true;
      const matchesTag = filters.tag ? log.tag?.name === filters.tag : true;
      return matchesRequester && matchesClient && matchesDate && matchesStatus && matchesEmployee && matchesTag;
    });
  }, [logs, filters]);

  const validSelectedLogId = useMemo(() => {
    if (!selectedLogId) return filteredLogs.length > 0 ? filteredLogs[0].id : null;
    if (filteredLogs.find((l) => l.id === selectedLogId)) return selectedLogId;
    return filteredLogs.length > 0 ? filteredLogs[0].id : null;
  }, [selectedLogId, filteredLogs]);

  const selectedLog = logs.find((log) => log.id === validSelectedLogId);

  function openMediaModal(log: WorkLog, startIndex = 0) {
    const paths = getMediaPaths(log);
    setMediaItems(paths);
    setMediaCurrentIndex(startIndex);
    setMediaModalOpen(true);
  }

  return (
    <main className="animate-fade-in" style={{ maxWidth: "1600px", padding: "2rem 2.5rem", width: "100%" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          Dashboard de Atendimentos
        </h1>
      </div>

      <div style={{ marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <button
          className="btn-primary"
          disabled={isRecording}
          onClick={() => {
            if (isRecording) return;
            setRecordedVideo(null);
            setIsModalOpen(true);
          }}
          style={{
            opacity: isRecording ? 0.45 : 1,
            cursor: isRecording ? "not-allowed" : "pointer",
          }}
          title={isRecording ? "Finalize a gravação de tela para abrir o formulário manualmente" : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Atendimento
        </button>

        <ScreenRecorderButton onRecordingComplete={handleRecordingComplete} />
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="input-dark"
          placeholder="Pesquisar por solicitante"
          value={filters.requester}
          onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
          style={{ maxWidth: "200px", flex: "1 1 200px" }}
        />
        <input
          type="text"
          className="input-dark"
          placeholder="Pesquisar por escritório/cliente"
          value={filters.clientOrOffice}
          onChange={(e) => setFilters({ ...filters, clientOrOffice: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px" }}
        />
        <input
          type="date"
          className="input-dark"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          style={{ maxWidth: "180px", flex: "1 1 180px" }}
        />
        <select
          className="input-dark"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px", cursor: "pointer" }}
        >
          <option value="">Todos os status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {getStatusBadgeConfig(status).label}
            </option>
          ))}
        </select>
        <select
          className="input-dark"
          value={filters.tag}
          onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
          style={{ maxWidth: "200px", flex: "1 1 200px", cursor: "pointer" }}
        >
          <option value="">Todas as plataformas / tags</option>
          {tagOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="input-dark"
          value={filters.employee}
          onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px", cursor: "pointer" }}
        >
          <option value="">Todos os funcionários</option>
          {employeeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "1.5rem",
          alignItems: "start",
          minHeight: "calc(100vh - 280px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxHeight: "calc(100vh - 300px)",
            overflowY: "auto",
            paddingRight: "0.25rem",
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem 1rem", borderStyle: "dashed" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Nenhum atendimento encontrado</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === validSelectedLogId;
              return (
                <ReportCardMinimized
                  key={log.id}
                  id={`card-daily-${log.id}`}
                  log={log}
                  isSelected={isSelected}
                  onClick={() => setSelectedLogId(log.id)}
                />
              );
            })
          )}
        </div>

        <div className="card" style={{ minHeight: "calc(100vh - 300px)", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
          {selectedLog ? (
            <div className="animate-fade-in">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  paddingBottom: "0.875rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    className="avatar"
                    style={{
                      background: `linear-gradient(135deg, ${getAvatarColor(selectedLog.userId)}, ${getAvatarColor(selectedLog.userId)}aa)`,
                    }}
                  >
                    {getInitials(selectedLog.user.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {selectedLog.user.name}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Registrado em {formatDate(selectedLog.createdAt)} às{" "}
                      {new Date(selectedLog.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Tipo tags no card expandido (abaixo do badge de status, canto direito) */}
                <div
                  style={{
                    position: "absolute",
                    top: "3.2rem",
                    right: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    zIndex: 10,
                  }}
                >
                  {selectedLog.technicalAction && (
                    <div
                      style={{
                        width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#f59e0b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid #0d1322",
                        }}
                      >
                        <Cog size={9} strokeWidth={1.5} color="white" />
                      </div>
                    )}
                    {selectedLog.implementation && (
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#3b82f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid #0d1322",
                        }}
                      >
                        <Lightbulb size={9} strokeWidth={1.5} color="white" />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {selectedLog.tag && <TagBadge name={selectedLog.tag.name} color={selectedLog.tag.color} size="md" />}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.25rem 0.7rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: getStatusBadgeConfig(selectedLog.status).color,
                      background: getStatusBadgeConfig(selectedLog.status).bg,
                      border: `1px solid ${getStatusBadgeConfig(selectedLog.status).border}`,
                    }}
                  >
                    {getStatusBadgeConfig(selectedLog.status).label}
                  </span>
                </div>
              </div>

              {/* Título do Atendimento (se houver) */}
              {selectedLog.title && (
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    borderRadius: "8px",
                    padding: "0.875rem 1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <p style={{ fontSize: "0.72rem", color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Título do Atendimento
                  </p>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    {selectedLog.title}
                  </h3>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    flex: "1 1 250px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Solicitante
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                    {selectedLog.requester}
                  </p>
                </div>
                <div
                  style={{
                    flex: "1 1 250px",
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "#a5b4fc", marginBottom: "0.375rem" }}>
                    Escritório / Cliente
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "#e0e7ff", fontWeight: 600 }}>
                    {selectedLog.clientOrOffice}
                  </p>
                </div>
                {selectedLog.tag && (
                  <div
                    style={{
                      flex: "1 1 200px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.75rem",
                    }}
                  >
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                      Plataforma / Tag
                    </p>
                    <div style={{ marginTop: "0.25rem" }}>
                      <TagBadge name={selectedLog.tag.name} color={selectedLog.tag.color} size="md" />
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Mídia */}
              {getMediaPaths(selectedLog).length > 0 && (
                <button
                  onClick={() => openMediaModal(selectedLog)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.625rem 1rem",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    borderRadius: "8px",
                    color: "#818cf8",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    marginBottom: "1rem",
                    transition: "all 0.2s",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Mídia ({getMediaPaths(selectedLog).length})
                </button>
              )}

              {/* Seção Relatório de IA */}
              <AiReportSection
                workLogId={selectedLog.id}
                initialReport={selectedLog.aiReport}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#f87171",
                      marginBottom: "0.625rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Descrição
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                    {selectedLog.reportedProblem}
                  </p>
                </div>

                {selectedLog.actionTaken && selectedLog.actionTaken.trim() !== "" ? (
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#34d399",
                        marginBottom: "0.625rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Ação realizada
                    </p>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                      {selectedLog.actionTaken}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Selecione um atendimento para visualizar os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-in",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              animation: "slideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              style={{
                position: "absolute",
                top: "0.75rem",
                right: "0.75rem",
                zIndex: 10,
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid var(--border-light)",
                color: "var(--text-muted)",
                borderRadius: "6px",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <WorkLogForm
              recordedVideo={recordedVideo}
              onDiscardRecording={() => setRecordedVideo(null)}
              onSuccess={() => {
                setIsModalOpen(false);
                setRecordedVideo(null);
                onLogCreated?.();
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Carousel de Mídia */}
      {mediaModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            backdropFilter: "blur(8px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-in",
          }}
          onClick={() => setMediaModalOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: "12px",
              background: "#000",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com contador e fechar */}
            <div
              style={{
                position: "absolute",
                top: "1rem",
                left: "0",
                right: "0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 1rem",
                zIndex: 20,
                color: "white",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 500, background: "rgba(0,0,0,0.5)", padding: "0.25rem 0.75rem", borderRadius: "20px" }}>
                {mediaCurrentIndex + 1} / {mediaItems.length}
              </div>
              <button
                onClick={() => setMediaModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Conteúdo da mídia atual */}
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {mediaItems[mediaCurrentIndex] && (
                <div>
                  {isImage(mediaItems[mediaCurrentIndex]) ? (
                    <img
                      src={mediaItems[mediaCurrentIndex]}
                      alt="Mídia"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "80vh",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : (
                    <video
                      src={mediaItems[mediaCurrentIndex]}
                      controls
                      autoPlay
                      style={{
                        maxWidth: "100%",
                        maxHeight: "80vh",
                        display: "block",
                        background: "#000",
                      }}
                    />
                  )}
                </div>
              )}

              {/* Setas de navegação */}
              {mediaItems.length > 1 && (
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaCurrentIndex((i) => (i === 0 ? mediaItems.length - 1 : i - 1));
                    }}
                    style={{
                      position: "absolute",
                      left: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(255,255,255,0.2)",
                      border: "none",
                      color: "white",
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 30,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaCurrentIndex((i) => (i === mediaItems.length - 1 ? 0 : i + 1));
                    }}
                    style={{
                      position: "absolute",
                      right: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(255,255,255,0.2)",
                      border: "none",
                      color: "white",
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 30,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
