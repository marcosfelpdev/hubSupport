const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const faviconSvgPath = path.join(projectRoot, 'public', 'favicon.svg');
  const relixIconPngPath = path.join(projectRoot, 'public', 'relix-icon.png');
  const faviconIcoPath = path.join(projectRoot, 'public', 'favicon.ico');

  console.log('Rendering 512x512 PNG with Playwright...');
  const svg = fs.readFileSync(faviconSvgPath, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:transparent;">${svg}</body></html>`);
  await page.screenshot({ path: relixIconPngPath, omitBackground: true });
  await browser.close();

  console.log('Generating favicon.ico with Python Pillow...');
  execSync(`python -c "from PIL import Image; im = Image.open(r'${relixIconPngPath}'); im.save(r'${faviconIcoPath}', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])"`);

  console.log('Public brand assets generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
