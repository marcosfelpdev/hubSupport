export type BrandThemeId =
  | "default"
  | "relix"
  | "relix-cobalt"
  | "relix-emerald"
  | "relix-amber"
  | "relix-cyberpunk";

export type BrandLogoId =
  | "relix-crimson"
  | "relix-cobalt"
  | "relix-emerald"
  | "relix-amber"
  | "relix-cyberpunk";

/**
 * Paleta resumida exibida nos cartões de pré-visualização da aba Aparência.
 */
export interface BrandThemePreview {
  accent: string;
  accentHover: string;
  softBg: string;
  cardBorder: string;
  cardBg: string;
  cardPill: string;
  recorderBg: string;
  recorderText: string;
}

/**
 * Definição completa de um tema de marca disponível no Relix.
 */
export interface BrandThemeDefinition {
  id: BrandThemeId;
  name: string;
  badge: string;
  description: string;
  logoId: BrandLogoId;
  accentHex: string;
  preview: BrandThemePreview;
}

export const DEFAULT_BRAND_THEME_ID: BrandThemeId = "default";
export const BRAND_THEME_STORAGE_KEY = "relix_brand_theme";

export const BRAND_THEMES: readonly BrandThemeDefinition[] = [
  {
    id: "default",
    name: "Padrão do Sistema",
    badge: "Clássico",
    description: "Aparência clássica e neutra da plataforma com realces em ardósia e azul-celeste.",
    logoId: "relix-crimson",
    accentHex: "#0F172A",
    preview: {
      accent: "#0F172A",
      accentHover: "#1E293B",
      softBg: "#F1F5F9",
      cardBorder: "#0EA5E9",
      cardBg: "rgba(240, 249, 255, 0.35)",
      cardPill: "#0EA5E9",
      recorderBg: "rgba(99, 102, 241, 0.08)",
      recorderText: "#6366F1",
    },
  },
  {
    id: "relix",
    name: "Relix Carmim",
    badge: "Logo Relix",
    description: "Realces interativos em carmim (#E11D48 / rose-600) inspirados na identidade visual da logo Relix.",
    logoId: "relix-crimson",
    accentHex: "#E11D48",
    preview: {
      accent: "#E11D48",
      accentHover: "#BE123C",
      softBg: "#FFF1F2",
      cardBorder: "#E11D48",
      cardBg: "rgba(255, 241, 242, 0.45)",
      cardPill: "#E11D48",
      recorderBg: "rgba(225, 29, 72, 0.08)",
      recorderText: "#E11D48",
    },
  },
  {
    id: "relix-cobalt",
    name: "Relix Cobalto",
    badge: "Cobalto",
    description: "Realces em azul cobalto e royal (#2563EB) inspirados na identidade corporativa Relix.",
    logoId: "relix-cobalt",
    accentHex: "#2563EB",
    preview: {
      accent: "#2563eb",
      accentHover: "#1d4ed8",
      softBg: "#eff6ff",
      cardBorder: "#2563eb",
      cardBg: "rgba(239, 246, 255, 0.45)",
      cardPill: "#2563eb",
      recorderBg: "rgba(37, 99, 235, 0.08)",
      recorderText: "#2563eb",
    },
  },
  {
    id: "relix-emerald",
    name: "Relix Esmeralda",
    badge: "Esmeralda",
    description: "Realces em verde esmeralda e jade (#059669) com alto frescor e clareza visual.",
    logoId: "relix-emerald",
    accentHex: "#059669",
    preview: {
      accent: "#059669",
      accentHover: "#047857",
      softBg: "#ecfdf5",
      cardBorder: "#059669",
      cardBg: "rgba(236, 253, 245, 0.45)",
      cardPill: "#059669",
      recorderBg: "rgba(5, 150, 105, 0.08)",
      recorderText: "#059669",
    },
  },
  {
    id: "relix-amber",
    name: "Relix Âmbar",
    badge: "Âmbar",
    description: "Realces solares em tom âmbar e dourado (#D97706) com contraste aconchegante.",
    logoId: "relix-amber",
    accentHex: "#D97706",
    preview: {
      accent: "#d97706",
      accentHover: "#b45309",
      softBg: "#fffbeb",
      cardBorder: "#d97706",
      cardBg: "rgba(255, 251, 235, 0.45)",
      cardPill: "#d97706",
      recorderBg: "rgba(217, 119, 6, 0.08)",
      recorderText: "#d97706",
    },
  },
  {
    id: "relix-cyberpunk",
    name: "Relix Cyberpunk",
    badge: "Cyberpunk",
    description: "Visual duo-tone com realce primário em ciano (#0891B2) e contraste violeta (#6B42FF).",
    logoId: "relix-cyberpunk",
    accentHex: "#0891B2",
    preview: {
      accent: "#0891b2",
      accentHover: "#0e7490",
      softBg: "#ecfeff",
      cardBorder: "#0891b2",
      cardBg: "rgba(236, 254, 255, 0.45)",
      cardPill: "#0891b2",
      recorderBg: "rgba(8, 145, 178, 0.08)",
      recorderText: "#0891b2",
    },
  },
] as const;

const BRAND_THEME_IDS = new Set<string>(BRAND_THEMES.map((theme) => theme.id));

/**
 * Valida se um valor arbitrário corresponde a um identificador de tema registrado.
 */
export function isValidBrandThemeId(value: unknown): value is BrandThemeId {
  return typeof value === "string" && BRAND_THEME_IDS.has(value);
}

/**
 * Resolve a definição de tema pelo ID com fallback seguro para o tema padrão.
 */
export function getBrandThemeById(id: unknown): BrandThemeDefinition {
  if (isValidBrandThemeId(id)) {
    const match = BRAND_THEMES.find((theme) => theme.id === id);
    if (match) {
      return match;
    }
  }
  return BRAND_THEMES[0];
}
