/**
 * @file components/admin/shipping-settings-form.tsx
 * @description 배송비 설정 폼 컴포넌트
 *
 * 주요 기능:
 * 1. 배송비 설정 추가/수정
 * 2. 모달을 통한 폼 표시
 */

"use client";

import { useState } from "react";
import { Plus, Edit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

interface ShippingSetting {
  id?: string;
  name: string;
  base_shipping_fee: number;
  free_shipping_threshold: number | null;
  is_active: boolean;
  description?: string | null;
}

interface ShippingSettingsFormProps {
  mode: "create" | "edit";
  setting?: ShippingSetting;
}

export default function ShippingSettingsForm({
  mode,
  setting,
}: ShippingSettingsFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ShippingSetting>({
    name: setting?.name || "",
    base_shipping_fee: setting?.base_shipping_fee || 0,
    free_shipping_threshold: setting?.free_shipping_threshold || null,
    is_active: setting?.is_active ?? true,
    description: setting?.description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    console.group("[ShippingSettingsForm] 배송비 설정 저장 시작");
    console.log("[ShippingSettingsForm] 모드:", mode);
    console.log("[ShippingSettingsForm] 폼 데이터:", formData);

    try {
      const url = mode === "create" ? "/api/admin/shipping-settings" : `/api/admin/shipping-settings/${setting?.id}`;
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

      console.log("[ShippingSettingsForm] ✅ 저장 성공");
      console.groupEnd();

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("[ShippingSettingsForm] ❌ 저장 실패:", error);
      console.groupEnd();
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!setting?.id) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;

    console.group("[ShippingSettingsForm] 배송비 설정 삭제 시작");
    console.log("[ShippingSettingsForm] 설정 ID:", setting.id);

    try {
      const response = await fetch(`/api/admin/shipping-settings/${setting.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "삭제에 실패했습니다.");
      }

      console.log("[ShippingSettingsForm] ✅ 삭제 성공");
      console.groupEnd();

      router.refresh();
    } catch (error) {
      console.error("[ShippingSettingsForm] ❌ 삭제 실패:", error);
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
                {mode === "create" ? "배송비 설정 추가" : "배송비 설정 수정"}
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
                <Label htmlFor="name">설정 이름 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="예: 기본 배송비"
                />
              </div>

              <div>
                <Label htmlFor="base_shipping_fee">기본 배송비 (원) *</Label>
                <Input
                  id="base_shipping_fee"
                  type="number"
                  min="0"
                  value={formData.base_shipping_fee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      base_shipping_fee: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="free_shipping_threshold">
                  무료배송 기준 금액 (원)
                </Label>
                <Input
                  id="free_shipping_threshold"
                  type="number"
                  min="0"
                  value={formData.free_shipping_threshold || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      free_shipping_threshold: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="없으면 비워두세요"
                />
              </div>

              <div>
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="설명을 입력하세요"
                  rows={3}
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
