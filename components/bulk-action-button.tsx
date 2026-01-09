/**
 * @file components/bulk-action-button.tsx
 * @description 상품 일괄 작업 버튼 통합 컴포넌트
 *
 * delete, restore, hide, show 4가지 액션을 하나의 컴포넌트로 통합
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, EyeOff, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { deleteAllProducts } from "@/actions/bulk-delete-products";
import { restoreAllProducts } from "@/actions/bulk-restore-products";
import { bulkHideProducts } from "@/actions/bulk-hide-products";
import { bulkShowProducts } from "@/actions/bulk-show-products";

type BulkAction = "delete" | "restore" | "hide" | "show";

interface BulkActionButtonProps {
  action: BulkAction;
  selectedProductIds?: string[]; // delete/restore는 전체, hide/show는 선택
  onSuccess?: () => void;
}

const ACTION_CONFIG: Record<
  BulkAction,
  {
    actionFn: (ids?: string[]) => Promise<{ success: boolean; message: string }>;
    icon: React.ComponentType<{ className?: string }>;
    confirmMessage: string | ((ids?: string[]) => string);
    variant: "default" | "destructive" | "outline";
    buttonText: string | ((ids?: string[]) => string);
    loadingText: string;
    className?: string;
  }
> = {
  delete: {
    actionFn: async () => await deleteAllProducts(),
    icon: Trash2,
    confirmMessage:
      "⚠️ 경고: 모든 상품이 삭제 처리됩니다.\n이 작업은 되돌릴 수 없습니다.\n\n정말로 진행하시겠습니까?",
    variant: "destructive",
    buttonText: "전체 삭제",
    loadingText: "삭제 중...",
  },
  restore: {
    actionFn: async () => await restoreAllProducts(),
    icon: RotateCcw,
    confirmMessage:
      "✅ 모든 삭제된 상품을 복구하시겠습니까?\n\n삭제된 상품들이 다시 활성화됩니다.\nslug 충돌이 있는 경우 자동으로 slug가 변경됩니다.",
    variant: "default",
    buttonText: "전체상품 복구하기",
    loadingText: "복구 중...",
    className: "bg-green-600 hover:bg-green-700 text-white",
  },
  hide: {
    actionFn: async (ids) => await bulkHideProducts(ids || []),
    icon: EyeOff,
    confirmMessage: (ids) =>
      `선택한 ${ids?.length || 0}개 상품을 숨김 처리하시겠습니까?\n\n숨김 처리된 상품은 고객에게 보이지 않습니다.`,
    variant: "outline",
    buttonText: (ids) => `선택한 ${ids?.length || 0}개 숨김 처리`,
    loadingText: "숨김 처리 중...",
    className:
      "border-[#8b7d84] text-[#4a3f48] hover:bg-[#ffeef5] hover:border-[#ff6b9d]",
  },
  show: {
    actionFn: async (ids) => await bulkShowProducts(ids || []),
    icon: Eye,
    confirmMessage: (ids) =>
      `선택한 ${ids?.length || 0}개 상품을 판매중으로 변경하시겠습니까?\n\n변경된 상품은 고객에게 표시됩니다.`,
    variant: "outline",
    buttonText: (ids) => `선택한 ${ids?.length || 0}개 판매중으로 변경`,
    loadingText: "판매중 변경 중...",
    className:
      "border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600",
  },
};

export default function BulkActionButton({
  action,
  selectedProductIds,
  onSuccess,
}: BulkActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  const handleAction = () => {
    // delete/restore는 2단계 확인 필요
    if ((action === "delete" || action === "restore") && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    // hide/show는 선택된 상품 확인
    if (
      (action === "hide" || action === "show") &&
      (!selectedProductIds || selectedProductIds.length === 0)
    ) {
      alert("선택한 상품이 없습니다.");
      return;
    }

    const confirmMsg =
      typeof config.confirmMessage === "function"
        ? config.confirmMessage(selectedProductIds)
        : config.confirmMessage;

    if (!confirm(confirmMsg)) {
      if (action === "delete" || action === "restore") {
        setShowConfirm(false);
      }
      return;
    }

    startTransition(async () => {
      logger.group(`[BulkActionButton] ${action} 작업 시작`);
      logger.debug("선택한 상품 ID:", selectedProductIds);

      const result = await config.actionFn(selectedProductIds);

      if (result.success) {
        logger.info(`${action} 작업 성공:`, result.message);
        alert(result.message);
        if (onSuccess) {
          onSuccess();
        }
        router.refresh();
      } else {
        logger.error(`${action} 작업 실패:`, result.message);
        alert(`${action} 실패: ${result.message}`);
      }
      logger.groupEnd();

      if (action === "delete" || action === "restore") {
        setShowConfirm(false);
      }
    });
  };

  // hide/show는 선택된 상품이 없으면 렌더링하지 않음
  if (
    (action === "hide" || action === "show") &&
    (!selectedProductIds || selectedProductIds.length === 0)
  ) {
    return null;
  }

  return (
    <Button
      onClick={handleAction}
      disabled={isPending}
      variant={config.variant}
      className={`flex items-center gap-2 ${config.className || ""}`}
    >
      {isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {config.loadingText}
        </>
      ) : showConfirm ? (
        <>
          <AlertTriangle className="w-4 h-4" />
          정말 {action === "delete" ? "삭제" : "복구"}하시겠습니까?
        </>
      ) : (
        <>
          <Icon className="w-4 h-4" />
          {typeof config.buttonText === "function"
            ? config.buttonText(selectedProductIds)
            : config.buttonText}
        </>
      )}
    </Button>
  );
}

