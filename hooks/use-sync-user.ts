"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * Clerk 사용자를 Supabase DB에 자동으로 동기화하는 훅
 *
 * 사용자가 로그인한 상태에서 이 훅을 사용하면
 * 자동으로 /api/sync-user를 호출하여 Supabase users 테이블에 사용자 정보를 저장합니다.
 */
export function useSyncUser() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    // 이미 동기화했거나, 로딩 중이거나, 로그인하지 않은 경우 무시
    if (syncedRef.current || !isLoaded || !isSignedIn || !userId) {
      return;
    }

    // 동기화 실행 (약간의 딜레이 추가)
    const syncUser = async () => {
      try {
        // Clerk 세션이 완전히 준비될 때까지 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 500));

        console.group("🔄 사용자 동기화 시작");
        console.log("userId:", userId);
        console.log("isLoaded:", isLoaded);
        console.log("isSignedIn:", isSignedIn);
        console.log("시간:", new Date().toISOString());

        // Clerk 토큰 가져오기
        const token = await getToken();
        console.log("토큰 존재:", !!token);
        if (token) {
          console.log("토큰 길이:", token.length);
        }

        const response = await fetch("/api/sync-user", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            // 토큰이 있으면 Authorization 헤더에도 추가
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          // 401 Unauthorized는 로그인하지 않은 상태에서 정상적인 응답이므로 조용히 처리
          if (response.status === 401) {
            console.log("ℹ️ 로그인하지 않은 상태입니다. 동기화를 건너뜁니다.");
            console.groupEnd();
            return;
          }
          console.error("❌ 동기화 실패:", errorText);
          console.groupEnd();
          return;
        }

        const data = await response.json();
        console.log("✅ 동기화 성공:", data);
        syncedRef.current = true;
        console.groupEnd();
      } catch (error) {
        console.error("❌ 동기화 중 에러:", error);
        console.groupEnd();
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, getToken]);
}
