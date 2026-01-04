"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth 콜백 후 Clerk 세션 동기화를 위한 컴포넌트
 * 
 * OAuth 로그인 후 리다이렉트가 되면, Clerk 세션이 클라이언트에 제대로 반영되지 않을 수 있습니다.
 * 이 컴포넌트는 세션 상태를 확인하고 필요시 페이지를 새로고침하여 세션을 동기화합니다.
 * 
 * 검증 문서 6차 진단: OAuth 콜백 이후 Clerk가 세션을 생성했는지 확인
 */
export function AuthSessionSync() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
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
      // 로그를 localStorage에 저장 (페이지 새로고침 후에도 확인 가능)
      const logData = {
        timestamp: new Date().toISOString(),
        url: currentUrl,
        isSignedIn,
        userId,
        sessionId,
        userLoaded,
        hasUser: !!user,
      };
      
      // 이전 로그 가져오기
      const existingLogs = JSON.parse(localStorage.getItem("oauth_callback_logs") || "[]");
      existingLogs.push(logData);
      // 최근 10개만 유지
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      localStorage.setItem("oauth_callback_logs", JSON.stringify(existingLogs));
      
      console.group("[AuthSessionSync] OAuth 콜백 감지 - 세션 생성 검증 시작");
      console.log("현재 URL:", currentUrl);
      console.log("시간:", new Date().toISOString());
      console.log("💾 로그가 localStorage에 저장되었습니다. 페이지 새로고침 후에도 확인 가능합니다.");
      console.log("   localStorage.getItem('oauth_callback_logs')로 확인하세요.");
      
      // 검증 문서 6차 진단: 세션 생성 여부 확인
      console.log("=== 세션 생성 검증 ===");
      console.log("isSignedIn:", isSignedIn);
      console.log("userId:", userId);
      console.log("sessionId:", sessionId);
      console.log("userLoaded:", userLoaded);
      console.log("user 존재:", !!user);
      
      if (user) {
        const userInfo = {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || "없음",
          name: user.fullName || user.username || "없음",
          externalAccounts: user.externalAccounts?.length || 0,
          externalAccountDetails: user.externalAccounts?.map(acc => ({
            provider: acc.provider,
            providerUserId: acc.providerUserId,
            verified: acc.verification?.status,
          })) || [],
        };
        console.log("👤 Clerk 사용자 정보:", userInfo);
        
        // External Account가 없는 경우 경고
        if (!user.externalAccounts || user.externalAccounts.length === 0) {
          console.error("❌ [중요] External Account가 없습니다!");
          console.error("   → 'The External Account was not found' 에러의 원인일 수 있습니다.");
          console.error("   → Clerk가 Proxy 서버의 응답을 받았지만 외부 계정을 연결하지 못했습니다.");
          console.error("   → 가능한 원인:");
          console.error("      1. Clerk Dashboard의 Attribute Mapping 설정 문제");
          console.error("      2. Proxy 서버 응답의 sub 값이 Clerk가 기대하는 형식과 다름");
          console.error("      3. 네이버에서 제공한 사용자 ID가 이미 다른 Clerk 사용자와 연결됨");
        } else {
          console.log("✅ External Account 연결됨:", user.externalAccounts.map(acc => acc.provider));
        }
      }
      
      // 세션 토큰 확인
      getToken().then(token => {
        console.log("세션 토큰 존재:", !!token);
        if (token) {
          console.log("세션 토큰 길이:", token.length);
        }
      }).catch(err => {
        console.error("세션 토큰 가져오기 실패:", err);
      });
      
      // URL 파라미터 확인
      const clerkStatus = searchParams.get("__clerk_status");
      const clerkRedirectUrl = searchParams.get("__clerk_redirect_url");
      console.log("__clerk_status:", clerkStatus);
      console.log("__clerk_redirect_url:", clerkRedirectUrl);
      
      // 검증 판정
      if (!isSignedIn || !userId || !sessionId) {
        console.error("❌ [검증 실패] 세션이 생성되지 않았습니다!");
        console.error("   - isSignedIn:", isSignedIn);
        console.error("   - userId:", userId);
        console.error("   - sessionId:", sessionId);
        console.error("   → '추가 정보 입력 필요' 또는 '사용자 생성 실패' 상태일 수 있습니다.");
      } else {
        console.log("✅ [검증 성공] 세션이 정상적으로 생성되었습니다!");
        console.log("   - userId:", userId);
        console.log("   - sessionId:", sessionId);
      }
      
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
      // 세션이 생성되지 않은 경우 더 긴 대기 시간 제공
      const waitTime = (!isSignedIn || !userId || !sessionId) ? 3000 : 2000;
      
      // 로그를 더 오래 볼 수 있도록 경고 표시
      console.warn("⚠️ 3초 후 페이지가 새로고침됩니다. 로그를 확인하세요!");
      console.warn("   페이지 새로고침 후에도 로그를 보려면:");
      console.warn("   localStorage.getItem('oauth_callback_logs')를 콘솔에 입력하세요.");
      
      setTimeout(() => {
        // 재검증
        console.log("[AuthSessionSync] 대기 후 재검증");
        console.log("isSignedIn:", isSignedIn);
        console.log("userId:", userId);
        console.log("sessionId:", sessionId);
        
        // 최종 검증 결과를 localStorage에 저장
        const finalLog = {
          timestamp: new Date().toISOString(),
          finalCheck: {
            isSignedIn,
            userId,
            sessionId,
            hasUser: !!user,
            externalAccountsCount: user?.externalAccounts?.length || 0,
          },
        };
        const existingLogs = JSON.parse(localStorage.getItem("oauth_callback_logs") || "[]");
        existingLogs.push(finalLog);
        if (existingLogs.length > 10) {
          existingLogs.shift();
        }
        localStorage.setItem("oauth_callback_logs", JSON.stringify(existingLogs));
        
        if (!isSignedIn || !userId || !sessionId) {
          console.error("❌ [최종 검증 실패] 세션이 여전히 생성되지 않았습니다!");
          console.error("   → Clerk Dashboard의 Attribute Mapping을 확인하세요:");
          console.error("      - User ID / Subject → sub");
          console.error("      - Email → email");
          console.error("   → Proxy 서버 로그에서 응답 데이터 확인:");
          console.error("      - sub 값이 올바른지");
          console.error("      - email 값이 올바른지");
        } else if (user && (!user.externalAccounts || user.externalAccounts.length === 0)) {
          console.error("❌ [중요] 세션은 생성되었지만 External Account가 연결되지 않았습니다!");
          console.error("   → 'The External Account was not found' 에러의 원인입니다.");
          console.error("   → Proxy 서버 응답의 sub 값이 Clerk가 기대하는 형식과 일치하지 않을 수 있습니다.");
        } else {
          console.log("✅ [최종 검증 성공] 세션과 External Account가 모두 정상입니다!");
        }
        
        console.log("[AuthSessionSync] 세션 동기화를 위해 페이지 새로고침");
        console.log("리다이렉트 URL:", cleanUrl || "/");
        // 전체 페이지 새로고침으로 세션 상태를 확실히 반영
        window.location.href = cleanUrl || "/";
      }, waitTime);
      
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
  }, [isLoaded, isSignedIn, userId, sessionId, userLoaded, user, router, searchParams, getToken]);

  return null;
}

