/**
 * @file lib/utils/import-products.ts
 * @description 스마트스토어 상품 데이터 이관 유틸리티
 *
 * 주요 기능:
 * 1. CSV 파일 파싱
 * 2. 엑셀 파일 파싱
 * 3. 상품 데이터 검증 및 변환
 * 4. 카테고리 매핑
 * 5. 이미지 URL 파싱
 * 6. 옵션 정보 파싱
 *
 * @dependencies
 * - papaparse: CSV 파싱
 * - xlsx: 엑셀 파싱
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Category } from "@/types/database";

// CSV/엑셀 파일에서 읽어올 상품 데이터 타입 (스마트스토어 형식)
export interface SmartStoreProductRow {
  // 기본 정보
  상품명?: string;
  상품코드?: string;
  상품URL?: string;
  카테고리?: string;
  판매가?: string | number;
  할인가?: string | number;
  재고?: string | number;
  재고수량?: string | number; // 스마트스토어 CSV 컬럼명
  상태?: string; // 판매중, 판매중지, 품절 등
  판매상태?: string; // 스마트스토어 CSV 컬럼명 (판매중, 판매중지, 품절 등)

  // 상세 정보
  상품설명?: string;
  이미지URL?: string; // 콤마로 구분된 여러 URL
  대표이미지?: string;
  "대표이미지 URL"?: string; // 스마트스토어 CSV 컬럼명

  // 옵션 정보
  옵션명?: string; // 예: "색상", "사이즈"
  옵션값?: string; // 예: "빨강,파랑,노랑" 또는 "S,M,L"
  옵션재고?: string; // 콤마로 구분된 재고 수량
  옵션가격조정?: string; // 콤마로 구분된 가격 조정값

  // 기타
  베스트상품?: string | boolean;
  신상품?: string | boolean;
  메모?: string;
}

// 변환된 상품 데이터 타입
export interface ParsedProductData {
  // 기본 정보
  name: string;
  slug: string;
  category_slug?: string; // 카테고리 매핑용
  price: number;
  discount_price: number | null;
  stock: number;
  status: "active" | "hidden" | "sold_out";
  description: string | null;

  // 이미지
  image_urls: string[]; // 이미지 URL 배열

  // 옵션
  variants?: Array<{
    variant_name: string;
    variant_value: string;
    stock: number;
    price_adjustment: number;
    sku?: string | null;
  }>;

  // 플래그
  is_featured: boolean;
  is_new: boolean;

  // 원본 데이터 (에러 추적용)
  raw_data?: SmartStoreProductRow;
  row_number?: number;
}

// 파싱 결과 타입
export interface ParseResult {
  success: boolean;
  products: ParsedProductData[];
  errors: Array<{
    row: number;
    message: string;
    data?: SmartStoreProductRow;
  }>;
  warnings: Array<{
    row: number;
    message: string;
    data?: SmartStoreProductRow;
  }>;
}

/**
 * CSV 파일 파싱
 */
export async function parseCSVFile(
  file: File,
  categoryMap?: Map<string, string>, // 스마트스토어 카테고리 -> 자사몰 카테고리 slug 매핑
): Promise<ParseResult> {
  console.group("[parseCSVFile] CSV 파일 파싱 시작");
  console.log("파일명:", file.name);
  console.log("파일 크기:", file.size, "bytes");

  return new Promise((resolve) => {
    Papa.parse<SmartStoreProductRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        console.log("CSV 파싱 완료:", results.data.length, "행");
        const parseResult = convertToProductData(results.data, categoryMap);
        console.log("변환 완료:", parseResult.products.length, "개 상품");
        console.groupEnd();
        resolve(parseResult);
      },
      error: (error) => {
        console.error("CSV 파싱 에러:", error);
        console.groupEnd();
        resolve({
          success: false,
          products: [],
          errors: [{ row: 0, message: `CSV 파싱 실패: ${error.message}` }],
          warnings: [],
        });
      },
    });
  });
}

/**
 * 엑셀 파일 파싱
 */
