/**
 * @file components/cart-update-trigger.tsx
 * @description 주문 완료 시 장바구니 개수 갱신을 트리거하는 클라이언트 컴포넌트
 * 
 * 주문 완료 페이지에서 사용하여 헤더의 장바구니 개수를 즉시 업데이트합니다.
 */

"use client";

import { useEffect } from "react";
import logger from "@/lib/logger-client";

export default function CartUpdateTrigger() {
  useEffect(() => {
    // 페이지 마운트 시 커스텀 이벤트 발생
    logger.debug("[CartUpdateTrigger] 주문 완료 페이지 로드 - 장바구니 갱신 이벤트 발생");
    window.dispatchEvent(new CustomEvent("cart:update"));
  }, []);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}

