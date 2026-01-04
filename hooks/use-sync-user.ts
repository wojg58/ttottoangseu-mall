"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * Clerk 사용자를 Supabase DB에 자동으로 동기화하는 훅
 *
 * 사용자가 로그인한 상태에서 이 훅을 사용하면
 * 자동으로 /api/sync-user를 호출하여 Supabase users 테이블에 사용자 정보를 저장합니다.
 *
 * OAuth 로그인(네이버, 카카오 등) 시 Clerk가 사용자를 자동으로 생성하지 못하는 경우를 대비하여
 * 사용자 정보가 완전히 로드될 때까지 대기한 후 동기화를 시도합니다.
 */
export function useSyncUser() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    // 디버깅: 현재 상태 로그
    console.log("[useSyncUser] useEffect 실행", {
      synced: syncedRef.current,
      isLoaded,
      isSignedIn,
      userId,
      userLoaded,
      hasUser: !!user,
      timestamp: new Date().toISOString(),
    });

    // 이미 동기화했거나, 로딩 중이거나, 로그인하지 않은 경우 무시
    if (syncedRef.current) {
      console.log("[useSyncUser] 이미 동기화 완료, 건너뜀");
      return;
    }
    
    if (!isLoaded) {
      console.log("[useSyncUser] Clerk 로딩 중, 건너뜀");
      return;
    }
    
    if (!isSignedIn) {
      console.log("[useSyncUser] 로그인하지 않음, 건너뜀");
      return;
    }
    
    if (!userId) {
      console.log("[useSyncUser] userId 없음, 건너뜀");
      return;
    }

    // OAuth 로그인 시 사용자 정보가 완전히 로드될 때까지 대기
    if (!userLoaded) {
      console.log("[useSyncUser] 사용자 정보 로딩 중 (userLoaded: false), 대기...");
      return;
    }
    
    if (!user) {
      console.log("[useSyncUser] 사용자 정보 없음 (user: null), 대기...");
      return;
    }
    
    console.log("[useSyncUser] ✅ 모든 조건 만족, 동기화 시작!");

    // 동기화 실행 (약간의 딜레이 추가)
    const syncUser = async () => {
      try {
        // Clerk 세션이 완전히 준비될 때까지 잠시 대기
        // OAuth 로그인 후 사용자 정보가 완전히 로드되는데 시간이 걸릴 수 있음
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.group("🔄 사용자 동기화 시작");
        console.log("userId:", userId);
        console.log("isLoaded:", isLoaded);
        console.log("isSignedIn:", isSignedIn);
        console.log("userLoaded:", userLoaded);
        console.log("user 존재:", !!user);
        console.log("시간:", new Date().toISOString());

        // 사용자 정보 확인
        if (user) {
          console.log("👤 Clerk 사용자 정보:", {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress,
            name: user.fullName || user.username,
            externalAccounts: user.externalAccounts?.length || 0,
          });
        }

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
  }, [isLoaded, isSignedIn, userId, getToken, userLoaded, user]);

  // 네이버 로그인 후 Clerk 사용자 생성 실패 진단
  useEffect(() => {
    // isLoaded가 true인데 isSignedIn이 false면 Clerk가 사용자를 생성하지 못한 것
    if (isLoaded && !isSignedIn && !userId) {
      console.error("❌ [중요] 네이버 로그인 후 Clerk가 사용자를 생성하지 못했습니다!");
      console.error("   → 가능한 원인:");
      console.error("      1. Proxy 서버 응답 문제");
      console.error("         - Proxy 서버가 Clerk에 응답을 제대로 반환하지 못함");
      console.error("         - Proxy 서버 로그 확인: ssh로 접속 후 'pm2 logs clerk-userinfo-proxy'");
      console.error("      2. Clerk Attribute Mapping 설정 문제");
      console.error("         - Clerk Dashboard → SSO Connections → 네이버");
      console.error("         - User ID / Subject → 'sub' (대소문자 주의)");
      console.error("         - Email → 'email'");
      console.error("      3. 네이버에서 제공한 정보 부족");
      console.error("         - 네이버 개발자 센터에서 이메일 제공 정보가 필수 동의로 설정되어 있는지 확인");
      console.error("   → 확인 방법:");
      console.error("      1. Proxy 서버 로그에서 '[INFO] 최종 응답 JSON' 확인");
      console.error("      2. Clerk Dashboard → Users에서 사용자 생성 여부 확인");
      console.error("      3. 네이버 로그인 시 이메일 동의 화면이 나타나는지 확인");
    }
  }, [isLoaded, isSignedIn, userId]);
}
