/**
 * @file lib/error-handler.ts
 * @description 에러 메시지 정제 유틸리티
 *
 * 프로덕션 환경에서 민감한 정보가 포함된 에러 메시지를 숨기고,
 * 사용자 친화적인 메시지만 반환합니다.
 *
 * @dependencies
 * - 환경 변수: NODE_ENV
 */

/**
 * 프로덕션 환경 여부 확인
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * 에러를 사용자 친화적인 메시지로 변환
 *
 * 프로덕션 환경에서는 상세한 에러 정보를 숨기고,
 * 개발 환경에서는 원본 에러 메시지를 반환합니다.
 *
 * @param error - 에러 객체 또는 문자열
 * @param defaultMessage - 기본 에러 메시지 (프로덕션에서 사용)
 * @returns 정제된 에러 메시지
 *
 * @example
 * ```typescript
 * try {
 *   // ... 작업 수행
 * } catch (error) {
 *   const message = sanitizeError(error, "작업에 실패했습니다.");
 *   return NextResponse.json({ error: message }, { status: 500 });
 * }
 * ```
 */
export function sanitizeError(
  error: unknown,
  defaultMessage: string = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
): string {
  // 프로덕션 환경에서는 기본 메시지만 반환
  if (isProduction()) {
    return defaultMessage;
  }

  // 개발 환경에서는 상세 정보 반환
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }

  if (typeof error === "string") {
    return error;
  }

  return defaultMessage;
}

/**
 * 에러 객체에서 안전하게 메시지 추출
 *
 * @param error - 에러 객체
 * @returns 에러 메시지 또는 null
 */
export function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

/**
 * API 응답용 에러 객체 생성
 *
 * @param error - 에러 객체
 * @param statusCode - HTTP 상태 코드
 * @param defaultMessage - 기본 에러 메시지
 * @returns NextResponse에 사용할 수 있는 에러 응답 객체
 *
 * @example
 * ```typescript
 * try {
 *   // ... 작업 수행
 * } catch (error) {
 *   return createErrorResponse(error, 500, "작업에 실패했습니다.");
 * }
 * ```
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  defaultMessage?: string,
): { error: string; status: number } {
  const message = sanitizeError(
    error,
    defaultMessage || "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  );

  return {
    error: message,
    status: statusCode,
  };
}

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
  ];

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
 * 에러를 로깅 (프로덕션에서는 Sentry 등으로 전송, 민감 정보 마스킹)
 *
 * @param error - 에러 객체
 * @param context - 에러 발생 컨텍스트 (API 경로, 함수명 등)
 *
 * @example
 * ```typescript
 * try {
 *   // ... 작업 수행
 * } catch (error) {
 *   logError(error, { api: "/api/payments/confirm", userId });
 *   return NextResponse.json({ error: "결제 처리에 실패했습니다." }, { status: 500 });
 * }
 * ```
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const errorMessage = getErrorMessage(error);
  const errorStack =
    error instanceof Error ? error.stack : undefined;

  // 민감 정보 마스킹
  const maskedContext = context ? maskSensitiveData(context) : undefined;
  const maskedError = maskSensitiveData(error);

  // 개발 환경에서는 console.error 사용
  if (!isProduction()) {
    console.error("[Error]", errorMessage);
    if (errorStack) {
      console.error("[Error Stack]", errorStack);
    }
    if (maskedContext) {
      console.error("[Error Context]", maskedContext);
    }
    return;
  }

  // 프로덕션 환경에서는 Sentry 등으로 전송 (이미 설정되어 있다면)
  // Sentry.captureException(error, { contexts: { custom: maskedContext } });
  
  // 임시로 console.error 사용 (나중에 Sentry로 교체)
  console.error("[Error]", {
    message: errorMessage,
    stack: errorStack,
    context: maskedContext,
    error: maskedError,
  });
}

/**
 * 데이터베이스 에러를 사용자 친화적인 메시지로 변환
 *
 * @param error - 데이터베이스 에러 객체
 * @returns 사용자 친화적인 메시지
 */
export function sanitizeDatabaseError(error: unknown): string {
  if (isProduction()) {
    return "데이터 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 개발 환경에서는 원본 메시지 반환
  return getErrorMessage(error) || "데이터베이스 오류가 발생했습니다.";
}

/**
 * 인증 에러를 사용자 친화적인 메시지로 변환
 *
 * @param error - 인증 에러 객체
 * @returns 사용자 친화적인 메시지
 */
export function sanitizeAuthError(error: unknown): string {
  if (isProduction()) {
    return "인증에 실패했습니다. 다시 로그인해주세요.";
  }

  return getErrorMessage(error) || "인증 오류가 발생했습니다.";
}

/**
 * 네트워크 에러를 사용자 친화적인 메시지로 변환
 *
 * @param error - 네트워크 에러 객체
 * @returns 사용자 친화적인 메시지
 */
export function sanitizeNetworkError(error: unknown): string {
  if (isProduction()) {
    return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
  }

  return getErrorMessage(error) || "네트워크 오류가 발생했습니다.";
}