export async function parseExcelFile(
  file: File,
  categoryMap?: Map<string, string>,
): Promise<ParseResult> {
  console.group("[parseExcelFile] 엑셀 파일 파싱 시작");
  console.log("파일명:", file.name);
  console.log("파일 크기:", file.size, "bytes");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // 첫 번째 시트 사용
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json<SmartStoreProductRow>(worksheet, {
      defval: "", // 빈 셀은 빈 문자열로
    });

    console.log("엑셀 파싱 완료:", jsonData.length, "행");
    const parseResult = convertToProductData(jsonData, categoryMap);
    console.log("변환 완료:", parseResult.products.length, "개 상품");
    console.groupEnd();

    return parseResult;
  } catch (error) {
    console.error("엑셀 파싱 에러:", error);
    console.groupEnd();
    return {
      success: false,
      products: [],
      errors: [
        {
          row: 0,
          message: `엑셀 파싱 실패: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * 스마트스토어 데이터를 상품 데이터로 변환
 */
function convertToProductData(
  rows: SmartStoreProductRow[],
  categoryMap?: Map<string, string>,
): ParseResult {
  const products: ParsedProductData[] = [];
  const errors: ParseResult["errors"] = [];
  const warnings: ParseResult["warnings"] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // 헤더 행 제외 (1-based, 헤더가 1행)

    try {
      // 필수 필드 검증
      if (!row.상품명 || row.상품명.trim() === "") {
        errors.push({
          row: rowNumber,
          message: "상품명이 없습니다.",
          data: row,
        });
        return;
      }

      // 상품명
      const name = row.상품명.trim();

      // slug 생성 (상품명 기반)
      const slug = generateSlug(name, row.상품코드);

      // 가격 파싱
      const price = parseNumber(row.판매가, "판매가", rowNumber, errors, row);
      if (price === null) return;

      const discountPrice = row.할인가
        ? parseNumber(row.할인가, "할인가", rowNumber, errors, row)
        : null;

      if (discountPrice !== null && discountPrice >= price) {
        warnings.push({
          row: rowNumber,
          message: "할인가가 판매가보다 크거나 같습니다. 할인가를 무시합니다.",
          data: row,
        });
      }

      // 재고 파싱 (재고 또는 재고수량 필드 지원)
      const stockValue = row.재고 ?? row.재고수량;
      const stock = parseNumber(stockValue, "재고", rowNumber, errors, row, 0);
      if (stock === null) return;

      // 상태 변환 (상태 또는 판매상태 필드 지원)
      const statusValue = row.상태 ?? row.판매상태;
      const status = parseStatus(statusValue, stock);

      // 카테고리 매핑
      const categorySlug = row.카테고리
        ? categoryMap?.get(row.카테고리.trim()) ||
          row.카테고리.trim().toLowerCase()
        : undefined;

      if (!categorySlug) {
        warnings.push({
          row: rowNumber,
          message:
            "카테고리가 지정되지 않았습니다. 기본 카테고리를 사용합니다.",
          data: row,
        });
      }

      // 이미지 URL 파싱
      const imageUrls = parseImageUrls(row);

      if (imageUrls.length === 0) {
        warnings.push({
          row: rowNumber,
          message: "이미지가 없습니다.",
          data: row,
        });
      }

      // 옵션 파싱
      const variants = parseVariants(row, rowNumber, warnings);

      // 플래그
      const isFeatured = parseBoolean(row.베스트상품);
      const isNew = parseBoolean(row.신상품);

      products.push({
        name,
        slug,
        category_slug: categorySlug,
        price,
        discount_price:
          discountPrice && discountPrice < price ? discountPrice : null,
        stock,
        status,
        description: row.상품설명?.trim() || null,
        image_urls: imageUrls,
        variants: variants.length > 0 ? variants : undefined,
        is_featured: isFeatured,
        is_new: isNew,
        raw_data: row,
        row_number: rowNumber,
      });
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: `데이터 변환 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
        data: row,
      });
    }
  });

  return {
    success: errors.length === 0,
    products,
    errors,
    warnings,
  };
}

/**
 * 숫자 파싱 헬퍼
 */
function parseNumber(
  value: string | number | undefined,
  fieldName: string,
  rowNumber: number,
  errors: ParseResult["errors"],
  row: SmartStoreProductRow,
  defaultValue?: number,
): number | null {
  if (value === undefined || value === null || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    errors.push({
      row: rowNumber,
      message: `${fieldName}이(가) 없습니다.`,
      data: row,
    });
    return null;
  }

  if (typeof value === "number") {
    return value >= 0 ? value : 0;
  }

  // 문자열에서 숫자 추출 (콤마, 공백 제거)
  const cleaned = String(value).replace(/[,\s]/g, "");
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    errors.push({
      row: rowNumber,
      message: `${fieldName}이(가) 올바른 숫자가 아닙니다: ${value}`,
      data: row,
    });
    return null;
  }

  return parsed >= 0 ? parsed : 0;
}

/**
 * 상태 파싱
 */
function parseStatus(
  status: string | undefined,
  stock: number,
): "active" | "hidden" | "sold_out" {
  if (!status) {
    return stock > 0 ? "active" : "sold_out";
  }

  const statusLower = status.toLowerCase().trim();

  if (statusLower.includes("판매중") || statusLower.includes("active")) {
    return stock > 0 ? "active" : "sold_out";
  }

  if (statusLower.includes("판매중지") || statusLower.includes("hidden")) {
    return "hidden";
  }

  if (statusLower.includes("품절") || statusLower.includes("sold_out")) {
    return "sold_out";
  }

  return stock > 0 ? "active" : "sold_out";
}

