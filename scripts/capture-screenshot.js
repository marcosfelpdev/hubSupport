const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@hubsupport.com';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'HubSupport@2026';

  await page.goto('http://localhost:3000/login');
  await page.fill('#email', adminEmail);
  await page.fill('#password', adminPassword);
  await page.click('#btn-login');
  await page.waitForURL((url) => url.pathname === '/dashboard');
  await page.waitForTimeout(1000);

  // Clica no card da Mariana para exibir o relatório de IA no card expandido
  const card = await page.locator('text="Mariana Teste"').first();
  if (await card.isVisible()) {
    await card.click();
    await page.waitForTimeout(500);
  }

  const screenshotPath = path.join(__dirname, 'dashboard_with_ai_report.png');
  await page.screenshot({ path: screenshotPath });
  console.log('📸 Screenshot salvo em:', screenshotPath);
  await browser.close();
}

capture().catch(console.error);
