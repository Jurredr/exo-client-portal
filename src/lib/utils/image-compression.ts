/**
 * Image compression utility for user and organization profile images
 * Uses sharp for server-side compression to reduce file sizes
 */

import sharp from "sharp";

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 1-100, default 85
  format?: "jpeg" | "webp" | "png";
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 85,
  format: "jpeg",
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed image as Buffer and metadata
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number } | null> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Use sharp to compress the image
    const sharpInstance = sharp(inputBuffer).resize(
      opts.maxWidth,
      opts.maxHeight,
      {
        fit: "inside",
        withoutEnlargement: true,
      }
    );

    // Apply format-specific compression
    let outputBuffer: Buffer;
    let mimeType: string;

    switch (opts.format) {
      case "webp":
        outputBuffer = await sharpInstance
          .webp({ quality: opts.quality })
          .toBuffer();
        mimeType = "image/webp";
        break;
      case "png":
        outputBuffer = await sharpInstance
          .png({ quality: opts.quality, compressionLevel: 9 })
          .toBuffer();
        mimeType = "image/png";
        break;
      case "jpeg":
      default:
        outputBuffer = await sharpInstance
          .jpeg({ quality: opts.quality, mozjpeg: true })
          .toBuffer();
        mimeType = "image/jpeg";
        break;
    }

    return {
      buffer: outputBuffer,
      mimeType,
      sizeBytes: outputBuffer.length,
    };
  } catch (error) {
    console.error("Error compressing image:", error);
    return null;
  }
}

/**
 * Compress image for user profile (smaller, square format)
 */
export async function compressUserImage(
  file: File
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number } | null> {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 80,
    format: "jpeg",
  });
}

/**
 * Compress image for organization logo (slightly larger, maintains aspect ratio)
 */
export async function compressOrganizationImage(
  file: File
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number } | null> {
  return compressImage(file, {
    maxWidth: 600,
    maxHeight: 600,
    quality: 85,
    format: "jpeg",
  });
}
