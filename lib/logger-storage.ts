/**
 * 모든 콘솔 로그를 localStorage에 저장하는 유틸리티
 * 
 * 페이지 새로고침 후에도 로그를 확인할 수 있도록 localStorage에 저장합니다.
 */

const MAX_LOGS = 500; // 최대 저장할 로그 개수
const STORAGE_KEY = "app_console_logs";

interface LogEntry {
  timestamp: string;
  level: "log" | "warn" | "error" | "info" | "debug" | "group" | "groupEnd";
  message: string;
  args?: any[];
}

class LoggerStorage {
  private logs: LogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
    group: typeof console.group;
    groupEnd: typeof console.groupEnd;
  };

  constructor() {
    // 기존 로그 불러오기
    this.loadLogs();
    
    // 원본 console 메서드 저장
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
      group: console.group.bind(console),
      groupEnd: console.groupEnd.bind(console),
    };

    // console 메서드 오버라이드
    this.overrideConsole();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error("로그 불러오기 실패:", e);
    }
  }

  private saveLogs() {
    try {
      // 최대 개수 제한
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // localStorage 용량 초과 시 오래된 로그 삭제
      if (e instanceof Error && e.name === "QuotaExceededError") {
        this.logs = this.logs.slice(-Math.floor(MAX_LOGS / 2));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch (e2) {
          console.error("로그 저장 실패 (용량 초과):", e2);
        }
      }
    }
  }

  private addLog(level: LogEntry["level"], message: string, args?: any[]) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      args: args ? args.map(arg => {
        // 순환 참조 방지 및 직렬화 가능한 형태로 변환
        try {
          if (typeof arg === "object" && arg !== null) {
            // 함수나 undefined는 문자열로 변환
            if (typeof arg === "function") {
              return `[Function: ${arg.name || "anonymous"}]`;
            }
            // 너무 큰 객체는 요약
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

    this.logs.push(entry);
    this.saveLogs();
  }

  private overrideConsole() {
    // console.log 오버라이드
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
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
      this.addLog("log", message, args);
    };

    // console.warn 오버라이드
    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      const message = args.map(arg => String(arg)).join(" ");
      this.addLog("warn", message, args);
    };

    // console.error 오버라이드
    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      const message = args.map(arg => String(arg)).join(" ");
      this.addLog("error", message, args);
    };

    // console.info 오버라이드
    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      const message = args.map(arg => String(arg)).join(" ");
      this.addLog("info", message, args);
    };

    // console.debug 오버라이드
    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      const message = args.map(arg => String(arg)).join(" ");
      this.addLog("debug", message, args);
    };

    // console.group 오버라이드
    console.group = (...args: any[]) => {
      this.originalConsole.group(...args);
      const message = args.map(arg => String(arg)).join(" ");
      this.addLog("group", message, args);
    };

    // console.groupEnd 오버라이드
    console.groupEnd = () => {
      this.originalConsole.groupEnd();
      this.addLog("groupEnd", "");
    };
  }

  /**
   * 저장된 로그 가져오기
   */
  getLogs(): LogEntry[] {
    this.loadLogs();
    return this.logs;
  }

  /**
   * 로그 초기화
   */
  clearLogs() {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * 로그를 콘솔에 다시 출력
   */
  replayLogs() {
    const logs = this.getLogs();
    console.group("📋 저장된 로그 재생");
    logs.forEach((entry) => {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
      switch (entry.level) {
        case "log":
          this.originalConsole.log(prefix, entry.message, ...(entry.args || []));
          break;
        case "warn":
          this.originalConsole.warn(prefix, entry.message, ...(entry.args || []));
          break;
        case "error":
          this.originalConsole.error(prefix, entry.message, ...(entry.args || []));
          break;
        case "info":
          this.originalConsole.info(prefix, entry.message, ...(entry.args || []));
          break;
        case "debug":
          this.originalConsole.debug(prefix, entry.message, ...(entry.args || []));
          break;
        case "group":
          this.originalConsole.group(prefix, entry.message);
          break;
        case "groupEnd":
          this.originalConsole.groupEnd();
          break;
      }
    });
    console.groupEnd();
  }
}

// 전역 인스턴스
let loggerStorage: LoggerStorage | null = null;

/**
 * 로그 저장 기능 초기화 (클라이언트 사이드에서만 실행)
 */
export function initLoggerStorage() {
  if (typeof window === "undefined") {
    return;
  }

  if (!loggerStorage) {
    loggerStorage = new LoggerStorage();
    
    // 전역에서 접근 가능하도록 설정
    (window as any).getStoredLogs = () => loggerStorage?.getLogs() || [];
    (window as any).clearStoredLogs = () => loggerStorage?.clearLogs();
    (window as any).replayStoredLogs = () => loggerStorage?.replayLogs();
    
    console.log("💾 로그 저장 기능이 활성화되었습니다.");
    console.log("   - getStoredLogs(): 저장된 로그 가져오기");
    console.log("   - clearStoredLogs(): 로그 초기화");
    console.log("   - replayStoredLogs(): 로그 재생");
  }

  return loggerStorage;
}

/**
 * 저장된 로그 가져오기
 */
export function getStoredLogs(): LogEntry[] {
  if (!loggerStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  return loggerStorage.getLogs();
}

/**
 * 로그 초기화
 */
export function clearStoredLogs() {
  if (loggerStorage) {
    loggerStorage.clearLogs();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

