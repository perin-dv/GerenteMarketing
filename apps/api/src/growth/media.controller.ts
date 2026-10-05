import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { diskStorage } from "multer";
import { AuthGuard } from "../auth/auth.guard";
import { MediaStorageService } from "./media-storage.service";

function storageDir() {
  const dir = process.env.MEDIA_STORAGE_DIR || join(process.cwd(), ".data", "uploads");
  mkdirSync(dir, { recursive: true });
  return dir;
}

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaStorageService) {}

  @Post("upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (_request, _file, callback) => callback(null, storageDir()),
      filename: (_request, file, callback) => {
        const extension = file.mimetype === "video/mp4" ? ".mp4" : ".jpg";
        callback(null, `${randomUUID()}${extension}`);
      },
    }),
    limits: { fileSize: 250 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowed = new Set(["image/jpeg", "video/mp4"]);
      if (!allowed.has(file.mimetype)) {
        return callback(new BadRequestException("Use JPG/JPEG para imagem ou MP4 para vídeo."), false);
      }
      callback(null, true);
    },
  }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    const valid = this.media.validateUploadedFile(file);
    return {
      ok: true,
      filename: valid.filename,
      originalName: valid.originalname,
      contentType: valid.mimetype,
      bytes: valid.size,
      mediaKind: valid.mimetype === "video/mp4" ? "VIDEO" : "IMAGE",
      publicUrl: this.media.publicUrl(valid.filename),
    };
  }

  @Get(":filename")
  get(@Param("filename") filename: string, @Res() response: Response) {
    return this.media.sendPublicFile(filename, response);
  }
}
