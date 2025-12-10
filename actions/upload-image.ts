"use server";

/**
 * @file actions/upload-image.ts
 * @description 이미지 파일 업로드 Server Action
 *
 * 주요 기능:
 * 1. 이미지 파일 업로드
 * 2. 이미지 자동 압축 (WebP 변환, 리사이즈)
 * 3. Supabase Storage에 저장
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { compressImage } from "@/lib/utils/compress-image";

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadImageOptions {
  /** 고정 너비 (px, 지정 시 정확히 이 크기로 리사이즈) */
  width?: number;
  /** 고정 높이 (px, 지정 시 정확히 이 크기로 리사이즈) */
  height?: number;
  /** 리사이즈 모드 (기본값: "inside") */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export async function uploadImageFile(
  formData: FormData,
  options?: UploadImageOptions,
): Promise<{ success: boolean; url?: string; error?: string }> {
  console.group("[uploadImageFile] 이미지 파일 업로드 시작");

  try {
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("파일이 선택되지 않았습니다.");
    }

    // 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드 가능합니다.");
    }

    // 파일 크기 검증
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

    // Supabase 클라이언트 생성 (서비스 롤 키 사용 - 관리자 권한 필요)
    const supabase = getServiceRoleClient();

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;
    console.log(`원본 이미지 크기: ${(originalSize / 1024).toFixed(2)} KB`);

    // 이미지 압축
    console.log("이미지 압축 시작...");
    const compressedResult = await compressImage(Buffer.from(arrayBuffer), {
      quality: 85, // 품질 85% (고품질 유지하면서 용량 최적화)
      maxWidth: options?.width ? undefined : 2000, // 고정 크기가 지정되지 않은 경우만 최대 너비 적용
      width: options?.width, // 고정 너비 (상품 설명 에디터용: 800)
      height: options?.height, // 고정 높이 (상품 설명 에디터용: 800)
      fit: options?.fit || "inside", // 리사이즈 모드 (고정 크기일 때는 cover 사용)
      convertToWebP: true, // WebP로 변환하여 용량 최적화
      keepOriginalFormat: false,
    });

    console.log(
      `압축 완료: ${(compressedResult.size / 1024).toFixed(2)} KB (압축률: ${compressedResult.compressionRatio.toFixed(2)}%)`,
    );

    // 파일명 생성 (WebP로 변환)
    const fileName = `product-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.webp`;
    const filePath = `products/${fileName}`;

    // Supabase Storage에 업로드 (압축된 이미지)
    console.log("Supabase Storage에 업로드 중...", filePath);
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filePath, compressedResult.buffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
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
      error:
        error instanceof Error
          ? error.message
          : "이미지 업로드에 실패했습니다.",
    };
  }
}

