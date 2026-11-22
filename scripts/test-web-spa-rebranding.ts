import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { formatReportAsText } from '../src/lib/report-formatter';

async function runTests() {
  console.log('🧪 Starting Web SPA Visual Rebranding verification...\n');
  const projectRoot = process.cwd();

  // Test 1: Verify Sidebar.tsx
  console.log('1. Checking Sidebar.tsx...');
  const sidebarPath = path.join(projectRoot, 'src', 'components', 'Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  assert(sidebarContent.includes('BrandLogo'), 'Sidebar.tsx must import BrandLogo');
  assert(sidebarContent.includes('<BrandLogo'), 'Sidebar.tsx must render <BrandLogo');
  assert(sidebarContent.includes('Relix - Portal da Equipe'), 'Sidebar.tsx must have Relix tooltip');
  assert(!sidebarContent.includes('HubSupport'), 'Sidebar.tsx must not contain legacy HubSupport text');

  // Test 2: Verify DashboardHeader.tsx
  console.log('2. Checking DashboardHeader.tsx...');
  const headerPath = path.join(projectRoot, 'src', 'components', 'DashboardHeader.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');
  assert(headerContent.includes('BrandLogo'), 'DashboardHeader.tsx must import BrandLogo');
  assert(headerContent.includes('<BrandLogo'), 'DashboardHeader.tsx must render <BrandLogo');
  assert(headerContent.includes('Relix'), 'DashboardHeader.tsx must contain Relix');
  assert(!headerContent.includes('HubSupport'), 'DashboardHeader.tsx must not contain legacy HubSupport text');

  // Test 3: Verify LoginPage.tsx
  console.log('3. Checking LoginPage.tsx...');
  const loginPath = path.join(projectRoot, 'src', 'pages', 'LoginPage.tsx');
  const loginContent = fs.readFileSync(loginPath, 'utf8');
  assert(loginContent.includes('BrandLogo'), 'LoginPage.tsx must import BrandLogo');
  assert(loginContent.includes('<BrandLogo variant="full" height={48}'), 'LoginPage.tsx must render full BrandLogo');
  assert(loginContent.includes('Acesse sua conta no Relix'), 'LoginPage.tsx must contain "Acesse sua conta no Relix"');
  assert(!loginContent.includes('HubSupport'), 'LoginPage.tsx must not contain legacy HubSupport text');

  // Verify BrandLogo.tsx preserves RelixLogo delegation
  const brandLogoPath = path.join(projectRoot, 'src', 'components', 'common', 'BrandLogo.tsx');
  const brandLogoContent = fs.readFileSync(brandLogoPath, 'utf8');
  assert(brandLogoContent.includes('RelixLogo'), 'BrandLogo.tsx must import and render RelixLogo');
  assert(brandLogoContent.includes('<RelixLogo'), 'BrandLogo.tsx must render <RelixLogo');

  // Test 4: Verify AppDownloadModal.tsx
  console.log('4. Checking AppDownloadModal.tsx...');
  const modalPath = path.join(projectRoot, 'src', 'components', 'phoneFinder', 'AppDownloadModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert(modalContent.includes('Instalar Relix Mobile'), 'AppDownloadModal.tsx must have "Instalar Relix Mobile" title');
  assert(modalContent.includes('Relix Mobile • Android 8.0+'), 'AppDownloadModal.tsx must reference Relix Mobile subtitle');
  assert(modalContent.includes('Instale o aplicativo Relix Mobile no celular'), 'AppDownloadModal.tsx must have updated instruction copy');
  assert(!modalContent.includes('HubSupport Phone Finder'), 'AppDownloadModal.tsx must not contain legacy HubSupport Phone Finder');

  // Test 5: Verify pdf-generator.ts
  console.log('5. Checking pdf-generator.ts...');
  const pdfGenPath = path.join(projectRoot, 'src', 'lib', 'pdf-generator.ts');
  const pdfGenContent = fs.readFileSync(pdfGenPath, 'utf8');
  assert(pdfGenContent.includes('Author: "Relix AI"'), 'pdf-generator.ts must have Author: "Relix AI"');
  assert(pdfGenContent.includes('|| "Relix"'), 'pdf-generator.ts must have fallback platform footer "Relix"');
  assert(!pdfGenContent.includes('Author: "HubSupport AI"'), 'pdf-generator.ts must not have legacy HubSupport Author');

  // Test 6: Verify report-formatter.ts
  console.log('6. Checking report-formatter.ts output...');
  const formatted = formatReportAsText({ title: 'Teste' });
  assert(formatted.includes('Gerado via Relix'), 'formatReportAsText must end with "Gerado via Relix"');
  assert(!formatted.includes('HubSupport'), 'formatReportAsText must not contain HubSupport');

  console.log('\n✅ All Web SPA Rebranding tests passed successfully!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
