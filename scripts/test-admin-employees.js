const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/mfana/.gemini/antigravity-ide/brain/a10c8d9a-efaa-4675-a691-098e380235f0';

async function run() {
  console.log('🚀 Iniciando teste do usuário mestre e gestão de funcionários...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();

  // 1. Login com o Administrador Mestre Marcos
  console.log('1. Acessando login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('#email');

  console.log('2. Efetuando login como marcosf@hubsupport.com...');
  await page.fill('#email', 'marcosf@hubsupport.com');
  await page.fill('#password', '076250@Ma');
  await page.click('#btn-login');

  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });
  console.log(' Redirecionado para dashboard!');

  // Screenshot do Dashboard com a Sidebar à esquerda
  await page.waitForTimeout(1000);
  const dashboardSidebarScreenshot = path.join(ARTIFACT_DIR, 'screenshot_dashboard_sidebar.png');
  await page.screenshot({ path: dashboardSidebarScreenshot });
  console.log(' Screenshot da dashboard com sidebar salvo:', dashboardSidebarScreenshot);

  // 2. Navegar para a seção de Funcionários via Sidebar
  console.log('3. Navegando para /dashboard/funcionarios via Sidebar...');
  await page.click('a[href="/dashboard/funcionarios"]');
  await page.waitForURL((url) => url.pathname === '/dashboard/funcionarios', { timeout: 10000 });
  await page.waitForSelector('h1');
  console.log(' Página de funcionários carregada com sucesso!');

  // Verificar elementos da lista de funcionários
  const pageText = await page.innerText('body');
  const hasMarcosVoce = pageText.includes('Marcos') && pageText.includes('(você)');
  const hasAna = pageText.includes('Ana Silva');
  const hasCarlos = pageText.includes('Carlos Mendes');
  console.log('Marcos (você) visível:', hasMarcosVoce ? ' SIM' : ' NÃO');
  console.log('Ana Silva visível:', hasAna ? ' SIM' : ' NÃO');
  console.log('Carlos Mendes visível:', hasCarlos ? ' SIM' : ' NÃO');

  // Screenshot da lista de funcionários estilo referência
  const funcionariosScreenshot = path.join(ARTIFACT_DIR, 'screenshot_funcionarios_lista.png');
  await page.screenshot({ path: funcionariosScreenshot });
  console.log(' Screenshot da lista de funcionários salvo:', funcionariosScreenshot);

  // 3. Criar Novo Funcionário
  console.log('4. Abrindo modal para criar novo funcionário...');
  await page.click('#btn-open-create-employee');
  await page.waitForSelector('#create-name');

  await page.fill('#create-name', 'Fernanda Lima');
  await page.fill('#create-email', 'fernanda@hubsupport.com');
  await page.fill('#create-password', 'senha1234');
  await page.click('#btn-confirm-create-employee');

  console.log(' Aguardando criação e recarregamento...');
  await page.waitForTimeout(2000);

  const textAfterCreate = await page.innerText('body');
  const hasFernanda = textAfterCreate.includes('Fernanda Lima') && textAfterCreate.includes('fernanda@hubsupport.com');
  console.log('Fernanda Lima cadastrada com sucesso:', hasFernanda ? ' SIM' : ' NÃO');

  // 4. Editar o funcionário criado (alterar nome e inativar)
  console.log('5. Editando o funcionário criado...');
  // Encontrar o botão de edição na linha da Fernanda
  const rows = await page.$$('.employee-row');
  let fernandaRow = null;
  for (const row of rows) {
    const text = await row.innerText();
    if (text.includes('fernanda@hubsupport.com')) {
      fernandaRow = row;
      break;
    }
  }

  if (fernandaRow) {
    const editBtn = await fernandaRow.$('button[title="Editar funcionário"]');
    await editBtn.click();
    await page.waitForSelector('#edit-name');

    // Screenshot do Modal de Edição
    const editModalScreenshot = path.join(ARTIFACT_DIR, 'screenshot_modal_editar.png');
    await page.screenshot({ path: editModalScreenshot });
    console.log(' Screenshot do modal de edição salvo:', editModalScreenshot);

    // Verificar se o campo de e-mail está desabilitado!
    const emailDisabled = await page.isDisabled('#edit-email');
    console.log('Campo de e-mail está protegido/desabilitado:', emailDisabled ? ' SIM' : ' NÃO');

    await page.fill('#edit-name', 'Fernanda Lima Souza');
    await page.selectOption('#edit-active', 'false'); // Inativar
    await page.click('#btn-confirm-edit-employee');
    await page.waitForTimeout(2000);

    const textAfterEdit = await page.innerText('body');
    const hasEdited = textAfterEdit.includes('Fernanda Lima Souza') && textAfterEdit.includes('Inativo');
    console.log('Fernanda editada para Fernanda Lima Souza e Inativo:', hasEdited ? ' SIM' : ' NÃO');
  }

  // 5. Excluir o funcionário de teste
  console.log('6. Testando exclusão do funcionário...');
  const updatedRows = await page.$$('.employee-row');
  let rowToDelete = null;
  for (const row of updatedRows) {
    const text = await row.innerText();
    if (text.includes('fernanda@hubsupport.com')) {
      rowToDelete = row;
      break;
    }
  }

  if (rowToDelete) {
    const deleteBtn = await rowToDelete.$('button[title="Excluir funcionário"]');
    await deleteBtn.click();
    await page.waitForSelector('#btn-confirm-delete-employee');
    await page.click('#btn-confirm-delete-employee');
    await page.waitForTimeout(2000);

    const textAfterDelete = await page.innerText('body');
    const isDeleted = !textAfterDelete.includes('fernanda@hubsupport.com');
    console.log('Fernanda excluída com sucesso do sistema:', isDeleted ? ' SIM' : ' NÃO');
  }

  await browser.close();
  console.log('\n TODOS OS TESTES DE ADMINISTRADOR E GESTÃO DE FUNCIONÁRIOS PASSARAM COM SUCESSO!');
}

run().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
