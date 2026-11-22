export type BrandThemeId = "default" | "relix";
export type BrandLogoId = "relix-crimson";

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
