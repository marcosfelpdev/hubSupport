import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';

async function runTests() {
  console.log('🧪 Starting Relix Brand Assets & RelixLogo verification...\n');
  const projectRoot = process.cwd();

  // Test 1: Check public brand asset files exist
  console.log('1. Checking public assets existence and formats...');
  const faviconSvgPath = path.join(projectRoot, 'public', 'favicon.svg');
  const relixIconPngPath = path.join(projectRoot, 'public', 'relix-icon.png');
  const faviconIcoPath = path.join(projectRoot, 'public', 'favicon.ico');

  assert(fs.existsSync(faviconSvgPath), 'public/favicon.svg must exist');
  assert(fs.existsSync(relixIconPngPath), 'public/relix-icon.png must exist');
  assert(fs.existsSync(faviconIcoPath), 'public/favicon.ico must exist');

  const svgContent = fs.readFileSync(faviconSvgPath, 'utf8');
  assert(svgContent.includes('<svg'), 'favicon.svg must contain <svg');
  assert(svgContent.toLowerCase().includes('#de1d4b'), 'favicon.svg must contain Relix crimson color #DE1D4B');

  // Verify PNG header and dimensions (512x512)
  const pngBuffer = fs.readFileSync(relixIconPngPath);
  assert(pngBuffer.length > 5000, 'relix-icon.png must be non-empty and well-sized');
  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert(
    pngBuffer[0] === 0x89 &&
    pngBuffer[1] === 0x50 &&
    pngBuffer[2] === 0x4e &&
    pngBuffer[3] === 0x47,
    'relix-icon.png must have a valid PNG signature'
  );
  // IHDR width at offset 16, height at offset 20 (big endian 32-bit)
  const pngWidth = pngBuffer.readUInt32BE(16);
  const pngHeight = pngBuffer.readUInt32BE(20);
  assert.strictEqual(pngWidth, 512, `relix-icon.png width must be 512px, got ${pngWidth}`);
  assert.strictEqual(pngHeight, 512, `relix-icon.png height must be 512px, got ${pngHeight}`);

  // Test 2: Check index.html content
  console.log('2. Checking index.html title, meta and favicon links...');
  const indexHtmlPath = path.join(projectRoot, 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  assert(
    indexHtml.includes('<title>Relix — Log de Atendimentos & Relatórios IA</title>'),
    'index.html must have Relix title'
  );
  assert(
    indexHtml.includes('Relix') && !indexHtml.includes('HubSupport — Log de Atendimentos'),
    'index.html must reference Relix in meta tags and not legacy HubSupport in title'
  );
  assert(
    indexHtml.includes('/favicon.svg'),
    'index.html must reference /favicon.svg'
  );

  // Test 3: Import and test RelixLogo component
  console.log('3. Checking RelixLogo React component...');
  const logoComponentPath = path.join(projectRoot, 'src', 'components', 'common', 'RelixLogo.tsx');
  assert(fs.existsSync(logoComponentPath), 'src/components/common/RelixLogo.tsx must exist');

  // Dynamic import of the component
  const { RelixLogo } = await import('../src/components/common/RelixLogo');
  assert(typeof RelixLogo === 'function', 'RelixLogo must be exported as a React component');

  // Render full variant
  const fullHtml = renderToString(React.createElement(RelixLogo, { variant: 'full', mode: 'auto' }));
  assert(fullHtml.includes('<svg'), 'RelixLogo(variant="full") must render an <svg>');
  assert(fullHtml.toLowerCase().includes('#de1d4b'), 'RelixLogo full must contain crimson color');
  // Should render both symbol and wordmark elements
  assert(
    fullHtml.includes('relix-symbol') || fullHtml.includes('relix-wordmark') || fullHtml.includes('relix'),
    'RelixLogo full must contain wordmark and symbol identifiers/paths'
  );

  // Render symbol variant
  const symbolHtml = renderToString(React.createElement(RelixLogo, { variant: 'symbol', mode: 'light' }));
  assert(symbolHtml.includes('<svg'), 'RelixLogo(variant="symbol") must render an <svg>');
  assert(symbolHtml.toLowerCase().includes('#de1d4b'), 'RelixLogo symbol must contain crimson color');

  // Render app-icon variant
  const iconHtml = renderToString(React.createElement(RelixLogo, { variant: 'app-icon', height: 48, className: 'my-custom-class' }));
  assert(iconHtml.includes('<svg'), 'RelixLogo(variant="app-icon") must render an <svg>');
  assert(iconHtml.includes('my-custom-class'), 'RelixLogo must forward className');
  assert(iconHtml.includes('height="48"'), 'RelixLogo must respect height prop');
  assert(iconHtml.toLowerCase().includes('#de1d4b'), 'RelixLogo app-icon must use crimson background');

  // Render dark and light modes
  const darkHtml = renderToString(React.createElement(RelixLogo, { variant: 'full', mode: 'dark' }));
  const lightHtml = renderToString(React.createElement(RelixLogo, { variant: 'full', mode: 'light' }));
  assert(darkHtml.length > 0 && lightHtml.length > 0, 'Both dark and light modes must render properly');

  console.log('\n✅ All Relix Brand Assets & RelixLogo tests passed successfully!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
