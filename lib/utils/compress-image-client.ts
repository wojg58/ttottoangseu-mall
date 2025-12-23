// lib/imageCompression.ts
// 브라우저에서 이미지 자동 압축

import imageCompression from 'browser-image-compression';

/**
 * 이미지 압축 옵션 타입
 */
export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
}

/**
 * 기본 이미지 압축 옵션
 */
const defaultCompressionOptions: CompressionOptions = {
  maxSizeMB: 0.15,              // 최대 150KB
  maxWidthOrHeight: 1200,       // 최대 1200px
  useWebWorker: true,           // 멀티스레드 사용
  fileType: 'image/webp',       // WebP로 변환
  initialQuality: 0.85,         // 초기 품질 85%
};

/**
 * 단일 이미지 압축
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  try {
    console.log(`압축 시작: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const compressionOptions = { ...defaultCompressionOptions, ...options };
    const compressedFile = await imageCompression(file, compressionOptions);

    console.log(`압축 완료: ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(1)} KB)`);
    console.log(`절감률: ${Math.round((1 - compressedFile.size / file.size) * 100)}%`);

    // 파일명을 .webp로 변경
    const newFileName = file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    const renamedFile = new File([compressedFile], newFileName, {
      type: 'image/webp',
    });

    return renamedFile;
  } catch (error) {
    console.error('이미지 압축 실패:', error);
    return file; // 실패 시 원본 반환
  }
}

/**
 * 여러 이미지 일괄 압축
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  const compressedFiles: File[] = [];

  for (const file of files) {
    const compressed = await compressImage(file, options);
    compressedFiles.push(compressed);
  }

  return compressedFiles;
}

/**
 * 압축 전후 용량 통계
 */
export function getCompressionStats(original: File[], compressed: File[]) {
  const originalSize = original.reduce((sum, file) => sum + file.size, 0);
  const compressedSize = compressed.reduce((sum, file) => sum + file.size, 0);

  return {
    originalSize,
    compressedSize,
    reduction: Math.round((1 - compressedSize / originalSize) * 100),
    originalMB: (originalSize / 1024 / 1024).toFixed(2),
    compressedMB: (compressedSize / 1024 / 1024).toFixed(2),
  };
}

