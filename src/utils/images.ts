export const MAX_LONG_EDGE = 3000;
export const JPEG_QUALITY = 0.94;
export const STORED_IMAGE_TYPE = 'image/jpeg';

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const EXPLICIT_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

export type ImageProcessingErrorCode = 'unsupported-format' | 'heic-conversion-failed' | 'processing-failed';

export class ImageProcessingError extends Error {
  constructor(
    public readonly code: ImageProcessingErrorCode,
    message: string
  ) {
    super(message);
  }
}

export function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  return extension && extension !== fileName ? extension.toLowerCase() : '';
}

export function hasHeicExtension(fileName: string) {
  const extension = getFileExtension(fileName);
  return extension === 'heic' || extension === 'heif';
}

export function hasHeicMimeType(mimeType: string) {
  return HEIC_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isHeicFileByMetadata(file: Pick<File, 'name' | 'type'>) {
  return hasHeicMimeType(file.type || '') || hasHeicExtension(file.name);
}

export function isExplicitlySupportedImage(file: Pick<File, 'name' | 'type'>) {
  const extension = getFileExtension(file.name);
  return file.type.startsWith('image/') || EXPLICIT_IMAGE_EXTENSIONS.has(extension);
}

export async function isHeicFile(file: File) {
  if (isHeicFileByMetadata(file)) {
    return true;
  }

  try {
    const { isHeic: detectHeicSignature } = await import('heic-to');
    return await detectHeicSignature(file);
  } catch {
    return false;
  }
}

async function decodeInputImage(file: File): Promise<Blob> {
  if (!isExplicitlySupportedImage(file)) {
    throw new ImageProcessingError('unsupported-format', 'Unsupported image format.');
  }

  if (await isHeicFile(file)) {
    try {
      const { heicTo } = await import('heic-to');
      return await heicTo({
        blob: file,
        type: STORED_IMAGE_TYPE,
        quality: JPEG_QUALITY
      });
    } catch (error) {
      throw new ImageProcessingError(
        'heic-conversion-failed',
        error instanceof Error ? error.message : 'Cannot convert HEIC/HEIF image.'
      );
    }
  }

  return file;
}

export async function processContestantPhoto(file: File): Promise<Blob> {
  const browserReadyImage = await decodeInputImage(file);

  try {
    return await resizeImageForStorage(browserReadyImage);
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error;
    }

    throw new ImageProcessingError(
      'processing-failed',
      error instanceof Error ? error.message : 'Cannot process selected image.'
    );
  }
}

export async function resizeImageForStorage(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_LONG_EDGE / longestEdge);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Cannot prepare image canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Cannot resize selected image.'));
        }
      },
      STORED_IMAGE_TYPE,
      JPEG_QUALITY
    );
  });
}

export function blobToObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}
