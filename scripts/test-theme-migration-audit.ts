import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { chromium, type Locator, type Page } from "playwright";

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, "src");

interface ComputedStyleSnapshot {
  backgroundColor: string;
  color: string;
  borderTopColor: string;
}

interface ClassNameBlock {
  content: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

function test(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}

async function asyncTest(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`  ✓ ${name}`);
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function relPath(absPath: string): string {
  return path.relative(projectRoot, absPath).replace(/\\/g, "/");
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
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

/**
 * Remove comentários de JS/TS/JSX preservando strings, template literals,
 * regex literals e quebras de linha para manter números de linha consistentes.
 */
function stripTypeScriptComments(source: string): string {
  let out = "";
  let i = 0;
  const len = source.length;
  let lastSignificant = "";
  let lastWord = "";

  const regexPrefixWords = new Set([
    "return",
    "throw",
    "case",
    "default",
    "typeof",
    "void",
    "delete",
    "await",
    "yield",
    "in",
    "of",
    "instanceof",
    "else",
  ]);

  const canStartRegex = () => {
    if (!lastSignificant) return true;
    if ("([{:;,=!&|?+-*%^~<>".includes(lastSignificant)) return true;
    return regexPrefixWords.has(lastWord);
  };

  while (i < len) {
    const ch = source[i];
    const next = i + 1 < len ? source[i + 1] : "";

    // String com aspas simples ou duplas
    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += ch;
      i++;
      while (i < len) {
        const c = source[i];
        out += c;
        if (c === "\\" && i + 1 < len) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (c === quote) break;
      }
      lastSignificant = quote;
      lastWord = "";
      continue;
    }

    // Template literal
    if (ch === "`") {
      out += ch;
      i++;
      let interpDepth = 0;
      while (i < len) {
        const c = source[i];
        if (c === "\\" && i + 1 < len) {
          out += c + source[i + 1];
          i += 2;
          continue;
        }
        if (interpDepth === 0 && c === "$" && i + 1 < len && source[i + 1] === "{") {
          out += "${";
          i += 2;
          interpDepth = 1;
          continue;
        }
        if (interpDepth > 0) {
          if (c === "{") interpDepth++;
          else if (c === "}") interpDepth--;
        }
        out += c;
        i++;
        if (interpDepth === 0 && c === "`") break;
      }
      lastSignificant = "`";
      lastWord = "";
      continue;
    }

    // Comentário de bloco /* ... */ (inclui JSX {/* ... */})
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < len) {
        if (source[i] === "*" && i + 1 < len && source[i + 1] === "/") {
          out += "  ";
          i += 2;
          break;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }

    // Comentário de linha // ... (evita falso match em URLs tipo http:// em texto JSX)
    if (ch === "/" && next === "/" && lastSignificant !== ":") {
      out += "  ";
      i += 2;
      while (i < len && source[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }

    // Regex literal /pattern/flags
    if (ch === "/" && next !== "/" && next !== "*" && canStartRegex()) {
      out += ch;
      i++;
      let inCharClass = false;
      while (i < len) {
        const c = source[i];
        if (c === "\n") break;
        out += c;
        if (c === "\\" && i + 1 < len) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        if (c === "[") inCharClass = true;
        else if (c === "]" && inCharClass) inCharClass = false;
        i++;
        if (c === "/" && !inCharClass) break;
      }
      lastSignificant = "/";
      lastWord = "";
      continue;
    }

    out += ch;
    if (!/\s/.test(ch)) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        lastWord = /[A-Za-z0-9_$]/.test(lastSignificant) ? lastWord + ch : ch;
      } else {
        lastWord = "";
      }
      lastSignificant = ch;
    }
    i++;
  }

  return out;
}

/**
 * Extrai blocos `className="..."`, `className='...'` e `className={...}` (incluindo multi-linha).
 */
function extractClassNameBlocks(strippedSource: string): ClassNameBlock[] {
  const blocks: ClassNameBlock[] = [];
  const attrRegex = /\bclassName\s*=\s*/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(strippedSource)) !== null) {
    const attrStart = match.index;
    const valueStart = attrStart + match[0].length;
    if (valueStart >= strippedSource.length) continue;

    const firstChar = strippedSource[valueStart];
    let endOffset = valueStart;

    if (firstChar === '"' || firstChar === "'") {
      endOffset = valueStart + 1;
      while (endOffset < strippedSource.length) {
        const c = strippedSource[endOffset];
        if (c === "\\" && endOffset + 1 < strippedSource.length) {
          endOffset += 2;
          continue;
        }
        endOffset++;
        if (c === firstChar) break;
      }
    } else if (firstChar === "{") {
      let depth = 0;
      endOffset = valueStart;
      while (endOffset < strippedSource.length) {
        const c = strippedSource[endOffset];
        if (c === '"' || c === "'" || c === "`") {
          const quote = c;
          endOffset++;
          let tplDepth = 0;
          while (endOffset < strippedSource.length) {
            const sc = strippedSource[endOffset];
            if (sc === "\\" && endOffset + 1 < strippedSource.length) {
              endOffset += 2;
              continue;
            }
            if (quote === "`" && tplDepth === 0 && sc === "$" && strippedSource[endOffset + 1] === "{") {
              tplDepth = 1;
              endOffset += 2;
              continue;
            }
            if (quote === "`" && tplDepth > 0) {
              if (sc === "{") tplDepth++;
              else if (sc === "}") tplDepth--;
            }
            endOffset++;
            if ((quote !== "`" || tplDepth === 0) && sc === quote) break;
          }
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            endOffset++;
            break;
          }
        }
        endOffset++;
      }
    } else {
      continue;
    }

    blocks.push({
      content: strippedSource.slice(attrStart, endOffset),
      startLine: lineNumberAt(strippedSource, attrStart),
      endLine: lineNumberAt(strippedSource, endOffset),
      startOffset: attrStart,
      endOffset,
    });

    attrRegex.lastIndex = endOffset;
  }

  return blocks;
}