/**
 * 이미지 URL 파싱
 */
function parseImageUrls(row: SmartStoreProductRow): string[] {
  const urls: string[] = [];

  // 대표 이미지 우선 (대표이미지 또는 대표이미지 URL 필드 지원)
  const primaryImage = row.대표이미지 || row["대표이미지 URL"];
  if (primaryImage && primaryImage.trim()) {
    urls.push(primaryImage.trim());
  }

  // 이미지 URL (콤마로 구분)
  if (row.이미지URL && row.이미지URL.trim()) {
    const imageUrls = row.이미지URL
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && url !== primaryImage?.trim());

    urls.push(...imageUrls);
  }

  return urls;
}

/**
 * 옵션 파싱
 */
function parseVariants(
  row: SmartStoreProductRow,
  rowNumber: number,
  warnings: ParseResult["warnings"],
): ParsedProductData["variants"] {
  if (!row.옵션명 || !row.옵션값) {
    return [];
  }

  const variantName = row.옵션명.trim();
  const variantValues = row.옵션값
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  if (variantValues.length === 0) {
    return [];
  }

  // 옵션 재고 파싱
  const optionStocks = row.옵션재고
    ? row.옵션재고.split(",").map((s) => {
        const cleaned = s.trim().replace(/[,\s]/g, "");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      })
    : variantValues.map(() => 0);

  // 옵션 가격 조정 파싱
  const optionPriceAdjustments = row.옵션가격조정
    ? row.옵션가격조정.split(",").map((p) => {
        const cleaned = p.trim().replace(/[,\s]/g, "");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      })
    : variantValues.map(() => 0);

  // 재고와 가격 조정 배열 길이 맞추기
  while (optionStocks.length < variantValues.length) {
    optionStocks.push(0);
  }

  while (optionPriceAdjustments.length < variantValues.length) {
    optionPriceAdjustments.push(0);
  }

  const variants: ParsedProductData["variants"] = [];

  variantValues.forEach((value, index) => {
    variants.push({
      variant_name: variantName,
      variant_value: value,
      stock: optionStocks[index] || 0,
      price_adjustment: optionPriceAdjustments[index] || 0,
      sku: row.상품코드 ? `${row.상품코드}-${value}` : null,
    });
  });

  return variants;
}

/**
 * Boolean 파싱
 */
function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (!value) {
    return false;
  }

  const lower = String(value).toLowerCase().trim();
  return (
    lower === "true" ||
    lower === "1" ||
    lower === "예" ||
    lower === "y" ||
    lower === "yes"
  );
}

/**
 * Slug 생성
 */
function generateSlug(name: string, productCode?: string): string {
  // 상품명 기반 slug 생성
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "") // 특수문자 제거
    .replace(/\s+/g, "-") // 공백을 하이픈으로
    .replace(/-+/g, "-") // 연속된 하이픈 제거
    .replace(/^-|-$/g, ""); // 앞뒤 하이픈 제거

  // 한글이 있으면 제거하고 영문/숫자만 사용
  slug = slug.replace(/[가-힣]/g, "");

  // slug가 비어있으면 상품코드 사용
  if (!slug && productCode) {
    slug = productCode.toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  // 여전히 비어있으면 타임스탬프 사용
  if (!slug) {
    slug = `product-${Date.now()}`;
  }

  return slug;
}

/**
 * 카테고리 매핑 맵 생성 (카테고리 목록에서)
 */
export function createCategoryMap(
  categories: Category[],
  mappingRules?: Array<{ smartStore: string; ourStore: string }>,
): Map<string, string> {
  const map = new Map<string, string>();

  // 매핑 규칙 적용
  if (mappingRules) {
    mappingRules.forEach((rule) => {
      map.set(rule.smartStore, rule.ourStore);
    });
  }

  // 카테고리 목록에서 자동 매핑 (slug 기준)
  categories.forEach((category) => {
    // 카테고리 이름으로도 매핑
    map.set(category.name, category.slug);
    map.set(category.slug, category.slug);
  });

  return map;
}

/**
 * 파일 확장자로 파서 선택
 */
export function parseProductFile(
  file: File,
  categoryMap?: Map<string, string>,
): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf(".") + 1);

  console.log("[parseProductFile] 파일 파싱:", file.name, "확장자:", extension);

  if (extension === "csv") {
    return parseCSVFile(file, categoryMap);
  } else if (extension === "xlsx" || extension === "xls") {
    return parseExcelFile(file, categoryMap);
  } else {
    return Promise.resolve({
      success: false,
      products: [],
      errors: [
        {
          row: 0,
          message: `지원하지 않는 파일 형식입니다: ${extension}. CSV 또는 Excel 파일을 사용해주세요.`,
        },
      ],
      warnings: [],
    });
  }
}
