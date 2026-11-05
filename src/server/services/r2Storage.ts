import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim();
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim();
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim();
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME?.trim() || "hubsupport-storage";

export const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
);

let s3Client: S3Client | null = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
  console.log(`[Storage] Cloudflare R2 configurado para bucket: ${R2_BUCKET_NAME}`);
} else {
  console.log("[Storage] Cloudflare R2 não configurado. Operando em modo de armazenamento local.");
}

/**
 * Faz upload de um buffer de arquivo para o R2 ou disco local.
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (isR2Configured && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return normalizedKey;
  }

  // Fallback local
  const localPath = path.join(process.cwd(), normalizedKey);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(localPath, buffer);
  return normalizedKey;
}

/**
 * Faz upload de um arquivo a partir do disco para o R2 (via stream) ou move/copia no disco local.
 * Mantém o consumo de RAM estritamente constante (~poucos KBs) mesmo para arquivos de 1GB+.
 */
export async function uploadFileFromDisk(
  filePath: string,
  key: string,
  contentType: string
): Promise<string> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const stat = await fs.promises.stat(filePath);

  if (isR2Configured && s3Client) {
    const fileStream = fs.createReadStream(filePath);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: normalizedKey,
        Body: fileStream,
        ContentLength: stat.size,
        ContentType: contentType,
      })
    );
    return normalizedKey;
  }

  // Fallback local: copia o arquivo do temp para a pasta final
  const localPath = path.join(process.cwd(), normalizedKey);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.copyFile(filePath, localPath);
  return normalizedKey;
}


/**
 * Obtém o stream e metadados de um arquivo do R2 ou disco local.
 */
export async function getFileStream(
  key: string,
  range?: string
): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  statusCode?: number;
}> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (isR2Configured && s3Client) {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: normalizedKey,
      Range: range,
    });
    const response = await s3Client.send(command);

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      statusCode: response.$metadata.httpStatusCode,
    };
  }

  // Fallback local
  let localPath = path.join(process.cwd(), normalizedKey);
  if (!fs.existsSync(localPath)) {
    const publicPath = path.join(process.cwd(), "public", normalizedKey);
    if (fs.existsSync(publicPath)) {
      localPath = publicPath;
    } else {
      throw new Error(`Arquivo local não encontrado: ${localPath}`);
    }
  }

  const stat = fs.statSync(localPath);
  let stream: Readable;
  let statusCode = 200;
  let contentRange: string | undefined;
  let contentLength = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    contentLength = end - start + 1;
    contentRange = `bytes ${start}-${end}/${stat.size}`;
    statusCode = 206;
    stream = fs.createReadStream(localPath, { start, end });
  } else {
    stream = fs.createReadStream(localPath);
  }

  return {
    stream,
    contentLength,
    contentRange,
    statusCode,
  };
}

/**
 * Obtém o conteúdo completo de um arquivo como Buffer (do R2 ou disco local).
 */
export async function getFileBuffer(key: string): Promise<Buffer> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const { stream } = await getFileStream(normalizedKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Verifica se um arquivo existe no R2 ou disco local.
 */
export async function fileExists(key: string): Promise<boolean> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (isR2Configured && s3Client) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: normalizedKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  const localPath = path.join(process.cwd(), normalizedKey);
  if (fs.existsSync(localPath)) return true;
  const publicPath = path.join(process.cwd(), "public", normalizedKey);
  return fs.existsSync(publicPath);
}

/**
 * Deleta um arquivo do R2 ou disco local.
 */
export async function deleteFile(key: string): Promise<void> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (isR2Configured && s3Client) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: normalizedKey,
        })
      );
    } catch (err) {
      console.warn(`[Storage] Falha ao deletar objeto no R2: ${normalizedKey}`, err);
    }
    return;
  }

  const localPath = path.join(process.cwd(), normalizedKey);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch (err) {
      console.warn(`[Storage] Falha ao deletar arquivo local: ${localPath}`, err);
    }
  }
}

/**
 * Baixa um arquivo do R2 ou disco local para um arquivo temporário em disco (ex: para o Gemini).
 */
export async function downloadToTempFile(key: string, tempFilePath: string): Promise<string> {
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");

  const tempDir = path.dirname(tempFilePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  if (isR2Configured && s3Client) {
    const { stream } = await getFileStream(normalizedKey);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("error", reject);
      writeStream.on("finish", () => resolve());
      writeStream.on("error", reject);
    });

    return tempFilePath;
  }

  // Fallback local: se já estiver em disco, copia ou retorna caminho
  const localPath = path.join(process.cwd(), normalizedKey);
  if (fs.existsSync(localPath)) {
    fs.copyFileSync(localPath, tempFilePath);
    return tempFilePath;
  }
  const publicPath = path.join(process.cwd(), "public", normalizedKey);
  if (fs.existsSync(publicPath)) {
    fs.copyFileSync(publicPath, tempFilePath);
    return tempFilePath;
  }

  throw new Error(`Arquivo não encontrado para download temporário: ${key}`);
}
