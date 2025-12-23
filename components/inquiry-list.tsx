/**
 * @file components/inquiry-list.tsx
 * @description 문의 목록 컴포넌트
 */

"use client";

import { Lock } from "lucide-react";
import type { Inquiry } from "@/actions/inquiries";

interface InquiryListProps {
  inquiries: Inquiry[];
}

export default function InquiryList({ inquiries }: InquiryListProps) {
  if (inquiries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8b7d84]">아직 작성된 문의가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {inquiries.map((inquiry) => (
        <div
          key={inquiry.id}
          className="border border-[#f5d5e3] rounded-xl p-6 bg-white"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-[#4a3f48]">{inquiry.title}</h4>
              {inquiry.is_secret && (
                <Lock className="w-4 h-4 text-[#8b7d84]" />
              )}
              {inquiry.status === "answered" && (
                <span className="text-xs bg-[#ff6b9d] text-white px-2 py-1 rounded">
                  답변완료
                </span>
              )}
            </div>
            <span className="text-xs text-[#8b7d84]">
              {new Date(inquiry.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <p className="text-[#4a3f48] whitespace-pre-wrap mb-4">
            {inquiry.content}
          </p>
          {inquiry.status === "answered" && inquiry.answer && (
            <div className="mt-4 pt-4 border-t border-[#f5d5e3]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-[#ff6b9d]">답변</span>
                {inquiry.answered_at && (
                  <span className="text-xs text-[#8b7d84]">
                    {new Date(inquiry.answered_at).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </div>
              <p className="text-[#4a3f48] whitespace-pre-wrap">
                {inquiry.answer}
              </p>
            </div>
          )}
          <div className="text-xs text-[#8b7d84] mt-2">
            {inquiry.user?.name || "익명"}
          </div>
        </div>
      ))}
    </div>
  );
}

