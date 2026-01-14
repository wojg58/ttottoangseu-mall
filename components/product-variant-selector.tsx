/**
 * @file components/product-variant-selector.tsx
 * @description 상품 옵션 선택 컴포넌트
 *
 * 주요 기능:
 * 1. 옵션 선택 UI
 * 2. 옵션별 재고 표시
 * 3. 옵션별 가격 조정 표시
 * 4. 선택된 옵션 상태 관리
 */

"use client";

import { useState, useEffect } from "react";
import type { ProductVariant } from "@/types/database";

interface ProductVariantSelectorProps {
  variants: ProductVariant[];
  basePrice: number;
  onVariantChange?: (
    variantId: string | null,
    variant: ProductVariant | null,
  ) => void;
  required?: boolean;
}

export default function ProductVariantSelector({
  variants,
  basePrice,
  onVariantChange,
  required = false,
}: ProductVariantSelectorProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  // 필터링된 variants (삭제되지 않은 것만)
  const availableVariants = variants.filter((v) => !v.deleted_at);

  // 선택된 variant 정보
  const selectedVariant =
    availableVariants.find((v) => v.id === selectedVariantId) || null;

  // 옵션이 필수이고 선택되지 않은 경우
  const hasError =
    required && availableVariants.length > 0 && !selectedVariantId;

  // variant 변경 시 콜백 호출
  useEffect(() => {
    if (onVariantChange) {
      onVariantChange(selectedVariantId, selectedVariant);
    }
  }, [selectedVariantId, selectedVariant, onVariantChange]);

  // 옵션이 없는 경우 렌더링하지 않음
  if (availableVariants.length === 0) {
    return null;
  }

  // 옵션 이름에서 숫자 추출 함수 (정렬용)
  const extractOrderNumber = (variantValue: string): number => {
    // "1.블랙키티+그레이드레스" 형식에서 숫자 추출
    const match = variantValue.match(/^(\d+)\./);
    if (match) {
      return parseInt(match[1], 10);
    }
    // 숫자가 없으면 맨 뒤로 (큰 숫자 반환)
    return 999999;
  };

  // 옵션별 그룹화 (variant_name 기준)
  const groupedVariants = availableVariants.reduce((acc, variant) => {
    const groupName = variant.variant_name || "옵션";
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(variant);
    return acc;
  }, {} as Record<string, ProductVariant[]>);

  // 각 그룹의 옵션들을 숫자 순서로 정렬
  Object.keys(groupedVariants).forEach((groupName) => {
    groupedVariants[groupName].sort((a, b) => {
      const orderA = extractOrderNumber(a.variant_value);
      const orderB = extractOrderNumber(b.variant_value);
      return orderA - orderB;
    });
  });

  const handleVariantClick = (variantId: string) => {
    // 이미 선택된 옵션을 다시 클릭하면 선택 해제
    if (selectedVariantId === variantId) {
      if (!required) {
        setSelectedVariantId(null);
      }
    } else {
      setSelectedVariantId(variantId);
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedVariants).map(([groupName, groupVariants]) => (
        <div key={groupName}>
          <h3 className="text-sm font-bold text-[#4a3f48] mb-3">
            {groupName}
            {required && <span className="text-[#ff6b9d] ml-1">*</span>}
          </h3>
          <div className="flex flex-wrap gap-2">
            {groupVariants.map((variant) => {
              const isSelected = selectedVariantId === variant.id;
              const isOutOfStock = variant.stock === 0;
              const priceAdjustment = variant.price_adjustment || 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => handleVariantClick(variant.id)}
                  disabled={isOutOfStock}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    isOutOfStock
                      ? "border-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                      : isSelected
                      ? "border-[#ff6b9d] bg-[#ffeef5] text-[#ff6b9d] font-bold shadow-sm"
                      : "border-[#f5d5e3] text-[#4a3f48] hover:border-[#ff6b9d] hover:bg-[#ffeef5]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{variant.variant_value}</span>
                    {priceAdjustment !== 0 && (
                      <span
                        className={`text-xs ${
                          priceAdjustment > 0
                            ? "text-[#ff6b9d]"
                            : "text-green-600"
                        }`}
                      >
                        {priceAdjustment > 0 ? "+" : ""}
                        {priceAdjustment.toLocaleString("ko-KR")}원
                      </span>
                    )}
                    {isOutOfStock && (
                      <span className="ml-1 text-xs text-red-400">품절</span>
                    )}
                    {isSelected && <span className="ml-1 text-xs">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 선택된 옵션 정보 표시 */}
      {selectedVariant && (
        <div className="bg-[#ffeef5] rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#4a3f48]">
                선택된 옵션: {selectedVariant.variant_value}
              </p>
              {selectedVariant.price_adjustment !== 0 && (
                <p className="text-xs text-[#8b7d84] mt-1">
                  옵션 가격:{" "}
                  <span
                    className={
                      selectedVariant.price_adjustment > 0
                        ? "text-[#ff6b9d]"
                        : "text-green-600"
                    }
                  >
                    {selectedVariant.price_adjustment > 0 ? "+" : ""}
                    {selectedVariant.price_adjustment.toLocaleString("ko-KR")}원
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8b7d84]">최종 가격</p>
              <p className="text-lg font-bold text-[#ff6b9d]">
                {(
                  basePrice + (selectedVariant.price_adjustment || 0)
                ).toLocaleString("ko-KR")}
                원
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 필수 옵션 미선택 에러 메시지 */}
      {hasError && (
        <p className="text-sm text-red-500 mt-2">옵션을 선택해주세요.</p>
      )}
    </div>
  );
}
