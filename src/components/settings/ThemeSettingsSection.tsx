import React from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { BRAND_THEMES } from "@/themes/themeRegistry";

/**
 * Seção da aba Aparência em Configurações para seleção individual de tema e variação da logo Relix.
 */
export default function ThemeSettingsSection(): React.JSX.Element {
  const { theme, setTheme, brandTheme, setBrandTheme, activeBrandTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      {/* Banner explicativo */}
      <div className="bg-slate-50/80 dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs mt-0.5">
          <Palette className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-1">
            Personalização de Tema e Identidade Visual
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Escolha a paleta de realces interativos para o modo claro e a variação da logo{" "}
            <strong className="text-slate-900 dark:text-white font-semibold">Relix</strong> exibida na plataforma.
            Sua preferência é salva individualmente neste navegador, mantendo intactas as cores do modo escuro e as
            cores personalizadas de Tags e Categorias de Atendimento.
          </p>
        </div>
      </div>

      {/* Aviso contextual em Dark Mode */}
      {theme === "dark" && (
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <Moon className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                Modo escuro ativo
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                No modo escuro, apenas a variação da logo acompanha o tema selecionado; as cores de realce da
                interface se aplicam exclusivamente ao modo claro.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme("light")}
            className="bg-white hover:bg-slate-100 text-slate-900 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Alternar para Modo Claro</span>
          </button>
        </div>
      )}

      {/* Grade de Temas */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs">
              <Palette className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Temas Disponíveis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {BRAND_THEMES.length}{" "}
                {BRAND_THEMES.length === 1 ? "tema configurado" : "temas configurados"} • Ativo:{" "}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {activeBrandTheme.name}
                </strong>
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {BRAND_THEMES.map((item) => {
            const isActive = brandTheme === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setBrandTheme(item.id)}
                className={`group text-left rounded-2xl border p-4 transition-all cursor-pointer flex flex-col gap-4 ${
                  isActive
                    ? "brand-card-selected dark:bg-[#0b0f19] dark:border-white dark:ring-1 dark:ring-white/40"
                    : "bg-white dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
                }`}
              >
                {/* Miniatura fixa em modo claro */}
                <div className="w-full bg-[#f8f9fa] border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5 text-slate-900 select-none">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <BrandLogo themeId={item.id} mode="light" height={18} />
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.preview.accent }}
                    />
                  </div>

                  <div className="flex items-stretch gap-2.5">
                    {/* Mini Sidebar */}
                    <div className="w-20 shrink-0 rounded-lg bg-white border border-slate-200/90 p-1.5 flex flex-col gap-1">
                      <div
                        className="rounded-md px-1.5 py-1 flex items-center gap-1 text-[9px] font-semibold text-white"
                        style={{ backgroundColor: item.preview.accent }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0" />
                        <span className="truncate">Painel</span>
                      </div>
                      <div className="rounded-md px-1.5 py-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        <span className="h-1.5 w-9 rounded-full bg-slate-200" />
                      </div>
                    </div>

                    {/* Mini Área de Ações & Card */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded-md text-[9px] font-semibold text-white whitespace-nowrap"
                          style={{ backgroundColor: item.preview.accent }}
                        >
                          + Novo
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md text-[9px] font-semibold border whitespace-nowrap"
                          style={{
                            backgroundColor: item.preview.recorderBg,
                            color: item.preview.recorderText,
                            borderColor: `${item.preview.recorderText}4D`,
                          }}
                        >
                          Gravação
                        </span>
                      </div>

                      <div
                        className="rounded-lg border p-2 flex items-center justify-between gap-2"
                        style={{
                          borderColor: item.preview.cardBorder,
                          backgroundColor: item.preview.cardBg,
                          boxShadow: `inset 0 0 0 1px ${item.preview.cardBorder}40`,
                        }}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="h-1.5 w-14 rounded-full bg-slate-800/80" />
                          <span className="h-1 w-10 rounded-full bg-slate-300" />
                        </div>
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[8px] font-semibold text-white shrink-0 leading-none"
                          style={{ backgroundColor: item.preview.cardPill }}
                        >
                          Aberto
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadados do tema */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {item.badge}
                      </span>
                    </div>

                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-accent text-brand-accent-foreground dark:bg-white dark:text-slate-900 shrink-0">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Ativo</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Rodapé com hexadecimal */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: item.accentHex }}
                    />
                    <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      {item.accentHex}
                    </code>
                  </div>

                  <span
                    className={`text-[11px] font-semibold ${
                      isActive
                        ? "text-brand-accent dark:text-white"
                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  >
                    {isActive ? "Selecionado" : "Aplicar tema"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
