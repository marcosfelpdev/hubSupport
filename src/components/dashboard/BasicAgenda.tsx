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

const categoryBadgeConfig: Record<AgendaEvent["category"], { badgeClass: string }> = {
  Reunião: {
    badgeClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  Atendimento: {
    badgeClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  Técnico: {
    badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  Lembrete: {
    badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
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
    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col h-full min-h-[580px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <CalendarIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Agenda de Atendimentos
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Agenda funcional básica da equipe
              </p>
            </div>
          </div>

          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-wider shrink-0">
            Básica
          </span>
        </div>

        {/* Navegação do Mês */}
        <div className="flex items-center justify-between mt-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-xl">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
              {monthName}
            </span>
            <button
              onClick={goToToday}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c273e] shadow-2xs transition-colors cursor-pointer"
            >
              Hoje
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726]">
        {/* Cabeçalho dias da semana */}
        <div className="grid grid-cols-7 text-center mb-1">
          {weekDays.map((d, i) => (
            <span
              key={i}
              className="text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.slice(0, 35).map((day, idx) => {
            const isSelected = day.dateStr === selectedDate;
            const isToday = day.dateStr === todayStr;
            const hasEvent = daysWithEvents.has(day.dateStr);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day.dateStr)}
                className={`h-7 flex flex-col items-center justify-center rounded-lg text-xs font-semibold relative transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs font-bold"
                    : isToday
                    ? "border border-indigo-400 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold"
                    : day.isCurrentMonth
                    ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              >
                <span>{day.dayNum}</span>
                {hasEvent && (
                  <span
                    className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                      isSelected ? "bg-white dark:bg-slate-900" : "bg-indigo-600 dark:bg-indigo-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção do Dia Selecionado */}
      <div className="flex-1 flex flex-col overflow-y-auto p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
              {selectedDateFormatted}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5">
              ({selectedDayEvents.length} {selectedDayEvents.length === 1 ? "item" : "itens"})
            </span>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              showAddForm
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                : "bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-700 shadow-2xs"
            }`}
          >
            <Plus
              size={12}
              className={`transition-transform duration-150 ${showAddForm ? "rotate-45" : ""}`}
            />
            {showAddForm ? "Cancelar" : "Novo"}
          </button>
        </div>

        {/* Formulário Rápido de Adição */}
        {showAddForm && (
          <form
            onSubmit={handleAddEvent}
            className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 animate-fade-in"
          >
            <input
              type="text"
              placeholder="Título do compromisso / reunião..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              required
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors"
            />

            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-24 px-2 py-1 text-xs bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none"
              />

              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as AgendaEvent["category"])}
                className="flex-1 px-2 py-1 text-xs bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none cursor-pointer"
              >
                <option value="Reunião">Reunião</option>
                <option value="Atendimento">Atendimento</option>
                <option value="Técnico">Técnico</option>
                <option value="Lembrete">Lembrete</option>
              </select>

              <button
                type="submit"
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </form>
        )}

        {/* Lista de Eventos do Dia */}
        <div className="flex flex-col gap-2 flex-1">
          {selectedDayEvents.length === 0 ? (
            <div className="py-8 px-4 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
              <CalendarIcon size={24} className="opacity-40 text-slate-400 dark:text-slate-500" />
              <span>Nenhum compromisso agendado para este dia.</span>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline cursor-pointer"
              >
                + Adicionar para {selectedDateFormatted}
              </button>
            </div>
          ) : (
            selectedDayEvents.map((evt) => {
              const catConfig = categoryBadgeConfig[evt.category] || categoryBadgeConfig.Reunião;

              return (
                <div
                  key={evt.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all duration-150 ${
                    evt.completed
                      ? "bg-slate-50/80 dark:bg-[#0b0f19]/80 border-slate-200 dark:border-slate-800/80 opacity-60"
                      : "bg-white dark:bg-[#161f33] border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(evt.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer mt-0.5 shrink-0 transition-colors ${
                      evt.completed
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0b0f19] hover:border-slate-400 dark:hover:border-slate-500"
                    }`}
                    title={evt.completed ? "Marcar como pendente" : "Marcar como concluído"}
                  >
                    {evt.completed && <Check size={11} strokeWidth={3} />}
                  </button>

                  {/* Informações */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                        <Clock size={10} className="text-slate-400 dark:text-slate-500" /> {evt.time}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${catConfig.badgeClass}`}
                      >
                        {evt.category}
                      </span>
                    </div>

                    <span
                      className={`text-xs block leading-snug break-words ${
                        evt.completed
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-200 font-medium"
                      }`}
                    >
                      {evt.title}
                    </span>
                  </div>

                  {/* Botão Deletar */}
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer rounded"
                    title="Excluir compromisso"
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
      <div className="p-3 bg-slate-50 dark:bg-[#0b0f19] border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <AlertCircle size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
        <span>Módulo de agenda em fase básica; novas integrações serão implementadas em breve.</span>
      </div>
    </div>
  );
};
