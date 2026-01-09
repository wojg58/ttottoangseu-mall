/**
 * @file lib/logger.ts
 * @description 환경 변수 기반 로깅 유틸리티
 *
 * 개발 환경에서만 로그를 출력하고 프로덕션에서는 비활성화
 * 민감 정보는 자동으로 마스킹 처리
 */

const isDev = process.env.NODE_ENV === "development";

/**
 * 민감 정보 키워드 목록
 */
const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "key",
  "authorization",
  "api_key",
  "apiKey",
  "access_token",
  "refresh_token",
  "session",
  "cookie",
  "credit_card",
  "creditCard",
  "card_number",
  "cardNumber",
  "cvv",
  "ssn",
  "social_security",
  "clerk_secret",
  "supabase_service_role",
  "toss_secret",
  "gemini_api",
] as const;

/**
 * 민감 정보 마스킹 함수
 */
function maskSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // 짧은 문자열은 전체 마스킹
    if (value.length <= 8) {
      return "***";
    }
    // 긴 문자열은 앞뒤 일부만 보여주고 중간 마스킹
    const visibleLength = Math.min(4, Math.floor(value.length / 4));
    return (
      value.substring(0, visibleLength) +
      "***".repeat(3) +
      value.substring(value.length - visibleLength)
    );
  }

  return "***";
}

/**
 * 객체에서 민감 정보를 재귀적으로 마스킹
 */
function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // 원시 타입은 그대로 반환
  if (typeof data !== "object") {
    return data;
  }

  // 배열인 경우 각 요소 처리
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  // 객체인 경우 키를 확인하여 민감 정보 마스킹
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive) {
      masked[key] = maskSensitiveValue(value);
    } else if (typeof value === "object" && value !== null) {
      // 중첩 객체는 재귀적으로 처리
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

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

  /** 정보 로그 (개발 환경에서만, 민감 정보 마스킹) */
  info: (message: string, data?: unknown) => {
    if (isDev) {
      if (data !== undefined) {
        const maskedData = maskSensitiveData(data);
        console.log(`[INFO] ${message}`, maskedData);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  },

  /** 경고 로그 (항상 출력, 민감 정보 마스킹) */
  warn: (message: string, data?: unknown) => {
    if (data !== undefined) {
      const maskedData = maskSensitiveData(data);
      console.warn(`[WARN] ${message}`, maskedData);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  /** 에러 로그 (항상 출력, 민감 정보 마스킹) */
  error: (message: string, error?: unknown) => {
    if (error !== undefined) {
      const maskedError = maskSensitiveData(error);
      console.error(`[ERROR] ${message}`, maskedError);
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
