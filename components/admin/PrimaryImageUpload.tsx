/**
 * @file components/admin/PrimaryImageUpload.tsx
 * @description 상품 대표 이미지 업로드 컴포넌트
 * 
 * 주요 기능:
 * 1. 대표 이미지 업로드
 * 2. 기존 대표 이미지 교체
 * 3. 이미지 미리보기
 */

"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Check } from "lucide-react";
import { uploadImageFile } from "@/actions/upload-image";
import { addProductImage } from "@/actions/admin-products";
import logger from "@/lib/logger-client";

interface PrimaryImageUploadProps {
  productId: string;
  productSlug: string;
  currentPrimaryImage?: {
    id: string;
    image_url: string;
    alt_text?: string | null;
  } | null;
  onSuccess?: () => void;
}

export default function PrimaryImageUpload({
  productId,
  productSlug,
  currentPrimaryImage,
  onSuccess,
}: PrimaryImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("이미지를 선택해주세요.");
      return;
    }

    setIsUploading(true);
    setIsCompressing(true);

    try {
      logger.info("[PrimaryImageUpload] 대표 이미지 업로드 시작", {
        productId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      // 이미지 업로드 (압축 포함)
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResult = await uploadImageFile(formData, {
        width: 1200,
        height: 1200,
        fit: "inside",
      });

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || "이미지 업로드에 실패했습니다.");
      }

      logger.info("[PrimaryImageUpload] 이미지 업로드 완료", {
        imageUrl: uploadResult.url,
      });

      setIsCompressing(false);

      // 데이터베이스에 대표 이미지 추가/업데이트
      const addResult = await addProductImage(productId, {
        image_url: uploadResult.url,
        is_primary: true,
        sort_order: 0,
        alt_text: `대표 이미지`,
      });

      if (!addResult.success) {
        throw new Error(addResult.message || "대표 이미지 등록에 실패했습니다.");
      }

      logger.info("[PrimaryImageUpload] 대표 이미지 등록 완료", {
        imageId: addResult.imageId,
      });

      alert("대표 이미지가 등록되었습니다!");
      
      // 성공 콜백 실행
      if (onSuccess) {
        onSuccess();
      } else {
        // 페이지 새로고침
        window.location.reload();
      }
    } catch (error) {
      logger.error("[PrimaryImageUpload] 업로드 실패", error);
      alert(
        error instanceof Error
          ? error.message
          : "대표 이미지 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setIsUploading(false);
      setIsCompressing(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#4a3f48]">
          대표 이미지 {currentPrimaryImage ? "교체" : "등록"}
        </h3>
        {currentPrimaryImage && (
          <span className="text-xs bg-[#ffeef5] text-[#ff6b9d] px-2 py-1 rounded-full">
            현재 이미지 있음
          </span>
        )}
      </div>

      {/* 현재 대표 이미지 표시 */}
      {currentPrimaryImage && !previewUrl && (
        <div className="mb-4">
          <p className="text-sm text-[#8b7d84] mb-2">현재 대표 이미지:</p>
          <div className="relative w-full aspect-square max-w-xs border rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={currentPrimaryImage.image_url}
              alt={currentPrimaryImage.alt_text || "대표 이미지"}
              fill
              className="object-contain"
              sizes="(max-width: 400px) 100vw, 400px"
            />
          </div>
        </div>
      )}

      {/* 파일 선택 */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={isUploading || isCompressing}
          className="hidden"
          id="primary-image-input"
        />
        <label
          htmlFor="primary-image-input"
          className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isUploading || isCompressing
              ? "border-gray-200 bg-gray-50 cursor-not-allowed"
              : "border-[#ff6b9d] bg-[#ffeef5] hover:bg-[#ffd9e8]"
          }`}
        >
          <Upload className="w-5 h-5 text-[#ff6b9d]" />
          <span className="text-sm font-medium text-[#4a3f48]">
            {selectedFile ? "다른 이미지 선택" : "이미지 선택"}
          </span>
        </label>
        <p className="mt-2 text-xs text-[#8b7d84]">
          💡 이미지는 자동으로 압축됩니다 (최대 1200px)
        </p>
      </div>

      {/* 압축 중 표시 */}
      {isCompressing && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-semibold text-yellow-800">
            ⏳ 이미지 압축 중...
          </p>
        </div>
      )}

      {/* 미리보기 */}
      {previewUrl && selectedFile && (
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#4a3f48]">미리보기</p>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-[#8b7d84] hover:text-[#ff6b9d]"
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative w-full aspect-square max-w-xs border rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={previewUrl}
              alt="미리보기"
              fill
              className="object-contain"
              sizes="(max-width: 400px) 100vw, 400px"
            />
          </div>
          <div className="text-xs text-[#8b7d84]">
            파일명: {selectedFile.name}
            <br />
            크기: {(selectedFile.size / 1024).toFixed(1)} KB
          </div>
        </div>
      )}

      {/* 업로드 버튼 */}
      {selectedFile && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || isCompressing}
          className="w-full px-4 py-3 bg-[#ff6b9d] text-white rounded-lg font-semibold hover:bg-[#ff5a8a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>업로드 중...</span>
            </>
          ) : isCompressing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>압축 중...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>대표 이미지 {currentPrimaryImage ? "교체" : "등록"}하기</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
