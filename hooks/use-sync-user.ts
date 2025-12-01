"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * Clerk 사용자를 Supabase DB에 자동으로 동기화하는 훅
 *
 * 사용자가 로그인한 상태에서 이 훅을 사용하면
 * 자동으로 /api/sync-user를 호출하여 Supabase users 테이블에 사용자 정보를 저장합니다.
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useSyncUser } from '@/hooks/use-sync-user';
 *
 * export default function Layout({ children }) {
 *   useSyncUser();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useSyncUser() {
  const { isLoaded, userId } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    // 이미 동기화했거나, 로딩 중이거나, 로그인하지 않은 경우 무시
    if (syncedRef.current || !isLoaded || !userId) {
      return;
    }

    // 동기화 실행
    const syncUser = async () => {
      try {
        console.group("🔄 사용자 동기화 시작");
        console.log("userId:", userId);
        
        const response = await fetch("/api/sync-user", {
          method: "POST",
          credentials: "include", // 쿠키 포함
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
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
  }, [isLoaded, userId]);
}
