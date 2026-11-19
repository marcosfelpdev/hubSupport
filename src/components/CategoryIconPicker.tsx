import React from "react";
import {
  Cog,
  Rocket,
  Sparkles,
  Lightbulb,
  Wrench,
  Server,
  Shield,
  Bug,
  Code,
  HelpCircle,
  Zap,
  Palette,
  FileText,
  Database,
  Terminal,
  Cpu,
  Bot,
  Layers,
  Activity,
  CheckCircle,
} from "lucide-react";

export interface IconOption {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { key: "cog", label: "Engrenagem", icon: Cog },
  { key: "rocket", label: "Foguete", icon: Rocket },
  { key: "sparkles", label: "Brilhos / IA", icon: Sparkles },
  { key: "lightbulb", label: "Lâmpada / Ideia", icon: Lightbulb },
  { key: "wrench", label: "Chave Inglesa", icon: Wrench },
  { key: "server", label: "Servidor", icon: Server },
  { key: "shield", label: "Escudo / Segurança", icon: Shield },
  { key: "bug", label: "Bug / Defeito", icon: Bug },
  { key: "code", label: "Código", icon: Code },
  { key: "help-circle", label: "Dúvida / Ajuda", icon: HelpCircle },
  { key: "zap", label: "Raio / Urgente", icon: Zap },
  { key: "palette", label: "Paleta / Design", icon: Palette },
  { key: "file-text", label: "Documento", icon: FileText },
  { key: "database", label: "Banco de Dados", icon: Database },
  { key: "terminal", label: "Terminal / CLI", icon: Terminal },
  { key: "cpu", label: "CPU / Hardware", icon: Cpu },
  { key: "bot", label: "Robô / Automação", icon: Bot },
  { key: "layers", label: "Camadas", icon: Layers },
  { key: "activity", label: "Atividade", icon: Activity },
  { key: "check-circle", label: "Sucesso", icon: CheckCircle },
];

export function getCategoryIconComponent(iconKey?: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  if (!iconKey) return Cog;
  const match = AVAILABLE_ICONS.find((item) => item.key.toLowerCase() === iconKey.toLowerCase());
  return match ? match.icon : Cog;
}

interface CategoryIconPickerProps {
  selectedIcon: string;
  onSelect: (iconKey: string) => void;
  accentColor?: string;
}

export default function CategoryIconPicker({
  selectedIcon,
  onSelect,
  accentColor = "#3b82f6",
}: CategoryIconPickerProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
        Ícone do Card
      </label>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl">
        {AVAILABLE_ICONS.map((option) => {
          const IconComp = option.icon;
          const isSelected = selectedIcon.toLowerCase() === option.key.toLowerCase();
          return (
            <button
              key={option.key}
              type="button"
              title={option.label}
              onClick={() => onSelect(option.key)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "border-transparent text-white shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
              }`}
              style={{
                backgroundColor: isSelected ? accentColor : undefined,
              }}
            >
              <IconComp className="w-5 h-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
