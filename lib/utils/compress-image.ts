/**
 * @file lib/utils/compress-image.ts
 * @description 이미지 압축 유틸리티 함수
 *
 * 주요 기능:
 * 1. Sharp를 사용한 이미지 압축 (품질 90% 이상)
 * 2. WebP 포맷 변환 (용량 최적화)
 * 3. 이미지 리사이즈 (최대 너비 2000px)
 * 4. 압축 전후 용량 비교
 *
 * @dependencies
 * - sharp: Node.js 이미지 처리 라이브러리
 */

import sharp from "sharp";

export interface CompressImageOptions {
  /** 압축 품질 (0-100, 기본값: 90) */
  quality?: number;
  /** 최대 너비 (px, 기본값: 2000) */
  maxWidth?: number;
  /** WebP로 변환할지 여부 (기본값: true) */
  convertToWebP?: boolean;
  /** 원본 포맷 유지 여부 (기본값: false) */
  keepOriginalFormat?: boolean;
}

export interface CompressImageResult {
  /** 압축된 이미지 버퍼 */
  buffer: Buffer;
  /** 압축 후 파일 크기 (bytes) */
  size: number;
  /** 압축 전 파일 크기 (bytes) */
  originalSize: number;
  /** 압축률 (%) */
  compressionRatio: number;
  /** 최종 포맷 */
  format: string;
  /** 이미지 메타데이터 */
  metadata: sharp.Metadata;
}

/**
 * 이미지 파일을 압축합니다.
 *
 * @param input - 압축할 이미지 (Buffer, ArrayBuffer, 또는 File)
 * @param options - 압축 옵션
 * @returns 압축된 이미지 결과
 */
export async function compressImage(
  input: Buffer | ArrayBuffer | Uint8Array,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  console.group("[compressImage] 이미지 압축 시작");

  const {
    quality = 90,
    maxWidth = 2000,
    convertToWebP = true,
    keepOriginalFormat = false,
  } = options;

  try {
    // 입력 데이터를 Buffer로 변환
    const inputBuffer =
      input instanceof Buffer
        ? input
        : Buffer.from(input instanceof ArrayBuffer ? input : input);

    const originalSize = inputBuffer.length;
    console.log(`원본 크기: ${(originalSize / 1024).toFixed(2)} KB`);

    // Sharp 인스턴스 생성
    let sharpInstance = sharp(inputBuffer);

    // 메타데이터 가져오기
    const metadata = await sharpInstance.metadata();
    console.log(
      `원본 이미지 정보: ${metadata.width}x${metadata.height}, 포맷: ${metadata.format}`,
    );

    // 리사이즈 (너비가 maxWidth보다 크면 리사이즈)
    if (metadata.width && metadata.width > maxWidth) {
      console.log(`이미지 리사이즈: ${metadata.width}px → ${maxWidth}px`);
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    // 포맷 결정
    let outputFormat: "jpeg" | "png" | "webp" = "webp";
    let mimeType = "image/webp";

    if (keepOriginalFormat && metadata.format) {
      if (metadata.format === "jpeg" || metadata.format === "jpg") {
        outputFormat = "jpeg";
        mimeType = "image/jpeg";
      } else if (metadata.format === "png") {
        outputFormat = "png";
        mimeType = "image/png";
      }
    }

    // 압축 옵션 설정
    const compressOptions: sharp.WebpOptions | sharp.JpegOptions | sharp.PngOptions =
      {};

    if (outputFormat === "jpeg") {
      (compressOptions as sharp.JpegOptions).quality = quality;
      (compressOptions as sharp.JpegOptions).mozjpeg = true; // 최적화
    } else if (outputFormat === "png") {
      (compressOptions as sharp.PngOptions).quality = quality;
      (compressOptions as sharp.PngOptions).compressionLevel = 9; // 최대 압축
    } else {
      // WebP
      (compressOptions as sharp.WebpOptions).quality = quality;
      (compressOptions as sharp.WebpOptions).effort = 6; // 압축 품질 (0-6, 높을수록 느리지만 더 압축)
    }

    // 압축 실행
    console.log(`압축 중... (품질: ${quality}%, 포맷: ${outputFormat})`);
    const compressedBuffer = await sharpInstance
      [outputFormat](compressOptions)
      .toBuffer();

    const compressedSize = compressedBuffer.length;
    const compressionRatio =
      ((originalSize - compressedSize) / originalSize) * 100;

    console.log(`압축 완료: ${(compressedSize / 1024).toFixed(2)} KB`);
    console.log(
      `압축률: ${compressionRatio.toFixed(2)}% (${originalSize} → ${compressedSize} bytes)`,
    );
    console.groupEnd();

    // 최종 메타데이터 가져오기
    const finalMetadata = await sharp(compressedBuffer).metadata();

    return {
      buffer: compressedBuffer,
      size: compressedSize,
      originalSize,
      compressionRatio,
      format: outputFormat,
      metadata: finalMetadata,
    };
  } catch (error) {
    console.error("이미지 압축 에러:", error);
    console.groupEnd();
    throw new Error(
      error instanceof Error
        ? `이미지 압축 실패: ${error.message}`
        : "이미지 압축에 실패했습니다.",
    );
  }
}

/**
 * 여러 이미지를 일괄 압축합니다.
 *
 * @param inputs - 압축할 이미지 배열
 * @param options - 압축 옵션
 * @param onProgress - 진행률 콜백 (current, total)
 * @returns 압축된 이미지 결과 배열
 */
export async function compressImages(
  inputs: Array<Buffer | ArrayBuffer | Uint8Array>,
  options: CompressImageOptions = {},
  onProgress?: (current: number, total: number) => void,
): Promise<CompressImageResult[]> {
  console.group("[compressImages] 이미지 일괄 압축 시작");
  console.log(`압축할 이미지 수: ${inputs.length}`);

  const results: CompressImageResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    console.log(`[${i + 1}/${inputs.length}] 압축 중...`);

    try {
      const result = await compressImage(inputs[i], options);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, inputs.length);
      }
    } catch (error) {
      console.error(`[${i + 1}/${inputs.length}] 압축 실패:`, error);
      // 실패한 이미지는 원본 사용 (또는 에러 처리)
      throw error;
    }
  }

  const totalOriginalSize = results.reduce(
    (sum, r) => sum + r.originalSize,
    0,
  );
  const totalCompressedSize = results.reduce((sum, r) => sum + r.size, 0);
  const avgCompressionRatio =
    ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100;

  console.log(
    `일괄 압축 완료: 총 ${results.length}개, 평균 압축률: ${avgCompressionRatio.toFixed(2)}%`,
  );
  console.log(
    `총 용량: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB → ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`,
  );
  console.groupEnd();

  return results;
}

