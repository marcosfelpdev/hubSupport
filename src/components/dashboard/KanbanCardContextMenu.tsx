import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  ArrowRight,
  Archive,
  Trash2,
  ChevronRight,
  Check,
} from "lucide-react";
import { WorkLogItem } from "@/services/api";
import {
  COLUMNS,
  ColumnId,
  getColumnForStatus,
} from "./TechnicianKanbanBoard";

export interface KanbanCardContextMenuProps {
  log: WorkLogItem;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onEdit: (log: WorkLogItem) => void;
  onMoveColumn: (targetColId: ColumnId) => void;
  onArchive: (log: WorkLogItem) => void;
  onDelete: (log: WorkLogItem) => void;
}

export const KanbanCardContextMenu: React.FC<KanbanCardContextMenuProps> = ({
  log,
  position,
  onClose,
  onEdit,
  onMoveColumn,
  onArchive,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);

  const currentColId = getColumnForStatus(log.status);

  // Calcula posição ajustada para evitar transbordamento da tela
  useEffect(() => {
    if (!position) return;

    const menuWidth = 230;
    const menuHeight = 240;
    const padding = 12;

    let x = position.x;
    let y = position.y;

    if (x + menuWidth > window.innerWidth - padding) {
      x = Math.max(padding, x - menuWidth);
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = Math.max(padding, y - menuHeight);
    }

    setAdjustedPos({ x, y });
  }, [position]);

  // Fecha ao clicar fora ou apertar Escape ou redimensionar/rolar tela
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [position, onClose]);

  if (!position || !adjustedPos) return null;

  return createPortal(
    <div
      ref={menuRef}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
      }}
      className="z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md shadow-2xl py-1.5 text-slate-800 dark:text-slate-100 text-xs font-medium animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Título com nome resumido do card */}
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
          {log.title || log.reportedProblem || "Atendimento Técnico"}
        </p>
      </div>

      {/* Ação: Editar */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onEdit(log);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
      >
        <Pencil size={14} className="text-slate-400 dark:text-slate-400 shrink-0" />
        <span>Editar chamado</span>
      </button>

      {/* Ação: Transferir para... com submenu flutuante */}
      <div
        className="relative"
        onMouseEnter={() => setIsSubmenuOpen(true)}
        onMouseLeave={() => setIsSubmenuOpen(false)}
      >
        <button
          type="button"
          onClick={() => setIsSubmenuOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ArrowRight size={14} className="text-slate-400 dark:text-slate-400 shrink-0" />
            <span>Transferir para...</span>
          </div>
          <ChevronRight size={13} className="text-slate-400 dark:text-slate-500" />
        </button>

        {/* Submenu de Colunas */}
        {isSubmenuOpen && (
          <div
            className={`absolute top-0 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md shadow-2xl py-1.5 z-60 animate-in fade-in zoom-in-95 duration-75 ${
              adjustedPos.x + 230 + 192 > window.innerWidth - 12
                ? "right-full -mr-1"
                : "left-full -ml-1"
            }`}
          >
            <div className="px-3 py-1 border-b border-slate-100 dark:border-slate-800/80 mb-1">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Mover para coluna
              </span>
            </div>
            {COLUMNS.map((col) => {
              const isCurrent = col.id === currentColId;
              return (
                <button
                  key={col.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    onClose();
                    onMoveColumn(col.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                    isCurrent
                      ? "opacity-50 cursor-default bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span>{col.title}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Check size={11} /> atual
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ação: Arquivar */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onArchive(log);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
      >
        <Archive size={14} className="text-amber-500 shrink-0" />
        <span>Arquivar</span>
      </button>

      {/* Divisor */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

      {/* Ação: Excluir */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onDelete(log);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
      >
        <Trash2 size={14} className="text-red-500 shrink-0" />
        <span>Excluir chamado</span>
      </button>
    </div>,
    document.body
  );
};

export default KanbanCardContextMenu;
