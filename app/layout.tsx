import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import { Gowun_Dodum, Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";

import ShopHeader from "@/components/shop-header";
import ShopFooter from "@/components/shop-footer";
import { SyncUserProvider } from "@/components/providers/sync-user-provider";
import { AuthSessionSync } from "@/components/auth-session-sync";
import MarketingScripts from "@/components/marketing-scripts";
import ChatbotLottieLauncher from "@/components/ChatbotLottieLauncher";
import ChatWidgetWrapper from "@/components/chatbot/chat-widget-wrapper";
import "./globals.css";

// Google Fonts 최적화 - 한글 서브셋 포함
// preload는 첫 번째 폰트만 활성화하여 FCP 개선
const gowunDodum = Gowun_Dodum({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-gowun-dodum",
  preload: true, // 첫 번째 폰트만 preload
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  preload: false, // 성능 최적화: preload 비활성화
});

// Nanum Gothic 대신 Noto Sans KR 사용 (더 나은 최적화 지원)
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-kr",
  preload: false, // 성능 최적화: preload 비활성화
});

export const metadata: Metadata = {
  title: "또또앙스 | 캐릭터 굿즈 전문 쇼핑몰",
  description:
    "산리오, 디즈니 등 다양한 캐릭터 굿즈를 만나보세요. 귀여운 키링, 파우치, 핸드폰 스트랩 등 두근거리는 설렘을 선사합니다.",
  keywords: [
    "캐릭터 굿즈",
    "산리오",
    "헬로키티",
    "키링",
    "굿즈 쇼핑몰",
    "또또앙스",
  ],
  viewport: "width=device-width, initial-scale=1.0",
  openGraph: {
    title: "또또앙스 | 캐릭터 굿즈 전문 쇼핑몰",
    description:
      "산리오, 디즈니 등 다양한 캐릭터 굿즈를 만나보세요. 두근거리는 설렘 (*´v`*) Love",
    type: "website",
    locale: "ko_KR",
  },
};

