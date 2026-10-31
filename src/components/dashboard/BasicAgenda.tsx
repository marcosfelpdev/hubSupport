import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Check,
  Trash2,
  AlertCircle,
  Tag,
  CheckCircle2,
} from "lucide-react";

export interface AgendaEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  category: "Reunião" | "Atendimento" | "Técnico" | "Lembrete";
  completed: boolean;
}

const STORAGE_KEY = "hubsupport_agenda_events_v1";

const initialSampleEvents: AgendaEvent[] = [
  {
    id: "evt-1",
    date: new Date().toISOString().split("T")[0],
    time: "09:30",
    title: "Alinhamento com equipe de suporte e triagem",
    category: "Reunião",
    completed: true,
  },
  {
    id: "evt-2",
    date: new Date().toISOString().split("T")[0],
    time: "14:00",
    title: "Validação de chamado técnico #402 (Filial Curitiba)",
    category: "Técnico",
    completed: false,
  },
  {
    id: "evt-3",
    date: new Date().toISOString().split("T")[0],
    time: "16:30",
    title: "Reunião de feedback de usabilidade com cliente",
    category: "Reunião",
    completed: false,
  },
];

const categoryColors: Record<AgendaEvent["category"], { bg: string; color: string; border: string }> = {
  Reunião: {
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    border: "rgba(59, 130, 246, 0.3)",
  },
  Atendimento: {
    bg: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    border: "rgba(168, 85, 247, 0.3)",
  },
  Técnico: {
    bg: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    border: "rgba(245, 158, 11, 0.3)",
  },
  Lembrete: {
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    border: "rgba(16, 185, 129, 0.3)",
  },
};

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

