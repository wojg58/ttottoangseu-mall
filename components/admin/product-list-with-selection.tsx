/**
 * @file components/admin/product-list-with-selection.tsx
 * @description 체크박스 선택 기능이 있는 상품 목록 컴포넌트
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Edit, ImageIcon } from "lucide-react";
import type { ProductListItem } from "@/types/database";
import DeleteProductButton from "@/components/delete-product-button";
import NumberDisplay from "@/components/number-display";
import BulkHideProductsButton from "@/components/bulk-hide-products-button";

interface ProductListWithSelectionProps {
  products: ProductListItem[];
}

export default function ProductListWithSelection({
  products,
}: ProductListWithSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedIds(newSelected);
  };

  const handleHideSuccess = () => {
    // 숨김 처리 성공 후 선택 해제
    setSelectedIds(new Set());
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  return (
    <div className="space-y-4">
      {/* 일괄 숨김 처리 버튼 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-[#ffeef5] p-4 rounded-lg border border-[#ff6b9d]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#4a3f48] font-medium">
              {selectedIds.size}개 상품 선택됨
            </span>
          </div>
          <BulkHideProductsButton
            selectedProductIds={Array.from(selectedIds)}
            onSuccess={handleHideSuccess}
          />
        </div>
      )}

      {/* 상품 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
                    aria-label="전체 선택"
                  />
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  이미지
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  상품명
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  카테고리
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  가격
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  재고
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  상태
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isSelected={isSelected}
                    onSelect={(checked) => handleSelectOne(product.id, checked)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 상품 행 컴포넌트 (이미지 로딩 상태 관리)
function ProductRow({
  product,
  isSelected,
  onSelect,
}: {
  product: ProductListItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 이미지 URL이 있으면 표시 시도
  const hasImage = product.primary_image?.image_url;

  // 이미지 로딩 타임아웃 설정 (10초 후 실패 처리 - 네트워크가 느린 경우 대비)
  useEffect(() => {
    if (hasImage && !imageError) {
      timeoutRef.current = setTimeout(() => {
        // 10초가 지나도 이미지가 로드되지 않으면 에러 처리
        if (imageLoading) {
          console.warn(
            "[ProductRow] 이미지 로딩 타임아웃:",
            product.name,
            product.primary_image?.image_url,
          );
          setImageError(true);
          setImageLoading(false);
        }
      }, 10000); // 10초 타임아웃

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else if (!hasImage) {
      // 이미지가 없으면 즉시 로딩 완료 처리
      setImageLoading(false);
      setImageError(true);
    }
  }, [hasImage, imageError, imageLoading, product.name, product.primary_image?.image_url]);

  return (
    <tr
      className={`border-b border-gray-50 hover:bg-gray-50 ${
        isSelected ? "bg-[#ffeef5]" : ""
      }`}
    >
      <td className="py-4 px-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
          aria-label={`${product.name} 선택`}
        />
      </td>
      <td className="py-4 px-4">
        {hasImage ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
            {/* Next.js Image 컴포넌트 사용 (SSL 인증서 오류 해결) */}
            <Image
              src={product.primary_image.image_url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="64px"
              onLoadingComplete={() => {
                console.log("[ProductRow] 이미지 로딩 완료:", product.name);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                }
                setImageLoading(false);
                setImageError(false);
              }}
            />
            {/* 로딩 스피너 (이미지가 로딩 중일 때만 표시) */}
            {imageLoading && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                <div className="w-4 h-4 border-2 border-[#ff6b9d] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* 에러 상태일 때 오버레이 */}
            {imageError && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 opacity-75">
                <ImageIcon className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
      </td>
      <td className="py-4 px-4">
        <div>
          <p className="font-medium text-[#4a3f48]">{product.name}</p>
          <p className="text-xs text-[#8b7d84]">{product.slug}</p>
        </div>
      </td>
      <td className="py-4 px-4 text-[#4a3f48]">{product.category.name}</td>
      <td className="py-4 px-4">
        <div>
          {product.discount_price ? (
            <>
              <NumberDisplay
                value={product.discount_price}
                suffix="원"
                className="text-[#ff6b9d] font-medium"
              />
              <p className="text-xs text-gray-400 line-through">
                <NumberDisplay value={product.price} suffix="원" />
              </p>
            </>
          ) : (
            <NumberDisplay
              value={product.price}
              suffix="원"
              className="text-[#4a3f48] font-medium"
            />
          )}
        </div>
      </td>
      <td className="py-4 px-4 text-[#4a3f48]">{product.stock}개</td>
      <td className="py-4 px-4">
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            product.status === "active"
              ? "bg-green-100 text-green-600"
              : product.status === "sold_out"
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {product.status === "active" && "판매중"}
          {product.status === "hidden" && "숨김"}
          {product.status === "sold_out" && "품절"}
        </span>
        <div className="flex gap-1 mt-1">
          {product.is_featured && (
            <span className="text-xs px-1.5 py-0.5 bg-[#ffeef5] text-[#ff6b9d] rounded">
              BEST
            </span>
          )}
          {product.is_new && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
              NEW
            </span>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/products/${product.id}`}
            className="p-2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <DeleteProductButton productId={product.id} />
        </div>
      </td>
    </tr>
  );
}

