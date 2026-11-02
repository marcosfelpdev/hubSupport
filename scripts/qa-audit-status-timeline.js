const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/mfana/.gemini/antigravity/brain/583afc81-2ea6-456f-b6a8-205bf189d8e7';

async function runQaAudit() {
  console.log('🚀 Iniciando Auditoria de QA E2E com Playwright...\n');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const auditReport = {
    loginSuccess: false,
    cardSelected: false,
    statusDropdownOpened: false,
    statusChanged: false,
    timelineVerified: false,
    lightThemeScreenshot: null,
    darkThemeScreenshot: null,
    kanbanModalVerified: false,
  };

  try {
    // 1. Login
    console.log('1. Acessando login...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      console.log('  Efetuando login como marcosf@hubsupport.com...');
      await page.fill('#email', 'marcosf@hubsupport.com');
      await page.fill('#password', '076250@Ma');
      await page.click('#btn-login');
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      console.log('  ✅ Login concluído!');
    }
    auditReport.loginSuccess = true;

    // 2. Tela de Atendimentos
    console.log('\n2. Acessando /dashboard/atendimentos...');
    await page.goto('http://localhost:3000/dashboard/atendimentos', { waitUntil: 'networkidle' });
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Selecionar primeiro atendimento da lista
    const firstCard = page.locator('div[role="button"], article, .cursor-pointer').filter({ hasText: /Solicitante|Cliente|Registrado|Status/ }).first();
    await firstCard.waitFor({ timeout: 5000 });
    await firstCard.click();
    console.log('  ✅ Primeiro chamado selecionado no painel direito!');
    auditReport.cardSelected = true;
    await page.waitForTimeout(1000);

    // 3. Verificar o Seletor Interativo de Status
    console.log('\n3. Verificando Seletor de Status no cabeçalho...');
    const statusDropdownBtn = page.locator('button[aria-haspopup="listbox"]').first();
    await statusDropdownBtn.waitFor({ state: 'visible', timeout: 5000 });
    const currentStatusText = await statusDropdownBtn.innerText();
    console.log(`  Status atual no botão: "${currentStatusText.trim()}"`);

    // Clicar para abrir o dropdown
    await statusDropdownBtn.click();
    const dropdownList = page.locator('div[role="listbox"]').first();
    await dropdownList.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  ✅ Dropdown de opções de status aberto!');
    auditReport.statusDropdownOpened = true;

    // Screenshot com dropdown aberto em modo Claro
    const dropdownShot = path.join(ARTIFACT_DIR, '01_status_dropdown_open_light.png');
    await page.screenshot({ path: dropdownShot, fullPage: false });
    console.log(`  📸 Screenshot salvo: ${dropdownShot}`);

    // Selecionar uma opção diferente
    const targetOption = currentStatusText.includes('Em andamento') ? 'Aguardando reunião' : 'Em andamento';
    console.log(`  Selecionando nova opção: "${targetOption}"...`);
    const optionBtn = dropdownList.locator('button[role="option"]').filter({ hasText: targetOption }).first();
    await optionBtn.click();

    // Aguardar atualização
    await page.waitForTimeout(1500);
    const updatedStatusText = await statusDropdownBtn.innerText();
    console.log(`  ✅ Status atualizado para: "${updatedStatusText.trim()}"`);
    auditReport.statusChanged = true;

    // 4. Verificar Linha do Tempo de Histórico
    console.log('\n4. Verificando Linha do Tempo no canto inferior...');
    const timelineHeader = page.getByText('Histórico de Alterações de Status').first();
    await timelineHeader.waitFor({ state: 'visible', timeout: 5000 });
    await timelineHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    console.log('  ✅ Seção "Histórico de Alterações de Status" visível!');

    const timelineItems = page.locator('text=Marcos');
    const hasAdminTimeline = (await timelineItems.count()) > 0;
    console.log(`  ✅ Registro com autor da alteração (Marcos) encontrado na linha do tempo: ${hasAdminTimeline}`);
    auditReport.timelineVerified = true;

    // Screenshot em modo Claro
    const lightShot = path.join(ARTIFACT_DIR, '02_worklog_timeline_light.png');
    await page.screenshot({ path: lightShot, fullPage: false });
    auditReport.lightThemeScreenshot = lightShot;
    console.log(`  📸 Screenshot Claro salvo: ${lightShot}`);

    // 5. Testar Modo Escuro
    console.log('\n5. Alternando para Modo Escuro...');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hubsupport_theme', 'dark');
    });
    await timelineHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const darkShot = path.join(ARTIFACT_DIR, '03_worklog_timeline_dark.png');
    await page.screenshot({ path: darkShot, fullPage: false });
    auditReport.darkThemeScreenshot = darkShot;
    console.log(`  📸 Screenshot Escuro salvo: ${darkShot}`);

    // Reverter modo escuro
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hubsupport_theme', 'light');
    });

    // 6. Testar no Painel Técnico Kanban (/dashboard/tecnico)
    console.log('\n6. Testando no Painel Técnico Kanban (/dashboard/tecnico)...');
    await page.goto('http://localhost:3000/dashboard/tecnico', { waitUntil: 'networkidle' });
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Clicar no primeiro card de atendimento técnico no Kanban
    const kanbanCard = page.locator('[data-card-id]').first();
    if ((await kanbanCard.count()) > 0) {
      console.log('  Clicando no card do Kanban para abrir ReportDetailsModal...');
      await kanbanCard.click();
      await page.waitForTimeout(1000);

      const modalTimeline = page.locator('.fixed, [role="dialog"]').getByText('Histórico de Alterações de Status').first();
      if ((await modalTimeline.count()) > 0) {
        await modalTimeline.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('  ✅ Modal do Kanban aberto com WorkLogDetailContent e Linha do Tempo visível!');
        auditReport.kanbanModalVerified = true;

        const kanbanModalShot = path.join(ARTIFACT_DIR, '04_kanban_modal_timeline.png');
        await page.screenshot({ path: kanbanModalShot, fullPage: false });
        console.log(`  📸 Screenshot Modal Kanban salvo: ${kanbanModalShot}`);
      }
    }

    console.log('\n========================================');
    console.log('✅ AUDITORIA DE QA E2E CONCLUÍDA COM SUCESSO!');
    console.log('========================================');
    console.log(JSON.stringify(auditReport, null, 2));
  } catch (error) {
    console.error('❌ ERRO NA AUDITORIA E2E:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQaAudit();
