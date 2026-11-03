import "dotenv/config";
import { uploadBuffer, getFileStream, deleteFile, R2_BUCKET_NAME } from "../src/server/services/r2Storage";

async function testR2() {
  console.log(`📡 Testando conexão com Cloudflare R2 (Bucket: ${R2_BUCKET_NAME})...`);
  const testKey = `test-ping-${Date.now()}.txt`;
  const content = Buffer.from("Conexão com Cloudflare R2 funcionando perfeitamente! - HubSupport");

  console.log(`1. Enviando arquivo de teste: ${testKey}`);
  await uploadBuffer(content, testKey, "text/plain");
  console.log("   ✅ Upload bem-sucedido!");

  console.log(`2. Baixando arquivo de teste: ${testKey}`);
  const { stream, contentLength } = await getFileStream(testKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const downloaded = Buffer.concat(chunks).toString("utf-8");
  console.log(`   ✅ Download bem-sucedido! (${contentLength} bytes)`);
  console.log(`   Conteúdo recebido: "${downloaded}"`);

  console.log(`3. Deletando arquivo de teste: ${testKey}`);
  await deleteFile(testKey);
  console.log("   ✅ Exclusão bem-sucedida!");

  console.log("\n🎉 Cloudflare R2 validado e operando 100%!");
}

testR2().catch((err) => {
  console.error("❌ Erro no teste do R2:", err);
  process.exit(1);
});
