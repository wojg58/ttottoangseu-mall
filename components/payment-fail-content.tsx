"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentFailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제에 실패했습니다.";

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
        결제에 실패했습니다
      </h1>
      <p className="text-sm text-[#8b7d84] mb-4">{message}</p>
      <p className="text-xs text-[#8b7d84] mb-8">
        문제가 지속되면 고객센터로 문의해주세요.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          asChild
          variant="outline"
          className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
        >
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Link>
        </Button>
        <Button
          asChild
          className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
        >
          <Link href="/cart">
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 시도
          </Link>
        </Button>
      </div>
    </div>
  );
}

