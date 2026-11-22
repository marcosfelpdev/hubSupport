import React, { createContext, useContext, useEffect, useState } from "react";
import {
  BRAND_THEME_STORAGE_KEY,
  DEFAULT_BRAND_THEME_ID,
  getBrandThemeById,
  isValidBrandThemeId,
  type BrandThemeDefinition,
  type BrandThemeId,
} from "../themes/themeRegistry";

export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  brandTheme: BrandThemeId;
  setBrandTheme: (id: BrandThemeId) => void;
  activeBrandTheme: BrandThemeDefinition;
}

const THEME_STORAGE_KEY = "hubsupport_theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSafeStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return undefined;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storage = getSafeStorage();
    const savedTheme = storage?.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (err) {
    console.warn("[ThemeContext] Erro ao carregar preferência de tema:", err);
  }

  return "light";
}

/**
 * Lê e valida o tema de marca salvo no localStorage com fallback seguro para "default".
 */
export function getInitialBrandTheme(): BrandThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_BRAND_THEME_ID;
  }

  try {
    const storage = getSafeStorage();
    const savedBrandTheme = storage?.getItem(BRAND_THEME_STORAGE_KEY);
    if (isValidBrandThemeId(savedBrandTheme)) {
      return savedBrandTheme;
    }
  } catch (err) {
    console.warn("[ThemeContext] Erro ao carregar tema de marca:", err);
  }

  return DEFAULT_BRAND_THEME_ID;
}

/**
 * Sincroniza `data-brand-theme` no elemento raiz e persiste o ID validado no localStorage.
 */
export function applyBrandTheme(brandTheme: unknown): BrandThemeId {
  const safeBrandTheme = isValidBrandThemeId(brandTheme)
    ? brandTheme
    : DEFAULT_BRAND_THEME_ID;

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (safeBrandTheme === DEFAULT_BRAND_THEME_ID) {
      delete root.dataset.brandTheme;
    } else {
      root.dataset.brandTheme = safeBrandTheme;
    }
  }

  try {
    const storage = getSafeStorage();
    storage?.setItem(BRAND_THEME_STORAGE_KEY, safeBrandTheme);
  } catch (err) {
    console.warn("[ThemeContext] Erro ao persistir tema de marca no localStorage:", err);
  }

  return safeBrandTheme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [brandTheme, setBrandThemeState] = useState<BrandThemeId>(getInitialBrandTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      const storage = getSafeStorage();
      storage?.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      console.warn("[ThemeContext] Erro ao persistir tema no localStorage:", err);
    }
  }, [theme]);

  useEffect(() => {
    applyBrandTheme(brandTheme);
  }, [brandTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setBrandTheme = (nextBrandTheme: BrandThemeId) => {
    setBrandThemeState(
      isValidBrandThemeId(nextBrandTheme) ? nextBrandTheme : DEFAULT_BRAND_THEME_ID
    );
  };

  const activeBrandTheme = getBrandThemeById(brandTheme);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        brandTheme,
        setBrandTheme,
        activeBrandTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser utilizado dentro de um ThemeProvider");
  }
  return context;
}
