/**
 * @file app/error.tsx
 * @description 글로벌 에러 바운더리
 * 
 * Next.js 15의 error.tsx를 사용하여 예상치 못한 에러를 처리합니다.
 * 프로덕션 환경에서는 에러를 Sentry로 전송합니다.
 */

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import logger from "@/lib/logger-client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러를 로깅 (프로덕션에서는 Sentry로 전송)
    logger.error("[GlobalErrorBoundary] 예상치 못한 에러 발생", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });

    // TODO: 프로덕션에서는 Sentry로 전송
    // if (process.env.NODE_ENV === "production") {
    //   Sentry.captureException(error, {
    //     tags: { component: "ErrorBoundary" },
    //   });
    // }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#ffeef5]">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-6xl mb-4">😢</div>
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">
          예상치 못한 오류가 발생했습니다
        </h1>
        <p className="text-[#8b7d84] mb-6">
          잠시 후 다시 시도해주세요. 문제가 계속되면 고객센터로 문의해주세요.
        </p>
        {process.env.NODE_ENV === "development" && (
          <details className="mb-6 text-left bg-white p-4 rounded-lg border border-red-200">
            <summary className="cursor-pointer text-sm font-medium text-red-600 mb-2">
              에러 상세 정보 (개발 환경)
            </summary>
            <pre className="text-xs text-red-800 overflow-auto">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={reset}
            className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 시도
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[#ff6b9d] text-[#ff6b9d] hover:bg-[#ffeef5]"
          >
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              홈으로
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
