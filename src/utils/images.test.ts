import { describe, expect, it } from 'vitest';
import {
  hasHeicExtension,
  isExplicitlySupportedImage,
  isHeicFileByMetadata
} from './images';

function fileMetadata(name: string, type = ''): Pick<File, 'name' | 'type'> {
  return { name, type };
}

describe('image format handling', () => {
  it('accepts .jpg files', () => {
    expect(isExplicitlySupportedImage(fileMetadata('contestant.jpg'))).toBe(true);
  });

  it('accepts .jpeg files', () => {
    expect(isExplicitlySupportedImage(fileMetadata('contestant.jpeg'))).toBe(true);
  });

  it('accepts .png files', () => {
    expect(isExplicitlySupportedImage(fileMetadata('contestant.png'))).toBe(true);
  });

  it('accepts .webp files', () => {
    expect(isExplicitlySupportedImage(fileMetadata('contestant.webp'))).toBe(true);
  });

  it('identifies .heic files', () => {
    expect(hasHeicExtension('contestant.heic')).toBe(true);
  });

  it('identifies uppercase .HEIC files', () => {
    expect(hasHeicExtension('contestant.HEIC')).toBe(true);
  });

  it('identifies .heif files', () => {
    expect(hasHeicExtension('contestant.heif')).toBe(true);
  });

  it('identifies uppercase .HEIF files', () => {
    expect(hasHeicExtension('contestant.HEIF')).toBe(true);
  });

  it('identifies HEIC when MIME type is missing but extension exists', () => {
    expect(isHeicFileByMetadata(fileMetadata('contestant.heic'))).toBe(true);
  });

  it('rejects unsupported non-image extensions', () => {
    expect(isExplicitlySupportedImage(fileMetadata('contestant.pdf', 'application/pdf'))).toBe(false);
  });
});
