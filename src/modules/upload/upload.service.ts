import { Injectable, BadRequestException } from '@nestjs/common';
import type { Express } from 'express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UploadService {
  constructor(private cloudinary: CloudinaryService) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    
    // Check file type if necessary
    if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Uploaded file is not an image');
    }

    const result = await this.cloudinary.uploadFile(file).catch(() => {
      throw new BadRequestException('Invalid file type.');
    });
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  async uploadDocument(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.cloudinary.uploadFile(file).catch(() => {
      throw new BadRequestException('Failed to upload document.');
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}
