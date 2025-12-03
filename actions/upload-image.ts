"use server";

/**
 * @file actions/upload-image.ts
 * @description 이미지 파일 업로드 Server Action
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadImageFile(
  formData: FormData,
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

    const fileName = `product-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${ext}`;
    const filePath = `products/${fileName}`;

    // Supabase 클라이언트 생성 (서비스 롤 키 사용 - 관리자 권한 필요)
    const supabase = getServiceRoleClient();

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();

    // Supabase Storage에 업로드
    console.log("Supabase Storage에 업로드 중...", filePath);
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
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

