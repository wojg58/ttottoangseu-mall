"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import logger from "@/lib/logger-client";

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
    // 디버깅: 현재 상태 로그 (민감 정보 제외)
    logger.debug("[useSyncUser] useEffect 실행", {
      synced: syncedRef.current,
      isLoaded,
      isSignedIn,
      hasUserId: !!userId,
      userLoaded,
      hasUser: !!user,
    });

    // 이미 동기화했거나, 로딩 중이거나, 로그인하지 않은 경우 무시
    if (syncedRef.current) {
      logger.debug("[useSyncUser] 이미 동기화 완료, 건너뜀");
      return;
    }
    
    if (!isLoaded) {
      logger.debug("[useSyncUser] Clerk 로딩 중, 건너뜀");
      return;
    }
    
    if (!isSignedIn) {
      logger.debug("[useSyncUser] 로그인하지 않음, 건너뜀");
      return;
    }
    
    if (!userId) {
      logger.debug("[useSyncUser] userId 없음, 건너뜀");
      return;
    }

    // OAuth 로그인 시 사용자 정보가 완전히 로드될 때까지 대기
    if (!userLoaded) {
      logger.debug("[useSyncUser] 사용자 정보 로딩 중, 대기");
      return;
    }
    
    if (!user) {
      logger.debug("[useSyncUser] 사용자 정보 없음, 대기");
      return;
    }
    
    logger.debug("[useSyncUser] 모든 조건 만족, 동기화 시작");

    // 동기화 실행 (약간의 딜레이 추가)
    const syncUser = async () => {
      try {
        // Clerk 세션이 완전히 준비될 때까지 잠시 대기
        // OAuth 로그인 후 사용자 정보가 완전히 로드되는데 시간이 걸릴 수 있음
        await new Promise((resolve) => setTimeout(resolve, 1000));

        logger.group("[useSyncUser] 사용자 동기화 시작");
        logger.debug("[useSyncUser] 동기화 상태", {
          isLoaded,
          isSignedIn,
          userLoaded,
          hasUser: !!user,
          hasExternalAccounts: user?.externalAccounts?.length > 0,
        });

        // Clerk 토큰 가져오기 (민감 정보이므로 로깅하지 않음)
        const token = await getToken();
        logger.debug("[useSyncUser] 토큰 확인 완료", {
          hasToken: !!token,
        });

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
          // 401 Unauthorized는 로그인하지 않은 상태에서 정상적인 응답이므로 조용히 처리
          if (response.status === 401) {
            logger.debug("[useSyncUser] 로그인하지 않은 상태, 동기화 건너뜀");
            logger.groupEnd();
            return;
          }

          // 에러 응답 파싱 시도
          let errorMessage = `HTTP ${response.status}`;
          try {
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } else {
              const errorText = await response.text();
              errorMessage = errorText || errorMessage;
            }
          } catch (parseError) {
            // 파싱 실패 시 상태 코드만 사용
            logger.debug("[useSyncUser] 에러 응답 파싱 실패", parseError);
          }

          logger.error("[useSyncUser] 동기화 실패", {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            url: response.url,
          });
          logger.groupEnd();
          return;
        }

        const data = await response.json();
        logger.debug("[useSyncUser] 동기화 성공", {
          success: data.success || true,
        });
        syncedRef.current = true;
        logger.groupEnd();
      } catch (error) {
        logger.error("[useSyncUser] 동기화 중 에러", error);
        logger.groupEnd();
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, getToken, userLoaded, user]);
}
