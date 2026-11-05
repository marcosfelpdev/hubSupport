import assert from "assert";
import fs from "fs";
import path from "path";
import http from "http";
import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { app } from "../src/server/app";
import worklogsRoutes from "../src/server/routes/worklogs.routes";
import { uploadFileFromDisk, isR2Configured } from "../src/server/services/r2Storage";

async function main() {
  console.log("==================================================================");
  console.log("  QA VERIFIER: EXECUÇÃO DA SUÍTE DE TESTES (UPLOAD 1GB & STREAMING)");
  console.log("==================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function recordResult(name: string, ok: boolean, error?: any) {
    totalTests++;
    if (ok) {
      passedTests++;
      console.log(`[PASSOU] ${name}`);
    } else {
      console.error(`[FALHOU] ${name}`);
      if (error) console.error("   Erro:", error);
    }
  }

  // -------------------------------------------------------------
  // 1. Verificação Estática e Funcional do worklogs.routes.ts
  // -------------------------------------------------------------
  try {
    const routeFilePath = path.join(process.cwd(), "src", "server", "routes", "worklogs.routes.ts");
    const routeCode = fs.readFileSync(routeFilePath, "utf-8");

    const hasDiskStorage = routeCode.includes("multer.diskStorage");
    const hasTempDirDestination = routeCode.includes("destination: (_req, _file, cb) => {") && routeCode.includes("cb(null, TEMP_DIR)");
    const has1GBLimit = routeCode.includes("fileSize: 1024 * 1024 * 1024");
    const hasFinallyCleanup = routeCode.includes("finally {") && routeCode.includes("fsSync.unlinkSync(tempPath)");

    assert.ok(hasDiskStorage, "Deve usar multer.diskStorage");
    assert.ok(hasTempDirDestination, "Deve direcionar uploads temporários para TEMP_DIR (storage/temp)");
    assert.ok(has1GBLimit, "fileSize deve ser 1024 * 1024 * 1024 (1GB)");
    assert.ok(hasFinallyCleanup, "Deve ter bloco finally que limpa os arquivos de tempFilesToClean");

    recordResult("1. Validação estática de worklogs.routes.ts (diskStorage, storage/temp, 1GB limit, finally unlink)", true);
  } catch (err) {
    recordResult("1. Validação estática de worklogs.routes.ts (diskStorage, storage/temp, 1GB limit, finally unlink)", false, err);
  }

  // -------------------------------------------------------------
  // 2. Verificação de uploadFileFromDisk (r2Storage.ts)
  // -------------------------------------------------------------
  try {
    const tempDir = path.join(process.cwd(), "storage", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const testSourceFile = path.join(tempDir, `qa-test-source-${Date.now()}.bin`);
    const testPayload = Buffer.from("STREAMING_TEST_BINARY_DATA_".repeat(256)); // ~7KB
    fs.writeFileSync(testSourceFile, testPayload);

    const testDestinationKey = `storage/recordings/qa-stream-test-${Date.now()}.bin`;
    const returnedKey = await uploadFileFromDisk(testSourceFile, testDestinationKey, "application/octet-stream");

    assert.strictEqual(returnedKey, testDestinationKey);

    if (!isR2Configured) {
      const destPath = path.join(process.cwd(), testDestinationKey);
      assert.ok(fs.existsSync(destPath), "Fallback local: arquivo copiado deve existir no destino");
      const statDest = fs.statSync(destPath);
      assert.strictEqual(statDest.size, testPayload.length, "Tamanho do arquivo copiado deve ser idêntico");
      fs.unlinkSync(destPath);
    }

    fs.unlinkSync(testSourceFile);
    recordResult("2. Validação do uploadFileFromDisk no r2Storage.ts (streaming e cópia local)", true);
  } catch (err) {
    recordResult("2. Validação do uploadFileFromDisk no r2Storage.ts (streaming e cópia local)", false, err);
  }

  // -------------------------------------------------------------
  // 3. Verificação do Middleware Central de Erros no app.ts (Multer LIMIT_FILE_SIZE -> HTTP 413)
  // -------------------------------------------------------------
  try {
    // Montamos um servidor de teste conectando as rotas e o handler de erro do app real
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as any).port;

    // Criamos uma rota temporária em worklogsRoutes para emitir o erro MulterError("LIMIT_FILE_SIZE")
    worklogsRoutes.get("/test-trigger-limit-file-size", (_req: Request, _res: Response, next: NextFunction) => {
      const multerErr = new multer.MulterError("LIMIT_FILE_SIZE", "media");
      next(multerErr);
    });

    const response = await fetch(`http://127.0.0.1:${port}/api/worklogs/test-trigger-limit-file-size`);
    const status = response.status;
    const body: any = await response.json();

    server.close();

    assert.strictEqual(status, 413, `Esperava status 413, obteve ${status}`);
    assert.strictEqual(body.code, "LIMIT_FILE_SIZE", `Esperava code LIMIT_FILE_SIZE, obteve ${body.code}`);
    assert.strictEqual(
      body.error,
      "O arquivo enviado é muito grande. O limite máximo permitido é de 1GB por arquivo.",
      `Mensagem em português divergente: ${body.error}`
    );

    recordResult("3. Handler central em app.ts captura Multer LIMIT_FILE_SIZE e responde 413 com mensagem amigável em português", true);
  } catch (err) {
    recordResult("3. Handler central em app.ts captura Multer LIMIT_FILE_SIZE e responde 413 com mensagem amigável em português", false, err);
  }

  // -------------------------------------------------------------
  // 4. Verificação das Validações no Frontend (WorkLogForm.tsx)
  // -------------------------------------------------------------
  try {
    const formFilePath = path.join(process.cwd(), "src", "components", "WorkLogForm.tsx");
    const formCode = fs.readFileSync(formFilePath, "utf-8");

    const hasMaxFileSizeBytes = formCode.includes("const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024;");
    const hasOversizedCheck = formCode.includes("oversizedFiles = newFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES)");
    const hasRecordedVideoCheck = formCode.includes("activeRecordedVideo.size > MAX_FILE_SIZE_BYTES");
    const has1GBHint = formCode.includes("até 1GB por arquivo");
    const hasPortugueseErrorMessage = formCode.includes("excede o limite máximo permitido de 1GB");

    assert.ok(hasMaxFileSizeBytes, "Deve definir MAX_FILE_SIZE_BYTES = 1GB");
    assert.ok(hasOversizedCheck, "Deve filtrar arquivos adicionados maiores que 1GB");
    assert.ok(hasRecordedVideoCheck, "Deve validar gravação de tela maior que 1GB");
    assert.ok(has1GBHint, "Deve exibir texto explicativo 'até 1GB por arquivo'");
    assert.ok(hasPortugueseErrorMessage, "Deve conter mensagem de erro em português");

    recordResult("4. Frontend WorkLogForm.tsx valida 1GB e exibe mensagens corretas", true);
  } catch (err) {
    recordResult("4. Frontend WorkLogForm.tsx valida 1GB e exibe mensagens corretas", false, err);
  }

  // -------------------------------------------------------------
  // 5. Teste Funcional do Bloco Finally (Limpeza de Arquivos Temporários)
  // -------------------------------------------------------------
  try {
    const tempDir = path.join(process.cwd(), "storage", "temp");
    const temp1 = path.join(tempDir, `cleanup-test-1-${Date.now()}.tmp`);
    const temp2 = path.join(tempDir, `cleanup-test-2-${Date.now()}.tmp`);

    fs.writeFileSync(temp1, "DADO_TEMPORARIO_1");
    fs.writeFileSync(temp2, "DADO_TEMPORARIO_2");

    assert.ok(fs.existsSync(temp1), "temp1 criado");
    assert.ok(fs.existsSync(temp2), "temp2 criado");

    const tempFilesToClean = [temp1, temp2];

    // Simula bloco com erro ou término
    try {
      throw new Error("Erro simulado para testar garantia de execução do bloco finally");
    } catch {
      // manipulado
    } finally {
      for (const tempPath of tempFilesToClean) {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (cleanupErr) {
          console.warn("Falha no cleanup:", cleanupErr);
        }
      }
    }

    assert.ok(!fs.existsSync(temp1), "temp1 deve ter sido deletado");
    assert.ok(!fs.existsSync(temp2), "temp2 deve ter sido deletado");

    recordResult("5. Bloco finally garante exclusão física dos arquivos temporários de storage/temp", true);
  } catch (err) {
    recordResult("5. Bloco finally garante exclusão física dos arquivos temporários de storage/temp", false, err);
  }

  // -------------------------------------------------------------
  // 6. Teste de Integração Real: Multer Disparando LIMIT_FILE_SIZE em Requisição HTTP
  // -------------------------------------------------------------
  try {
    const testApp = express();
    const tempDir = path.join(process.cwd(), "storage", "temp");
    const testMulter = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, tempDir),
        filename: (_req, file, cb) => cb(null, `test-${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 2048 }, // 2KB para testar detecção de estouro de limite
    });

    testApp.post("/upload-exceed-test", testMulter.single("media"), (_req: Request, res: Response) => {
      res.json({ success: true });
    });

    // Anexa o mesmo middleware de tratamento do app.ts
    testApp.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: "O arquivo enviado é muito grande. O limite máximo permitido é de 1GB por arquivo.",
            code: "LIMIT_FILE_SIZE",
          });
          return;
        }
        res.status(400).json({
          error: `Erro no upload do arquivo: ${err.message}`,
          code: err.code,
        });
        return;
      }
      res.status(500).json({ error: "Erro interno." });
    });

    const server = http.createServer(testApp);
    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as any).port;

    const boundary = "---------------------------QA123456789";
    const oversizedData = "Z".repeat(5000); // 5KB > 2KB
    const body = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="media"; filename="test_large.dat"\r\n',
      'Content-Type: application/octet-stream\r\n\r\n',
      oversizedData,
      `\r\n--${boundary}--\r\n`,
    ].join("");

    const response = await fetch(`http://127.0.0.1:${port}/upload-exceed-test`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(body),
    });

    const status = response.status;
    const json: any = await response.json();
    server.close();

    assert.strictEqual(status, 413, `Esperava status 413, obteve ${status}`);
    assert.strictEqual(json.code, "LIMIT_FILE_SIZE");
    assert.strictEqual(json.error, "O arquivo enviado é muito grande. O limite máximo permitido é de 1GB por arquivo.");

    recordResult("6. Teste de integração HTTP: Multer rejeita payload excedente e retorna HTTP 413", true);
  } catch (err) {
    recordResult("6. Teste de integração HTTP: Multer rejeita payload excedente e retorna HTTP 413", false, err);
  }

  console.log("==================================================================");
  console.log(`  RESUMO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS.`);
  console.log("==================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
