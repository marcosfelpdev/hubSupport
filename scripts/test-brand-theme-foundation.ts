import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import vm from "node:vm";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  BRAND_THEMES,
  BRAND_THEME_STORAGE_KEY,
  DEFAULT_BRAND_THEME_ID,
  getBrandThemeById,
  isValidBrandThemeId,
  type BrandThemeId,
} from "../src/themes/themeRegistry";
import {
  ThemeProvider,
  applyBrandTheme,
  getInitialBrandTheme,
  useTheme,
} from "../src/contexts/ThemeContext";

const projectRoot = process.cwd();

function test(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractCssBlock(css: string, selectorStart: string): string {
  const idx = css.indexOf(selectorStart);
  assert(idx !== -1, `Expected CSS block starting with "${selectorStart}"`);
  const openBrace = css.indexOf("{", idx);
  assert(openBrace !== -1, `Expected opening brace for "${selectorStart}"`);

  let depth = 0;
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(openBrace + 1, i);
      }
    }
  }
  throw new Error(`Unclosed CSS block for "${selectorStart}"`);
}

function assertCssTokens(block: string, expectedTokens: Record<string, string>, blockName: string) {
  for (const [token, value] of Object.entries(expectedTokens)) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escapedToken}\\s*:\\s*([^;]+);`);
    const match = block.match(regex);
    assert(match, `${blockName} is missing token ${token}`);
    assert.strictEqual(
      match[1].trim(),
      value,
      `${blockName} token ${token} expected "${value}", got "${match[1].trim()}"`
    );
  }
}

function createMockClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (...tokens: string[]) => tokens.forEach((t) => classes.add(t)),
    remove: (...tokens: string[]) => tokens.forEach((t) => classes.delete(t)),
    contains: (token: string) => classes.has(token),
    toArray: () => Array.from(classes),
  };
}

function withMockedBrowserGlobals(
  options: {
    storage?: Partial<Storage> | (() => Storage);
    prefersDark?: boolean;
    initialDataset?: Record<string, string>;
    initialClasses?: string[];
  },
  fn: (ctx: {
    root: {
      classList: ReturnType<typeof createMockClassList>;
      dataset: Record<string, string>;
    };
  }) => void
) {
  const g = globalThis as Record<string, unknown>;
  const hadWindow = "window" in g;
  const hadLocalStorage = "localStorage" in g;
  const hadDocument = "document" in g;
  const prevWindow = g.window;
  const prevLocalStorage = g.localStorage;
  const prevDocument = g.document;
  const prevWarn = console.warn;

  const root = {
    classList: createMockClassList(options.initialClasses),
    dataset: { ...(options.initialDataset ?? {}) },
  };

  const fakeWindow: Record<string, unknown> = {
    matchMedia: (query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") ? Boolean(options.prefersDark) : false,
    }),
  };

  if (typeof options.storage === "function") {
    const getter = options.storage;
    Object.defineProperty(fakeWindow, "localStorage", {
      configurable: true,
      get: getter,
    });
    Object.defineProperty(g, "localStorage", {
      configurable: true,
      get: getter,
    });
  } else if (options.storage) {
    fakeWindow.localStorage = options.storage;
    g.localStorage = options.storage;
  }

  g.window = fakeWindow;
  g.document = { documentElement: root };
  console.warn = () => {};

  try {
    fn({ root });
  } finally {
    console.warn = prevWarn;
    if (hadWindow) g.window = prevWindow;
    else delete g.window;

    if (hadLocalStorage) {
      Object.defineProperty(g, "localStorage", {
        configurable: true,
        writable: true,
        value: prevLocalStorage,
      });
    } else {
      delete g.localStorage;
    }

    if (hadDocument) g.document = prevDocument;
    else delete g.document;
  }
}

async function runTests() {
  console.log("Running Brand Theme Foundation tests...\n");

  // 1. Theme Registry
  test("BRAND_THEMES exposes exactly ['default', 'relix'] with required metadata and previews", () => {
    assert.strictEqual(DEFAULT_BRAND_THEME_ID, "default");
    assert.strictEqual(BRAND_THEME_STORAGE_KEY, "relix_brand_theme");
    assert.deepStrictEqual(
      BRAND_THEMES.map((t) => t.id),
      ["default", "relix"]
    );

    const [defaultTheme, relixTheme] = BRAND_THEMES;
    assert.strictEqual(defaultTheme.name, "Padrão do Sistema");
    assert.strictEqual(defaultTheme.badge, "Clássico");
    assert.strictEqual(defaultTheme.logoId, "relix-crimson");
    assert.strictEqual(defaultTheme.accentHex, "#0F172A");
    assert(defaultTheme.description.trim().length > 0, "default theme must have description");
    assert.deepStrictEqual(defaultTheme.preview, {
      accent: "#0F172A",
      accentHover: "#1E293B",
      softBg: "#F1F5F9",
      cardBorder: "#0EA5E9",
      cardBg: "rgba(240, 249, 255, 0.35)",
      cardPill: "#0EA5E9",
      recorderBg: "rgba(99, 102, 241, 0.08)",
      recorderText: "#6366F1",
    });

    assert.strictEqual(relixTheme.name, "Relix Carmim");
    assert.strictEqual(relixTheme.badge, "Logo Relix");
    assert.strictEqual(relixTheme.logoId, "relix-crimson");
    assert.strictEqual(relixTheme.accentHex, "#E11D48");
    assert(relixTheme.description.trim().length > 0, "relix theme must have description");
    assert.deepStrictEqual(relixTheme.preview, {
      accent: "#E11D48",
      accentHover: "#BE123C",
      softBg: "#FFF1F2",
      cardBorder: "#E11D48",
      cardBg: "rgba(255, 241, 242, 0.45)",
      cardPill: "#E11D48",
      recorderBg: "rgba(225, 29, 72, 0.08)",
      recorderText: "#E11D48",
    });
  });

  test("isValidBrandThemeId validates known IDs and rejects invalid inputs", () => {
    assert.strictEqual(isValidBrandThemeId("default"), true);
    assert.strictEqual(isValidBrandThemeId("relix"), true);
    assert.strictEqual(isValidBrandThemeId(""), false);
    assert.strictEqual(isValidBrandThemeId(null), false);
    assert.strictEqual(isValidBrandThemeId(undefined), false);
    assert.strictEqual(isValidBrandThemeId("unknown-theme"), false);
    assert.strictEqual(isValidBrandThemeId(123), false);
    assert.strictEqual(isValidBrandThemeId({}), false);
  });

  test("getBrandThemeById returns matching theme and falls back safely to default", () => {
    assert.strictEqual(getBrandThemeById("relix").id, "relix");
    assert.strictEqual(getBrandThemeById("default").id, "default");
    assert.strictEqual(getBrandThemeById("unknown-theme").id, "default");
    assert.strictEqual(getBrandThemeById(null).id, "default");
    assert.strictEqual(getBrandThemeById(undefined).id, "default");
    assert.strictEqual(getBrandThemeById(42).id, "default");
  });

  // 2. CSS Tokens, @theme inline, :not(.dark) isolation, @layer components
  const globalsCssPath = path.join(projectRoot, "src", "styles", "globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
  const strippedCss = stripCssComments(globalsCss);

  test("globals.css exposes all --color-brand-* tokens inside @theme inline", () => {
    const themeInlineBlock = extractCssBlock(strippedCss, "@theme inline");
    const expectedThemeInlineTokens: Record<string, string> = {
      "--color-brand-accent": "var(--brand-accent)",
      "--color-brand-accent-hover": "var(--brand-accent-hover)",
      "--color-brand-accent-foreground": "var(--brand-accent-foreground)",
      "--color-brand-accent-soft": "var(--brand-accent-soft)",
      "--color-brand-accent-soft-hover": "var(--brand-accent-soft-hover)",
      "--color-brand-accent-border": "var(--brand-accent-border)",
      "--color-brand-accent-text": "var(--brand-accent-text)",
      "--color-brand-accent-icon-tint": "var(--brand-accent-icon-tint)",
      "--color-brand-focus": "var(--brand-focus-border)",
      "--color-brand-focus-border": "var(--brand-focus-border)",
      "--color-brand-focus-ring": "var(--brand-focus-ring)",
      "--color-brand-card-selected-bg": "var(--brand-card-selected-bg)",
      "--color-brand-card-selected-bg-hover": "var(--brand-card-selected-bg-hover)",
      "--color-brand-card-selected-border": "var(--brand-card-selected-border)",
      "--color-brand-card-selected-ring": "var(--brand-card-selected-ring)",
      "--color-brand-card-selected-shadow": "var(--brand-card-selected-shadow)",
      "--color-brand-card-selected-pill": "var(--brand-card-selected-pill)",
      "--color-brand-recorder-bg": "var(--brand-recorder-bg)",
      "--color-brand-recorder-bg-hover": "var(--brand-recorder-bg-hover)",
      "--color-brand-recorder-text": "var(--brand-recorder-text)",
      "--color-brand-recorder-border": "var(--brand-recorder-border)",
      "--color-brand-highlight-bg": "var(--brand-highlight-bg)",
      "--color-brand-highlight-bg-soft": "var(--brand-highlight-bg-soft)",
      "--color-brand-highlight-border": "var(--brand-highlight-border)",
      "--color-brand-highlight-text": "var(--brand-highlight-text)",
      "--color-brand-highlight-dot": "var(--brand-highlight-dot)",
      "--color-brand-action-blue": "var(--brand-action-blue)",
      "--color-brand-action-blue-hover": "var(--brand-action-blue-hover)",
      "--color-brand-focus-blue": "var(--brand-focus-blue)",
      "--color-brand-action-sky": "var(--brand-action-sky)",
      "--color-brand-action-sky-hover": "var(--brand-action-sky-hover)",
      "--color-brand-focus-sky": "var(--brand-focus-sky)",
      "--color-brand-action-indigo": "var(--brand-action-indigo)",
      "--color-brand-action-indigo-hover": "var(--brand-action-indigo-hover)",
      "--color-brand-focus-indigo": "var(--brand-focus-indigo)",
      "--color-brand-filter-bg": "var(--brand-filter-bg)",
      "--color-brand-filter-bg-hover": "var(--brand-filter-bg-hover)",
      "--color-brand-filter-border": "var(--brand-filter-border)",
      "--color-brand-filter-text": "var(--brand-filter-text)",
      "--color-brand-danger": "var(--brand-danger)",
      "--color-brand-danger-hover": "var(--brand-danger-hover)",
    };
    assertCssTokens(themeInlineBlock, expectedThemeInlineTokens, "@theme inline");
  });

  test("globals.css defines exact :root default tokens, custom collapse rule, and relix theme tokens", () => {
    const rootBlock = extractCssBlock(strippedCss, ":root {");
    assertCssTokens(
      rootBlock,
      {
        "--brand-accent": "#0f172a",
        "--brand-accent-hover": "#1e293b",
        "--brand-accent-foreground": "#ffffff",
        "--brand-accent-soft": "#f1f5f9",
        "--brand-accent-soft-hover": "#e2e8f0",
        "--brand-accent-border": "#cbd5e1",
        "--brand-accent-text": "#0f172a",
        "--brand-accent-icon-tint": "#818cf8",
        "--brand-focus-border": "#0f172a",
        "--brand-focus-ring": "#0f172a",
        "--brand-card-selected-bg": "rgba(240, 249, 255, 0.3)",
        "--brand-card-selected-bg-hover": "rgba(240, 249, 255, 0.4)",
        "--brand-card-selected-border": "#0ea5e9",
        "--brand-card-selected-ring": "rgba(56, 189, 248, 0.4)",
        "--brand-card-selected-shadow": "rgba(14, 165, 233, 0.1)",
        "--brand-card-selected-pill": "#0ea5e9",
        "--brand-recorder-bg": "rgba(99, 102, 241, 0.08)",
        "--brand-recorder-bg-hover": "rgba(99, 102, 241, 0.14)",
        "--brand-recorder-text": "#a5b4fc",
        "--brand-recorder-border": "rgba(99, 102, 241, 0.3)",
        "--brand-highlight-bg": "rgba(238, 242, 255, 0.6)",
        "--brand-highlight-bg-soft": "rgba(238, 242, 255, 0.4)",
        "--brand-highlight-border": "#818cf8",
        "--brand-highlight-text": "#4338ca",
        "--brand-highlight-dot": "#4f46e5",
        "--brand-action-blue": "#2563eb",
        "--brand-action-blue-hover": "#1d4ed8",
        "--brand-focus-blue": "#3b82f6",
        "--brand-action-sky": "#0284c7",
        "--brand-action-sky-hover": "#0369a1",
        "--brand-focus-sky": "#0ea5e9",
        "--brand-action-indigo": "#4f46e5",
        "--brand-action-indigo-hover": "#4338ca",
        "--brand-focus-indigo": "#6366f1",
        "--brand-filter-bg": "#f0f9ff",
        "--brand-filter-bg-hover": "#e0f2fe",
        "--brand-filter-border": "#7dd3fc",
        "--brand-filter-text": "#075985",
        "--brand-danger": "#e11d48",
        "--brand-danger-hover": "#be123c",
      },
      ":root"
    );

    const collapseSelector = ':root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)';
    const collapseBlock = extractCssBlock(strippedCss, collapseSelector);
    assertCssTokens(
      collapseBlock,
      {
        "--brand-action-blue": "var(--brand-accent)",
        "--brand-action-blue-hover": "var(--brand-accent-hover)",
        "--brand-focus-blue": "var(--brand-focus-border)",
        "--brand-action-sky": "var(--brand-accent)",
        "--brand-action-sky-hover": "var(--brand-accent-hover)",
        "--brand-focus-sky": "var(--brand-focus-border)",
        "--brand-action-indigo": "var(--brand-accent)",
        "--brand-action-indigo-hover": "var(--brand-accent-hover)",
        "--brand-focus-indigo": "var(--brand-focus-border)",
        "--brand-filter-bg": "var(--brand-accent-soft)",
        "--brand-filter-bg-hover": "var(--brand-accent-soft-hover)",
        "--brand-filter-border": "var(--brand-accent-border)",
        "--brand-filter-text": "var(--brand-accent-text)",
        "--brand-accent-icon-tint": "var(--brand-accent-foreground)",
      },
      collapseSelector
    );

    const relixSelector = ':root[data-brand-theme="relix"]:not(.dark)';
    const relixBlock = extractCssBlock(strippedCss, relixSelector);
    assertCssTokens(
      relixBlock,
      {
        "--brand-accent": "#e11d48",
        "--brand-accent-hover": "#be123c",
        "--brand-accent-foreground": "#ffffff",
        "--brand-accent-soft": "#fff1f2",
        "--brand-accent-soft-hover": "#ffe4e6",
        "--brand-accent-border": "#fda4af",
        "--brand-accent-text": "#be123c",
        "--brand-focus-border": "#e11d48",
        "--brand-focus-ring": "rgba(225, 29, 72, 0.35)",
        "--brand-card-selected-bg": "rgba(255, 241, 242, 0.45)",
        "--brand-card-selected-bg-hover": "rgba(255, 228, 230, 0.52)",
        "--brand-card-selected-border": "#e11d48",
        "--brand-card-selected-ring": "rgba(225, 29, 72, 0.35)",
        "--brand-card-selected-shadow": "rgba(225, 29, 72, 0.14)",
        "--brand-card-selected-pill": "#e11d48",
        "--brand-recorder-bg": "rgba(225, 29, 72, 0.08)",
        "--brand-recorder-bg-hover": "rgba(225, 29, 72, 0.14)",
        "--brand-recorder-text": "#e11d48",
        "--brand-recorder-border": "rgba(225, 29, 72, 0.32)",
        "--brand-highlight-bg": "rgba(255, 241, 242, 0.75)",
        "--brand-highlight-bg-soft": "rgba(255, 241, 242, 0.5)",
        "--brand-highlight-border": "#fb7185",
        "--brand-highlight-text": "#be123c",
        "--brand-highlight-dot": "#e11d48",
        "--brand-danger": "#991b1b",
        "--brand-danger-hover": "#7f1d1d",
      },
      relixSelector
    );
  });

  test("globals.css enforces :not(.dark) on every [data-brand-theme] selector and keeps .dark intact", () => {
    const lines = strippedCss.split(/\r?\n/);
    const brandThemeLines = lines.filter((line) => line.includes("[data-brand-theme"));
    assert(brandThemeLines.length >= 2, "Expected at least 2 [data-brand-theme] selectors in globals.css");
    for (const line of brandThemeLines) {
      assert(
        line.includes(":not(.dark)"),
        `Selector with [data-brand-theme must include :not(.dark), found: ${line.trim()}`
      );
    }

    const darkBlock = extractCssBlock(strippedCss, ".dark {");
    assertCssTokens(
      darkBlock,
      {
        "--bg-primary": "#090d16",
        "--bg-secondary": "#111726",
        "--bg-card": "#111726",
        "--accent": "#f8fafc",
      },
      ".dark"
    );
  });

  test("globals.css defines @layer components helpers and updates utility classes while preserving .avatar", () => {
    const componentsLayer = extractCssBlock(strippedCss, "@layer components");
    assert(
      componentsLayer.includes("html:not(.dark) .brand-card-selected"),
      "@layer components must define html:not(.dark) .brand-card-selected"
    );
    assert(
      componentsLayer.includes("html:not(.dark) .brand-card-selected:hover"),
      "@layer components must define html:not(.dark) .brand-card-selected:hover"
    );
    assert(
      componentsLayer.includes("--brand-card-selected-bg") &&
        componentsLayer.includes("--brand-card-selected-border") &&
        componentsLayer.includes("--brand-card-selected-ring") &&
        componentsLayer.includes("--brand-card-selected-shadow"),
      ".brand-card-selected must consume --brand-card-selected-* variables"
    );

    assert(
      componentsLayer.includes(".brand-recorder-btn"),
      "@layer components must define .brand-recorder-btn"
    );
    assert(
      componentsLayer.includes("--brand-recorder-bg") &&
        componentsLayer.includes("--brand-recorder-text") &&
        componentsLayer.includes("--brand-recorder-border"),
      ".brand-recorder-btn must consume --brand-recorder-* variables"
    );

    const btnPrimary = extractCssBlock(strippedCss, ".btn-primary {");
    assert(btnPrimary.includes("var(--brand-accent)"), ".btn-primary must use var(--brand-accent)");
    const btnPrimaryHover = extractCssBlock(strippedCss, ".btn-primary:hover {");
    assert(
      btnPrimaryHover.includes("var(--brand-accent-hover)"),
      ".btn-primary:hover must use var(--brand-accent-hover)"
    );

    const inputFocus = extractCssBlock(strippedCss, ".input-dark:focus {");
    assert(
      inputFocus.includes("var(--brand-focus-border)"),
      ".input-dark:focus must use var(--brand-focus-border)"
    );

    const spinner = extractCssBlock(strippedCss, ".spinner {");
    assert(spinner.includes("var(--brand-accent)"), ".spinner must use var(--brand-accent)");

    const avatar = extractCssBlock(strippedCss, ".avatar {");
    assert(
      /background\s*:\s*#0f172a\s*;/.test(avatar),
      ".avatar must keep background: #0f172a;"
    );
  });

  // 3. index.html Anti-FOUC script
  const indexHtmlPath = path.join(projectRoot, "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

  test("index.html includes synchronous anti-FOUC inline script in <head> with whitelist and try/catch", () => {
    const headMatch = indexHtml.match(/<head>([\s\S]*?)<\/head>/i);
    assert(headMatch, "index.html must contain <head>...</head>");
    const headHtml = headMatch[1];
    const scriptMatch = headHtml.match(/<script>([\s\S]*?)<\/script>/i);
    assert(scriptMatch, "index.html <head> must contain an inline <script>");
    const scriptCode = scriptMatch[1];

    assert(scriptCode.includes("hubsupport_theme"), "anti-FOUC script must read hubsupport_theme");
    assert(scriptCode.includes("relix_brand_theme"), "anti-FOUC script must read relix_brand_theme");
    assert(scriptCode.includes("try") && scriptCode.includes("catch"), "anti-FOUC script must use try/catch");
    assert(
      scriptCode.includes('["relix"]') || scriptCode.includes("['relix']"),
      'anti-FOUC script must validate against ["relix"] whitelist'
    );

    const runAntiFouc = (opts: {
      storageMap?: Record<string, string>;
      throwStorage?: boolean;
      prefersDark?: boolean;
    }) => {
      const root = {
        classList: createMockClassList(),
        dataset: {} as Record<string, string>,
      };
      const storageApi = {
        getItem(key: string) {
          if (opts.throwStorage) {
            throw new Error("SecurityError: storage blocked");
          }
          return Object.prototype.hasOwnProperty.call(opts.storageMap ?? {}, key)
            ? (opts.storageMap as Record<string, string>)[key]
            : null;
        },
      };
      const sandbox: Record<string, unknown> = {
        document: { documentElement: root },
        localStorage: storageApi,
        window: {
          localStorage: storageApi,
          matchMedia: (q: string) => ({
            matches: q.includes("prefers-color-scheme: dark") ? Boolean(opts.prefersDark) : false,
          }),
        },
      };
      vm.runInNewContext(scriptCode, sandbox);
      return root;
    };

    const relixDarkRoot = runAntiFouc({
      storageMap: { hubsupport_theme: "dark", relix_brand_theme: "relix" },
    });
    assert.strictEqual(relixDarkRoot.classList.contains("dark"), true);
    assert.strictEqual(relixDarkRoot.dataset.brandTheme, "relix");

    const defaultLightRoot = runAntiFouc({
      storageMap: { hubsupport_theme: "light", relix_brand_theme: "default" },
    });
    assert.strictEqual(defaultLightRoot.classList.contains("dark"), false);
    assert.strictEqual(defaultLightRoot.dataset.brandTheme, undefined);

    const corruptedRoot = runAntiFouc({
      storageMap: { relix_brand_theme: "evil-unknown" },
      prefersDark: true,
    });
    assert.strictEqual(corruptedRoot.classList.contains("dark"), true);
    assert.strictEqual(corruptedRoot.dataset.brandTheme, undefined);

    const securityErrorRoot = runAntiFouc({ throwStorage: true });
    assert.strictEqual(securityErrorRoot.classList.contains("dark"), false);
    assert.strictEqual(securityErrorRoot.dataset.brandTheme, undefined);
  });

  // 4. ThemeContext.tsx (Source checks + Runtime behavior with mocks)
  const themeContextPath = path.join(projectRoot, "src", "contexts", "ThemeContext.tsx");
  const themeContextSrc = fs.readFileSync(themeContextPath, "utf8");

  test("ThemeContext.tsx preserves hubsupport_theme and integrates registry and dataset cleanup", () => {
    assert(themeContextSrc.includes('"hubsupport_theme"'), "ThemeContext must preserve hubsupport_theme");
    assert(themeContextSrc.includes("BRAND_THEME_STORAGE_KEY"), "ThemeContext must use BRAND_THEME_STORAGE_KEY");
    assert(themeContextSrc.includes("isValidBrandThemeId"), "ThemeContext must use isValidBrandThemeId");
    assert(themeContextSrc.includes("getBrandThemeById"), "ThemeContext must use getBrandThemeById");
    assert(
      themeContextSrc.includes("delete root.dataset.brandTheme"),
      'ThemeContext must delete root.dataset.brandTheme when "default"'
    );
  });

  test("ThemeContext runtime handles SSR, valid, corrupted, and SecurityError storage safely", () => {
    assert.strictEqual(getInitialBrandTheme(), "default");

    const Probe: React.FC = () => {
      const ctx = useTheme();
      return React.createElement("div", {
        "data-theme": ctx.theme,
        "data-brand": ctx.brandTheme,
        "data-accent": ctx.activeBrandTheme.accentHex,
        "data-has-setter": String(typeof ctx.setBrandTheme === "function"),
      });
    };

    // Valid stored "relix" + "dark"
    withMockedBrowserGlobals(
      {
        storage: {
          getItem: (k: string) =>
            k === "hubsupport_theme" ? "dark" : k === BRAND_THEME_STORAGE_KEY ? "relix" : null,
          setItem: () => {},
        },
      },
      () => {
        assert.strictEqual(getInitialBrandTheme(), "relix");
        const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe)));
        assert(html.includes('data-theme="dark"'));
        assert(html.includes('data-brand="relix"'));
        assert(html.includes('data-accent="#E11D48"'));
        assert(html.includes('data-has-setter="true"'));
      }
    );

    // Corrupted stored value falls back to "default"
    withMockedBrowserGlobals(
      {
        storage: {
          getItem: (k: string) => (k === BRAND_THEME_STORAGE_KEY ? "corrupted-brand" : null),
          setItem: () => {},
        },
      },
      () => {
        assert.strictEqual(getInitialBrandTheme(), "default");
        const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe)));
        assert(html.includes('data-brand="default"'));
        assert(html.includes('data-accent="#0F172A"'));
      }
    );

    // SecurityError thrown by localStorage.getItem
    withMockedBrowserGlobals(
      {
        storage: {
          getItem: () => {
            const err = new Error("The operation is insecure.");
            err.name = "SecurityError";
            throw err;
          },
          setItem: () => {},
        },
      },
      () => {
        assert.strictEqual(getInitialBrandTheme(), "default");
        const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe)));
        assert(html.includes('data-brand="default"'));
      }
    );

    // SecurityError thrown when accessing window.localStorage getter itself
    withMockedBrowserGlobals(
      {
        storage: () => {
          const err = new Error("Access is denied for this document.");
          err.name = "SecurityError";
          throw err;
        },
      },
      () => {
        assert.strictEqual(getInitialBrandTheme(), "default");
        const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe)));
        assert(html.includes('data-brand="default"'));
      }
    );
  });

  test("applyBrandTheme updates dataset, deletes attribute on default/invalid, and handles SecurityError on setItem", () => {
    const writes: Record<string, string> = {};
    withMockedBrowserGlobals(
      {
        initialDataset: {},
        storage: {
          getItem: () => null,
          setItem: (k: string, v: string) => {
            writes[k] = v;
          },
        },
      },
      ({ root }) => {
        const appliedRelix = applyBrandTheme("relix");
        assert.strictEqual(appliedRelix, "relix");
        assert.strictEqual(root.dataset.brandTheme, "relix");
        assert.strictEqual(writes[BRAND_THEME_STORAGE_KEY], "relix");

        const appliedDefault = applyBrandTheme("default");
        assert.strictEqual(appliedDefault, "default");
        assert.strictEqual("brandTheme" in root.dataset, false);
        assert.strictEqual(writes[BRAND_THEME_STORAGE_KEY], "default");
      }
    );

    // Pre-existing invalid attribute + unknown value -> falls back to "default" and deletes attribute
    withMockedBrowserGlobals(
      {
        initialDataset: { brandTheme: "stale-invalid" },
        storage: {
          getItem: () => null,
          setItem: (k: string, v: string) => {
            writes[k] = v;
          },
        },
      },
      ({ root }) => {
        const appliedFallback = applyBrandTheme("unknown-theme" as BrandThemeId);
        assert.strictEqual(appliedFallback, "default");
        assert.strictEqual("brandTheme" in root.dataset, false);
        assert.strictEqual(writes[BRAND_THEME_STORAGE_KEY], "default");
      }
    );

    // SecurityError on setItem does not throw and still sets dataset safely
    withMockedBrowserGlobals(
      {
        initialDataset: {},
        storage: {
          getItem: () => null,
          setItem: () => {
            const err = new Error("The operation is insecure.");
            err.name = "SecurityError";
            throw err;
          },
        },
      },
      ({ root }) => {
        const applied = applyBrandTheme("relix");
        assert.strictEqual(applied, "relix");
        assert.strictEqual(root.dataset.brandTheme, "relix");
      }
    );
  });

  console.log("\nAll Brand Theme Foundation tests passed.");
}

runTests().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
