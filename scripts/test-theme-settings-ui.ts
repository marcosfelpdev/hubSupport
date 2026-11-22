import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import React from "react";
import { renderToString } from "react-dom/server";
import BrandLogo from "../src/components/common/BrandLogo";
import ThemeSettingsSection from "../src/components/settings/ThemeSettingsSection";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { BRAND_THEME_STORAGE_KEY } from "../src/themes/themeRegistry";

const projectRoot = process.cwd();

function test(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function withMockedStorage(storageMap: Record<string, string>, fn: () => void) {
  const g = globalThis as Record<string, unknown>;
  const hadWindow = "window" in g;
  const hadLocalStorage = "localStorage" in g;
  const prevWindow = g.window;
  const prevLocalStorage = g.localStorage;

  const storageApi: Storage = {
    get length() {
      return Object.keys(storageMap).length;
    },
    clear() {
      for (const k of Object.keys(storageMap)) delete storageMap[k];
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(storageMap, key) ? storageMap[key] : null;
    },
    key(index: number) {
      return Object.keys(storageMap)[index] ?? null;
    },
    removeItem(key: string) {
      delete storageMap[key];
    },
    setItem(key: string, value: string) {
      storageMap[key] = value;
    },
  };

  g.window = {
    localStorage: storageApi,
    matchMedia: () => ({ matches: false }),
  };
  Object.defineProperty(g, "localStorage", {
    configurable: true,
    writable: true,
    value: storageApi,
  });

  try {
    fn();
  } finally {
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
  }
}

async function runTests() {
  console.log("Running Theme Settings UI & BrandLogo tests...\n");

  // 1. BrandLogo SSR (isolated with explicit themeId and via ThemeProvider)
  test("BrandLogo renders valid SVG for explicit themeId without ThemeProvider", () => {
    const fullDefaultHtml = renderToString(
      React.createElement(BrandLogo, { themeId: "default", variant: "full", height: 32 })
    );
    assert(fullDefaultHtml.includes("<svg"), "default full BrandLogo must render an <svg>");
    assert(
      fullDefaultHtml.includes('aria-label="Relix"'),
      'default full BrandLogo must have aria-label="Relix"'
    );

    const symbolRelixDarkHtml = renderToString(
      React.createElement(BrandLogo, {
        themeId: "relix",
        variant: "symbol",
        mode: "dark",
        height: 32,
      })
    );
    assert(symbolRelixDarkHtml.includes("<svg"), "relix symbol dark BrandLogo must render an <svg>");
    assert(
      symbolRelixDarkHtml.includes('aria-label="Relix Symbol"'),
      'relix symbol BrandLogo must have aria-label="Relix Symbol"'
    );
    assert(
      symbolRelixDarkHtml.includes("#FFFFFF"),
      "relix symbol in dark mode must preserve white bracket fill"
    );

    const appIconHtml = renderToString(
      React.createElement(BrandLogo, { themeId: "relix", variant: "app-icon", height: 40 })
    );
    assert(
      appIconHtml.includes('aria-label="Relix Icon"'),
      'app-icon BrandLogo must have aria-label="Relix Icon"'
    );
  });

  test("BrandLogo reads active brandTheme from ThemeProvider when themeId is omitted", () => {
    withMockedStorage({ [BRAND_THEME_STORAGE_KEY]: "relix", hubsupport_theme: "dark" }, () => {
      const html = renderToString(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(BrandLogo, { variant: "full", height: 32 })
        )
      );
      assert(html.includes("<svg"), "context-driven BrandLogo must render an <svg>");
      assert(html.includes('aria-label="Relix"'), "context-driven BrandLogo must render Relix SVG");
    });
  });

  // 2. ThemeSettingsSection SSR
  test("ThemeSettingsSection renders both themes, hex codes, and active aria-pressed in light mode", () => {
    const html = renderToString(
      React.createElement(ThemeProvider, null, React.createElement(ThemeSettingsSection))
    );

    assert(html.includes("Personalização de Tema e Identidade Visual"), "Missing banner title");
    assert(html.includes("Padrão do Sistema"), "Missing default theme name");
    assert(html.includes("Relix Carmim"), "Missing relix theme name");
    assert(html.includes("#0F172A"), "Missing default theme accent hex #0F172A");
    assert(html.includes("#E11D48"), "Missing relix theme accent hex #E11D48");
    assert(html.includes('aria-pressed="true"'), "Default theme must have aria-pressed='true'");
    assert(html.includes('aria-pressed="false"'), "Inactive theme must have aria-pressed='false'");

    const buttonBlocks = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    const defaultBtn = buttonBlocks.find((b) => b.includes("Padrão do Sistema"));
    const relixBtn = buttonBlocks.find((b) => b.includes("Relix Carmim"));
    assert(defaultBtn, "Default theme button must exist");
    assert(relixBtn, "Relix theme button must exist");
    assert(
      defaultBtn.includes('aria-pressed="true"'),
      "Default theme button must be pressed initially"
    );
    assert(
      relixBtn.includes('aria-pressed="false"'),
      "Relix theme button must not be pressed initially"
    );

    assert(
      !html.includes("Alternar para Modo Claro"),
      "Light mode notice button should not render when theme is light"
    );
  });

  test("ThemeSettingsSection renders dark-mode notice and active relix state when theme is dark + relix", () => {
    withMockedStorage({ hubsupport_theme: "dark", [BRAND_THEME_STORAGE_KEY]: "relix" }, () => {
      const html = renderToString(
        React.createElement(ThemeProvider, null, React.createElement(ThemeSettingsSection))
      );

      assert(
        html.includes("Alternar para Modo Claro"),
        "Dark mode notice must render Alternar para Modo Claro button"
      );

      const buttonBlocks = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
      const defaultBtn = buttonBlocks.find((b) => b.includes("Padrão do Sistema"));
      const relixBtn = buttonBlocks.find((b) => b.includes("Relix Carmim"));
      assert(defaultBtn, "Default theme button must exist in dark mode");
      assert(relixBtn, "Relix theme button must exist in dark mode");
      assert(
        defaultBtn.includes('aria-pressed="false"'),
        "Default theme button must have aria-pressed='false' when relix is active"
      );
      assert(
        relixBtn.includes('aria-pressed="true"'),
        "Relix theme button must have aria-pressed='true' when relix is active"
      );
    });
  });

  // 3. Source inspection: ThemeSettingsSection.tsx
  const themeSectionPath = path.join(
    projectRoot,
    "src",
    "components",
    "settings",
    "ThemeSettingsSection.tsx"
  );
  const themeSectionSrc = fs.readFileSync(themeSectionPath, "utf8");

  test("ThemeSettingsSection.tsx satisfies design, preview, and dark-mode notice requirements", () => {
    assert(themeSectionSrc.includes("BRAND_THEMES"), "Must iterate BRAND_THEMES");
    assert(themeSectionSrc.includes('theme === "dark"'), "Must guard dark-mode contextual notice");
    assert(
      themeSectionSrc.includes('setTheme("light")'),
      "Notice action must call setTheme('light')"
    );
    assert(
      themeSectionSrc.includes("Alternar para Modo Claro"),
      "Notice button label must be Alternar para Modo Claro"
    );
    assert(
      themeSectionSrc.includes("variação da logo") || themeSectionSrc.includes("logo"),
      "Dark-mode notice must explain logo follows theme while accents apply to light mode"
    );
    assert(
      themeSectionSrc.includes("<BrandLogo") && themeSectionSrc.includes('mode="light"'),
      "Miniatures must render <BrandLogo ... mode=\"light\" />"
    );
    assert(
      themeSectionSrc.includes("brand-card-selected") &&
        themeSectionSrc.includes("dark:border-white") &&
        themeSectionSrc.includes("dark:ring-1") &&
        themeSectionSrc.includes("dark:ring-white/40"),
      "Selected theme card must use .brand-card-selected and dark:border-white dark:ring-1 dark:ring-white/40"
    );
  });

  // 4. Source inspection: SettingsPage.tsx
  const settingsPagePath = path.join(projectRoot, "src", "pages", "SettingsPage.tsx");
  const settingsSrc = fs.readFileSync(settingsPagePath, "utf8");

  test("SettingsPage.tsx configures Appearance tab as default for all roles with non-admin fallback", () => {
    assert(
      settingsSrc.includes("ThemeSettingsSection"),
      "SettingsPage must import and render ThemeSettingsSection"
    );
    assert(
      settingsSrc.includes('useState<"appearance" | "tags" | "categories">("appearance")'),
      'activeTab must initialize to "appearance"'
    );
    assert(
      /if\s*\(\s*!isAdmin\s*&&\s*activeTab\s*===\s*"categories"\s*\)\s*\{\s*setActiveTab\("appearance"\)/.test(
        settingsSrc
      ),
      'Non-admin fallback from "categories" must redirect to "appearance"'
    );
    assert(
      settingsSrc.includes('setActiveTab("appearance")') &&
        settingsSrc.includes("Aparência") &&
        settingsSrc.includes("Temas"),
      "Must render Aparência tab with Temas pill"
    );

    const appearanceTabIdx = settingsSrc.indexOf('setActiveTab("appearance")');
    const isAdminTabIdx = settingsSrc.indexOf("{isAdmin && (");
    assert(
      appearanceTabIdx !== -1 && isAdminTabIdx !== -1 && appearanceTabIdx < isAdminTabIdx,
      "Aparência tab must be outside and before the isAdmin guard"
    );
    assert(
      settingsSrc.includes('{activeTab === "appearance" && <ThemeSettingsSection />}'),
      "Must render <ThemeSettingsSection /> when activeTab === 'appearance'"
    );
  });

  test("SettingsPage.tsx migrates interactive highlights to brand tokens while preserving dark:*", () => {
    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "border-brand-accent text-brand-accent dark:border-white dark:text-white"
      ),
      3,
      "All 3 tabs must use border-brand-accent text-brand-accent dark:border-white dark:text-white"
    );

    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "bg-brand-action-blue hover:bg-brand-action-blue-hover dark:bg-blue-600 dark:hover:bg-blue-700"
      ),
      3,
      "All 3 Category buttons must use bg-brand-action-blue with dark:bg-blue-600 dark:hover:bg-blue-700"
    );

    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "accent-brand-action-blue text-brand-action-blue focus:ring-brand-focus-blue dark:accent-blue-600 dark:text-blue-600 dark:focus:ring-blue-500"
      ),
      3,
      "All 3 Category checkboxes must use brand tokens and explicit dark:* classes"
    );

    assert.strictEqual(
      countOccurrences(settingsSrc, "focus:ring-brand-focus-blue dark:focus:ring-blue-500"),
      4,
      "All 4 Category inputs/selects must use focus:ring-brand-focus-blue dark:focus:ring-blue-500"
    );

    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700"
      ),
      2,
      "Both deletion confirm buttons must use bg-brand-danger with explicit dark:bg-rose-600"
    );

    assert(
      settingsSrc.includes("border-t-brand-accent dark:border-t-slate-200"),
      "Tags spinner must use border-t-brand-accent dark:border-t-slate-200"
    );
    assert(
      settingsSrc.includes("border-t-brand-action-blue dark:border-t-blue-400"),
      "Categories spinner must use border-t-brand-action-blue dark:border-t-blue-400"
    );
    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "bg-brand-accent dark:bg-slate-800 hover:bg-brand-accent-hover dark:hover:bg-slate-700 text-brand-accent-foreground dark:text-white"
      ),
      3,
      "All 3 Tag primary buttons must use brand-accent tokens with dark:slate-800 preserved"
    );
    assert.strictEqual(
      countOccurrences(
        settingsSrc,
        "focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400"
      ),
      2,
      "Both Tag inputs must use brand focus tokens with dark:slate-400 preserved"
    );
  });

  test("SettingsPage.tsx preserves strict isolation of Tags, Categories, Admin badge, and backdrops", () => {
    assert(settingsSrc.includes("const PRESET_COLORS"), "PRESET_COLORS must remain intact");
    assert(settingsSrc.includes("<TagBadge"), "<TagBadge must remain intact");
    assert(
      settingsSrc.includes("<CategoryIconPicker") &&
        settingsSrc.includes("accentColor={catColor}"),
      "<CategoryIconPicker accentColor={catColor} must remain intact"
    );
    assert(settingsSrc.includes('type="color"'), '<input type="color" must remain intact');
    assert(settingsSrc.includes("cat.color"), "cat.color preview/list styling must remain intact");
    assert(settingsSrc.includes("tag.color"), "tag.color styling must remain intact");
    assert.strictEqual(
      countOccurrences(settingsSrc, "fixed inset-0 bg-slate-900/40"),
      4,
      "All 4 modal backdrops must remain bg-slate-900/40"
    );
    assert(
      !settingsSrc.includes("fixed inset-0 bg-brand-"),
      "No modal backdrop may be migrated to brand-* tokens"
    );
    assert(
      settingsSrc.includes("bg-blue-50 dark:bg-blue-950/50 text-blue-700"),
      "Admin role badge must remain untouched"
    );
    assert.strictEqual(
      countOccurrences(settingsSrc, "text-blue-600 dark:text-blue-400"),
      2,
      "Informational Sliders and LayoutGrid icons in Categories must remain text-blue-600 dark:text-blue-400"
    );
    assert(
      settingsSrc.includes("ring-2 ring-slate-900 dark:ring-white") &&
        settingsSrc.includes("border-slate-900 dark:border-white bg-slate-50"),
      "Color preset swatch active states (L757/L1033) must remain untouched"
    );
  });

  console.log("\nAll Theme Settings UI & BrandLogo tests passed.");
}

runTests().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
