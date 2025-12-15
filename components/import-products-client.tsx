/**
 * @file components/import-products-client.tsx
 * @description 상품 데이터 이관 클라이언트 컴포넌트
 *
 * 주요 기능:
 * 1. 파일 업로드 및 파싱
 * 2. 파싱 결과 미리보기
 * 3. 카테고리 매핑 설정
 * 4. 상품 이관 실행
 */

"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import {
  parseProductFile,
  createCategoryMap,
  type ParseResult,
} from "@/lib/utils/import-products";
import { importProducts } from "@/actions/import-products";
import type { Category } from "@/types/database";
import { Button } from "@/components/ui/button";

interface ImportProductsClientProps {
  categories: Category[];
}

export default function ImportProductsClient({
  categories,
}: ImportProductsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(
    new Map(),
  );
  // 다중 카테고리 매핑 (상품 인덱스 -> 카테고리 slug 배열)
  const [categorySlugsMap, setCategorySlugsMap] = useState<
    Map<number, string[]>
  >(new Map());
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported: number;
    failed: number;
    errors: Array<{ product_name: string; message: string }>;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 클라이언트 사이드 마운트 확인 (hydration 에러 방지)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  console.log("[ImportProductsClient] 렌더링");

  // 카테고리 매핑 초기화
  const initializeCategoryMap = () => {
    const map = createCategoryMap(categories);
    setCategoryMap(map);
    return map;
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    console.log("[ImportProductsClient] 파일 선택:", selectedFile.name);
    setFile(selectedFile);
    setParseResult(null);
    setImportResult(null);
    setCategorySlugsMap(new Map()); // 다중 카테고리 매핑 초기화

    // 카테고리 매핑 초기화
    const map = initializeCategoryMap();

    // 파일 파싱
    try {
      const result = await parseProductFile(selectedFile, map);
      console.log("[ImportProductsClient] 파싱 결과:", result);
      setParseResult(result);
      setCategoryMap(map);
    } catch (error) {
      console.error("[ImportProductsClient] 파싱 에러:", error);
      setParseResult({
        success: false,
        products: [],
        errors: [
          {
            row: 0,
            message: `파일 파싱 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          },
        ],
        warnings: [],
      });
    }
  };

  // 카테고리 매핑 변경 (단일 - 하위 호환성)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCategoryMappingChange = (
    productIndex: number,
    categorySlug: string,
  ) => {
    if (!parseResult) return;

    const product = parseResult.products[productIndex];
    if (!product) return;

    const newMap = new Map(categoryMap);
    if (product.raw_data?.카테고리) {
      newMap.set(product.raw_data.카테고리, categorySlug);
    }
    setCategoryMap(newMap);

    // 해당 상품의 category_slug 업데이트 (하위 호환성)
    const updatedProducts = [...parseResult.products];
    updatedProducts[productIndex] = {
      ...product,
      category_slug: categorySlug,
      category_slugs: categorySlug ? [categorySlug] : [], // 다중 카테고리도 업데이트
    };
    setParseResult({
      ...parseResult,
      products: updatedProducts,
    });
  };

  // 다중 카테고리 매핑 변경
  const handleCategorySlugsChange = (
    productIndex: number,
    categorySlug: string,
    checked: boolean,
  ) => {
    if (!parseResult) return;

    const product = parseResult.products[productIndex];
    if (!product) return;

    const currentSlugs = categorySlugsMap.get(productIndex) || product.category_slugs || [];
    let newSlugs: string[];

    if (checked) {
      // 체크박스 선택 시 배열에 추가
      newSlugs = [...currentSlugs, categorySlug];
    } else {
      // 체크박스 해제 시 배열에서 제거
      newSlugs = currentSlugs.filter((slug) => slug !== categorySlug);
    }

    // categorySlugsMap 업데이트
    const newCategorySlugsMap = new Map(categorySlugsMap);
    newCategorySlugsMap.set(productIndex, newSlugs);
    setCategorySlugsMap(newCategorySlugsMap);

    // 해당 상품의 category_slugs 업데이트
    const updatedProducts = [...parseResult.products];
    updatedProducts[productIndex] = {
      ...product,
      category_slugs: newSlugs,
      category_slug: newSlugs.length > 0 ? newSlugs[0] : undefined, // 첫 번째가 기본 카테고리
    };
    setParseResult({
      ...parseResult,
      products: updatedProducts,
    });
  };

  // 상품 이관 실행
  const handleImport = () => {
    if (!parseResult || parseResult.products.length === 0) {
      alert("이관할 상품이 없습니다.");
      return;
    }

    if (
      !confirm(
        `${parseResult.products.length}개 상품을 이관하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    console.log("[ImportProductsClient] 상품 이관 시작");
    setIsImporting(true);
    setImportResult(null);

    startTransition(async () => {
      try {
        // 카테고리 매핑 적용 (다중 카테고리 우선)
        const mappedProducts = parseResult.products.map((product, index) => {
          // categorySlugsMap에서 다중 카테고리 가져오기
          const categorySlugs = categorySlugsMap.get(index) || product.category_slugs;
          
          if (categorySlugs && categorySlugs.length > 0) {
            return {
              ...product,
              category_slugs: categorySlugs,
              category_slug: categorySlugs[0], // 첫 번째가 기본 카테고리
            };
          }

          // 기존 단일 카테고리 매핑 (하위 호환성)
          if (product.raw_data?.카테고리) {
            const mappedSlug = categoryMap.get(product.raw_data.카테고리);
            if (mappedSlug) {
              return {
                ...product,
                category_slug: mappedSlug,
                category_slugs: [mappedSlug],
              };
            }
          }
          return product;
        });

        const result = await importProducts(mappedProducts);
        console.log("[ImportProductsClient] 이관 결과:", result);
        setImportResult(result);

        if (result.success || result.imported > 0) {
          // 성공 시 상품 목록 페이지로 이동
          setTimeout(() => {
            router.push("/admin/products");
            router.refresh();
          }, 2000);
        }
      } catch (error) {
        console.error("[ImportProductsClient] 이관 에러:", error);
        setImportResult({
          success: false,
          message: `이관 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          imported: 0,
          failed: parseResult.products.length,
          errors: [],
        });
      } finally {
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 파일 업로드 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#4a3f48] mb-4">
          1. 파일 업로드
        </h2>

        <div className="border-2 border-dashed border-[#f5d5e3] rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-[#ff6b9d] mx-auto mb-4" />
          <p className="text-sm text-[#8b7d84] mb-4">
            CSV 또는 Excel 파일을 선택하세요
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isPending || isImporting}
          />
          <Button
            type="button"
            variant="outline"
            className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
            disabled={isPending || isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="w-4 h-4 mr-2" />
            파일 선택
          </Button>
          {file && (
            <p className="text-sm text-[#4a3f48] mt-4">
              선택된 파일: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        {/* 파일 형식 안내 */}
        <div className="mt-4 p-4 bg-[#ffeef5] rounded-lg">
          <p className="text-xs text-[#8b7d84] mb-2 font-bold">
            지원하는 파일 형식:
          </p>
          <ul className="text-xs text-[#8b7d84] space-y-1 list-disc list-inside">
            <li>CSV 파일 (.csv)</li>
            <li>Excel 파일 (.xlsx, .xls)</li>
          </ul>
          <p className="text-xs text-[#8b7d84] mt-2 font-bold">
            필수 컬럼: 상품명, 판매가, 재고
          </p>
        </div>
      </div>

      {/* 파싱 결과 미리보기 */}
      {parseResult && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-4">
            2. 파싱 결과 미리보기
          </h2>

          {/* 요약 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#ffeef5] rounded-lg p-4">
              <p className="text-xs text-[#8b7d84] mb-1">총 상품 수</p>
              <p className="text-2xl font-bold text-[#4a3f48]">
                {parseResult.products.length}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-green-600 mb-1">성공</p>
              <p className="text-2xl font-bold text-green-600">
                {parseResult.products.length - parseResult.errors.length}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-red-600 mb-1">에러</p>
              <p className="text-2xl font-bold text-red-600">
                {parseResult.errors.length}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-xs text-yellow-600 mb-1">경고</p>
              <p className="text-2xl font-bold text-yellow-600">
                {parseResult.warnings.length}
              </p>
            </div>
          </div>

          {/* 에러 목록 */}
          {parseResult.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                에러 ({parseResult.errors.length}개)
              </h3>
              <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <ul className="space-y-2 text-sm">
                  {parseResult.errors.map((error, index) => (
                    <li key={index} className="text-red-600">
                      <span className="font-medium">행 {error.row}:</span>{" "}
                      {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 경고 목록 */}
          {parseResult.warnings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-yellow-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                경고 ({parseResult.warnings.length}개)
              </h3>
              <div className="bg-yellow-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <ul className="space-y-2 text-sm">
                  {parseResult.warnings.map((warning, index) => (
                    <li key={index} className="text-yellow-600">
                      <span className="font-medium">행 {warning.row}:</span>{" "}
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 상품 목록 미리보기 */}
          {parseResult.products.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-[#4a3f48] mb-4">
                상품 목록 ({parseResult.products.length}개)
              </h3>
              <div className="border border-[#f5d5e3] rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#ffeef5] sticky top-0">
                      <tr>
                        <th className="p-3 text-left text-[#4a3f48] font-bold">
                          상품명
                        </th>
                        <th className="p-3 text-left text-[#4a3f48] font-bold min-w-[200px]">
                          카테고리
                        </th>
                        <th className="p-3 text-right text-[#4a3f48] font-bold">
                          가격
                        </th>
                        <th className="p-3 text-right text-[#4a3f48] font-bold">
                          재고
                        </th>
                        <th className="p-3 text-center text-[#4a3f48] font-bold">
                          상태
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.products.map((product, index) => (
                        <tr
                          key={index}
                          className="border-t border-[#f5d5e3] hover:bg-[#ffeef5]"
                        >
                          <td className="p-3 text-[#4a3f48]">
                            {product.name}
                          </td>
                          <td className="p-3">
                            <div className="border border-[#f5d5e3] rounded-lg p-2 max-h-32 overflow-y-auto bg-white">
                              {categories.length === 0 ? (
                                <p className="text-xs text-[#8b7d84] text-center py-2">
                                  카테고리가 없습니다.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {categories.map((cat) => {
                                    // 서버와 클라이언트 간 일관성 유지를 위해 안정적인 초기값 사용
                                    const defaultSlugs =
                                      product.category_slugs ||
                                      (product.category_slug ? [product.category_slug] : []);
                                    // 클라이언트 마운트 전에는 기본값만 사용 (hydration 에러 방지)
                                    const mappedSlugs = isMounted
                                      ? categorySlugsMap.get(index) || defaultSlugs
                                      : defaultSlugs;
                                    const isChecked = Array.isArray(mappedSlugs)
                                      ? mappedSlugs.includes(cat.slug)
                                      : false;
                                    
                                    // 항상 동일한 구조를 렌더링하여 hydration 에러 방지
                                    return (
                                      <div
                                        key={cat.id}
                                        className="flex items-center gap-2 p-1 hover:bg-[#ffeef5] rounded transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          id={`product-${index}-category-${cat.id}`}
                                          checked={isChecked}
                                          onChange={(e) =>
                                            handleCategorySlugsChange(
                                              index,
                                              cat.slug,
                                              e.target.checked,
                                            )
                                          }
                                          className="w-3.5 h-3.5 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-1 focus:ring-[#fad2e6] cursor-pointer"
                                          disabled={isImporting || !isMounted}
                                          suppressHydrationWarning
                                        />
                                        <label
                                          htmlFor={`product-${index}-category-${cat.id}`}
                                          className="text-xs text-[#4a3f48] cursor-pointer flex-1 select-none"
                                        >
                                          {cat.name}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-[#8b7d84] mt-1">
                              여러 카테고리 선택 가능
                            </p>
                          </td>
                          <td className="p-3 text-right text-[#4a3f48]">
                            {product.price.toLocaleString("ko-KR")}원
                            {product.discount_price && (
                              <span className="text-[#ff6b9d] ml-2">
                                (할인: {product.discount_price.toLocaleString("ko-KR")}원)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right text-[#4a3f48]">
                            {product.stock}개
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                product.status === "active"
                                  ? "bg-green-100 text-green-600"
                                  : product.status === "sold_out"
                                    ? "bg-red-100 text-red-600"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {product.status === "active"
                                ? "판매중"
                                : product.status === "sold_out"
                                  ? "품절"
                                  : "숨김"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 이관 실행 버튼 */}
      {parseResult && parseResult.products.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-4">
            3. 상품 이관 실행
          </h2>

          {importResult ? (
            <div
              className={`p-4 rounded-lg mb-4 ${
                importResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {importResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-bold mb-2 ${
                      importResult.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {importResult.message}
                  </p>
                  <div className="text-sm space-y-1">
                    <p>
                      성공: <span className="font-bold">{importResult.imported}개</span>
                    </p>
                    {importResult.failed > 0 && (
                      <p>
                        실패: <span className="font-bold">{importResult.failed}개</span>
                      </p>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-bold text-red-600 mb-2">
                        실패한 상품 ({importResult.errors.length}개):
                      </p>
                      <div className="bg-red-50 rounded-lg p-4 max-h-96 overflow-y-auto border border-red-200">
                        <ul className="text-sm text-red-600 space-y-2">
                          {importResult.errors.map((error, index) => (
                            <li
                              key={index}
                              className="p-2 bg-white rounded border border-red-100"
                            >
                              <span className="font-medium">
                                {error.product_name}
                              </span>
                              <span className="text-red-500 ml-2">
                                {error.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-[#ffeef5] rounded-lg">
              <p className="text-sm text-[#8b7d84]">
                {parseResult.products.length}개 상품을 이관할 준비가 되었습니다.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleImport}
              disabled={
                isPending ||
                isImporting ||
                parseResult.products.length === 0 ||
                parseResult.products.some(
                  (p) =>
                    !p.category_slug &&
                    (!p.category_slugs || p.category_slugs.length === 0),
                )
              }
              className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  이관 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  상품 이관 실행
                </>
              )}
            </Button>
            <Link href="/admin/products">
              <Button
                variant="outline"
                className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                취소
              </Button>
            </Link>
          </div>

          {parseResult.products.some(
            (p) =>
              !p.category_slug &&
              (!p.category_slugs || p.category_slugs.length === 0),
          ) && (
            <p className="text-sm text-red-500 mt-2">
              모든 상품의 카테고리를 최소 1개 이상 선택해주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

