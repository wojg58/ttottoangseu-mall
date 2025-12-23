/**
 * @file components/product-detail-tabs.tsx
 * @description 상품 상세 페이지 탭 컴포넌트 (상품 설명, 리뷰, 문의)
 *
 * 주요 기능:
 * 1. 탭 전환 (상품 설명, 리뷰, 문의)
 * 2. 리뷰 목록 표시 및 작성
 * 3. 문의 목록 표시 및 작성
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Star } from "lucide-react";
import { getProductReviews, getProductAverageRating } from "@/actions/reviews";
import { getProductInquiries, getProductInquiryCount } from "@/actions/inquiries";
import type { Review } from "@/actions/reviews";
import type { Inquiry } from "@/actions/inquiries";
import ReviewForm from "@/components/review-form";
import InquiryForm from "@/components/inquiry-form";
import ReviewList from "@/components/review-list";
import InquiryList from "@/components/inquiry-list";

interface ProductDetailTabsProps {
  productId: string;
  productName: string;
  description: string | null;
  detailImages: Array<{ id: string; image_url: string; alt_text: string | null }>;
}

type TabType = "description" | "reviews" | "inquiries";

export default function ProductDetailTabs({
  productId,
  productName,
  description,
  detailImages,
}: ProductDetailTabsProps) {
  const { isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("description");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 리뷰 데이터 로드
  const loadReviews = async () => {
    setIsLoading(true);
    const [reviewsResult, ratingResult] = await Promise.all([
      getProductReviews(productId),
      getProductAverageRating(productId),
    ]);

    if (reviewsResult.success) {
      setReviews(reviewsResult.data);
      setReviewCount(reviewsResult.data.length);
    }
    if (ratingResult.success) {
      setAverageRating(ratingResult.averageRating);
    }
    setIsLoading(false);
  };

  // 문의 데이터 로드
  const loadInquiries = async () => {
    setIsLoading(true);
    const [inquiriesResult, countResult] = await Promise.all([
      getProductInquiries(productId),
      getProductInquiryCount(productId),
    ]);

    if (inquiriesResult.success) {
      setInquiries(inquiriesResult.data);
    }
    if (countResult.success) {
      setInquiryCount(countResult.count);
    }
    setIsLoading(false);
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === "reviews") {
      loadReviews();
    } else if (activeTab === "inquiries") {
      loadInquiries();
    }
  }, [activeTab, productId]);

  const handleReviewSubmit = () => {
    loadReviews();
  };

  const handleInquirySubmit = () => {
    loadInquiries();
  };

  return (
    <section className="mt-12 lg:mt-16">
      <div className="border-b border-[#f5d5e3]">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("description")}
            className={`py-4 ${
              activeTab === "description"
                ? "text-[#ff6b9d] border-b-2 border-[#ff6b9d] font-bold"
                : "text-[#8b7d84] hover:text-[#4a3f48]"
            }`}
          >
            상품 설명
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`py-4 ${
              activeTab === "reviews"
                ? "text-[#ff6b9d] border-b-2 border-[#ff6b9d] font-bold"
                : "text-[#8b7d84] hover:text-[#4a3f48]"
            }`}
          >
            리뷰{reviewCount > 0 && ` (${reviewCount})`}
          </button>
          <button
            onClick={() => setActiveTab("inquiries")}
            className={`py-4 ${
              activeTab === "inquiries"
                ? "text-[#ff6b9d] border-b-2 border-[#ff6b9d] font-bold"
                : "text-[#8b7d84] hover:text-[#4a3f48]"
            }`}
          >
            문의{inquiryCount > 0 && ` (${inquiryCount})`}
          </button>
        </nav>
      </div>

      <div className="py-8">
        {activeTab === "description" && (
          <>
            {description ? (
              <div
                className="product-description prose prose-pink max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-4 [&_img]:block [&_img]:mx-auto [&_p]:text-[#4a3f48] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:mt-0 [&_p]:first:mt-0 [&_p]:last:mb-0 [&_p:empty]:mb-4 [&_p:empty]:min-h-[1rem] [&_br]:block [&_br]:my-2 [&_br+br]:my-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#4a3f48] [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#4a3f48] [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#4a3f48] [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:text-[#4a3f48] [&_li]:mb-2 [&_a]:text-[#ff6b9d] [&_a]:underline [&_a]:hover:text-[#ff5088] [&_div]:mb-4 [&_div]:last:mb-0"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-[#8b7d84] text-center py-8">
                상품 설명이 없습니다.
              </p>
            )}

            {/* 상품 이미지들 (상세 이미지) */}
            {detailImages.length > 0 && (
              <div className="mt-8 space-y-6">
                {detailImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-[#f5f5f5]"
                  >
                    <div className="relative aspect-video w-full">
                      <img
                        src={image.image_url}
                        alt={
                          image.alt_text ||
                          `${productName} 상세 이미지 ${index + 1}`
                        }
                        className="object-contain w-full h-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-6">
            {/* 평균 평점 표시 */}
            {averageRating > 0 && (
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg text-[#4a3f48] font-medium">
                  {averageRating}
                </span>
                <span className="text-sm text-[#8b7d84]">
                  (리뷰 {reviewCount}개)
                </span>
              </div>
            )}

            {/* 리뷰 작성 폼 */}
            {isSignedIn && (
              <ReviewForm
                productId={productId}
                onSuccess={handleReviewSubmit}
              />
            )}

            {/* 리뷰 목록 */}
            {isLoading ? (
              <p className="text-center text-[#8b7d84] py-8">로딩 중...</p>
            ) : (
              <ReviewList reviews={reviews} />
            )}
          </div>
        )}

        {activeTab === "inquiries" && (
          <div className="space-y-6">
            {/* 문의 작성 폼 */}
            <InquiryForm
              productId={productId}
              onSuccess={handleInquirySubmit}
            />

            {/* 문의 목록 */}
            {isLoading ? (
              <p className="text-center text-[#8b7d84] py-8">로딩 중...</p>
            ) : (
              <InquiryList inquiries={inquiries} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

