/**
 * @file components/admin/support-tabs.tsx
 * @description 리뷰/문의 탭 컴포넌트
 *
 * 주요 기능:
 * 1. 문의 탭 (미답변 필터, 답변 작성)
 * 2. 리뷰 탭 (리뷰 목록)
 *
 * @dependencies
 * - actions/admin: answerInquiry
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Star,
  Search,
  CheckCircle2,
  Clock,
  Lock,
  Trash2,
} from "lucide-react";
import type { AdminInquiry, AdminReview } from "@/actions/admin";
import { answerInquiry, deleteInquiry, deleteReview, deleteInquiries } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import DateDisplay from "@/components/date-display";
import logger from "@/lib/logger-client";

interface SupportTabsProps {
  activeTab: string;
  inquiries: AdminInquiry[];
  inquiriesTotal: number;
  inquiriesTotalPages: number;
  reviews: AdminReview[];
  reviewsTotal: number;
  reviewsTotalPages: number;
  currentPage: number;
  status?: string;
  searchQuery?: string;
}

export default function SupportTabs({
  activeTab,
  inquiries,
  inquiriesTotal,
  inquiriesTotalPages,
  reviews,
  reviewsTotal,
  reviewsTotalPages,
  currentPage,
  status,
  searchQuery: initialSearchQuery,
}: SupportTabsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || "");
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null);
  const [selectedInquiries, setSelectedInquiries] = useState<Set<string>>(new Set());

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    params.set("page", "1");
    router.push(`/admin/support?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (status) {
      params.set("status", status);
    }
    params.set("page", "1");
    router.push(`/admin/support?${params.toString()}`);
  };

  const handleStatusFilter = (newStatus: string | undefined) => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (newStatus) {
      params.set("status", newStatus);
    }
    params.set("page", "1");
    router.push(`/admin/support?${params.toString()}`);
  };

  const handleAnswerChange = (inquiryId: string, value: string) => {
    setAnswerTexts((prev) => ({
      ...prev,
      [inquiryId]: value,
    }));
  };

  const handleSubmitAnswer = async (inquiryId: string) => {
    const answer = answerTexts[inquiryId]?.trim();
    if (!answer) {
      alert("답변 내용을 입력해주세요.");
      return;
    }

    logger.group("[SupportTabs] 문의 답변 등록");
    logger.info("[SupportTabs] 문의 ID:", inquiryId);

    startTransition(async () => {
      const result = await answerInquiry(inquiryId, answer);

      if (result.success) {
        logger.info("[SupportTabs] ✅ 답변 등록 성공");
        setAnswerTexts((prev) => {
          const newState = { ...prev };
          delete newState[inquiryId];
          return newState;
        });
        setExpandedInquiry(null);
        router.refresh();
      } else {
        logger.error("[SupportTabs] ❌ 답변 등록 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleDeleteInquiry = (inquiryId: string) => {
    if (!confirm("이 문의를 삭제할까요? 삭제 후 복구할 수 없습니다.")) {
      return;
    }

    logger.group("[SupportTabs] 문의 삭제");
    logger.info("[SupportTabs] 문의 ID:", inquiryId);

    startTransition(async () => {
      const result = await deleteInquiry(inquiryId);

      if (result.success) {
        logger.info("[SupportTabs] ✅ 문의 삭제 성공");
        router.refresh();
      } else {
        logger.error("[SupportTabs] ❌ 문의 삭제 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleDeleteReview = (reviewId: string) => {
    if (!confirm("이 리뷰를 삭제할까요? 삭제 후 복구할 수 없습니다.")) {
      return;
    }

    logger.group("[SupportTabs] 리뷰 삭제");
    logger.info("[SupportTabs] 리뷰 ID:", reviewId);

    startTransition(async () => {
      const result = await deleteReview(reviewId);

      if (result.success) {
        logger.info("[SupportTabs] ✅ 리뷰 삭제 성공");
        router.refresh();
      } else {
        logger.error("[SupportTabs] ❌ 리뷰 삭제 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleToggleInquirySelection = (inquiryId: string) => {
    setSelectedInquiries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(inquiryId)) {
        newSet.delete(inquiryId);
      } else {
        newSet.add(inquiryId);
      }
      return newSet;
    });
  };

  const handleSelectAllInquiries = () => {
    if (selectedInquiries.size === inquiries.length) {
      setSelectedInquiries(new Set());
    } else {
      setSelectedInquiries(new Set(inquiries.map((i) => i.id)));
    }
  };

  const handleBulkDeleteInquiries = () => {
    if (selectedInquiries.size === 0) {
      alert("삭제할 문의를 선택해주세요.");
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedInquiries.size}개의 문의를 삭제할까요? 삭제 후 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    logger.group("[SupportTabs] 문의 일괄 삭제");
    logger.info("[SupportTabs] 삭제할 문의 개수:", selectedInquiries.size);

    startTransition(async () => {
      const result = await deleteInquiries(Array.from(selectedInquiries));

      if (result.success) {
        logger.info("[SupportTabs] ✅ 문의 일괄 삭제 성공", {
          deletedCount: result.deletedCount,
        });
        setSelectedInquiries(new Set());
        router.refresh();
        alert(result.message);
      } else {
        logger.error("[SupportTabs] ❌ 문의 일괄 삭제 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-2">
        <button
          onClick={() => handleTabChange("inquiries")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "inquiries"
              ? "bg-[#ff6b9d] text-white"
              : "text-[#4a3f48] hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            문의 ({inquiriesTotal})
          </div>
        </button>
        <button
          onClick={() => handleTabChange("reviews")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "reviews"
              ? "bg-[#ff6b9d] text-white"
              : "text-[#4a3f48] hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Star className="w-4 h-4" />
            리뷰 ({reviewsTotal})
          </div>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b7d84]" />
              <Input
                type="text"
                placeholder={
                  activeTab === "inquiries"
                    ? "상품명, 제목, 내용으로 검색..."
                    : "상품명, 내용으로 검색..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
              />
            </div>
            <Button
              type="submit"
              className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              검색
            </Button>
          </form>
          {activeTab === "inquiries" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusFilter(undefined)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  !status
                    ? "bg-[#ff6b9d] text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => handleStatusFilter("pending")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  status === "pending"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  미답변
                </div>
              </button>
              <button
                onClick={() => handleStatusFilter("answered")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  status === "answered"
                    ? "bg-green-500 text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  답변완료
                </div>
              </button>
              {selectedInquiries.size > 0 && (
                <button
                  onClick={handleBulkDeleteInquiries}
                  disabled={isPending}
                  className="ml-2 px-4 py-2 rounded-lg text-sm transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <div className="flex items-center gap-1">
                    <Trash2 className="w-4 h-4" />
                    선택 삭제 ({selectedInquiries.size})
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 문의 탭 */}
      {activeTab === "inquiries" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {inquiries.length > 0 ? (
            <>
              {/* 전체 선택 및 일괄 삭제 헤더 */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      inquiries.length > 0 &&
                      selectedInquiries.size === inquiries.length
                    }
                    onChange={handleSelectAllInquiries}
                    className="w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
                  />
                  <span className="text-sm text-[#4a3f48]">
                    전체 선택 ({selectedInquiries.size}/{inquiries.length})
                  </span>
                </label>
                {selectedInquiries.size > 0 && (
                  <button
                    onClick={handleBulkDeleteInquiries}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg text-sm transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1">
                      <Trash2 className="w-4 h-4" />
                      선택 삭제 ({selectedInquiries.size})
                    </div>
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {inquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* 체크박스 */}
                      <input
                        type="checkbox"
                        checked={selectedInquiries.has(inquiry.id)}
                        onChange={() => handleToggleInquirySelection(inquiry.id)}
                        className="mt-1 w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-[#4a3f48]">
                            {inquiry.title}
                          </h3>
                          {inquiry.is_secret && (
                            <Lock className="w-4 h-4 text-[#8b7d84]" />
                          )}
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              inquiry.status === "answered"
                                ? "bg-green-100 text-green-600"
                                : "bg-orange-100 text-orange-600"
                            }`}
                          >
                            {inquiry.status === "answered" ? "답변완료" : "미답변"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteInquiry(inquiry.id)}
                            disabled={isPending}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            삭제
                          </button>
                        </div>
                        <div className="text-sm text-[#8b7d84] mb-2">
                          <Link
                            href={`/products/${inquiry.product_id}`}
                            className="text-[#ff6b9d] hover:underline"
                          >
                            {inquiry.product_name}
                          </Link>
                          {" · "}
                          {inquiry.user_name || "비회원"}
                          {" · "}
                          <DateDisplay date={inquiry.created_at} format="date" />
                        </div>
                        <p className="text-[#4a3f48] mb-3 whitespace-pre-wrap">
                          {inquiry.content}
                        </p>
                        {inquiry.answer && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                답변
                              </span>
                              {inquiry.answered_at && (
                                <span className="text-xs text-[#8b7d84]">
                                  <DateDisplay
                                    date={inquiry.answered_at}
                                    format="datetime"
                                  />
                                </span>
                              )}
                            </div>
                            <p className="text-[#4a3f48] whitespace-pre-wrap">
                              {inquiry.answer}
                            </p>
                          </div>
                        )}
                        {inquiry.status === "pending" && (
                          <div className="mt-4">
                            {expandedInquiry === inquiry.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  placeholder="답변 내용을 입력하세요..."
                                  value={answerTexts[inquiry.id] || ""}
                                  onChange={(e) =>
                                    handleAnswerChange(inquiry.id, e.target.value)
                                  }
                                  className="min-h-[100px] bg-white border-gray-200"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => handleSubmitAnswer(inquiry.id)}
                                    disabled={
                                      isPending ||
                                      !answerTexts[inquiry.id]?.trim()
                                    }
                                    className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
                                  >
                                    답변 등록
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setExpandedInquiry(null);
                                      setAnswerTexts((prev) => {
                                        const newState = { ...prev };
                                        delete newState[inquiry.id];
                                        return newState;
                                      });
                                    }}
                                    variant="outline"
                                    className="border-gray-300"
                                  >
                                    취소
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                onClick={() => setExpandedInquiry(inquiry.id)}
                                className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
                              >
                                답변 작성
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              ))}
            </div>
            </>
          ) : (
            <div className="p-16 text-center">
              <MessageSquare className="w-16 h-16 text-[#8b7d84] mx-auto mb-4 opacity-50" />
              <p className="text-[#8b7d84]">
                {status === "pending"
                  ? "미답변 문의가 없습니다."
                  : "문의가 없습니다."}
              </p>
            </div>
          )}

          {/* 페이지네이션 */}
          {inquiriesTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
              {Array.from({ length: inquiriesTotalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  const params = new URLSearchParams();
                  params.set("tab", "inquiries");
                  if (searchQuery.trim()) {
                    params.set("search", searchQuery.trim());
                  }
                  if (status) {
                    params.set("status", status);
                  }
                  params.set("page", pageNum.toString());
                  return (
                    <Link
                      key={pageNum}
                      href={`/admin/support?${params.toString()}`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                        pageNum === currentPage
                          ? "bg-[#ff6b9d] text-white"
                          : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </div>
      )}

      {/* 리뷰 탭 */}
      {activeTab === "reviews" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {reviews.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-[#8b7d84]">
                          {review.user_name || "익명"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={isPending}
                          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </button>
                      </div>
                      <div className="text-sm text-[#8b7d84] mb-2">
                        <Link
                          href={`/products/${review.product_id}`}
                          className="text-[#ff6b9d] hover:underline"
                        >
                          {review.product_name}
                        </Link>
                        {" · "}
                        <DateDisplay date={review.created_at} format="date" />
                      </div>
                      <p className="text-[#4a3f48] mb-3 whitespace-pre-wrap">
                        {review.content}
                      </p>
                      {review.images && review.images.length > 0 && (
                        <div className="flex gap-2 mb-3">
                          {review.images.map((imageUrl, idx) => (
                            <Image
                              key={idx}
                              src={imageUrl}
                              alt={`리뷰 이미지 ${idx + 1}`}
                              width={80}
                              height={80}
                              className="object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center">
              <Star className="w-16 h-16 text-[#8b7d84] mx-auto mb-4 opacity-50" />
              <p className="text-[#8b7d84]">리뷰가 없습니다.</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {reviewsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
              {Array.from({ length: reviewsTotalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  const params = new URLSearchParams();
                  params.set("tab", "reviews");
                  if (searchQuery.trim()) {
                    params.set("search", searchQuery.trim());
                  }
                  params.set("page", pageNum.toString());
                  return (
                    <Link
                      key={pageNum}
                      href={`/admin/support?${params.toString()}`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                        pageNum === currentPage
                          ? "bg-[#ff6b9d] text-white"
                          : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
