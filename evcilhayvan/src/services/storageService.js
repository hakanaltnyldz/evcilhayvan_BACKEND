import fs from "fs";
import path from "path";
import { config } from "../config/config.js";

export class StorageService {
  // file: req.file from multer
  async save(file) {
    if (!file?.filename) throw new Error("File missing");
    return this.getPublicUrl(file.filename);
  }

  getPublicUrl(filename) {
    return `/uploads/${filename}`;
  }
}

export class LocalStorageService extends StorageService {
  constructor(uploadDir = config.uploadDir) {
    super();
    this.uploadDir = uploadDir || path.join(process.cwd(), "uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}

export const storageService = new LocalStorageService();
