/**
 * @file app/order/waiting-deposit/page.tsx
 * @description 에스크로 계좌이체 입금 대기 페이지
 * 
 * 주요 기능:
 * 1. 가상계좌 정보 표시
 * 2. 입금 기한 안내
 * 3. 입금 확인 대기 상태 표시
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import logger from "@/lib/logger";

interface VirtualAccountInfo {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  customerName: string;
  dueDate: string;
  refundStatus: string;
}

function WaitingDepositContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<{
    orderId: string;
    orderNumber?: string;
    amount: number;
    virtualAccount?: VirtualAccountInfo;
    method?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    logger.group("[WaitingDepositPage] 입금 대기 페이지 진입");

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    logger.info("쿼리 파라미터:", {
      paymentKey: paymentKey ? paymentKey.substring(0, 10) + "..." : null,
      orderId,
      amount,
    });

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      logger.error("필수 파라미터 누락");
      setError("잘못된 결제 요청입니다.");
      setIsLoading(false);
      logger.groupEnd();
      return;
    }

    const amountNumber = parseInt(amount, 10);
    if (isNaN(amountNumber)) {
      logger.error("잘못된 금액 형식:", amount);
      setError("잘못된 결제 금액입니다.");
      setIsLoading(false);
      logger.groupEnd();
      return;
    }

    // 결제 정보 조회
    const fetchPaymentInfo = async () => {
      try {
        logger.info("결제 정보 조회 시작");
        const response = await fetch("/api/payments/toss/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: amountNumber,
          }),
        });

        const data = await response.json();

        logger.group("[WaitingDepositPage] 결제 정보 조회 결과");
        logger.info("성공 여부:", data.success);
        logger.info("결제 수단:", data.method);
        logger.info("가상계좌 정보:", data.virtualAccount);
        logger.groupEnd();

        if (!data.success) {
          setError(data.message || "결제 정보를 가져올 수 없습니다.");
          setIsLoading(false);
          return;
        }

        // 계좌이체가 아니면 일반 성공 페이지로 리다이렉트
        if (data.method !== "TRANSFER" && !data.virtualAccount) {
          logger.info("계좌이체가 아님 - 일반 성공 페이지로 리다이렉트");
          router.push(`/order/success?paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`);
          return;
        }

        // 가상계좌 정보 매핑
        const bankNames: Record<string, string> = {
          "20": "우리은행",
          "04": "KB국민은행",
          "03": "신한은행",
          "88": "하나은행",
          "11": "NH농협은행",
          "23": "SC제일은행",
          "27": "한국씨티은행",
          "37": "우체국",
          "39": "경남은행",
          "34": "광주은행",
          "32": "부산은행",
          "31": "대구은행",
          "71": "포스코",
          "81": "KEB하나은행",
          "89": "케이뱅크",
          "90": "카카오뱅크",
          "92": "토스뱅크",
        };

        const virtualAccount: VirtualAccountInfo | undefined = data.virtualAccount
          ? {
              accountNumber: data.virtualAccount.accountNumber || "",
              bankCode: data.virtualAccount.bankCode || "",
              bankName:
                bankNames[data.virtualAccount.bankCode] ||
                data.virtualAccount.bankCode ||
                "은행",
              customerName: data.virtualAccount.customerName || "",
              dueDate: data.virtualAccount.dueDate || "",
              refundStatus: data.virtualAccount.refundStatus || "",
            }
          : undefined;

        setPaymentInfo({
          orderId,
          orderNumber: data.orderId,
          amount: amountNumber,
          virtualAccount,
          method: data.method,
        });
      } catch (error) {
        logger.error("결제 정보 조회 에러:", error);
        setError(
          error instanceof Error
            ? error.message
            : "결제 정보를 가져오는 중 오류가 발생했습니다."
        );
      } finally {
        setIsLoading(false);
        logger.groupEnd();
      }
    };

    fetchPaymentInfo();
  }, [searchParams, router]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDueDate = (dueDate: string) => {
    if (!dueDate) return "";
    try {
      const date = new Date(dueDate);
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dueDate;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">결제 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">오류 발생</h1>
          <p className="text-[#8b7d84] mb-8">{error}</p>
          <Button
            onClick={() => router.push("/checkout")}
            className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  if (!paymentInfo || !paymentInfo.virtualAccount) {
    return null;
  }

  const { virtualAccount, amount, orderNumber } = paymentInfo;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#ffeef5] py-8">
      <div className="max-w-2xl w-full mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#ffeef5] rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-[#ff6b9d]" />
            </div>
            <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
              입금 대기 중입니다
            </h1>
            <p className="text-[#8b7d84]">
              아래 계좌로 입금해주시면 주문이 완료됩니다.
            </p>
          </div>

          {/* 가상계좌 정보 */}
          <div className="bg-[#ffeef5] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#4a3f48] mb-4">
              입금 계좌 정보
            </h2>

            <div className="space-y-4">
              {/* 은행명 */}
              <div>
                <label className="text-sm text-[#8b7d84] mb-1 block">
                  은행명
                </label>
                <div className="text-lg font-bold text-[#4a3f48]">
                  {virtualAccount.bankName}
                </div>
              </div>

              {/* 계좌번호 */}
              <div>
                <label className="text-sm text-[#8b7d84] mb-1 block">
                  계좌번호
                </label>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-[#4a3f48] font-mono">
                    {virtualAccount.accountNumber}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(virtualAccount.accountNumber)}
                    className="border-[#f5d5e3] text-[#4a3f48] hover:bg-[#fef8fb]"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        복사
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* 입금자명 */}
              <div>
                <label className="text-sm text-[#8b7d84] mb-1 block">
                  입금자명
                </label>
                <div className="text-lg font-bold text-[#4a3f48]">
                  {virtualAccount.customerName}
                </div>
                <p className="text-xs text-[#8b7d84] mt-1">
                  ⚠️ 입금자명을 정확히 입력해주세요. 다르면 입금이 확인되지
                  않을 수 있습니다.
                </p>
              </div>

              {/* 입금 금액 */}
              <div>
                <label className="text-sm text-[#8b7d84] mb-1 block">
                  입금 금액
                </label>
                <div className="text-2xl font-bold text-[#ff6b9d]">
                  {amount.toLocaleString("ko-KR")}원
                </div>
              </div>

              {/* 입금 기한 */}
              {virtualAccount.dueDate && (
                <div>
                  <label className="text-sm text-[#8b7d84] mb-1 block">
                    입금 기한
                  </label>
                  <div className="text-lg font-semibold text-[#4a3f48]">
                    {formatDueDate(virtualAccount.dueDate)}까지
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 주문 정보 */}
          {orderNumber && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="text-sm text-[#8b7d84] mb-1">주문번호</div>
              <div className="text-base font-semibold text-[#4a3f48]">
                {orderNumber}
              </div>
            </div>
          )}

          {/* 안내 사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              입금 안내
            </h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 입금 후 자동으로 주문이 완료됩니다.</li>
              <li>• 입금 확인까지 최대 10분 정도 소요될 수 있습니다.</li>
              <li>• 입금 기한 내에 입금하지 않으면 주문이 자동 취소됩니다.</li>
              <li>• 입금 확인 후 주문 내역은 마이페이지에서 확인하실 수 있습니다.</li>
            </ul>
          </div>

          {/* 버튼 */}
          <div className="space-y-2">
            <Button
              onClick={() => router.push("/mypage/orders")}
              className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              주문 내역 보기
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full border-[#f5d5e3] text-[#4a3f48] hover:bg-[#fef8fb]"
            >
              홈으로 가기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaitingDepositPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
            <p className="text-sm text-[#8b7d84]">로딩 중...</p>
          </div>
        </div>
      }
    >
      <WaitingDepositContent />
    </Suspense>
  );
}