function runStaticAudit() {
  console.log("Running Mode 1 — Static Theme Migration Audit...\n");

  const files = collectSourceFiles(srcDir);
  assert(files.length > 0, "Expected .ts/.tsx files inside src/");

  const parsedFiles = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const stripped = stripTypeScriptComments(raw);
    return {
      filePath,
      relative: relPath(filePath),
      raw,
      stripped,
      classBlocks: extractClassNameBlocks(stripped),
    };
  });

  // 1. Backdrops limpos
  test("1. Backdrops com 'fixed inset-0' nunca usam bg-brand-accent ou bg-brand-highlight", () => {
    const backdropViolationRegex = /\bbg-brand-(?:accent|highlight)\b/;
    const violations: string[] = [];

    for (const file of parsedFiles) {
      for (const block of file.classBlocks) {
        if (/\bfixed\b/.test(block.content) && /\binset-0\b/.test(block.content)) {
          if (backdropViolationRegex.test(block.content)) {
            violations.push(`${file.relative}:${block.startLine}-${block.endLine}`);
          }
        }
      }

      const lines = file.stripped.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/\bfixed\b/.test(line) && /\binset-0\b/.test(line) && backdropViolationRegex.test(line)) {
          violations.push(`${file.relative}:${idx + 1}`);
        }
      });
    }

    assert.deepStrictEqual(
      Array.from(new Set(violations)),
      [],
      `Found forbidden brand backdrop classes on fixed inset-0: ${violations.join(", ")}`
    );
  });

  // 2. Logos centralizadas no BrandLogo
  test("2. Sidebar, LoginPage e DashboardHeader usam <BrandLogo e zero <RelixLogo direto em src/", () => {
    const requiredBrandLogoFiles = [
      "src/components/Sidebar.tsx",
      "src/pages/LoginPage.tsx",
      "src/components/DashboardHeader.tsx",
    ];
    const relixTagRegex = /<RelixLogo(?:\s|\/|>|$)/;
    const brandLogoTagRegex = /<BrandLogo(?:\s|\/|>)/;
    const brandLogoImportRegex = /import\s+BrandLogo\b/;

    for (const target of requiredBrandLogoFiles) {
      const file = parsedFiles.find((f) => f.relative === target);
      assert(file, `Expected file ${target} to exist`);
      assert(
        !relixTagRegex.test(file.stripped),
        `${target} must NOT render <RelixLogo directly`
      );
      assert(
        brandLogoImportRegex.test(file.stripped),
        `${target} must import BrandLogo`
      );
      assert(
        brandLogoTagRegex.test(file.stripped),
        `${target} must render <BrandLogo`
      );
    }

    const allowedDirectRelixFiles = new Set([
      "src/components/common/BrandLogo.tsx",
      "src/components/common/RelixLogo.tsx",
    ]);
    const directRelixViolations = parsedFiles
      .filter((f) => !allowedDirectRelixFiles.has(f.relative) && relixTagRegex.test(f.stripped))
      .map((f) => f.relative);

    assert.deepStrictEqual(
      directRelixViolations,
      [],
      `Direct <RelixLogo usage found outside BrandLogo.tsx: ${directRelixViolations.join(", ")}`
    );
  });

  // 3. Exclusões protegidas intactas
  test("3. Exclusões protegidas (Localizar, tag.color/cat.color, PRESET_COLORS, QRCodeSVG, ReportCardMinimized) intactas", () => {
    const byPath = new Map(parsedFiles.map((f) => [f.relative, f]));

    const phoneCardTile = byPath.get("src/components/phoneFinder/PhoneCardTile.tsx");
    assert(phoneCardTile, "Missing src/components/phoneFinder/PhoneCardTile.tsx");
    const phoneButtons = phoneCardTile.stripped.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    const locateBtn = phoneButtons.find(
      (b) => b.includes("onLocate(card)") && b.includes("Localizar")
    );
    assert(locateBtn, "PhoneCardTile.tsx must contain the Localizar button");
    assert(
      /\bbg-rose-600\b/.test(locateBtn),
      "PhoneCardTile Localizar button must keep bg-rose-600"
    );
    assert(
      !/bg-brand-(?:accent|danger)/.test(locateBtn),
      "PhoneCardTile Localizar button must NOT use bg-brand-accent or bg-brand-danger"
    );

    const workLogForm = byPath.get("src/components/WorkLogForm.tsx");
    assert(workLogForm, "Missing src/components/WorkLogForm.tsx");
    assert(workLogForm.stripped.includes("tag.color"), "WorkLogForm.tsx must preserve tag.color");
    assert(workLogForm.stripped.includes("cat.color"), "WorkLogForm.tsx must preserve cat.color");

    const settingsPage = byPath.get("src/pages/SettingsPage.tsx");
    assert(settingsPage, "Missing src/pages/SettingsPage.tsx");
    assert(
      settingsPage.stripped.includes("PRESET_COLORS"),
      "SettingsPage.tsx must preserve PRESET_COLORS"
    );
    assert(
      /<CategoryIconPicker[\s\S]*?accentColor=\{catColor\}/.test(settingsPage.stripped),
      "SettingsPage.tsx must preserve <CategoryIconPicker with accentColor={catColor}"
    );

    const appDownloadModal = byPath.get("src/components/phoneFinder/AppDownloadModal.tsx");
    assert(appDownloadModal, "Missing src/components/phoneFinder/AppDownloadModal.tsx");
    assert(
      appDownloadModal.stripped.includes("<QRCodeSVG"),
      "AppDownloadModal.tsx must preserve <QRCodeSVG"
    );

    const reportCardMinimized = byPath.get("src/components/ReportCardMinimized.tsx");
    assert(reportCardMinimized, "Missing src/components/ReportCardMinimized.tsx");
    assert(
      reportCardMinimized.stripped.includes("<TagBadge"),
      "ReportCardMinimized.tsx must preserve <TagBadge"
    );
    assert(
      reportCardMinimized.stripped.includes("brand-card-selected"),
      "ReportCardMinimized.tsx must apply brand-card-selected"
    );
    assert(
      reportCardMinimized.stripped.includes("dark:bg-sky-950/20") &&
        reportCardMinimized.stripped.includes("dark:border-sky-400"),
      "ReportCardMinimized.tsx must keep dark:bg-sky-950/20 and dark:border-sky-400"
    );
  });

  // 4. Cobertura explícita de dark:bg-*
  test("4. Todo uso de bg-brand-danger ou bg-brand-action-blue declara dark:bg-* explícito", () => {
    const tokenRegex = /(?<![\w-])bg-brand-(?:danger|action-blue)(?![\w-])/;
    const darkBgRegex = /(?<![\w-])dark:bg-[\w\-\/\[\]#.%]+/;
    const violations: string[] = [];
    let checkedOccurrences = 0;

    for (const file of parsedFiles) {
      if (!tokenRegex.test(file.stripped)) continue;

      // Verifica cada bloco className="..." / className={...} (suporta multi-linha)
      for (const block of file.classBlocks) {
        if (tokenRegex.test(block.content)) {
          checkedOccurrences++;
          if (!darkBgRegex.test(block.content)) {
            violations.push(`${file.relative}:${block.startLine}-${block.endLine}`);
          }
        }
      }

      // Verifica linhas com ocorrências fora de blocos className=...
      const lines = file.stripped.split(/\r?\n/);
      let offset = 0;
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const lineStart = offset;
        const lineEnd = offset + line.length;
        offset = lineEnd + 1;

        if (!tokenRegex.test(line)) continue;

        const insideClassBlock = file.classBlocks.some(
          (b) => lineStart >= b.startOffset && lineStart <= b.endOffset
        );
        if (!insideClassBlock) {
          checkedOccurrences++;
          if (!darkBgRegex.test(line)) {
            violations.push(`${file.relative}:${idx + 1}`);
          }
        }
      }
    }

    assert(checkedOccurrences > 0, "Expected at least 1 occurrence of bg-brand-danger or bg-brand-action-blue");
    assert.deepStrictEqual(
      violations,
      [],
      `Missing explicit dark:bg-* alongside bg-brand-danger/bg-brand-action-blue: ${violations.join(", ")}`
    );
  });

  // 5. Escopo de CSS no src/styles/globals.css
  test("5. src/styles/globals.css define seletores :not(.dark) e .brand-card-selected em @layer components", () => {
    const globalsCssPath = path.join(srcDir, "styles", "globals.css");
    const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
    const strippedCss = stripCssComments(globalsCss);

    const relixSelector = ':root[data-brand-theme="relix"]:not(.dark)';
    const collapseSelector = ':root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)';

    const relixBlock = extractCssBlock(strippedCss, relixSelector);
    assert(relixBlock.includes("--brand-accent"), "Relix block must define --brand-accent");

    const collapseBlock = extractCssBlock(strippedCss, collapseSelector);
    assert(
      collapseBlock.includes("--brand-action-blue"),
      "Collapse block must remap --brand-action-blue"
    );

    const componentsLayer = extractCssBlock(strippedCss, "@layer components");
    assert(
      componentsLayer.includes("html:not(.dark) .brand-card-selected"),
      "@layer components must contain html:not(.dark) .brand-card-selected"
    );

    const brandThemeLines = strippedCss
      .split(/\r?\n/)
      .filter((line) => line.includes("[data-brand-theme"));
    assert(brandThemeLines.length >= 2, "Expected at least 2 [data-brand-theme] rules in globals.css");
    for (const line of brandThemeLines) {
      assert(
        line.includes(":not(.dark)"),
        `Selector with [data-brand-theme must include :not(.dark): ${line.trim()}`
      );
    }
  });

  console.log("\n✅ Mode 1 — Static Theme Migration Audit passed.");
}

