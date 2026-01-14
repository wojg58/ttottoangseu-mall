/**
 * @file app/global-error.tsx
 * @description 루트 레이아웃 에러 바운더리
 * 
 * 루트 레이아웃에서 발생하는 에러를 처리합니다.
 * 이 파일은 반드시 "use client"를 사용해야 합니다.
 */

"use client";

import { useEffect } from "react";
import logger from "@/lib/logger-client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // 에러를 로깅 (프로덕션에서는 Sentry로 전송)
    logger.error("[GlobalError] 루트 레이아웃 에러 발생", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });

    // TODO: 프로덕션에서는 Sentry로 전송
    // if (process.env.NODE_ENV === "production") {
    //   Sentry.captureException(error, {
    //     tags: { component: "GlobalError" },
    //   });
    // }
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div className="flex items-center justify-center min-h-screen bg-[#ffeef5]">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="text-6xl mb-4">😢</div>
            <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">
              심각한 오류가 발생했습니다
            </h1>
            <p className="text-[#8b7d84] mb-6">
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5088] transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
