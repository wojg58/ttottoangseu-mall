"use server";

/**
 * @file actions/batch-upload-images.ts
 * @description 이미지 일괄 압축 및 업로드 Server Action
 *
 * 주요 기능:
 * 1. 여러 이미지 파일을 받아서 Sharp로 압축
 * 2. 압축된 이미지를 Supabase Storage에 업로드
 * 3. 진행률 추적 및 결과 반환
 *
 * @dependencies
 * - sharp: 이미지 압축
 * - @/lib/utils/compress-image: 압축 유틸리티
 * - @/lib/supabase/service-role: Supabase 클라이언트
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { compressImage } from "@/lib/utils/compress-image";

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (압축 전)

export interface BatchUploadResult {
  success: boolean;
  uploaded: Array<{
    fileName: string;
    url: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }>;
  failed: Array<{
    fileName: string;
    error: string;
  }>;
  totalOriginalSize: number;
  totalCompressedSize: number;
  avgCompressionRatio: number;
}

/**
 * 단일 이미지 파일을 압축하고 업로드합니다.
 *
 * @param file - 업로드할 이미지 파일
 * @returns 업로드 결과
 */
export async function uploadAndCompressImage(
  file: File,
): Promise<{
  success: boolean;
  fileName?: string;
  url?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  error?: string;
}> {
  console.group(`[uploadAndCompressImage] 이미지 처리 시작: ${file.name}`);

  try {
    // 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드 가능합니다.");
    }

    // 파일 크기 검증 (압축 전)
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(
        `이미지 크기가 너무 큽니다. (최대 ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`,
      );
    }

    // 파일명 생성
    const fileExt = file.name.split(".").pop() || "jpg";
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
    const ext = fileExt.toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      throw new Error(`지원하지 않는 이미지 형식입니다: ${ext}`);
    }

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;

    // 이미지 압축 (품질 90%, WebP 변환)
    console.log(`압축 시작: ${file.name} (${(originalSize / 1024).toFixed(2)} KB)`);
    const compressResult = await compressImage(arrayBuffer, {
      quality: 90,
      maxWidth: 2000,
      convertToWebP: true,
    });

    // 파일명 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `product-${timestamp}-${randomStr}.${compressResult.format}`;
    const filePath = `products/${fileName}`;

    // Supabase 클라이언트 생성
    const supabase = getServiceRoleClient();

    // Supabase Storage에 업로드
    console.log(`Supabase Storage에 업로드 중... ${filePath}`);
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filePath, compressResult.buffer, {
        contentType: `image/${compressResult.format}`,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 공개 URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filePath);

    console.log(`업로드 성공: ${publicUrl}`);
    console.log(
      `압축률: ${compressResult.compressionRatio.toFixed(2)}% (${(originalSize / 1024).toFixed(2)} KB → ${(compressResult.size / 1024).toFixed(2)} KB)`,
    );
    console.groupEnd();

    return {
      success: true,
      fileName: file.name,
      url: publicUrl,
      originalSize,
      compressedSize: compressResult.size,
      compressionRatio: compressResult.compressionRatio,
    };
  } catch (error) {
    console.error(`이미지 처리 에러: ${file.name}`, error);
    console.groupEnd();
    return {
      success: false,
      fileName: file.name,
      error:
        error instanceof Error
          ? error.message
          : "이미지 처리에 실패했습니다.",
    };
  }
}

/**
 * 여러 이미지 파일을 일괄 압축하고 업로드합니다.
 *
 * @param files - 업로드할 이미지 파일 배열
 * @returns 일괄 업로드 결과
 */
export async function batchUploadImages(
  files: File[],
): Promise<BatchUploadResult> {
  console.group("[batchUploadImages] 이미지 일괄 업로드 시작");
  console.log(`업로드할 이미지 수: ${files.length}`);

  const uploaded: BatchUploadResult["uploaded"] = [];
  const failed: BatchUploadResult["failed"] = [];

  // 각 이미지를 순차적으로 처리
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] 처리 중: ${file.name}`);

    const result = await uploadAndCompressImage(file);

    if (result.success && result.url) {
      uploaded.push({
        fileName: result.fileName!,
        url: result.url,
        originalSize: result.originalSize!,
        compressedSize: result.compressedSize!,
        compressionRatio: result.compressionRatio!,
      });
    } else {
      failed.push({
        fileName: result.fileName || file.name,
        error: result.error || "알 수 없는 오류",
      });
    }

    // API 레이트 리밋 방지를 위한 짧은 대기 (마지막 파일 제외)
    if (i < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 통계 계산
  const totalOriginalSize = uploaded.reduce(
    (sum, item) => sum + item.originalSize,
    0,
  );
  const totalCompressedSize = uploaded.reduce(
    (sum, item) => sum + item.compressedSize,
    0,
  );
  const avgCompressionRatio =
    totalOriginalSize > 0
      ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100
      : 0;

  console.log(
    `일괄 업로드 완료: 성공 ${uploaded.length}개, 실패 ${failed.length}개`,
  );
  console.log(
    `총 용량: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB → ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`평균 압축률: ${avgCompressionRatio.toFixed(2)}%`);
  console.groupEnd();

  return {
    success: failed.length === 0,
    uploaded,
    failed,
    totalOriginalSize,
    totalCompressedSize,
    avgCompressionRatio,
  };
}

/**
 * FormData에서 이미지 파일들을 추출하여 일괄 업로드합니다.
 *
 * @param formData - FormData 객체
 * @returns 일괄 업로드 결과
 */
export async function batchUploadImagesFromFormData(
  formData: FormData,
): Promise<BatchUploadResult> {
  console.group("[batchUploadImagesFromFormData] FormData에서 이미지 추출");

  const files: File[] = [];
  const fileEntries = formData.getAll("files");

  for (const entry of fileEntries) {
    if (entry instanceof File) {
      files.push(entry);
    }
  }

  console.log(`추출된 이미지 파일 수: ${files.length}`);
  console.groupEnd();

  if (files.length === 0) {
    return {
      success: false,
      uploaded: [],
      failed: [{ fileName: "", error: "업로드할 이미지 파일이 없습니다." }],
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      avgCompressionRatio: 0,
    };
  }

  return batchUploadImages(files);
}

