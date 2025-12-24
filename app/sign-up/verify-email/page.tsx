/**
 * @file app/sign-up/verify-email/page.tsx
 * @description 이메일 인증 페이지
 */

"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logger from "@/lib/logger";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, setActive } = useSignUp();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const email = searchParams.get("email") || "";

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError("6자리 인증 코드를 입력해주세요.");
      return;
    }

    logger.group("[VerifyEmail] 이메일 인증 시작");
    setIsLoading(true);
    setError("");

    try {
      if (!signUp) {
        throw new Error("SignUp이 초기화되지 않았습니다.");
      }

      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      logger.debug("[VerifyEmail] 인증 결과:", result);

      if (result.status === "complete") {
        // 세션 활성화
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }

        logger.debug("[VerifyEmail] 인증 완료");
        logger.groupEnd();

        // 회원가입 완료 페이지로 이동
        router.push("/sign-up/complete");
      } else {
        setError("인증에 실패했습니다. 다시 시도해주세요.");
        logger.groupEnd();
      }
    } catch (err: any) {
      logger.error("[VerifyEmail] 인증 에러:", err);
      logger.groupEnd();

      setError(
        err.errors?.[0]?.message || "인증 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    logger.debug("[VerifyEmail] 인증 코드 재전송");
    setIsLoading(true);
    setError("");

    try {
      if (!signUp) {
        throw new Error("SignUp이 초기화되지 않았습니다.");
      }

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      alert("인증 코드가 재전송되었습니다.");
    } catch (err: any) {
      logger.error("[VerifyEmail] 재전송 에러:", err);
      setError("인증 코드 재전송에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-shop-rose/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-shop-rose"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">이메일 인증</h1>
            <p className="text-gray-600">
              <strong>{email}</strong>
              <br />
              위 이메일로 발송된 6자리 인증 코드를 입력해주세요.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="code">인증 코드</Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleVerify}
              disabled={isLoading || code.length !== 6}
              className="w-full bg-shop-rose hover:bg-shop-rose/90"
            >
              {isLoading ? "확인 중..." : "인증 확인"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm text-gray-600 hover:text-shop-rose underline"
              >
                인증 코드 재전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