// Clerk localization 커스터마이징 - "사용자 이름"을 "아이디"로 변경
const customKoKR: any = {
  ...koKR,
  formFieldLabel__username: "아이디",
  formFieldLabel__identifier: "아이디",
  // 중첩 구조도 시도
  formFields: {
    ...(koKR as any).formFields,
    username: {
      ...((koKR as any).formFields as any)?.username,
      label: "아이디",
    },
    identifier: {
      ...((koKR as any).formFields as any)?.identifier,
      label: "아이디",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 운영 환경에서 Clerk 도메인 명시적 설정
  const clerkDomain = process.env.NEXT_PUBLIC_CLERK_DOMAIN;
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // 배포 환경 디버깅 로그
  if (typeof window === "undefined") {
    console.log("[RootLayout] Clerk 설정:", {
      hasDomain: !!clerkDomain,
      hasPublishableKey: !!clerkPublishableKey,
      publishableKeyPrefix: clerkPublishableKey?.substring(0, 10) || "none",
      isProduction: process.env.NODE_ENV === "production",
    });
  }

  // Type assertion for Next.js 15 compatibility
  const ClerkProviderWrapper = ClerkProvider as any;

  return (
    <ClerkProviderWrapper
      localization={customKoKR}
      {...(clerkDomain ? { domain: clerkDomain } : {})}
    >
      <html
        lang="ko"
        className={`${gowunDodum.variable} ${plusJakartaSans.variable} ${notoSansKR.variable}`}
      >
        <body
          className="antialiased min-h-screen flex flex-col"
          suppressHydrationWarning
        >
          <SyncUserProvider>
            <Suspense fallback={null}>
              <AuthSessionSync />
            </Suspense>
            <ShopHeader />
            <div className="flex-1">{children}</div>
            <ShopFooter />
          </SyncUserProvider>
          {/* 마케팅 스크립트 - 페이지 로드 후 lazyOnload로 로드 */}
          <MarketingScripts />
          {/* ChatWidget - 버튼은 숨겨지고 Dialog만 사용 */}
          <ChatWidgetWrapper />
          {/* Clerk iframe 접근성 개선 및 로그 저장 기능 초기화 */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Clerk iframe에 title 추가
                if (typeof window !== 'undefined') {
                  const observer = new MutationObserver(() => {
                    const clerkIframes = document.querySelectorAll('iframe[src*="clerk"]');
                    clerkIframes.forEach((iframe) => {
                      if (!iframe.getAttribute('title')) {
                        iframe.setAttribute('title', 'Clerk 인증 서비스');
                      }
                    });
                  });
                  observer.observe(document.body, { childList: true, subtree: true });
                  
                  // 모든 콘솔 로그를 localStorage에 저장
                  (function() {
                    const MAX_LOGS = 500;
                    const STORAGE_KEY = "app_console_logs";
                    
                    // 기존 로그 불러오기
                    let logs = [];
                    try {
                      const stored = localStorage.getItem(STORAGE_KEY);
                      if (stored) {
                        logs = JSON.parse(stored);
                      }
                    } catch (e) {
                      console.error("로그 불러오기 실패:", e);
                    }
                    
                    // 로그 저장 함수
                    function saveLog(level, message, args) {
                      try {
                        const entry = {
                          timestamp: new Date().toISOString(),
                          level: level,
                          message: message,
                          args: args ? args.map(arg => {
                            try {
                              if (typeof arg === "object" && arg !== null) {
                                if (typeof arg === "function") {
                                  return "[Function: " + (arg.name || "anonymous") + "]";
                                }
                                const str = JSON.stringify(arg);
                                if (str.length > 1000) {
                                  return str.substring(0, 1000) + "... (truncated)";
                                }
                                return JSON.parse(str);
                              }
                              return arg;
                            } catch (e) {
                              return String(arg);
                            }
                          }) : undefined,
                        };
                        
                        logs.push(entry);
                        
                        // 최대 개수 제한
                        if (logs.length > MAX_LOGS) {
                          logs = logs.slice(-MAX_LOGS);
                        }
                        
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
                      } catch (e) {
                        // localStorage 용량 초과 시 오래된 로그 삭제
                        if (e.name === "QuotaExceededError") {
                          logs = logs.slice(-Math.floor(MAX_LOGS / 2));
                          try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
                          } catch (e2) {
                            // 저장 실패 시 조용히 처리
                          }
                        }
                      }
                    }
                    
                    // 원본 console 메서드 저장
                    const originalConsole = {
                      log: console.log.bind(console),
                      warn: console.warn.bind(console),
                      error: console.error.bind(console),
                      info: console.info.bind(console),
                      debug: console.debug.bind(console),
                      group: console.group.bind(console),
                      groupEnd: console.groupEnd.bind(console),
                    };
                    
                    // console.log 오버라이드
                    console.log = function(...args) {
                      originalConsole.log(...args);
                      const message = args.map(arg => {
                        if (typeof arg === "object") {
                          try {
                            return JSON.stringify(arg, null, 2);
                          } catch {
                            return String(arg);
                          }
                        }
                        return String(arg);
                      }).join(" ");
                      saveLog("log", message, args);
                    };
                    
                    // console.warn 오버라이드
                    console.warn = function(...args) {
                      originalConsole.warn(...args);
                      const message = args.map(arg => String(arg)).join(" ");
                      saveLog("warn", message, args);
                    };
                    
                    // console.error 오버라이드
                    console.error = function(...args) {
                      originalConsole.error(...args);
                      const message = args.map(arg => String(arg)).join(" ");
                      saveLog("error", message, args);
                    };
                    
                    // console.info 오버라이드
                    console.info = function(...args) {
                      originalConsole.info(...args);
                      const message = args.map(arg => String(arg)).join(" ");
                      saveLog("info", message, args);
                    };
                    
                    // console.debug 오버라이드
                    console.debug = function(...args) {
                      originalConsole.debug(...args);
                      const message = args.map(arg => String(arg)).join(" ");
                      saveLog("debug", message, args);
                    };
                    
                    // console.group 오버라이드
                    console.group = function(...args) {
                      originalConsole.group(...args);
                      const message = args.map(arg => String(arg)).join(" ");
                      saveLog("group", message, args);
                    };
                    
                    // console.groupEnd 오버라이드
                    console.groupEnd = function() {
                      originalConsole.groupEnd();
                      saveLog("groupEnd", "");
                    };
                    
                    // 전역 함수로 접근 가능하도록 설정
                    window.getStoredLogs = function() {
                      try {
                        const stored = localStorage.getItem(STORAGE_KEY);
                        return stored ? JSON.parse(stored) : [];
                      } catch {
                        return [];
                      }
                    };
                    
                    window.clearStoredLogs = function() {
                      logs = [];
                      localStorage.removeItem(STORAGE_KEY);
                      console.log("로그가 초기화되었습니다.");
                    };
                    
                    window.replayStoredLogs = function() {
                      const storedLogs = window.getStoredLogs();
                      console.group("📋 저장된 로그 재생 (" + storedLogs.length + "개)");
                      storedLogs.forEach(function(entry) {
                        const prefix = "[" + entry.timestamp + "] [" + entry.level.toUpperCase() + "]";
                        switch (entry.level) {
                          case "log":
                            originalConsole.log(prefix, entry.message, ...(entry.args || []));
                            break;
                          case "warn":
                            originalConsole.warn(prefix, entry.message, ...(entry.args || []));
                            break;
                          case "error":
                            originalConsole.error(prefix, entry.message, ...(entry.args || []));
                            break;
                          case "info":
                            originalConsole.info(prefix, entry.message, ...(entry.args || []));
                            break;
                          case "debug":
                            originalConsole.debug(prefix, entry.message, ...(entry.args || []));
                            break;
                          case "group":
                            originalConsole.group(prefix, entry.message);
                            break;
                          case "groupEnd":
                            originalConsole.groupEnd();
                            break;
                        }
                      });
                      console.groupEnd();
                    };
                    
                    console.log("💾 모든 콘솔 로그가 localStorage에 저장됩니다.");
                    console.log("   - getStoredLogs(): 저장된 로그 가져오기");
                    console.log("   - clearStoredLogs(): 로그 초기화");
                    console.log("   - replayStoredLogs(): 로그 재생");
                  })();
                }
              `,
            }}
          />
          <ChatbotLottieLauncher />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