export const BasicAgenda: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0]
  );
  const [events, setEvents] = useState<AgendaEvent[]>(() => {
    if (typeof window === "undefined") return initialSampleEvents;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return initialSampleEvents;
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const [newCategory, setNewCategory] = useState<AgendaEvent["category"]>("Reunião");

  // Salvar no localStorage sempre que houver mudanças
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  // Funções do calendário
  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now.toISOString().split("T")[0]);
  };

  // Gerar dias do mês
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Dias do mês anterior para preencher
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dayNum);
      days.push({
        dateStr: prevDate.toISOString().split("T")[0],
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const curDate = new Date(year, month, i);
      days.push({
        dateStr: curDate.toISOString().split("T")[0],
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Completar última semana se necessário
    const remainingDays = 42 - days.length; // 6 semanas completas
    if (remainingDays > 0 && remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({
          dateStr: nextDate.toISOString().split("T")[0],
          dayNum: i,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [currentMonth]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [events, selectedDate]);

  // Mapeamento de dias que possuem eventos para pintar bolinhas no calendário
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.date));
    return set;
  }, [events]);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newEvent: AgendaEvent = {
      id: `evt-${Date.now()}`,
      date: selectedDate,
      time: newTime || "09:00",
      title: newTitle.trim(),
      category: newCategory,
      completed: false,
    };

    setEvents((prev) => [...prev, newEvent]);
    setNewTitle("");
    setShowAddForm(false);
  };

  const handleToggleComplete = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const monthName = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const selectedDateFormatted = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }, [selectedDate]);

  const todayStr = today.toISOString().split("T")[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.875rem",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        height: "100%",
        minHeight: "580px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "rgba(15, 23, 42, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
              }}
            >
              <CalendarIcon size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                Agenda de Atendimentos
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                Agenda funcional básica da equipe
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              padding: "0.2rem 0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#93c5fd",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Básica
          </span>
        </div>

        {/* Navegação do Mês */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "0.75rem",
            backgroundColor: "rgba(8, 12, 22, 0.6)",
            padding: "0.35rem 0.5rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
          }}
        >
          <button
            onClick={prevMonth}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0.2rem",
              display: "flex",
              alignItems: "center",
            }}
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.825rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "capitalize",
              }}
            >
              {monthName}
            </span>
            <button
              onClick={goToToday}
              style={{
                fontSize: "0.68rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "0.25rem",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                color: "#a5b4fc",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                cursor: "pointer",
              }}
            >
              Hoje
            </button>
          </div>

          <button
            onClick={nextMonth}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0.2rem",
              display: "flex",
              alignItems: "center",
            }}
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div
        style={{
          padding: "0.75rem 1rem 0.5rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Cabeçalho dias da semana */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            textAlign: "center",
            marginBottom: "0.35rem",
          }}
        >
          {weekDays.map((d, i) => (
            <span
              key={i}
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grade de dias */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
          }}
        >
          {calendarDays.slice(0, 35).map((day, idx) => {
            const isSelected = day.dateStr === selectedDate;
            const isToday = day.dateStr === todayStr;
            const hasEvent = daysWithEvents.has(day.dateStr);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day.dateStr)}
                style={{
                  height: "28px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: isSelected
                    ? "1px solid #6366f1"
                    : isToday
                    ? "1px solid rgba(99, 102, 241, 0.4)"
                    : "1px solid transparent",
                  backgroundColor: isSelected
                    ? "rgba(99, 102, 241, 0.25)"
                    : isToday
                    ? "rgba(99, 102, 241, 0.1)"
                    : "transparent",
                  color: isSelected
                    ? "#ffffff"
                    : day.isCurrentMonth
                    ? "var(--text-primary)"
                    : "rgba(148, 163, 184, 0.3)",
                  fontSize: "0.75rem",
                  fontWeight: isSelected || isToday ? 700 : 500,
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.12s ease",
                  padding: 0,
                }}
              >
                <span>{day.dayNum}</span>
                {hasEvent && (
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: isSelected ? "#ffffff" : "#60a5fa",
                      position: "absolute",
                      bottom: "2px",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção do Dia Selecionado */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          padding: "0.875rem 1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.825rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                textTransform: "capitalize",
              }}
            >
              {selectedDateFormatted}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginLeft: "0.4rem",
              }}
            >
              ({selectedDayEvents.length} {selectedDayEvents.length === 1 ? "item" : "itens"})
            </span>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "0.25rem 0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: showAddForm ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
              color: showAddForm ? "#fca5a5" : "#a5b4fc",
              border: `1px solid ${showAddForm ? "rgba(239, 68, 68, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Plus size={12} style={{ transform: showAddForm ? "rotate(45deg)" : "none", transition: "transform 0.15s ease" }} />
            {showAddForm ? "Cancelar" : "Novo"}
          </button>
        </div>

        {/* Formulário Rápido de Adição */}
        {showAddForm && (
          <form
            onSubmit={handleAddEvent}
            style={{
              marginBottom: "0.75rem",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <input
              type="text"
              placeholder="Título do compromisso / reunião..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              required
              style={{
                width: "100%",
                padding: "0.4rem 0.6rem",
                fontSize: "0.78rem",
                borderRadius: "0.375rem",
                backgroundColor: "rgba(8, 12, 22, 0.8)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                style={{
                  width: "90px",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgba(8, 12, 22, 0.8)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />

              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as AgendaEvent["category"])}
                style={{
                  flex: 1,
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgba(8, 12, 22, 0.8)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                <option value="Reunião">Reunião</option>
                <option value="Atendimento">Atendimento</option>
                <option value="Técnico">Técnico</option>
                <option value="Lembrete">Lembrete</option>
              </select>

              <button
                type="submit"
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "0.375rem",
                  backgroundColor: "#6366f1",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Salvar
              </button>
            </div>
          </form>
        )}

        {/* Lista de Eventos do Dia */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
          {selectedDayEvents.length === 0 ? (
            <div
              style={{
                padding: "1.5rem 1rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <CalendarIcon size={24} style={{ opacity: 0.3 }} />
              <span>Nenhum compromisso agendado para este dia.</span>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.72rem",
                  color: "#818cf8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                + Adicionar para {selectedDateFormatted}
              </button>
            </div>
          ) : (
            selectedDayEvents.map((evt) => {
              const catConfig = categoryColors[evt.category] || categoryColors.Reunião;

              return (
                <div
                  key={evt.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.625rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: evt.completed
                      ? "rgba(15, 23, 42, 0.3)"
                      : "rgba(15, 23, 42, 0.65)",
                    border: "1px solid",
                    borderColor: evt.completed
                      ? "rgba(255, 255, 255, 0.05)"
                      : "var(--border)",
                    opacity: evt.completed ? 0.65 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(evt.id)}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "4px",
                      border: evt.completed
                        ? "1px solid #10b981"
                        : "1px solid var(--border-light)",
                      backgroundColor: evt.completed
                        ? "#10b981"
                        : "rgba(8, 12, 22, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#fff",
                      flexShrink: 0,
                      marginTop: "2px",
                      padding: 0,
                    }}
                    title={evt.completed ? "Marcar como pendente" : "Marcar como concluído"}
                  >
                    {evt.completed && <Check size={12} strokeWidth={3} />}
                  </button>

                  {/* Informações */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--text-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Clock size={10} /> {evt.time}
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          padding: "0.08rem 0.35rem",
                          borderRadius: "3px",
                          backgroundColor: catConfig.bg,
                          color: catConfig.color,
                          border: `1px solid ${catConfig.border}`,
                        }}
                      >
                        {evt.category}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: evt.completed ? "var(--text-muted)" : "var(--text-primary)",
                        textDecoration: evt.completed ? "line-through" : "none",
                        lineHeight: 1.3,
                        display: "block",
                        wordBreak: "break-word",
                      }}
                    >
                      {evt.title}
                    </span>
                  </div>

                  {/* Botão Deletar */}
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "0.15rem",
                      opacity: 0.6,
                      transition: "opacity 0.15s ease",
                    }}
                    title="Excluir compromisso"
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: "0.75rem 1rem",
          backgroundColor: "rgba(8, 12, 22, 0.4)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
        }}
      >
        <AlertCircle size={13} style={{ color: "#60a5fa", flexShrink: 0 }} />
        <span>Módulo de agenda em fase básica; novas integrações serão implementadas em breve.</span>
      </div>
    </div>
  );
};
