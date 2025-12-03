/**
 * @file lib/utils/upload-image.ts
 * @description 상품 이미지 업로드 유틸리티
 *
 * 주요 기능:
 * 1. 외부 URL에서 이미지 다운로드
 * 2. Supabase Storage에 업로드
 * 3. 공개 URL 반환
 *
 * @dependencies
 * - @supabase/supabase-js: Supabase 클라이언트
 */

import { createClient } from "@supabase/supabase-js";

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 외부 URL에서 이미지 다운로드 및 Supabase Storage에 업로드
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  fileName?: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  console.group("[uploadImageFromUrl] 이미지 업로드 시작");
  console.log("이미지 URL:", imageUrl);

  try {
    // Supabase 클라이언트 생성 (서비스 롤 키 사용 - 관리자 권한)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 이미지 다운로드
    console.log("이미지 다운로드 중...");
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error("이미지 파일이 아닙니다.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    if (fileSize > MAX_IMAGE_SIZE) {
      throw new Error(`이미지 크기가 너무 큽니다. (최대 ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
    }

    // 파일명 생성
    const urlPath = new URL(imageUrl).pathname;
    const urlFileName = urlPath.split("/").pop() || "image";
    const fileExtension = urlFileName.split(".").pop() || "jpg";

    // 확장자 검증
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
    const ext = fileExtension.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`지원하지 않는 이미지 형식입니다: ${ext}`);
    }

    const finalFileName = fileName || `product-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `products/${finalFileName}`;

    // Supabase Storage에 업로드
    console.log("Supabase Storage에 업로드 중...", filePath);
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: true, // 같은 파일명이 있으면 덮어쓰기
      });

    if (error) {
      throw error;
    }

    // 공개 URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filePath);

    console.log("이미지 업로드 성공:", publicUrl);
    console.groupEnd();

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    console.error("이미지 업로드 에러:", error);
    console.groupEnd();
    return {
      success: false,
      error: error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.",
    };
  }
}

/**
 * 여러 이미지 URL을 일괄 업로드
 */
export async function uploadImagesFromUrls(
  imageUrls: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<{
  success: boolean;
  uploaded: Array<{ originalUrl: string; uploadedUrl: string }>;
  failed: Array<{ originalUrl: string; error: string }>;
}> {
  console.group("[uploadImagesFromUrls] 이미지 일괄 업로드 시작");
  console.log("업로드할 이미지 수:", imageUrls.length);

  const uploaded: Array<{ originalUrl: string; uploadedUrl: string }> = [];
  const failed: Array<{ originalUrl: string; error: string }> = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`[${i + 1}/${imageUrls.length}] 업로드 중: ${url}`);

    const result = await uploadImageFromUrl(url);

    if (result.success && result.url) {
      uploaded.push({
        originalUrl: url,
        uploadedUrl: result.url,
      });
    } else {
      failed.push({
        originalUrl: url,
        error: result.error || "알 수 없는 오류",
      });
    }

    // 진행 상황 콜백
    if (onProgress) {
      onProgress(i + 1, imageUrls.length);
    }

    // API 레이트 리밋 방지를 위한 짧은 대기
    if (i < imageUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`업로드 완료: 성공 ${uploaded.length}개, 실패 ${failed.length}개`);
  console.groupEnd();

  return {
    success: failed.length === 0,
    uploaded,
    failed,
  };
}

