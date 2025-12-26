"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth 콜백 후 Clerk 세션 동기화를 위한 컴포넌트
 * 
 * OAuth 로그인 후 리다이렉트가 되면, Clerk 세션이 클라이언트에 제대로 반영되지 않을 수 있습니다.
 * 이 컴포넌트는 세션 상태를 확인하고 필요시 페이지를 새로고침하여 세션을 동기화합니다.
 */
export function AuthSessionSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // 이미 확인했거나 아직 로딩 중이면 무시
    if (hasCheckedRef.current || !isLoaded) {
      return;
    }

    // OAuth 콜백 후 리다이렉트인지 확인 (URL 파라미터 확인)
    const currentUrl = window.location.href;
    const isOAuthCallback = searchParams.has("__clerk_redirect_url") || 
                           searchParams.has("__clerk_status") ||
                           currentUrl.includes("__clerk") ||
                           currentUrl.includes("oauth_callback");

    if (isOAuthCallback) {
      console.group("[AuthSessionSync] OAuth 콜백 감지");
      console.log("현재 URL:", currentUrl);
      console.log("isSignedIn:", isSignedIn);
      
      // OAuth 콜백 파라미터 제거
      const url = new URL(currentUrl);
      url.searchParams.delete("__clerk_redirect_url");
      url.searchParams.delete("__clerk_status");
      
      // URL에서 __clerk 관련 파라미터 모두 제거
      let cleanSearch = url.search;
      cleanSearch = cleanSearch.replace(/[?&]__clerk[^&]*/g, '');
      cleanSearch = cleanSearch.replace(/[?&]oauth_callback[^&]*/g, '');
      const cleanUrl = url.pathname + (cleanSearch || '');
      
      // 세션이 활성화될 때까지 잠시 대기 (더 긴 대기 시간)
      setTimeout(() => {
        console.log("[AuthSessionSync] 세션 동기화를 위해 페이지 새로고침");
        console.log("리다이렉트 URL:", cleanUrl || "/");
        // 전체 페이지 새로고침으로 세션 상태를 확실히 반영
        window.location.href = cleanUrl || "/";
      }, 1000);
      
      hasCheckedRef.current = true;
      console.groupEnd();
      return;
    }

    // 일반 페이지 로드 시 세션 상태 확인
    // 로그인 상태가 변경되었을 때 페이지를 새로고침하여 UI 업데이트
    if (isSignedIn) {
      console.log("[AuthSessionSync] 로그인 상태 확인됨");
      // 세션이 활성화되었지만 UI가 업데이트되지 않은 경우를 대비하여
      // 약간의 딜레이 후 강제 리렌더링
      const timeoutId = setTimeout(() => {
        // 현재 URL에서 리다이렉트가 필요한지 확인
        const currentPath = window.location.pathname;
        if (currentPath === "/sign-in" || currentPath.startsWith("/sign-in/")) {
          console.log("[AuthSessionSync] 로그인 페이지에서 홈으로 리다이렉트");
          router.replace("/");
        }
      }, 1000);

      hasCheckedRef.current = true;
      return () => clearTimeout(timeoutId);
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  return null;
}

