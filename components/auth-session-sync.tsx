"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import logger from "@/lib/logger-client";

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
      const timestamp = new Date().toISOString();
      
      // Sentry에 OAuth 콜백 시작 이벤트 전송
      Sentry.addBreadcrumb({
        category: "oauth",
        message: "OAuth 콜백 감지 - 세션 생성 검증 시작",
        level: "info",
        data: {
          url: currentUrl,
          timestamp,
        },
      });
      
      logger.group("[AuthSessionSync] OAuth 콜백 감지 - 세션 생성 검증 시작");
      logger.debug("[AuthSessionSync] OAuth 콜백 URL 감지", {
        hasClerkRedirectUrl: searchParams.has("__clerk_redirect_url"),
        hasClerkStatus: searchParams.has("__clerk_status"),
      });
      
      // 검증 문서 6차 진단: 세션 생성 여부 확인
      logger.debug("[AuthSessionSync] 세션 생성 검증", {
        isSignedIn,
        hasUserId: !!userId,
        hasSessionId: !!sessionId,
        userLoaded,
        hasUser: !!user,
      });
      
      let userInfo = null;
      let externalAccounts: any[] = [];
      let hasToken = false;
      let tokenLength = 0;
      
      if (user) {
        // 민감 정보는 로깅하지 않음 (마스킹된 정보만 필요 시 사용)
        externalAccounts = user.externalAccounts?.map((acc) => ({
          provider: acc.provider,
          providerUserId: acc.providerUserId,
          verified: acc.verification?.status,
        })) || [];
        
        // External Account가 없는 경우 경고
        if (!user.externalAccounts || user.externalAccounts.length === 0) {
          logger.error("[AuthSessionSync] External Account가 없습니다");
          logger.debug("[AuthSessionSync] 가능한 원인: Clerk Dashboard 설정 또는 Proxy 서버 응답 문제");
        } else {
          logger.debug("[AuthSessionSync] External Account 연결됨", {
            providers: user.externalAccounts.map(acc => acc.provider),
            count: user.externalAccounts.length,
          });
        }
      }
      
      // URL 파라미터 확인
      const clerkStatus = searchParams.get("__clerk_status");
      const clerkRedirectUrl = searchParams.get("__clerk_redirect_url");
      logger.debug("[AuthSessionSync] Clerk 파라미터", {
        hasStatus: !!clerkStatus,
        hasRedirectUrl: !!clerkRedirectUrl,
      });
      
      // 검증 판정
      const verificationResult = {
        success: false,
        error: null as string | null,
        warnings: [] as string[],
      };
      
      if (!isSignedIn || !userId || !sessionId) {
        verificationResult.error = "세션이 생성되지 않았습니다";
        logger.error("[AuthSessionSync] 세션 생성 실패", {
          isSignedIn,
          hasUserId: !!userId,
          hasSessionId: !!sessionId,
        });
        
        // Sentry에 세션 생성 실패 이벤트 전송
        Sentry.captureMessage("OAuth 세션 생성 실패", {
          level: "error",
          tags: {
            oauth_provider: "naver",
            session_creation: "failed",
          },
          contexts: {
            oauth_callback: {
              url: currentUrl,
              timestamp,
              isSignedIn,
              hasUserId: !!userId,
              hasSessionId: !!sessionId,
              userLoaded,
              hasUser: !!user,
              hasClerkStatus: !!clerkStatus,
              hasClerkRedirectUrl: !!clerkRedirectUrl,
            },
            verification: verificationResult,
          },
          extra: {
            externalAccountsCount: externalAccounts.length,
            hasToken,
          },
        });
      } else if (user && (!user.externalAccounts || user.externalAccounts.length === 0)) {
        verificationResult.warnings.push("External Account가 연결되지 않았습니다");
        logger.warn("[AuthSessionSync] External Account 연결 실패", {
          hasSession: true,
          externalAccountsCount: 0,
        });
        
        // Sentry에 External Account 연결 실패 이벤트 전송
        Sentry.captureMessage("OAuth External Account 연결 실패", {
          level: "warning",
          tags: {
            oauth_provider: "naver",
            session_creation: "success",
            external_account: "missing",
          },
          contexts: {
            oauth_callback: {
              url: currentUrl,
              timestamp,
              hasUserId: !!userId,
              hasSessionId: !!sessionId,
              hasUser: !!user,
            },
            verification: verificationResult,
          },
          extra: {
            externalAccountsCount: externalAccounts.length,
          },
        });
      } else {
        verificationResult.success = true;
        logger.debug("[AuthSessionSync] 세션 생성 성공", {
          hasUserId: !!userId,
          hasSessionId: !!sessionId,
          hasExternalAccounts: user?.externalAccounts?.length > 0,
        });
        
        // Sentry에 성공 이벤트 전송 (디버깅용)
        Sentry.addBreadcrumb({
          category: "oauth",
          message: "OAuth 세션 생성 성공",
          level: "info",
          data: {
            hasUserId: !!userId,
            hasSessionId: !!sessionId,
            hasExternalAccounts: user?.externalAccounts?.length > 0,
          },
        });
      }
      
      // 세션 토큰 확인 후 서버로 로그 전송
      const sendLogToServer = async () => {
        try {
          // 세션 토큰 확인 (민감 정보이므로 로깅하지 않음)
          const token = await getToken();
          hasToken = !!token;
          tokenLength = token?.length || 0;
          logger.debug("[AuthSessionSync] 세션 토큰 확인 완료", {
            hasToken,
          });
        } catch (err) {
          logger.error("[AuthSessionSync] 세션 토큰 가져오기 실패", err);
        }
        
        // 서버로 로그 전송
        const logPayload = {
          timestamp,
          url: currentUrl,
          isSignedIn,
          userId,
          sessionId,
          userLoaded,
          hasUser: !!user,
          userInfo,
          externalAccounts,
          clerkStatus,
          clerkRedirectUrl,
          hasToken,
          tokenLength,
          verificationResult,
        };
        
        logger.debug("[AuthSessionSync] 서버로 로그 전송 중");
        
        try {
          const res = await fetch("/api/log-oauth-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logPayload),
          });
          
          if (res.ok) {
            const result = await res.json();
            logger.debug("[AuthSessionSync] 서버 로그 저장 완료", {
              message: result.message,
            });
          } else {
            const errorText = await res.text();
            logger.error("[AuthSessionSync] 서버 로그 저장 실패", {
              status: res.status,
              error: errorText,
            });
          }
        } catch (err) {
          logger.error("[AuthSessionSync] 서버 로그 전송 실패", err);
        }
      };
      
      // 즉시 실행
      sendLogToServer();
      
      // OAuth 콜백 파라미터 제거 (페이지 새로고침 전에 정리)
      const url = new URL(currentUrl);
      url.searchParams.delete("__clerk_redirect_url");
      url.searchParams.delete("__clerk_status");
      
      // URL에서 __clerk 관련 파라미터 모두 제거
      let cleanSearch = url.search;
      cleanSearch = cleanSearch.replace(/[?&]__clerk[^&]*/g, '');
      cleanSearch = cleanSearch.replace(/[?&]oauth_callback[^&]*/g, '');
      const cleanUrl = url.pathname + (cleanSearch || '');
      
      // Network 탭에서 실패한 요청을 확인할 수 있도록 충분한 대기 시간 제공
      // 세션이 생성되지 않은 경우 더 긴 대기 시간 제공
      const waitTime = (!isSignedIn || !userId || !sessionId) ? 10000 : 8000;
      
      // 로그를 더 오래 볼 수 있도록 경고 표시
      logger.debug("[AuthSessionSync] Network 탭 확인 안내", {
        waitTimeSeconds: waitTime / 1000,
      });
      
      // 전역 변수로 리다이렉션 제어 가능하게 설정
      (window as any).stopRedirect = false;
      
      let timeoutId2: NodeJS.Timeout | null = null;
      
      const timeoutId1 = setTimeout(() => {
        // 사용자가 리다이렉션을 중지한 경우 확인
        if ((window as any).stopRedirect) {
          logger.debug("[AuthSessionSync] 리다이렉션 중지됨");
          return;
        }
        // 재검증
        logger.debug("[AuthSessionSync] 대기 후 재검증", {
          isSignedIn,
          hasUserId: !!userId,
          hasSessionId: !!sessionId,
        });
        
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
          logger.error("[AuthSessionSync] 최종 검증 실패", {
            isSignedIn,
            hasUserId: !!userId,
            hasSessionId: !!sessionId,
          });
          logger.debug("[AuthSessionSync] 해결 방법: Clerk Dashboard 설정 확인 필요");
          
          // Sentry에 최종 검증 실패 이벤트 전송
          Sentry.captureMessage("OAuth 세션 생성 최종 검증 실패", {
            level: "error",
            tags: {
              oauth_provider: "naver",
              session_creation: "failed",
              verification: "final_check",
            },
            contexts: {
              oauth_callback: {
                url: currentUrl,
                timestamp,
                finalCheck: {
                  isSignedIn,
                  hasUserId: !!userId,
                  hasSessionId: !!sessionId,
                  userLoaded,
                  hasUser: !!user,
                },
              },
            },
            extra: {
              externalAccountsCount: externalAccounts.length,
              hasClerkStatus: !!clerkStatus,
              hasClerkRedirectUrl: !!clerkRedirectUrl,
            },
          });
        } else if (user && (!user.externalAccounts || user.externalAccounts.length === 0)) {
          logger.warn("[AuthSessionSync] External Account 연결 실패 (최종 검증)", {
            hasSession: true,
            externalAccountsCount: 0,
          });
          
          // Sentry에 최종 검증 경고 이벤트 전송
          Sentry.captureMessage("OAuth External Account 연결 최종 검증 실패", {
            level: "warning",
            tags: {
              oauth_provider: "naver",
              session_creation: "success",
              external_account: "missing",
              verification: "final_check",
            },
            contexts: {
              oauth_callback: {
                url: currentUrl,
                timestamp,
                finalCheck: {
                  isSignedIn,
                  hasUserId: !!userId,
                  hasSessionId: !!sessionId,
                  hasUser: !!user,
                },
              },
            },
            extra: {
              externalAccountsCount: externalAccounts.length,
            },
          });
        } else {
          logger.debug("[AuthSessionSync] 최종 검증 성공");
        }
        
        logger.debug("[AuthSessionSync] 세션 동기화를 위해 페이지 새로고침", {
          redirectUrl: cleanUrl || "/",
        });
        
        // Network 탭 확인을 위한 추가 대기 (선택적)
        // 사용자가 확인할 시간을 더 주기 위해 2초 더 대기
        timeoutId2 = setTimeout(() => {
          // 전체 페이지 새로고침으로 세션 상태를 확실히 반영
          window.location.href = cleanUrl || "/";
        }, 2000);
      }, waitTime);
      
      hasCheckedRef.current = true;
      logger.groupEnd();
      return () => {
        if (timeoutId1) clearTimeout(timeoutId1);
        if (timeoutId2) clearTimeout(timeoutId2);
      };
    }

    // 일반 페이지 로드 시 세션 상태 확인
    // 로그인 상태가 변경되었을 때 페이지를 새로고침하여 UI 업데이트
    if (isSignedIn) {
      // 세션이 활성화되었지만 UI가 업데이트되지 않은 경우를 대비하여
      // 약간의 딜레이 후 강제 리렌더링
      const timeoutId = setTimeout(() => {
        // 현재 URL에서 리다이렉트가 필요한지 확인
        const currentPath = window.location.pathname;
        if (currentPath === "/sign-in" || currentPath.startsWith("/sign-in/")) {
          router.replace("/");
        }
      }, 1000);

      hasCheckedRef.current = true;
      return () => clearTimeout(timeoutId);
    }
    
    hasCheckedRef.current = true;
  }, [isLoaded, isSignedIn, userId, sessionId, userLoaded, user, router, searchParams, getToken]);

  return null;
}

