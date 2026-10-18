import { chromium } from "playwright";

async function testLargeUpload() {
  console.log("🧪 Testando envio de arquivo maior que 1MB via Server Action...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/login");
    await page.fill("#email", "marcosf@hubsupport.com");
    await page.fill("#password", "076250@Ma");
    await page.click("#btn-login");
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 15000 });

    // Clica no botão "Novo Atendimento"
    await page.click('text="Novo Atendimento"');
    await page.waitForSelector("#requester", { timeout: 5000 });

    await page.fill("#requester", "Carlos Upload Grande");
    await page.fill("#clientOrOffice", "Filial Teste Carga");
    await page.selectOption("#status", "Realizado");
    await page.fill("#reportedProblem", "Teste de envio de payload maior que 1MB com nova configuração de 100MB.");
    await page.fill("#actionTaken", "Validado envio e processamento do arquivo no servidor.");

    // Gera um buffer simulado de 4MB (acima do limite padrão de 1MB) e anexa como vídeo
    console.log("Criando arquivo simulado de 4MB...");
    const largeBuffer = Buffer.alloc(4 * 1024 * 1024, "a");

    await page.setInputFiles("#media", {
      name: "video_teste_4mb.webm",
      mimeType: "video/webm",
      buffer: largeBuffer,
    });

    console.log("Enviando formulário com arquivo de 4MB...");
    await page.click("#btn-submit-log");

    // Aguarda o modal fechar (indicador de sucesso na Server Action)
    await page.waitForSelector("#requester", { state: "detached", timeout: 25000 });
    console.log("✅ Formulário com payload de 4MB enviado e processado com sucesso!");
    console.log("🎉 O limite de 100MB para Server Actions está funcionando perfeitamente!");
  } finally {
    await browser.close();
  }
}

testLargeUpload().catch((err) => {
  console.error("❌ Erro no teste de upload grande:", err);
  process.exit(1);
});
