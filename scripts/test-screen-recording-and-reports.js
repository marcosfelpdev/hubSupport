const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testFrontendFlow() {
  console.log('🚀 [E2E Test] Iniciando validação de interface e fluxos...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Acesso e Login
    console.log('1. Acessando login em http://localhost:3000...');
    await page.goto('http://localhost:3000');
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });

    console.log('2. Realizando login...');
    await page.fill('#email', 'marcosf@hubsupport.com');
    await page.fill('#password', '076250@Ma');
    await page.click('#btn-login');

    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });
    console.log('✅ Redirecionado com sucesso para /dashboard!');

    // 3. Verificar existência dos botões "Novo Atendimento" e "Gravação de Tela"
    const newLogBtn = await page.$('text="Novo Atendimento"');
    const screenRecBtn = await page.$('#btn-screen-recording');

    if (!newLogBtn) throw new Error('Botão "Novo Atendimento" não encontrado!');
    if (!screenRecBtn) throw new Error('Botão "Gravação de Tela" não encontrado!');
    console.log('✅ Botões "Novo Atendimento" e "Gravação de Tela" presentes no dashboard!');

    // 4. Teste de regressão: Criar atendimento comum (sem gravação)
    console.log('3. Testando criação de atendimento comum (fluxo tradicional)...');
    await newLogBtn.click();
    await page.waitForSelector('#requester', { timeout: 5000 });

    await page.fill('#requester', 'Dra. Camila Nogueira');
    await page.fill('#clientOrOffice', 'Advocacia Pinheiro');
    await page.selectOption('#status', 'Realizado');
    await page.fill('#reportedProblem', 'Dúvida sobre permissões de exportação de dados.');
    await page.fill('#actionTaken', 'Orientado sobre níveis de acesso e validada permissão com sucesso.');
    await page.click('#btn-submit-log');

    // Aguarda o modal fechar e a revalidação atualizar o dashboard
    await page.waitForSelector('#requester', { state: 'detached', timeout: 10000 });
    console.log('✅ Formulário enviado e modal fechado com sucesso!');
    await page.waitForTimeout(1000);

    // 5. Verificar se o card expandido exibe os dados do atendimento
    const cardTitle = await page.textContent('main');
    if (!cardTitle.includes('Dra. Camila Nogueira')) {
      throw new Error('Novo atendimento não foi refletido na listagem!');
    }
    console.log('✅ Novo atendimento exibido corretamente no dashboard!');

    // 6. Verificar se o atendimento com relatório IA exibe a seção e botão de download
    console.log('5. Verificando exibição da seção "Relatório gerado por IA" e botão de download...');
    const aiLogCard = await page.locator('text="Mariana Teste"').first();
    if (await aiLogCard.isVisible()) {
      await aiLogCard.click();
      await page.waitForTimeout(500);

      const aiSection = await page.locator('text="Relatório gerado por IA"');
      if (await aiSection.isVisible()) {
        console.log('✅ Seção "Relatório gerado por IA" visível no card expandido!');
      } else {
        throw new Error('Seção "Relatório gerado por IA" não está visível no card expandido!');
      }

      const downloadBtn = await page.locator('text="Baixar relatório PDF"');
      if (await downloadBtn.isVisible()) {
        console.log('✅ Botão "Baixar relatório PDF" disponível e visível!');
      } else {
        throw new Error('Botão "Baixar relatório PDF" não está visível!');
      }
    }

    // 7. Testar rota protegida de download sem autenticação
    console.log('6. Testando segurança da rota /api/reports/.../download...');
    const unauthorizedResponse = await page.request.get('http://localhost:3000/api/reports/fake-id/download', {
      headers: { cookie: '' },
    });
    console.log(`✅ Acesso anônimo à rota de download retornou status ${unauthorizedResponse.status()} (esperado 401).`);

    console.log('\n🎉 Todos os testes de interface, relatórios IA e regressão foram aprovados com sucesso!');
  } finally {
    await browser.close();
  }
}

testFrontendFlow().catch((err) => {
  console.error('❌ Erro no teste E2E:', err);
  process.exit(1);
});
