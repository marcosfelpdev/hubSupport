import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label?: string;    // Rótulo amigável (ex: "Hoje", "15/10/2026 - 02/11/2026")
}

export interface DateRangePopoverProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onClear: () => void;
  className?: string;
}

export function toLocalDateStr(dateVal: Date | string): string {
  const d = new Date(dateVal);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatYMDToBR(ymd: string): string {
  if (!ymd) return "";
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function DateRangePopover({
  value,
  onChange,
  onClear,
  className = "",
}: DateRangePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(value.startDate || "");
  const [tempEnd, setTempEnd] = useState(value.endDate || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sincroniza campos temporários quando o popover é aberto ou quando o valor externo muda
  useEffect(() => {
    if (isOpen) {
      setTempStart(value.startDate || "");
      setTempEnd(value.endDate || "");
    }
  }, [isOpen, value.startDate, value.endDate]);

  // Fecha o popover ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isActive = Boolean(value.startDate || value.endDate);

  // Formata o texto exibido no gatilho
  const displayLabel = useMemo(() => {
    if (value.label) return value.label;
    if (value.startDate && value.endDate) {
      if (value.startDate === value.endDate) {
        return formatYMDToBR(value.startDate);
      }
      return `${formatYMDToBR(value.startDate)} - ${formatYMDToBR(value.endDate)}`;
    }
    if (value.startDate) return `A partir de ${formatYMDToBR(value.startDate)}`;
    if (value.endDate) return `Até ${formatYMDToBR(value.endDate)}`;
    return "Filtrar período";
  }, [value]);

  // Manipulador para atalhos rápidos
  const handlePresetSelect = (
    preset: "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "clear"
  ) => {
    const today = new Date();
    const todayStr = toLocalDateStr(today);

    if (preset === "clear") {
      onClear();
      setTempStart("");
      setTempEnd("");
      setIsOpen(false);
      return;
    }

    if (preset === "today") {
      onChange({ startDate: todayStr, endDate: todayStr, label: "Hoje" });
      setIsOpen(false);
      return;
    }

    if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalDateStr(yesterday);
      onChange({
        startDate: yesterdayStr,
        endDate: yesterdayStr,
        label: "Ontem",
      });
      setIsOpen(false);
      return;
    }

    if (preset === "last7") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      onChange({
        startDate: toLocalDateStr(past7),
        endDate: todayStr,
        label: "Últimos 7 dias",
      });
      setIsOpen(false);
      return;
    }

    if (preset === "last30") {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 29);
      onChange({
        startDate: toLocalDateStr(past30),
        endDate: todayStr,
        label: "Últimos 30 dias",
      });
      setIsOpen(false);
      return;
    }

    if (preset === "thisMonth") {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onChange({
        startDate: toLocalDateStr(firstOfMonth),
        endDate: todayStr,
        label: "Este mês",
      });
      setIsOpen(false);
      return;
    }
  };

  // Aplicação de período customizado
  const handleApplyCustom = () => {
    let start = tempStart;
    let end = tempEnd;

    if (!start && !end) {
      onClear();
      setIsOpen(false);
      return;
    }

    // Se as duas datas estiverem preenchidas e a inicial for posterior à final, inverte
    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }

    let customLabel = "";
    if (start && end) {
      customLabel =
        start === end
          ? formatYMDToBR(start)
          : `${formatYMDToBR(start)} - ${formatYMDToBR(end)}`;
    } else if (start) {
      customLabel = `A partir de ${formatYMDToBR(start)}`;
    } else if (end) {
      customLabel = `Até ${formatYMDToBR(end)}`;
    }

    onChange({
      startDate: start,
      endDate: end,
      label: customLabel,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setTempStart("");
    setTempEnd("");
    setIsOpen(false);
  };

  // Determina se um atalho está ativo
  const isPresetActive = (preset: "today" | "yesterday" | "last7" | "last30" | "thisMonth") => {
    const today = new Date();
    const todayStr = toLocalDateStr(today);

    if (preset === "today") {
      return (
        value.label === "Hoje" ||
        (value.startDate === todayStr && value.endDate === todayStr)
      );
    }
    if (preset === "yesterday") {
      return (
        value.label === "Ontem" ||
        (value.startDate === toLocalDateStr(new Date(Date.now() - 86400000)) &&
          value.endDate === toLocalDateStr(new Date(Date.now() - 86400000)))
      );
    }
    if (preset === "last7") {
      return value.label === "Últimos 7 dias";
    }
    if (preset === "last30") {
      return value.label === "Últimos 30 dias";
    }
    if (preset === "thisMonth") {
      return value.label === "Este mês";
    }
    return false;
  };

  const presetButtonClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors text-left cursor-pointer border ${
      active
        ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700 font-semibold"
        : "bg-slate-50 dark:bg-[#0b0f19] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
    }`;

  return (
    <div className={`relative ${className || "w-full"}`} ref={popoverRef}>
      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-xl cursor-pointer shadow-xs transition-colors w-full ${
          isActive
            ? "bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 font-medium hover:border-sky-400 dark:hover:border-sky-600"
            : "bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
        title={isActive ? `Período ativo: ${displayLabel}` : "Filtrar por período de datas"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar
            size={14}
            className={
              isActive
                ? "text-sky-600 dark:text-sky-400 shrink-0"
                : "text-slate-400 dark:text-slate-500 shrink-0"
            }
          />
          <span className="truncate">{displayLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Botão de limpeza rápida direta no gatilho */}
          {isActive && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                setTempStart("");
                setTempEnd("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                  setTempStart("");
                  setTempEnd("");
                }
              }}
              className="p-0.5 rounded-md hover:bg-sky-200/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Limpar período"
              aria-label="Limpar período"
            >
              <X size={12} />
            </span>
          )}

          <ChevronDown
            size={14}
            className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Painel Popover Flutuante */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 md:left-0 z-50 w-72 sm:w-80 shadow-xl rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col gap-3 animate-fade-in"
          role="dialog"
          aria-label="Selecionar período de datas"
        >
          {/* Header do Popover */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Período de Atendimento
            </span>
            {isActive && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                Ativo
              </span>
            )}
          </div>

          {/* Atalhos Rápidos */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Atalhos rápidos
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePresetSelect("today")}
                className={presetButtonClass(isPresetActive("today"))}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("yesterday")}
                className={presetButtonClass(isPresetActive("yesterday"))}
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("last7")}
                className={presetButtonClass(isPresetActive("last7"))}
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("last30")}
                className={presetButtonClass(isPresetActive("last30"))}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("thisMonth")}
                className={presetButtonClass(isPresetActive("thisMonth"))}
              >
                Este mês
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("clear")}
                className="px-2.5 py-1.5 text-xs rounded-lg font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer border border-transparent"
              >
                Todos os períodos
              </button>
            </div>
          </div>

          {/* Campos Customizados De / Até */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              Intervalo personalizado
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  De:
                </label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Até:
                </label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-1">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