async function waitForServer(baseUrl: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status < 500) {
        return;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error(
    `Servidor não respondeu em ${baseUrl} dentro de ${timeoutMs}ms (${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    })`
  );
}

async function waitForSettledPaint(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function waitForComputedStyleProp(
  locator: Locator,
  prop: keyof ComputedStyleSnapshot,
  expected: string,
  label: string,
  timeoutMs = 2500
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let actual = "";

  while (Date.now() < deadline) {
    actual = await locator.evaluate((el, styleProp) => {
      return window.getComputedStyle(el)[styleProp];
    }, prop);
    if (actual === expected) {
      return actual;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.strictEqual(actual, expected, `${label}: expected ${prop} === "${expected}", got "${actual}"`);
  return actual;
}

async function getComputedSnapshot(locator: Locator): Promise<ComputedStyleSnapshot> {
  return locator.evaluate(async (el) => {
    if (typeof el.getAnimations === "function") {
      const finiteAnimations = el.getAnimations().filter((anim) => {
        const timing = anim.effect?.getTiming?.();
        return timing?.iterations !== Infinity;
      });
      await Promise.all(finiteAnimations.map((anim) => anim.finished.catch(() => {})));
    }
    const cs = window.getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderTopColor: cs.borderTopColor,
    };
  });
}

async function setBrandStorageAndReload(
  page: Page,
  theme: "light" | "dark",
  brandTheme: "default" | "relix",
  waitUntil: "domcontentloaded" | "networkidle" = "networkidle"
): Promise<void> {
  await page.evaluate(
    ({ t, b }) => {
      localStorage.setItem("hubsupport_theme", t);
      localStorage.setItem("relix_brand_theme", b);
    },
    { t: theme, b: brandTheme }
  );
  await page.reload({ waitUntil });
}

async function runLivePlaywrightAudit() {
  const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`\nRunning Mode 2 — Live Playwright Light/Dark Audit against ${baseUrl}...\n`);

  await waitForServer(baseUrl, 15000);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // =========================================================================
    // Bloco A — /login (sem sessão)
    // =========================================================================
    await asyncTest("Bloco A.1 — /login light 'default' exibe #btn-login rgb(15, 23, 42) e dataset.brandTheme undefined", async () => {
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem("hubsupport_theme", "light");
        localStorage.setItem("relix_brand_theme", "default");
      });
      await page.reload({ waitUntil: "networkidle" });

      const btnLogin = page.locator("#btn-login");
      await btnLogin.waitFor({ state: "visible", timeout: 10000 });
      await waitForSettledPaint(page);

      const state = await page.evaluate(() => ({
        brandTheme: document.documentElement.dataset.brandTheme,
        isDark: document.documentElement.classList.contains("dark"),
      }));
      assert.strictEqual(state.brandTheme, undefined);
      assert.strictEqual(state.isDark, false);

      await waitForComputedStyleProp(
        btnLogin,
        "backgroundColor",
        "rgb(15, 23, 42)",
        "/login light default #btn-login"
      );
    });

    await asyncTest("Bloco A.2 — /login F5 anti-FOUC em 'relix' aplica dataset imediatamente e #btn-login fica rgb(225, 29, 72)", async () => {
      await setBrandStorageAndReload(page, "light", "relix", "domcontentloaded");

      // Checagem imediata antes de networkidle (prova anti-FOUC síncrono no <head>)
      const immediateBrand = await page.evaluate(() => document.documentElement.dataset.brandTheme);
      assert.strictEqual(
        immediateBrand,
        "relix",
        `Expected dataset.brandTheme === "relix" immediately on domcontentloaded, got "${immediateBrand}"`
      );

      await page.waitForLoadState("networkidle");
      const btnLogin = page.locator("#btn-login");
      await btnLogin.waitFor({ state: "visible", timeout: 10000 });
      await waitForSettledPaint(page);

      await waitForComputedStyleProp(
        btnLogin,
        "backgroundColor",
        "rgb(225, 29, 72)",
        "/login light relix #btn-login"
      );
    });

    await asyncTest("Bloco A.3 — /login dark mode é 100% idêntico entre 'default' e 'relix'", async () => {
      const captureLoginDark = async (brand: "default" | "relix") => {
        await setBrandStorageAndReload(page, "dark", brand, "networkidle");
        await page.locator("#btn-login").waitFor({ state: "visible", timeout: 10000 });
        await page.locator("#email").waitFor({ state: "visible", timeout: 10000 });
        await waitForSettledPaint(page);

        const rootState = await page.evaluate(() => ({
          isDark: document.documentElement.classList.contains("dark"),
          brandTheme: document.documentElement.dataset.brandTheme,
        }));
        assert.strictEqual(rootState.isDark, true, `/login must have .dark in ${brand}`);
        assert.strictEqual(
          rootState.brandTheme,
          brand === "relix" ? "relix" : undefined,
          `/login dataset.brandTheme mismatch in dark ${brand}`
        );

        return {
          body: await getComputedSnapshot(page.locator("body")),
          btnLogin: await getComputedSnapshot(page.locator("#btn-login")),
          email: await getComputedSnapshot(page.locator("#email")),
        };
      };

      const darkDefault = await captureLoginDark("default");
      const darkRelix = await captureLoginDark("relix");
      assert.deepStrictEqual(
        darkRelix,
        darkDefault,
        "/login dark mode styles must be strictly identical between default and relix"
      );
    });

    // =========================================================================
    // Bloco B — Autenticação e Fluxo Autenticado
    // =========================================================================
    await asyncTest("Bloco B.1 — Login administrativo autentica com sucesso", async () => {
      await setBrandStorageAndReload(page, "light", "default", "networkidle");
      await page.locator("#email").waitFor({ state: "visible", timeout: 10000 });

      const email = process.env.TEST_ADMIN_EMAIL || "admin@hubsupport.com";
      const password = process.env.TEST_ADMIN_PASSWORD || "HubSupport@2026";
      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.click("#btn-login");

      try {
        await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
      } catch (err) {
        const errorText = await page
          .locator("form")
          .locator("..")
          .locator(".bg-rose-50, .text-rose-800")
          .first()
          .textContent()
          .catch(() => null);
        throw new Error(
          `Falha de autenticação/seed no login (${email}): ${
            errorText ? `alerta="${errorText.trim()}"` : err instanceof Error ? err.message : String(err)
          }. Verifique se o banco recebeu 'npm run seed'.`
        );
      }
      await page.waitForLoadState("networkidle");
    });

    await asyncTest("Bloco B.2 — /dashboard/configuracoes troca tema para 'relix', persiste após F5 e colore sidebar ativa", async () => {
      await page.goto(`${baseUrl}/dashboard/configuracoes`, { waitUntil: "networkidle" });
      await setBrandStorageAndReload(page, "light", "default", "networkidle");

      const appearanceTab = page.locator('button:has-text("Aparência")').first();
      const defaultCard = page.locator('button:has-text("Padrão do Sistema")').first();
      const relixCard = page.locator('button:has-text("Relix Carmim")').first();

      await appearanceTab.waitFor({ state: "visible", timeout: 15000 });
      await defaultCard.waitFor({ state: "visible", timeout: 10000 });
      await relixCard.waitFor({ state: "visible", timeout: 10000 });

      const tabClasses = (await appearanceTab.getAttribute("class")) || "";
      assert(
        tabClasses.includes("border-brand-accent"),
        `Expected Aparência tab to be active with border-brand-accent, got "${tabClasses}"`
      );

      await relixCard.click();
      await waitForSettledPaint(page);

      const postClick = await page.evaluate(() => ({
        datasetBrand: document.documentElement.dataset.brandTheme,
        storedBrand: localStorage.getItem("relix_brand_theme"),
      }));
      assert.strictEqual(postClick.datasetBrand, "relix");
      assert.strictEqual(postClick.storedBrand, "relix");

      assert.strictEqual(
        await relixCard.getAttribute("aria-pressed"),
        "true",
        "Clicked Relix Carmim card must have aria-pressed='true'"
      );
      const relixCardClasses = (await relixCard.getAttribute("class")) || "";
      assert(
        relixCardClasses.includes("brand-card-selected"),
        `Clicked Relix Carmim card must include brand-card-selected, got "${relixCardClasses}"`
      );

      // F5 anti-FOUC e persistência na sidebar
      await page.reload({ waitUntil: "domcontentloaded" });
      const immediateBrand = await page.evaluate(() => document.documentElement.dataset.brandTheme);
      assert.strictEqual(
        immediateBrand,
        "relix",
        `Expected dataset.brandTheme === "relix" immediately on domcontentloaded after F5`
      );

      await page.waitForLoadState("networkidle");
      const activeSidebarLink = page.locator('aside nav a[href="/dashboard/configuracoes"]').first();
      await activeSidebarLink.waitFor({ state: "visible", timeout: 10000 });
      await waitForComputedStyleProp(
        activeSidebarLink,
        "backgroundColor",
        "rgb(225, 29, 72)",
        "/dashboard/configuracoes active sidebar link (light relix)"
      );
    });

    await asyncTest("Bloco B.3 — /dashboard/atendimentos aplica brand-card-selected e preserva cores de TagBadge", async () => {
      await page.goto(`${baseUrl}/dashboard/atendimentos`, { waitUntil: "networkidle" });
      await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
      await page
        .locator('text="Carregando atendimentos do dia..."')
        .waitFor({ state: "hidden", timeout: 15000 })
        .catch(() => {});

      const cards = page.locator("[data-card-id]");
      const cardCount = await cards.count();

      if (cardCount === 0) {
        console.log("    ℹ Nenhum [data-card-id] encontrado em /dashboard/atendimentos; seleção de card/TagBadge pulada.");
        return;
      }

      const firstCard = cards.first();
      const cardId = await firstCard.getAttribute("data-card-id");
      assert(cardId, "First card must have non-empty data-card-id");

      await firstCard.click();
      await waitForSettledPaint(page);

      const cardClasses = (await firstCard.getAttribute("class")) || "";
      assert(
        cardClasses.includes("brand-card-selected"),
        `Selected card ${cardId} must have brand-card-selected, got "${cardClasses}"`
      );

      await waitForComputedStyleProp(
        firstCard,
        "borderTopColor",
        "rgb(225, 29, 72)",
        `/dashboard/atendimentos selected card ${cardId} (light relix)`
      );

      const tagBadgeSelector = 'span[style]:has(> span[aria-hidden="true"][style])';
      const relixTagBadge = firstCard.locator(tagBadgeSelector).first();
      if ((await relixTagBadge.count()) > 0) {
        const readTagStyles = async (cardLocator: Locator) => {
          return cardLocator
            .locator(tagBadgeSelector)
            .first()
            .evaluate((el) => {
              const htmlEl = el as HTMLElement;
              const cs = window.getComputedStyle(htmlEl);
              return {
                inlineColor: htmlEl.style.color,
                inlineBackgroundColor: htmlEl.style.backgroundColor,
                computedColor: cs.color,
                computedBackgroundColor: cs.backgroundColor,
              };
            });
        };

        const relixTagStyles = await readTagStyles(firstCard);
        assert(relixTagStyles.inlineColor.length > 0, "TagBadge must define inline style.color");
        assert(
          relixTagStyles.inlineBackgroundColor.length > 0,
          "TagBadge must define inline style.backgroundColor"
        );
        assert.strictEqual(
          relixTagStyles.computedColor,
          relixTagStyles.inlineColor,
          "TagBadge computed color must match its own inline style.color in relix mode"
        );
        assert.strictEqual(
          relixTagStyles.computedBackgroundColor,
          relixTagStyles.inlineBackgroundColor,
          "TagBadge computed backgroundColor must match its own inline style.backgroundColor in relix mode"
        );

        // Compara o mesmo card em modo light 'default' para garantir preservação absoluta da TagBadge
        await setBrandStorageAndReload(page, "light", "default", "networkidle");
        await page
          .locator('text="Carregando atendimentos do dia..."')
          .waitFor({ state: "hidden", timeout: 15000 })
          .catch(() => {});
        const sameCardDefault = page.locator(`[data-card-id="${cardId}"]`).first();
        await sameCardDefault.waitFor({ state: "visible", timeout: 10000 });
        const defaultTagStyles = await readTagStyles(sameCardDefault);

        assert.deepStrictEqual(
          relixTagStyles,
          defaultTagStyles,
          `TagBadge inline/computed colors on card ${cardId} must be identical between default and relix light modes`
        );

        // Restaura relix para os passos seguintes
        await page.evaluate(() => localStorage.setItem("relix_brand_theme", "relix"));
      }
    });

    await asyncTest("Bloco B.4 — /dashboard/tecnico alterna botão 'Quadro Kanban (Operações)' entre relix e default", async () => {
      await page.evaluate(() => {
        localStorage.setItem("hubsupport_theme", "light");
        localStorage.setItem("relix_brand_theme", "relix");
      });
      await page.goto(`${baseUrl}/dashboard/tecnico`, { waitUntil: "networkidle" });

      const kanbanBtn = page.locator('button:has-text("Quadro Kanban (Operações)")').first();
      await kanbanBtn.waitFor({ state: "visible", timeout: 15000 });
      await waitForSettledPaint(page);

      await waitForComputedStyleProp(
        kanbanBtn,
        "backgroundColor",
        "rgb(225, 29, 72)",
        "/dashboard/tecnico Kanban button (light relix)"
      );

      await setBrandStorageAndReload(page, "light", "default", "networkidle");
      await kanbanBtn.waitFor({ state: "visible", timeout: 15000 });
      await waitForSettledPaint(page);

      await waitForComputedStyleProp(
        kanbanBtn,
        "backgroundColor",
        "rgb(15, 23, 42)",
        "/dashboard/tecnico Kanban button (light default)"
      );
    });

    await asyncTest("Bloco B.5 — /dashboard/clientes em light 'relix' exibe botão 'Novo Cliente' em rgb(225, 29, 72)", async () => {
      await page.evaluate(() => {
        localStorage.setItem("hubsupport_theme", "light");
        localStorage.setItem("relix_brand_theme", "relix");
      });
      await page.goto(`${baseUrl}/dashboard/clientes`, { waitUntil: "networkidle" });

      const newClientBtn = page.locator('button:has-text("Novo Cliente")').first();
      await newClientBtn.waitFor({ state: "visible", timeout: 15000 });
      await waitForSettledPaint(page);

      await waitForComputedStyleProp(
        newClientBtn,
        "backgroundColor",
        "rgb(225, 29, 72)",
        "/dashboard/clientes 'Novo Cliente' button (light relix)"
      );
    });

    await asyncTest("Bloco B.6 — Paridade Dark Mode (default vs relix) em /dashboard/configuracoes e /dashboard/tecnico", async () => {
      const captureConfigDark = async (brand: "default" | "relix") => {
        await page.evaluate(
          (b) => {
            localStorage.setItem("hubsupport_theme", "dark");
            localStorage.setItem("relix_brand_theme", b);
          },
          brand
        );
        await page.goto(`${baseUrl}/dashboard/configuracoes`, { waitUntil: "networkidle" });
        await page.reload({ waitUntil: "networkidle" });

        const appearanceTab = page.locator('button:has-text("Aparência")').first();
        const darkNoticeBtn = page.locator('button:has-text("Alternar para Modo Claro")').first();
        const sidebarLink = page.locator('aside nav a[href="/dashboard/configuracoes"]').first();
        const activeThemeCard = page.locator('button[aria-pressed="true"]').first();

        await appearanceTab.waitFor({ state: "visible", timeout: 15000 });
        await darkNoticeBtn.waitFor({ state: "visible", timeout: 10000 });
        await sidebarLink.waitFor({ state: "visible", timeout: 10000 });
        await activeThemeCard.waitFor({ state: "visible", timeout: 10000 });
        await waitForSettledPaint(page);

        const rootState = await page.evaluate(() => ({
          isDark: document.documentElement.classList.contains("dark"),
          brandTheme: document.documentElement.dataset.brandTheme,
        }));
        assert.strictEqual(rootState.isDark, true);
        assert.strictEqual(rootState.brandTheme, brand === "relix" ? "relix" : undefined);

        const baseSnapshot = {
          body: await getComputedSnapshot(page.locator("body")),
          sidebarLink: await getComputedSnapshot(sidebarLink),
          activeTab: await getComputedSnapshot(appearanceTab),
          darkNoticeBtn: await getComputedSnapshot(darkNoticeBtn),
          activeThemeCard: await getComputedSnapshot(activeThemeCard),
        };

        // Captura o input #tagName via aba Formato de Formulário -> Nova Tag (leitura pura, sem salvar)
        await page.locator('button:has-text("Formato de Formulário")').first().click();
        const novaTagBtn = page.locator('button:has-text("Nova Tag")').first();
        await novaTagBtn.waitFor({ state: "visible", timeout: 10000 });
        const novaTagBtnSnapshot = await getComputedSnapshot(novaTagBtn);
        await novaTagBtn.click();

        const tagInput = page.locator("#tagName");
        await tagInput.waitFor({ state: "visible", timeout: 10000 });
        await tagInput.focus();
        await waitForSettledPaint(page);
        const inputFocused = await getComputedSnapshot(tagInput);

        await tagInput.evaluate((el) => (el as HTMLInputElement).blur());
        await waitForSettledPaint(page);
        const inputResting = await getComputedSnapshot(tagInput);

        await page.locator('button:has-text("Cancelar")').first().click();

        return {
          ...baseSnapshot,
          novaTagBtn: novaTagBtnSnapshot,
          inputResting,
          inputFocused,
        };
      };

      const configDarkDefault = await captureConfigDark("default");
      const configDarkRelix = await captureConfigDark("relix");
      assert.deepStrictEqual(
        configDarkRelix,
        configDarkDefault,
        "/dashboard/configuracoes dark mode styles must be strictly identical between default and relix"
      );

      const captureTechDark = async (brand: "default" | "relix") => {
        await page.evaluate(
          (b) => {
            localStorage.setItem("hubsupport_theme", "dark");
            localStorage.setItem("relix_brand_theme", b);
          },
          brand
        );
        await page.goto(`${baseUrl}/dashboard/tecnico`, { waitUntil: "networkidle" });
        await page.reload({ waitUntil: "networkidle" });

        const sidebarLink = page.locator('aside nav a[href="/dashboard/tecnico"]').first();
        const kanbanBtn = page.locator('button:has-text("Quadro Kanban (Operações)")').first();
        const firstInput = page.locator('main input:visible').first();

        await sidebarLink.waitFor({ state: "visible", timeout: 15000 });
        await kanbanBtn.waitFor({ state: "visible", timeout: 15000 });
        await firstInput.waitFor({ state: "visible", timeout: 15000 });
        await waitForSettledPaint(page);

        const rootState = await page.evaluate(() => ({
          isDark: document.documentElement.classList.contains("dark"),
          brandTheme: document.documentElement.dataset.brandTheme,
        }));
        assert.strictEqual(rootState.isDark, true);
        assert.strictEqual(rootState.brandTheme, brand === "relix" ? "relix" : undefined);

        const inputResting = await getComputedSnapshot(firstInput);
        await firstInput.focus();
        await waitForSettledPaint(page);
        const inputFocused = await getComputedSnapshot(firstInput);

        return {
          body: await getComputedSnapshot(page.locator("body")),
          sidebarLink: await getComputedSnapshot(sidebarLink),
          kanbanBtn: await getComputedSnapshot(kanbanBtn),
          inputResting,
          inputFocused,
        };
      };

      const techDarkDefault = await captureTechDark("default");
      const techDarkRelix = await captureTechDark("relix");
      assert.deepStrictEqual(
        techDarkRelix,
        techDarkDefault,
        "/dashboard/tecnico dark mode styles must be strictly identical between default and relix"
      );
    });

    console.log("\n✅ Mode 2 — Live Playwright Light/Dark Audit passed.");
  } finally {
    await browser.close();
  }
}

async function main() {
  runStaticAudit();

  if (process.argv.includes("--live")) {
    await runLivePlaywrightAudit();
  }
}

main().catch((err) => {
  console.error("\n❌ Audit failed:", err);
  process.exit(1);
});
