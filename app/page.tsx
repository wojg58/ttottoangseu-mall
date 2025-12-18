/**
 * @file app/page.tsx
 * @description 또또앙스 쇼핑몰 홈페이지
 *
 * 주요 기능:
 * 1. 메인 배너 / 히어로 섹션
 * 2. 베스트 상품 섹션
 * 3. 신상품 섹션
 * 4. 카테고리 섹션
 *
 * @dependencies
 * - Supabase: 상품 데이터 fetching
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, TrendingUp, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product-card";
import AllProductsSection from "@/components/all-products-section";
import EventBanner from "@/components/event-banner";
import WallpaperPreview from "@/components/WallpaperPreview";
import type { ProductListItem, Category } from "@/types/database";

// 카테고리별 이모지 매핑
const CATEGORY_EMOJI: Record<string, string> = {
  sanrio: "❤️",
  character: "🧡",
  "phone-strap": "💛",
  keyring: "💚",
  fashion: "💙",
  bear: "🤎",
  stationery: "💜",
};

// 상품 데이터 가져오기 (서버 컴포넌트에서 실행)
async function getProducts() {
  console.log("[HomePage] 상품 데이터 fetching 시작");

  const supabase = await createClient();

  // 베스트 상품 (지정된 5개 상품을 번호순으로 표시)
  const bestProductNames = [
    "산리오 헬로키티 블랙엔젤 스타일업 롱다리 마스코트 인형 키링 그레이 드레스",
    "산리오 헬로키티 판타지 스타일업 시리즈 롱다리 태닝 코갸류 마스코트 인형 키링",
    "유키오 마스코트 인형 키링",
    "모프샌드 산리오 마스코트 인형 키링 귀여운 가방 장식 열쇠고리",
    "ttotto_pr_069 먼작귀 치이카와 프렌즈 피규어 4 반다이 가챠 굿즈",
  ];

  // 모든 활성 상품 가져오기 (베스트 상품 매칭용)
  const { data: allProductsForBest, error: bestError } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `,
    )
    .eq("status", "active")
    .is("deleted_at", null);

  // 지정된 상품명과 매칭하여 순서대로 정렬
  let featuredProducts: typeof allProductsForBest = [];
  if (allProductsForBest && allProductsForBest.length > 0) {
    // 상품명 정규화 함수
    const normalize = (str: string): string => {
      return str.trim().replace(/\s+/g, " ").replace(/[&]/g, "&").toLowerCase();
    };

    // 상품명 매칭 함수 (정확한 매칭 우선)
    const matchProduct = (productName: string, targetName: string): number => {
      const normalizedProduct = normalize(productName);
      const normalizedTarget = normalize(targetName);

      // 1. 완전 일치 (최우선)
      if (normalizedProduct === normalizedTarget) {
        return 100;
      }

      // 2. 공백 제거 후 완전 일치
      const noSpaceProduct = normalizedProduct.replace(/\s+/g, "");
      const noSpaceTarget = normalizedTarget.replace(/\s+/g, "");
      if (noSpaceProduct === noSpaceTarget) {
        return 95;
      }

      // 3. 한쪽이 다른 쪽을 포함하는 경우
      if (normalizedProduct.includes(normalizedTarget)) {
        return 80;
      }
      if (normalizedTarget.includes(normalizedProduct)) {
        return 80;
      }

      // 4. 주요 키워드 매칭 점수 계산
      const targetWords = normalizedTarget
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 1 &&
            !["산리오", "헬로키티", "마스코트", "인형", "키링"].includes(word),
        );

      if (targetWords.length > 0) {
        const matchedWords = targetWords.filter((word) =>
          normalizedProduct.includes(word),
        );
        const matchRatio = matchedWords.length / targetWords.length;

        if (matchRatio >= 0.8) {
          return 70 + matchRatio * 10;
        }
        if (matchRatio >= 0.6) {
          return 50 + matchRatio * 10;
        }
      }

      // 5. 공통 단어 개수 기반 점수
      const productWords = new Set(normalizedProduct.split(/\s+/));
      const targetWordsSet = new Set(normalizedTarget.split(/\s+/));
      const commonWords = [...productWords].filter((word) =>
        targetWordsSet.has(word),
      );
      const commonRatio =
        commonWords.length / Math.max(productWords.size, targetWordsSet.size);

      return commonRatio * 40;
    };

    // 지정된 순서대로 상품 찾기
    featuredProducts = bestProductNames
      .map((targetName, index) => {
        const scoredProducts = allProductsForBest
          .map((product) => {
            const productName = (product as { name: string }).name || "";
            const score = matchProduct(productName, targetName);
            return { product, score, productName };
          })
          .filter((item) => item.score >= 50)
          .sort((a, b) => b.score - a.score);

        const bestMatch = scoredProducts[0];

        if (bestMatch && bestMatch.score >= 50) {
          console.log(
            `[HomePage] 베스트 상품 ${
              index + 1
            }번 매칭 (점수: ${bestMatch.score.toFixed(1)}):`,
            {
              target: targetName,
              found: bestMatch.productName,
              slug: (bestMatch.product as { slug: string }).slug,
            },
          );
          return bestMatch.product;
        } else {
          console.warn(`[HomePage] 베스트 상품 ${index + 1}번 매칭 실패:`, {
            target: targetName,
            candidates: scoredProducts.slice(0, 3).map((p) => ({
              name: p.productName,
              score: p.score.toFixed(1),
            })),
          });
          return null;
        }
      })
      .filter(
        (product): product is NonNullable<typeof product> => product !== null,
      );

    console.log("[HomePage] 베스트 상품 필터링 결과:", {
      total: allProductsForBest.length,
      matched: featuredProducts.length,
      expected: bestProductNames.length,
    });
  }

  if (bestError) {
    console.error("[HomePage] 베스트 상품 fetch 에러:", bestError);
  }

  // 전체상품 (지정된 22개 상품을 번호순으로 표시)
  // 지정된 상품명 목록 (1번부터 22번까지)
  const targetProductNames = [
    "산리오 헬로키티 고고걸 갸류 스타일업 마스코트 호피 태닝 롱다리 인형 키링",
    "산리오 헬로키티 MC컬렉션 마스코트 스탠다드 인형 키링",
    "산리오 헬로키티 MC컬렉션 마스코트 바니 토끼 인형 키링",
    "산리오 MC컬렉션 마스코트 머메이드 인어 인형 키링",
    "산리오 헬로키티 MC컬렉션 마스코트 애니멀 호피 인형 키링",
    "산리오 헬로키티 MC컬렉션 마스코트 타이니참 인형 키링",
    "산리오 헬로키티 MC컬렉션 마스코트 베이비 아기 인형 키링 키홀더",
    "산리오 헬로키티 블랙엔젤 마스코트 인형 키링 실버",
    "산리오 헬로키티 블랙엔젤 하트 카라비너 마스코트 인형 키링 그레이",
    "산리오 헬로키티 판타지 마스코트 태닝 머메이드 인어 키링",
    "산리오 헬로키티 판타지 요정 마스코트 홀더 하트 카라비너 인형 키링",
    "헬로키티 블랙엔젤 퀼팅 하트 파우치 동전지갑 실버",
    "헬로키티&타이니참 나카요시 마스코트 파우치 세트",
    "산리오 헬로키티 90s 고고걸 갸류 글리터 반짝이 파우치",
    "헬로키티 포치비 실리콘 동전지갑 키링 똑딱이 레드 민트 미니 파우치",
    "키티 한교동 카피바라 피그 팬더 동물 털 파우치 겨울 퍼 화장품 파우치 필통",
    "반다이 배스킨라빈스 아이스크림 키링 2탄",
    "산리오 헬로키티 십이간지 띠별 동물 신년 운세 봅기 피규어",
    "K푸드 미니어처 간식 초코 과자 봉지 가방꾸미기 열쇠고리 키링",
    "치이카와 인테리어 미니 피규어 2탄 먼작귀 가차 미니어처",
    "ttotto_pr_90 반다이 짱구 키구루미즈 크레용 신짱 플로키 미니 피규어 8종",
    "ttotto_pr_84 모프샌드 에비냥 새우냥 피규어 키링 가챠 mofusand 새우튀김 캡슐토이",
  ];

  // 모든 활성 상품 가져오기
  const { data: allProductsRaw, error: allError } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `,
    )
    .eq("status", "active")
    .is("deleted_at", null);

  // 지정된 상품명과 매칭하여 순서대로 정렬
  let allProducts: typeof allProductsRaw = [];
  if (allProductsRaw && allProductsRaw.length > 0) {
    // 상품명 정규화 함수 (공백, 특수문자 정리)
    const normalize = (str: string): string => {
      return str
        .trim()
        .replace(/\s+/g, " ") // 여러 공백을 하나로
        .replace(/[&]/g, "&") // & 기호 유지
        .toLowerCase();
    };

    // 상품명 매칭 함수 (정확한 매칭 우선)
    const matchProduct = (productName: string, targetName: string): number => {
      const normalizedProduct = normalize(productName);
      const normalizedTarget = normalize(targetName);

      // 1. 완전 일치 (최우선)
      if (normalizedProduct === normalizedTarget) {
        return 100;
      }

      // 2. 공백 제거 후 완전 일치
      const noSpaceProduct = normalizedProduct.replace(/\s+/g, "");
      const noSpaceTarget = normalizedTarget.replace(/\s+/g, "");
      if (noSpaceProduct === noSpaceTarget) {
        return 95;
      }

      // 3. 한쪽이 다른 쪽을 포함하는 경우
      if (normalizedProduct.includes(normalizedTarget)) {
        return 80;
      }
      if (normalizedTarget.includes(normalizedProduct)) {
        return 80;
      }

      // 4. 주요 키워드 매칭 점수 계산
      const targetWords = normalizedTarget
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 1 &&
            !["산리오", "헬로키티", "마스코트", "인형", "키링"].includes(word),
        );

      if (targetWords.length > 0) {
        const matchedWords = targetWords.filter((word) =>
          normalizedProduct.includes(word),
        );
        const matchRatio = matchedWords.length / targetWords.length;

        // 주요 키워드가 모두 포함되면 높은 점수
        if (matchRatio >= 0.8) {
          return 70 + matchRatio * 10;
        }
        if (matchRatio >= 0.6) {
          return 50 + matchRatio * 10;
        }
      }

      // 5. 공통 단어 개수 기반 점수
      const productWords = new Set(normalizedProduct.split(/\s+/));
      const targetWordsSet = new Set(normalizedTarget.split(/\s+/));
      const commonWords = [...productWords].filter((word) =>
        targetWordsSet.has(word),
      );
      const commonRatio =
        commonWords.length / Math.max(productWords.size, targetWordsSet.size);

      return commonRatio * 40;
    };

    // 지정된 순서대로 상품 찾기 (가장 높은 점수의 상품 선택)
    allProducts = targetProductNames
      .map((targetName, index) => {
        // 모든 상품에 대해 매칭 점수 계산
        const scoredProducts = allProductsRaw
          .map((product) => {
            const productName = (product as { name: string }).name || "";
            const score = matchProduct(productName, targetName);
            return { product, score, productName };
          })
          .filter((item) => item.score >= 50) // 최소 50점 이상만 고려
          .sort((a, b) => b.score - a.score); // 점수 높은 순으로 정렬

        const bestMatch = scoredProducts[0];

        if (bestMatch && bestMatch.score >= 50) {
          console.log(
            `[HomePage] 상품 ${
              index + 1
            }번 매칭 (점수: ${bestMatch.score.toFixed(1)}):`,
            {
              target: targetName,
              found: bestMatch.productName,
              slug: (bestMatch.product as { slug: string }).slug,
            },
          );
          return bestMatch.product;
        } else {
          console.warn(`[HomePage] 상품 ${index + 1}번 매칭 실패:`, {
            target: targetName,
            candidates: scoredProducts.slice(0, 3).map((p) => ({
              name: p.productName,
              score: p.score.toFixed(1),
            })),
          });
          return null;
        }
      })
      .filter(
        (product): product is NonNullable<typeof product> => product !== null,
      );

    console.log("[HomePage] 전체상품 필터링 결과:", {
      total: allProductsRaw.length,
      matched: allProducts.length,
      expected: targetProductNames.length,
      missing: targetProductNames.length - allProducts.length,
    });
  }

  if (allError) {
    console.error("[HomePage] 전체상품 fetch 에러:", allError);
  }

  // 카테고리 목록
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (categoryError) {
    console.error("[HomePage] 카테고리 fetch 에러:", categoryError);
  }

  console.log("[HomePage] 데이터 fetching 완료:", {
    featuredCount: featuredProducts?.length ?? 0,
    allCount: allProducts?.length ?? 0,
    categoryCount: categories?.length ?? 0,
  });

  // 데이터 변환
  const transformProduct = (product: unknown): ProductListItem => {
    const p = product as {
      id: string;
      category_id: string;
      name: string;
      slug: string;
      price: number;
      discount_price: number | null;
      description: string | null;
      status: "active" | "hidden" | "sold_out";
      stock: number;
      is_featured: boolean;
      is_new: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      category: { id: string; name: string; slug: string };
      images: Array<{
        id: string;
        image_url: string;
        is_primary: boolean;
        alt_text: string | null;
      }>;
    };

    const primaryImage =
      p.images?.find((img) => img.is_primary) || p.images?.[0] || null;

    return {
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      discount_price: p.discount_price,
      description: p.description,
      status: p.status,
      stock: p.stock,
      is_featured: p.is_featured,
      is_new: p.is_new,
      deleted_at: p.deleted_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
      category: p.category,
      primary_image: primaryImage
        ? {
            id: primaryImage.id,
            product_id: p.id,
            image_url: primaryImage.image_url,
            is_primary: primaryImage.is_primary,
            sort_order: 0,
            alt_text: primaryImage.alt_text,
            created_at: p.created_at,
          }
        : null,
    };
  };

  return {
    featuredProducts: (featuredProducts || []).map(transformProduct),
    allProducts: (allProducts || []).map(transformProduct),
    categories: (categories || []) as Category[],
  };
}

export default async function HomePage() {
  const { featuredProducts, allProducts } = await getProducts();

  return (
    <main
      className="pb-16 relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: "url('/f.jpg')",
      }}
    >
      {/* 배경 오버레이 (텍스트 가독성을 위해) */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] pointer-events-none"></div>
      <div className="relative z-10">
        {/* 히어로 배너 + 카테고리 섹션 */}
        <section className="relative py-12 md:py-20">
          <div className="shop-container">
            {/* 히어로 배너 */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-16">
              <div
                className="flex-1 text-center md:text-left"
                style={{ width: "700px", maxWidth: "700px", minWidth: "700px" }}
              >
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-white) 60%, transparent)",
                  }}
                >
                  <Sparkles className="w-4 h-4 text-[#ff6b9d]" />
                  <span className="text-[18px] text-black font-medium">
                    귀여운 정품 캐릭터 키덜트 소품샵
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-bold text-[#4a3f48] mb-4 leading-tight">
                  두근거리는 설렘을{" "}
                  <span className="text-[#ff6b9d]">선물하세요</span> 💕
                </h1>
                <p
                  className="text-[#4a3f48] mb-6 text-lg"
                  style={{
                    fontFamily:
                      "'NamyangjuGothic', 'Gowun Dodum', system-ui, sans-serif",
                  }}
                >
                  산리오, 짱구, 유키오 등 사랑스러운 캐릭터 굿즈를 만나보세요.
                  <br />
                  인형 키링, 파우치, 완구, 스티커 등 다양한 아이템이 가득!
                </p>
              </div>
              <div className="flex-1 relative">
                <div
                  className="relative w-[600px] h-[600px] mx-auto"
                  style={{ marginLeft: "-100px" }}
                >
                  {/* 장식적인 원들 */}
                  <div
                    className="absolute w-32 h-32 bg-[#ff6b9d]/20 rounded-full"
                    style={{
                      left: "50%",
                      top: "50%",
                      transform:
                        "translate(calc(50% - 300px), calc(50% + 70px))",
                    }}
                  />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src="/kity.png"
                      alt="또또앙스"
                      width={600}
                      height={600}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 이벤트 배너 */}
          <EventBanner />
        </section>

        {/* 베스트 상품 섹션 */}
        <section className="py-12 bg-white/70 relative overflow-hidden">
          {/* 장식용 원형 요소 */}
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/30 rounded-full"></div>
          <div className="shop-container">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 bg-[#FFEB3B] rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#F57F17]" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-[#ff6b9d]">
                    베스트 상품
                  </h2>
                  <p className="text-sm text-pink-500">가장 인기있는 상품들</p>
                </div>
              </div>
              <Link
                href="/products?featured=true"
                className="text-[#ff6b9d] hover:text-pink-600 hover:underline text-sm flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
                {featuredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    rank={index + 1}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#ffeef5] rounded-xl">
                <span className="text-4xl mb-4 block">🎀</span>
                <p className="text-[#8b7d84]">베스트 상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 전체상품 섹션 */}
        <section className="py-12 bg-white">
          <div className="shop-container">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 bg-[#FFEB3B] rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#ff6b9d]" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-[#ff6b9d]">
                    전체상품
                  </h2>
                  <p className="text-sm text-pink-500">
                    모든 상품을 확인하세요
                  </p>
                </div>
              </div>
              <Link
                href="/products"
                className="text-[#ff6b9d] hover:text-pink-600 hover:underline text-sm flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {allProducts.length > 0 ? (
              <AllProductsSection initialProducts={allProducts} />
            ) : (
              <div className="text-center py-12 bg-white rounded-xl">
                <span className="text-4xl mb-4 block">✨</span>
                <p className="text-black">상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 브랜드 스토리 배너 */}
        <section className="w-full py-16">
          <div className="w-full max-w-[1216px] mx-auto px-4">
            <WallpaperPreview
              src="/image/calendar_mobile_02.png"
              bgSrc="/image/calendar_main.png"
              pcSrc="/image/calendar_01.png"
              alt="1월 캘린더 배경화면"
              title="1월 배경화면"
              description="스마트폰/PC에 저장해서 예쁘게 써보세요 💗"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
