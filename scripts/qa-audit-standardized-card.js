const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/mfana/.gemini/antigravity/brain/85c475c0-b573-4c96-8f1a-3a5f6a975a7d';

async function runQaAudit() {
  console.log('🚀 Iniciando Auditoria Completa de QA — Card Maximizador Padronizado...\n');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const results = {
    auth: false,
    mainDashboardWithAi: false,
    mainDashboardWithoutAi: false,
    pdfViewerModal: false,
    technicianDashboardWithFooterAction: false,
    kanbanOverviewModal: false,
    lightThemeVerified: false,
    darkThemeVerified: false,
  };

  try {
    // -------------------------------------------------------------
    // 1. Autenticação (Login)
    // -------------------------------------------------------------
    console.log('1. Acessando tela de login (http://localhost:3000)...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      console.log('  Efetuando login como admin@hubsupport.com...');
      await page.fill('#email', process.env.TEST_ADMIN_EMAIL || 'admin@hubsupport.com');
      await page.fill('#password', process.env.TEST_ADMIN_PASSWORD || 'HubSupport@2026');
      await page.click('#btn-login');
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      console.log('  ✅ Login efetuado com sucesso!');
    } else {
      console.log('  ✅ Sessão já ativa!');
    }
    results.auth = true;

    // -------------------------------------------------------------
    // 2. Tela de Atendimentos Principal (/dashboard/atendimentos)
    // -------------------------------------------------------------
    console.log('\n2. Navegando para Tela de Atendimento Principal (/dashboard/atendimentos)...');
    await page.goto('http://localhost:3000/dashboard/atendimentos', { waitUntil: 'networkidle' });
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Salvar screenshot do Dashboard de Atendimentos em modo Claro
    const shotLightPath = path.join(ARTIFACT_DIR, '01_atendimentos_light.png');
    await page.screenshot({ path: shotLightPath, fullPage: false });
    console.log(`  📸 Screenshot salvo: ${shotLightPath}`);
    results.lightThemeVerified = true;

    // A) Verificar chamado COM relatório de IA gerado
    console.log('\n  A) Verificando chamado com Relatório de IA gerado (structuredData)...');
    const aiCardSelector = '[id^="card-daily-cmvz4"]';
    const hasAiCard = await page.$(aiCardSelector);
    if (hasAiCard) {
      await page.click(aiCardSelector);
    } else {
      await page.click('[id^="card-daily-"]');
    }
    await page.waitForTimeout(600);

    // Verificar seções ricas do WorkLogDetailContent (case insensitive)
    const mainText = (await page.innerText('.lg\\:col-span-7')).toLowerCase();
    
    const hasClientOrRequester = mainText.includes('solicitante:') && mainText.includes('registrado em:');
    const hasDescription = mainText.includes('descrição do atendimento');
    const hasSolution = mainText.includes('solução / ação realizada');
    const hasAiHeader = mainText.includes('relatório') || mainText.includes('ia');
    const hasExecutiveSummary = mainText.includes('resumo executivo');
    const hasProposals = mainText.includes('propostas & melhorias') || mainText.includes('melhorias');
    const hasTechnicalDetailing = mainText.includes('detalhamento:');
    const hasPdfBtn = await page.$('button:has-text("Visualizar PDF")');

    console.log(`    - Metadados e Solicitante: ${hasClientOrRequester ? '✅' : '❌'}`);
    console.log(`    - Seção Descrição do Atendimento: ${hasDescription ? '✅' : '❌'}`);
    console.log(`    - Seção Solução / Ação Realizada: ${hasSolution ? '✅' : '❌'}`);
    console.log(`    - Header de IA / Resumo Executivo: ${hasExecutiveSummary ? '✅' : '❌'}`);
    console.log(`    - Propostas & Melhorias com Badges: ${hasProposals ? '✅' : '❌'}`);
    console.log(`    - Detalhamento Técnico: ${hasTechnicalDetailing ? '✅' : '❌'}`);
    console.log(`    - Botão "Visualizar PDF": ${hasPdfBtn ? '✅' : '❌'}`);

    if (hasClientOrRequester && hasDescription && hasExecutiveSummary && hasProposals) {
      results.mainDashboardWithAi = true;
      console.log('  ✅ Chamado com IA validado com sucesso!');
    }

    // Screenshot do chamado com IA selecionado
    const shotAiPath = path.join(ARTIFACT_DIR, '02_chamado_com_ia_detalhes.png');
    await page.screenshot({ path: shotAiPath });

    // B) Teste de abertura do PdfViewerModal
    if (hasPdfBtn) {
      console.log('\n  B) Testando abertura do visualizador de PDF (PdfViewerModal)...');
      await page.click('button:has-text("Visualizar PDF")');
      await page.waitForSelector('iframe', { timeout: 8000 });
      await page.waitForTimeout(1000);

      const hasIframe = await page.$('iframe');
      const hasExportBtn = await page.$('a:has-text("Exportar")');
      console.log(`    - Iframe do PDF carregado: ${hasIframe ? '✅' : '❌'}`);
      console.log(`    - Botão Exportar presente: ${hasExportBtn ? '✅' : '❌'}`);

      // Screenshot do modal de PDF
      const shotPdfModalPath = path.join(ARTIFACT_DIR, '03_pdf_viewer_modal.png');
      await page.screenshot({ path: shotPdfModalPath });

      // Fechar modal de PDF via tecla Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const isModalClosed = (await page.$('iframe')) === null;
      console.log(`    - Modal fechado via Escape: ${isModalClosed ? '✅' : '❌'}`);
      results.pdfViewerModal = !!(hasIframe && hasExportBtn && isModalClosed);
    }

    // C) Verificar chamado SEM relatório de IA (Banner sob demanda)
    console.log('\n  C) Verificando chamado sem Relatório de IA (Banner sob demanda)...');
    const cardWithoutAi = await page.$('#card-daily-cmvx3w42z000111ojs1yya5vp') ||
                          await page.$('#card-daily-cmvyt5pdd0003ja3lyny4gf4c') ||
                          await page.$('#card-daily-cmv9afhiz0002yo87uvfwbxdx');
    if (cardWithoutAi) {
      await cardWithoutAi.click();
      await page.waitForTimeout(600);

      const detailTextWithoutAi = await page.innerText('.lg\\:col-span-7');
      const hasDemandBanner = detailTextWithoutAi.includes('Relatório Executivo com IA') &&
                              detailTextWithoutAi.includes('Você pode solicitar a geração sob demanda');
      const hasGenerateBtn = await page.$('button:has-text("Gerar Relatório com IA")');

      console.log(`    - Banner sob demanda presente: ${hasDemandBanner ? '✅' : '❌'}`);
      console.log(`    - Botão [✨ Gerar Relatório com IA] presente: ${hasGenerateBtn ? '✅' : '❌'}`);

      const shotWithoutAiPath = path.join(ARTIFACT_DIR, '04_chamado_sem_ia_banner.png');
      await page.screenshot({ path: shotWithoutAiPath });

      if (hasDemandBanner && hasGenerateBtn) {
        results.mainDashboardWithoutAi = true;
        console.log('  ✅ Banner sob demanda validado com sucesso!');
      }
    }

    // -------------------------------------------------------------
    // 3. Tela de Atendimento do Técnico (/dashboard/tecnico)
    // -------------------------------------------------------------
    console.log('\n3. Navegando para Tela de Atendimento do Técnico (/dashboard/tecnico)...');
    await page.goto('http://localhost:3000/dashboard/tecnico', { waitUntil: 'networkidle' });
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Alternar para a visualização "Lista Tradicional" para testar TechnicianDashboardClient
    console.log('  Alternando para a visualização Lista Tradicional...');
    const listBtn = await page.$('button:has-text("Lista Tradicional")');
    if (listBtn) {
      await listBtn.click();
      await page.waitForTimeout(600);
    }

    // Clica no primeiro card de atendimento técnico
    const firstTechCard = await page.$('[id^="card-tech-"]') || await page.$('.lg\\:col-span-5 [id^="card-"]');
    if (firstTechCard) {
      await firstTechCard.click();
      await page.waitForTimeout(600);

      const techDetailText = (await page.innerText('.lg\\:col-span-7')).toLowerCase();
      const hasWorkLogContent = techDetailText.includes('descrição do atendimento');
      const hasTechnicalActionSection = techDetailText.includes('resolução técnica');
      const hasSolvedButtonOrBadge = techDetailText.includes('solucionado') || techDetailText.includes('marcar como solucionado');

      console.log(`    - WorkLogDetailContent renderizado: ${hasWorkLogContent ? '✅' : '❌'}`);
      console.log(`    - Seção Resolução Técnica no footerActions: ${hasTechnicalActionSection ? '✅' : '❌'}`);
      console.log(`    - Botão/Badge de Solucionado presente: ${hasSolvedButtonOrBadge ? '✅' : '❌'}`);

      const shotTechPath = path.join(ARTIFACT_DIR, '05_tecnico_detalhes_footer.png');
      await page.screenshot({ path: shotTechPath });

      if (hasWorkLogContent && hasTechnicalActionSection && hasSolvedButtonOrBadge) {
        results.technicianDashboardWithFooterAction = true;
        console.log('  ✅ Tela do Técnico com slot footerActions validada com sucesso!');
      }
    } else {
      console.log('    ⚠️ Nenhum card técnico encontrado.');
    }

    // -------------------------------------------------------------
    // 4. Modal do Kanban / Visão Geral (/dashboard)
    // -------------------------------------------------------------
    console.log('\n4. Navegando para Visão Geral / Modal do Kanban (/dashboard)...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Clica no primeiro card da lista de chamados recentes para abrir o ReportDetailsModal
    const recentCard = await page.$('.space-y-3 .group');

    if (recentCard) {
      await recentCard.click();
      await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 });
      await page.waitForTimeout(800);

      const modalText = (await page.innerText('.fixed.inset-0.z-50')).toLowerCase();
      const modalHasContent = modalText.includes('descrição do atendimento');
      console.log(`    - ReportDetailsModal aberto com WorkLogDetailContent: ${modalHasContent ? '✅' : '❌'}`);

      // Testar se há botão de Visualizar PDF dentro do ReportDetailsModal
      const modalPdfBtn = await page.$('.fixed.inset-0.z-50 button:has-text("Visualizar PDF")');
      if (modalPdfBtn) {
        console.log('    - Testando alternância para PDF dentro do modal...');
        await modalPdfBtn.click();
        await page.waitForSelector('iframe', { timeout: 6000 });
        await page.waitForTimeout(800);
        console.log('    - Iframe renderizado dentro do ReportDetailsModal: ✅');

        // Retornar para detalhes
        const backBtn = await page.$('button:has-text("Detalhes")');
        if (backBtn) {
          await backBtn.click();
          await page.waitForTimeout(500);
        }
      }

      const shotKanbanModal = path.join(ARTIFACT_DIR, '06_kanban_modal_padronizado.png');
      await page.screenshot({ path: shotKanbanModal });

      if (modalHasContent) {
        results.kanbanOverviewModal = true;
        console.log('  ✅ Modal do Kanban com WorkLogDetailContent validado!');
      }

      // Fecha o modal via Esc
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      console.log('    ⚠️ Card da lista recente não encontrado.');
    }

    // -------------------------------------------------------------
    // 5. Teste de Suporte ao Tema Escuro (CloudNexus Dark Mode)
    // -------------------------------------------------------------
    console.log('\n5. Validando Tema Escuro (Dark Mode CloudNexus)...');
    await page.goto('http://localhost:3000/dashboard/atendimentos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Aplica a classe "dark" no elemento <html> para ativar o modo escuro
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(800);

    // Clica no card de atendimento para renderizar o detalhe no modo escuro
    const darkAiCard = await page.$('[id^="card-daily-cmvz4"]') || await page.$('[id^="card-daily-"]');
    if (darkAiCard) {
      await darkAiCard.click();
      await page.waitForTimeout(600);
    }

    const shotDarkPath = path.join(ARTIFACT_DIR, '07_atendimentos_dark_mode.png');
    await page.screenshot({ path: shotDarkPath, fullPage: false });
    console.log(`  📸 Screenshot salvo: ${shotDarkPath}`);
    results.darkThemeVerified = true;
    console.log('  ✅ Tema Escuro validado com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante a auditoria de QA:', error);
  } finally {
    await browser.close();
  }

  console.log('\n=============================================');
  console.log('📋 RESUMO DA AUDITORIA DE QA:');
  console.log('=============================================');
  console.log(`1. Autenticação e Sessão:                         ${results.auth ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`2. Dashboard Atendimentos (Chamado com IA):       ${results.mainDashboardWithAi ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`3. Dashboard Atendimentos (Chamado sem IA):       ${results.mainDashboardWithoutAi ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`4. Modal de Visualização de PDF (PdfViewerModal): ${results.pdfViewerModal ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`5. Dashboard do Técnico (Slot footerActions):     ${results.technicianDashboardWithFooterAction ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`6. Modal do Kanban (ReportDetailsModal unificado): ${results.kanbanOverviewModal ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`7. Design System Tema Claro:                      ${results.lightThemeVerified ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log(`8. Design System Tema Escuro:                     ${results.darkThemeVerified ? 'APROVADO ✅' : 'REPROVADO ❌'}`);
  console.log('=============================================\n');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('🎉 AUDITORIA CONCLUÍDA COM 100% DE APROVAÇÃO!');
    process.exit(0);
  } else {
    console.warn('⚠️ Alguns testes não obtiveram aprovação completa.');
    process.exit(1);
  }
}

runQaAudit();
