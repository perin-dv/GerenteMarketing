import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Response } from "express";

@Injectable()
export class MediaStorageService {
  private storageDir() {
    return process.env.MEDIA_STORAGE_DIR || join(process.cwd(), ".data", "uploads");
  }

  async ensureStorageDir() {
    await mkdir(this.storageDir(), { recursive: true });
    return this.storageDir();
  }

  publicBaseUrl() {
    const raw = String(process.env.PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
    if (!raw.startsWith("https://")) {
      throw new ServiceUnavailableException(
        "Configure PUBLIC_API_BASE_URL com a URL HTTPS pública da API para a Meta acessar a mídia.",
      );
    }
    return raw;
  }

  publicUrl(filename: string) {
    return `${this.publicBaseUrl()}/media/${encodeURIComponent(filename)}`;
  }

  validateUploadedFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Selecione uma imagem JPG/JPEG ou vídeo MP4.");
    const allowed = new Set(["image/jpeg", "video/mp4"]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException("Formato não suportado nesta etapa. Use JPG/JPEG para imagem ou MP4 para vídeo.");
    }
    return file;
  }

  async fingerprintFile(filepath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filepath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  async sendPublicFile(filenameInput: string, response: Response) {
    const filename = basename(filenameInput);
    if (!filename || filename !== filenameInput || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new NotFoundException("Mídia não encontrada.");
    }

    const fullPath = join(this.storageDir(), filename);
    try {
      const info = await stat(fullPath);
      if (!info.isFile()) throw new Error("not-file");
    } catch {
      throw new NotFoundException("Mídia não encontrada.");
    }

    const extension = extname(filename).toLowerCase();
    const contentType = extension === ".mp4" ? "video/mp4" : "image/jpeg";
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("X-Content-Type-Options", "nosniff");
    return createReadStream(fullPath).pipe(response);
  }
}
