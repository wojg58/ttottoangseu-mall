"use client";

/**
 * @file components/batch-upload-client.tsx
 * @description 이미지 일괄 업로드 클라이언트 컴포넌트
 *
 * 주요 기능:
 * 1. 다중 파일 선택 (드래그 앤 드롭 또는 파일 선택)
 * 2. 이미지 압축 및 업로드 진행률 표시
 * 3. 업로드된 이미지 URL 목록 표시
 * 4. 실패한 이미지 목록 표시
 * 5. 클립보드 복사 기능
 */

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  XCircle,
  Copy,
  Loader2,
  FileImage,
} from "lucide-react";
import { uploadAndCompressImage } from "@/actions/batch-upload-images";
import { Button } from "@/components/ui/button";

interface UploadedImage {
  fileName: string;
  url: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

interface FailedImage {
  fileName: string;
  error: string;
}

export default function BatchUploadClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [uploadResult, setUploadResult] = useState<{
    uploaded: UploadedImage[];
    failed: FailedImage[];
    totalOriginalSize: number;
    totalCompressedSize: number;
    avgCompressionRatio: number;
  } | null>(null);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFiles.length === 0) {
        alert("이미지 파일만 선택할 수 있습니다.");
        return;
      }

      // 파일 크기 체크 (10MB 제한)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = imageFiles.filter(
        (file) => file.size > MAX_FILE_SIZE,
      );

      if (oversizedFiles.length > 0) {
        const fileNames = oversizedFiles.map((f) => f.name).join(", ");
        alert(
          `다음 파일의 크기가 너무 큽니다 (최대 10MB):\n${fileNames}\n\n이 파일들은 제외됩니다.`,
        );
      }

      const validFiles = imageFiles.filter(
        (file) => file.size <= MAX_FILE_SIZE,
      );

      if (validFiles.length === 0) {
        alert("업로드 가능한 이미지 파일이 없습니다.");
        return;
      }

      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setUploadResult(null);
    },
    [],
  );

  // 파일 입력 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // 같은 파일을 다시 선택할 수 있도록 리셋
    if (e.target) {
      e.target.value = "";
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  // 파일 제거
  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 모든 파일 제거
  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadResult(null);
    setProgress({ current: 0, total: 0 });
  };

  // 업로드 실행 (개별 순차 업로드)
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("업로드할 이미지를 선택해주세요.");
      return;
    }

    setIsUploading(true);
    setProgress({ current: 0, total: selectedFiles.length });
    setUploadResult(null);

    const uploaded: UploadedImage[] = [];
    const failed: FailedImage[] = [];

    try {
      // 각 이미지를 개별적으로 순차 업로드
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`[${i + 1}/${selectedFiles.length}] 업로드 중: ${file.name}`);

        // 진행률 업데이트
        setProgress({ current: i, total: selectedFiles.length });

        try {
          // 개별 파일을 FormData로 전송
          const formData = new FormData();
          formData.append("file", file);

          // 개별 업로드 실행
          const result = await uploadAndCompressImage(file);

          if (result.success && result.url) {
            uploaded.push({
              fileName: result.fileName!,
              url: result.url,
              originalSize: result.originalSize!,
              compressedSize: result.compressedSize!,
              compressionRatio: result.compressionRatio!,
            });
            console.log(`[${i + 1}/${selectedFiles.length}] 업로드 성공: ${file.name}`);
          } else {
            failed.push({
              fileName: result.fileName || file.name,
              error: result.error || "알 수 없는 오류",
            });
            console.error(`[${i + 1}/${selectedFiles.length}] 업로드 실패: ${file.name}`, result.error);
          }
        } catch (error) {
          console.error(`[${i + 1}/${selectedFiles.length}] 업로드 에러: ${file.name}`, error);
          failed.push({
            fileName: file.name,
            error: error instanceof Error ? error.message : "업로드에 실패했습니다.",
          });
        }

        // API 레이트 리밋 방지를 위한 짧은 대기 (마지막 파일 제외)
        if (i < selectedFiles.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // 최종 진행률 업데이트
      setProgress({ current: selectedFiles.length, total: selectedFiles.length });

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

      setUploadResult({
        uploaded,
        failed,
        totalOriginalSize,
        totalCompressedSize,
        avgCompressionRatio,
      });

      // 성공한 파일은 선택 목록에서 제거
      if (uploaded.length > 0) {
        const uploadedFileNames = new Set(uploaded.map((item) => item.fileName));
        setSelectedFiles((prev) =>
          prev.filter((file) => !uploadedFileNames.has(file.name)),
        );
      }
    } catch (error) {
      console.error("업로드 에러:", error);
      alert(
        error instanceof Error
          ? error.message
          : "이미지 업로드에 실패했습니다.",
      );
    } finally {
      setIsUploading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  // URL 목록 복사
  const handleCopyUrls = () => {
    if (!uploadResult || uploadResult.uploaded.length === 0) return;

    const urls = uploadResult.uploaded.map((item) => item.url).join("\n");
    navigator.clipboard.writeText(urls);
    alert("URL 목록이 클립보드에 복사되었습니다.");
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* 파일 선택 영역 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#4a3f48] mb-4">
          이미지 선택
        </h2>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#f5d5e3] rounded-lg p-8 text-center hover:border-[#ff6b9d] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 mx-auto text-[#8b7d84] mb-4" />
          <p className="text-[#4a3f48] font-medium mb-2">
            이미지를 드래그 앤 드롭하거나 클릭하여 선택
          </p>
          <p className="text-sm text-[#8b7d84]">
            여러 이미지를 한 번에 선택할 수 있습니다 (Ctrl/Cmd + 클릭)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        {/* 선택된 파일 목록 */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#4a3f48]">
                선택된 파일 ({selectedFiles.length}개)
              </p>
              <button
                onClick={handleClearAll}
                className="text-sm text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
              >
                모두 제거
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileImage className="w-5 h-5 text-[#8b7d84] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#4a3f48] truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-[#8b7d84]">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 업로드 버튼 */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  업로드 시작 ({selectedFiles.length}개)
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* 진행률 표시 */}
      {isUploading && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#4a3f48] mb-4">
            업로드 진행 중
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#4a3f48]">
                {progress.current} / {progress.total}
              </span>
              <span className="text-[#8b7d84]">
                {progress.total > 0
                  ? Math.round((progress.current / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-[#ff6b9d] h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    progress.total > 0
                      ? (progress.current / progress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 업로드 결과 */}
      {uploadResult && (
        <div className="space-y-4">
          {/* 성공한 이미지 */}
          {uploadResult.uploaded.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-[#4a3f48]">
                    업로드 성공 ({uploadResult.uploaded.length}개)
                  </h2>
                </div>
                <Button
                  onClick={handleCopyUrls}
                  variant="outline"
                  size="sm"
                  className="border-[#f5d5e3] text-[#4a3f48] hover:bg-[#ffeef5]"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  URL 복사
                </Button>
              </div>

              {/* 통계 */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-[#8b7d84] mb-1">원본 용량</p>
                  <p className="text-sm font-medium text-[#4a3f48]">
                    {formatFileSize(uploadResult.totalOriginalSize)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8b7d84] mb-1">압축 후 용량</p>
                  <p className="text-sm font-medium text-[#4a3f48]">
                    {formatFileSize(uploadResult.totalCompressedSize)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8b7d84] mb-1">평균 압축률</p>
                  <p className="text-sm font-medium text-[#4a3f48]">
                    {uploadResult.avgCompressionRatio.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* URL 목록 */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {uploadResult.uploaded.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#4a3f48] truncate">
                        {item.fileName}
                      </p>
                      <p className="text-xs text-[#8b7d84] truncate mt-1">
                        {item.url}
                      </p>
                      <p className="text-xs text-[#8b7d84] mt-1">
                        {formatFileSize(item.originalSize)} →{" "}
                        {formatFileSize(item.compressedSize)} (
                        {item.compressionRatio.toFixed(2)}% 압축)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.url);
                        alert("URL이 복사되었습니다.");
                      }}
                      className="ml-2 p-1 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 실패한 이미지 */}
          {uploadResult.failed.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-[#4a3f48]">
                  업로드 실패 ({uploadResult.failed.length}개)
                </h2>
              </div>
              <div className="space-y-2">
                {uploadResult.failed.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <p className="text-sm font-medium text-red-800">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-red-600 mt-1">{item.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

