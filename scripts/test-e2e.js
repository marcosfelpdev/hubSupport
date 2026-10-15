const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/mfana/.gemini/antigravity-ide/brain/a10c8d9a-efaa-4675-a691-098e380235f0';

async function run() {
  console.log('🚀 Iniciando teste dos novos campos com Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // 1. Acessar tela de login
  console.log('1. Navegando para http://localhost:3000...');
  await page.goto('http://localhost:3000');
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });

  // 2. Login
  console.log('2. Efetuando login...');
  await page.fill('#email', 'ana@hubsupport.com');
  await page.fill('#password', 'senha123');
  await page.click('#btn-login');

  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });
  console.log(' Redirecionado para dashboard!');

  // 3. Registrar atendimento #1: Em andamento
  console.log('3. Preenchendo 1º atendimento (Em andamento)...');
  await page.fill('#requester', 'Juliana Andrade');
  await page.fill('#clientOrOffice', 'Matriz SP / Depto Financeiro');
  await page.selectOption('#status', 'Em andamento');
  await page.fill('#reportedProblem', 'Erro ao exportar relatório contábil em PDF no fechamento mensal.');
  await page.fill('#actionTaken', 'Identificado bloqueio de permissão na pasta do servidor. Liberado acesso temporário e alinhado com Infra.');
  await page.click('#btn-submit-log');

  await page.waitForSelector('.alert-success', { timeout: 10000 });
  console.log(' Atendimento #1 salvo com sucesso!');
  await page.waitForTimeout(1500);

  // 4. Registrar atendimento #2: Já realizado
  console.log('4. Preenchendo 2º atendimento (Já realizado)...');
  await page.fill('#requester', 'Roberto Farias');
  await page.fill('#clientOrOffice', 'Filial Curitiba');
  await page.selectOption('#status', 'Realizado');
  await page.fill('#reportedProblem', 'Impressora de etiquetas do balcão offline.');
  await page.fill('#actionTaken', 'Reiniciado spooler de impressão e validado teste de impressão com sucesso.');
  await page.click('#btn-submit-log');

  await page.waitForSelector('.alert-success', { timeout: 10000 });
  console.log(' Atendimento #2 salvo com sucesso!');
  await page.waitForTimeout(1500);

  // 5. Registrar atendimento #3: Aguardando reunião
  console.log('5. Preenchendo 3º atendimento (Aguardando reunião)...');
  await page.fill('#requester', 'Marcos Oliveira');
  await page.fill('#clientOrOffice', 'Cliente Tech Soluções');
  await page.selectOption('#status', 'Aguardando reunião');
  await page.fill('#reportedProblem', 'Solicitação de integração de nova API de pagamentos.');
  await page.fill('#actionTaken', 'Agendada reunião de alinhamento técnico para quinta-feira às 14h com o time de engenharia.');
  await page.click('#btn-submit-log');

  await page.waitForSelector('.alert-success', { timeout: 10000 });
  console.log(' Atendimento #3 salvo com sucesso!');
  await page.waitForTimeout(2000);

  // Screenshot do novo layout do dashboard
  const screenshotPath = path.join(ARTIFACT_DIR, 'screenshot_novos_campos.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(' Screenshot salvo em:', screenshotPath);

  // Validações no texto da página
  const text = await page.innerText('main');
  const hasJuliana = text.includes('Juliana Andrade');
  const hasRoberto = text.includes('Roberto Farias');
  const hasMarcos = text.includes('Marcos Oliveira');
  const hasStatusEmAndamento = text.includes('Em andamento');
  const hasStatusRealizado = text.includes('Já realizado');
  const hasStatusReuniao = text.includes('Aguardando reunião');

  console.log('\n--- VALIDAÇÃO DOS NOVOS CAMPOS ---');
  console.log('Solicitante Juliana Andrade:', hasJuliana ? ' SIM' : ' NÃO');
  console.log('Solicitante Roberto Farias:', hasRoberto ? ' SIM' : ' NÃO');
  console.log('Solicitante Marcos Oliveira:', hasMarcos ? ' SIM' : ' NÃO');
  console.log('Status Em andamento:', hasStatusEmAndamento ? ' SIM' : ' NÃO');
  console.log('Status Já realizado:', hasStatusRealizado ? ' SIM' : ' NÃO');
  console.log('Status Aguardando reunião:', hasStatusReuniao ? ' SIM' : ' NÃO');

  await browser.close();

  if (hasJuliana && hasRoberto && hasMarcos && hasStatusEmAndamento && hasStatusRealizado && hasStatusReuniao) {
    console.log('\n TODOS OS NOVOS CAMPOS E STATUS FUNCIONAM PERFEITAMENTE!');
    process.exit(0);
  } else {
    console.error('\n FALHA NA VALIDAÇÃO');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(' Erro no teste:', err);
  process.exit(1);
});
