/**
 * @file components/admin/return-policy-form.tsx
 * @description 반품 정책 폼 컴포넌트
 */

"use client";

import { useState } from "react";
import { Plus, Edit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

interface ReturnPolicy {
  id?: string;
  title: string;
  content: string;
  return_period_days: number;
  exchange_period_days: number;
  return_shipping_fee: number;
  is_active: boolean;
}

interface ReturnPolicyFormProps {
  mode: "create" | "edit";
  policy?: ReturnPolicy;
}

export default function ReturnPolicyForm({
  mode,
  policy,
}: ReturnPolicyFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ReturnPolicy>({
    title: policy?.title || "",
    content: policy?.content || "",
    return_period_days: policy?.return_period_days || 7,
    exchange_period_days: policy?.exchange_period_days || 7,
    return_shipping_fee: policy?.return_shipping_fee || 0,
    is_active: policy?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    console.group("[ReturnPolicyForm] 반품 정책 저장 시작");
    console.log("[ReturnPolicyForm] 모드:", mode);
    console.log("[ReturnPolicyForm] 폼 데이터:", formData);

    try {
      const url =
        mode === "create"
          ? "/api/admin/return-policies"
          : `/api/admin/return-policies/${policy?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "저장에 실패했습니다.");
      }

      console.log("[ReturnPolicyForm] ✅ 저장 성공");
      console.groupEnd();

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("[ReturnPolicyForm] ❌ 저장 실패:", error);
      console.groupEnd();
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!policy?.id) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;

    console.group("[ReturnPolicyForm] 반품 정책 삭제 시작");
    console.log("[ReturnPolicyForm] 정책 ID:", policy.id);

    try {
      const response = await fetch(`/api/admin/return-policies/${policy.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "삭제에 실패했습니다.");
      }

      console.log("[ReturnPolicyForm] ✅ 삭제 성공");
      console.groupEnd();

      router.refresh();
    } catch (error) {
      console.error("[ReturnPolicyForm] ❌ 삭제 실패:", error);
      console.groupEnd();
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <>
      {mode === "create" ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-[#ff6b9d] hover:bg-[#ff5a8a] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          추가
        </Button>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
        >
          <Edit className="w-4 h-4" />
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#4a3f48]">
                {mode === "create" ? "반품 정책 추가" : "반품 정책 수정"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#8b7d84] hover:text-[#4a3f48] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">정책 제목 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  placeholder="예: 기본 반품 정책"
                />
              </div>

              <div>
                <Label htmlFor="content">정책 내용 *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  required
                  placeholder="반품 정책 내용을 입력하세요"
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="return_period_days">반품 가능 기간 (일) *</Label>
                  <Input
                    id="return_period_days"
                    type="number"
                    min="1"
                    value={formData.return_period_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        return_period_days: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="exchange_period_days">교환 가능 기간 (일) *</Label>
                  <Input
                    id="exchange_period_days"
                    type="number"
                    min="1"
                    value={formData.exchange_period_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exchange_period_days: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="return_shipping_fee">반품 배송비 (원) *</Label>
                <Input
                  id="return_shipping_fee"
                  type="number"
                  min="0"
                  value={formData.return_shipping_fee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      return_shipping_fee: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  활성화
                </Label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                {mode === "edit" && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    삭제
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#ff6b9d] hover:bg-[#ff5a8a] text-white"
                >
                  {isSubmitting ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
