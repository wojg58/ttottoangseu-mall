/**
 * @file components/review-list.tsx
 * @description 리뷰 목록 컴포넌트
 */

"use client";

import { Star } from "lucide-react";
import type { Review } from "@/actions/reviews";

interface ReviewListProps {
  reviews: Review[];
}

export default function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8b7d84]">아직 작성된 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="border border-[#f5d5e3] rounded-xl p-6 bg-white"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-[#4a3f48]">
                {review.user?.name || "익명"}
              </span>
            </div>
            <span className="text-xs text-[#8b7d84]">
              {new Date(review.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <p className="text-[#4a3f48] whitespace-pre-wrap">
            {review.content}
          </p>
          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 mt-4">
              {review.images.map((imageUrl, index) => (
                <img
                  key={index}
                  src={imageUrl}
                  alt={`리뷰 이미지 ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

