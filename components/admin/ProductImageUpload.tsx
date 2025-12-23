// components/admin/ProductImageUpload.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImages, getCompressionStats } from '@/lib/utils/compress-image-client';
import Image from 'next/image';

interface ProductImageUploadProps {
  productId: string;
  productSlug: string;
}

export default function ProductImageUpload({
  productId,
  productSlug,
}: ProductImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // 특정 상품 ID에 대해서는 압축 건너뛰기
    const shouldSkipCompression = productId === 'ttotto_pr_255';
    
    if (shouldSkipCompression) {
      // 압축 없이 원본 파일 사용
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
      const previews = fileArray.map((file) => URL.createObjectURL(file));
      setPreviewUrls(previews);
      console.log('[ProductImageUpload] 압축 건너뛰기 (상품 ID: ttotto_pr_255)');
      return;
    }

    setIsCompressing(true);

    try {
      const fileArray = Array.from(files);
      const compressedFiles = await compressImages(fileArray);
      const stats = getCompressionStats(fileArray, compressedFiles);

      console.log(`압축 완료: ${stats.originalMB} MB → ${stats.compressedMB} MB`);

      setSelectedFiles(compressedFiles);

      const previews = compressedFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls(previews);

      alert(`압축 완료! ${stats.reduction}% 절감`);
    } catch (error) {
      console.error('압축 실패:', error);
      alert('이미지 압축 중 오류가 발생했습니다.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('이미지를 선택해주세요.');
      return;
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        // 압축을 건너뛴 경우 원본 파일 확장자 유지
        const shouldSkipCompression = productId === 'ttotto_pr_255';
        const fileExt = shouldSkipCompression 
          ? file.name.split('.').pop() || 'jpg'
          : 'webp';
        const fileName = `detail-${i + 1}.${fileExt}`;
        const filePath = `products/${productSlug}/${fileName}`;

        // 압축을 건너뛴 경우 원본 파일 형식의 contentType 사용
        const contentType = shouldSkipCompression
          ? file.type || `image/${fileExt}`
          : 'image/webp';

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file, {
            contentType,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error(`업로드 실패:`, uploadError);
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);

        await supabase.from('product_images').insert({
          product_id: productId,
          image_url: publicUrlData.publicUrl,
          is_primary: false,
          sort_order: i + 1,
          alt_text: `상품 상세 이미지 ${i + 1}`,
        });
      }

      alert(`${selectedFiles.length}장 업로드 완료!`);
      window.location.reload();
    } catch (error) {
      console.error('업로드 실패:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-8 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">상품 상세 이미지 업로드</h3>

      <div className="mb-4">
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          multiple
          onChange={handleFileChange}
          disabled={isCompressing || isUploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          {productId === 'ttotto_pr_255' 
            ? '💡 이 상품은 압축 없이 원본 이미지로 업로드됩니다'
            : '💡 이미지 선택 시 자동으로 압축됩니다 (150KB 목표)'}
        </p>
      </div>

      {isCompressing && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm font-semibold text-yellow-800">⏳ 이미지 압축 중...</p>
        </div>
      )}

      {previewUrls.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">미리보기 ({selectedFiles.length}장)</h4>
          <div className="grid grid-cols-3 gap-4">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative aspect-square border rounded">
                <Image
                  src={url}
                  alt={`미리보기 ${index + 1}`}
                  fill
                  className="object-cover rounded"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? '업로드 중...' : `${selectedFiles.length}장 업로드하기`}
          </button>
        </div>
      )}
    </div>
  );
}