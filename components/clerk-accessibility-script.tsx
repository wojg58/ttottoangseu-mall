/**
 * @file components/clerk-accessibility-script.tsx
 * @description Clerk iframe 접근성 개선 및 로그 저장 기능
 * 
 * 이 컴포넌트는 클라이언트 사이드에서만 실행되어 hydration 오류를 방지합니다.
 */

"use client";

import { useEffect } from "react";

export function ClerkAccessibilityScript() {
  useEffect(() => {
    // Clerk iframe에 title 추가
    const observer = new MutationObserver(() => {
      const clerkIframes = document.querySelectorAll('iframe[src*="clerk"]');
      clerkIframes.forEach((iframe) => {
        if (!iframe.getAttribute("title")) {
          iframe.setAttribute("title", "Clerk 인증 서비스");
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 모든 콘솔 로그를 localStorage에 저장
    const MAX_LOGS = 500;
    const STORAGE_KEY = "app_console_logs";

    // 기존 로그 불러오기
    let logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      args?: unknown[];
    }> = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error("로그 불러오기 실패:", e);
    }

    // 로그 저장 함수
    function saveLog(
      level: string,
      message: string,
      args?: unknown[]
    ): void {
      try {
        const entry = {
          timestamp: new Date().toISOString(),
          level: level,
          message: message,
          args: args
            ? args.map((arg) => {
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
                } catch {
                  return String(arg);
                }
              })
            : undefined,
        };

        logs.push(entry);

        // 최대 개수 제한
        if (logs.length > MAX_LOGS) {
          logs = logs.slice(-MAX_LOGS);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      } catch (e) {
        // localStorage 용량 초과 시 오래된 로그 삭제
        if (
          e instanceof Error &&
          (e as Error & { name?: string }).name === "QuotaExceededError"
        ) {
          logs = logs.slice(-Math.floor(MAX_LOGS / 2));
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
          } catch {
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
    console.log = function (...args: unknown[]) {
      originalConsole.log(...args);
      const message = args
        .map((arg) => {
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(" ");
      saveLog("log", message, args);
    };

    // console.warn 오버라이드
    console.warn = function (...args: unknown[]) {
      originalConsole.warn(...args);
      const message = args.map((arg) => String(arg)).join(" ");
      saveLog("warn", message, args);
    };

    // console.error 오버라이드
    console.error = function (...args: unknown[]) {
      originalConsole.error(...args);
      const message = args.map((arg) => String(arg)).join(" ");
      saveLog("error", message, args);
    };

    // console.info 오버라이드
    console.info = function (...args: unknown[]) {
      originalConsole.info(...args);
      const message = args.map((arg) => String(arg)).join(" ");
      saveLog("info", message, args);
    };

    // console.debug 오버라이드
    console.debug = function (...args: unknown[]) {
      originalConsole.debug(...args);
      const message = args.map((arg) => String(arg)).join(" ");
      saveLog("debug", message, args);
    };

    // console.group 오버라이드
    console.group = function (...args: unknown[]) {
      originalConsole.group(...args);
      const message = args.map((arg) => String(arg)).join(" ");
      saveLog("group", message, args);
    };

    // console.groupEnd 오버라이드
    console.groupEnd = function () {
      originalConsole.groupEnd();
      saveLog("groupEnd", "");
    };

    // 전역 함수로 접근 가능하도록 설정
    (window as any).getStoredLogs = function () {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    (window as any).clearStoredLogs = function () {
      logs = [];
      localStorage.removeItem(STORAGE_KEY);
      console.log("로그가 초기화되었습니다.");
    };

    (window as any).replayStoredLogs = function () {
      const storedLogs = (window as any).getStoredLogs();
      console.group("📋 저장된 로그 재생 (" + storedLogs.length + "개)");
      storedLogs.forEach(function (entry: {
        timestamp: string;
        level: string;
        message: string;
        args?: unknown[];
      }) {
        const prefix =
          "[" + entry.timestamp + "] [" + entry.level.toUpperCase() + "]";
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

    // cleanup 함수
    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}

