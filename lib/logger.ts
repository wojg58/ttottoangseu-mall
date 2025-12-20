/**
 * @file lib/logger.ts
 * @description 환경 변수 기반 로깅 유틸리티
 *
 * 개발 환경에서만 로그를 출력하고 프로덕션에서는 비활성화
 */

const isDev = process.env.NODE_ENV === "development";

/**
 * 개발 환경에서만 로그 출력
 */
export const logger = {
  /** 디버그 로그 (개발 환경에서만) */
  debug: (message: string, data?: unknown) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[DEBUG] ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  },

  /** 정보 로그 (개발 환경에서만) */
  info: (message: string, data?: unknown) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[INFO] ${message}`, data);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  },

  /** 경고 로그 (항상 출력) */
  warn: (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.warn(`[WARN] ${message}`, data);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  /** 에러 로그 (항상 출력) */
  error: (message: string, error?: unknown) => {
    if (error !== undefined) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  /** 로그 그룹 시작 (개발 환경에서만) */
  group: (name: string) => {
    if (isDev) {
      console.group(name);
    }
  },

  /** 로그 그룹 종료 (개발 환경에서만) */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /** 성능 측정 시작 (개발 환경에서만) */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
  },

  /** 성능 측정 종료 (개발 환경에서만) */
  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

export default logger;
