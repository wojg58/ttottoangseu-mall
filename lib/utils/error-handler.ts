/**
 * @file lib/utils/error-handler.ts
 * @description 공통 에러 처리 유틸리티
 *
 * 프로젝트 전반에서 일관된 에러 처리를 위한 유틸리티 함수들
 */

import { logger } from "@/lib/logger";

/**
 * 애플리케이션 에러 클래스
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    // Error 클래스의 stack trace를 올바르게 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * 인증 에러
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "인증이 필요합니다.", details?: unknown) {
    super(message, "AUTHENTICATION_ERROR", 401, details);
    this.name = "AuthenticationError";
  }
}

/**
 * 권한 에러
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "권한이 없습니다.", details?: unknown) {
    super(message, "AUTHORIZATION_ERROR", 403, details);
    this.name = "AuthorizationError";
  }
}

/**
 * 유효성 검증 에러
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

/**
 * 리소스 없음 에러
 */
export class NotFoundError extends AppError {
  constructor(message: string = "요청한 리소스를 찾을 수 없습니다.", details?: unknown) {
    super(message, "NOT_FOUND", 404, details);
    this.name = "NotFoundError";
  }
}

/**
 * 서버 에러
 */
export class ServerError extends AppError {
  constructor(message: string = "서버 오류가 발생했습니다.", details?: unknown) {
    super(message, "SERVER_ERROR", 500, details);
    this.name = "ServerError";
  }
}

/**
 * 에러를 처리하고 표준화된 응답 반환
 */
export function handleError(error: unknown): {
  success: false;
  message: string;
  code?: string;
} {
  if (error instanceof AppError) {
    logger.error(`[${error.code}] ${error.message}`, error.details);
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    logger.error("예상치 못한 에러:", error);
    return {
      success: false,
      message: error.message || "알 수 없는 오류가 발생했습니다.",
      code: "UNKNOWN_ERROR",
    };
  }

  logger.error("예상치 못한 에러 (Error 객체 아님):", error);
  return {
    success: false,
    message: "알 수 없는 오류가 발생했습니다.",
    code: "UNKNOWN_ERROR",
  };
}

/**
 * 에러를 던지기 (throw)
 */
export function throwError(
  message: string,
  code: string = "ERROR",
  statusCode: number = 500,
  details?: unknown,
): never {
  throw new AppError(message, code, statusCode, details);
}

/**
 * 에러를 던지기 (인증 에러)
 */
export function throwAuthenticationError(
  message: string = "인증이 필요합니다.",
  details?: unknown,
): never {
  throw new AuthenticationError(message, details);
}

/**
 * 에러를 던지기 (권한 에러)
 */
export function throwAuthorizationError(
  message: string = "권한이 없습니다.",
  details?: unknown,
): never {
  throw new AuthorizationError(message, details);
}

/**
 * 에러를 던지기 (유효성 검증 에러)
 */
export function throwValidationError(message: string, details?: unknown): never {
  throw new ValidationError(message, details);
}

/**
 * 에러를 던지기 (리소스 없음 에러)
 */
export function throwNotFoundError(
  message: string = "요청한 리소스를 찾을 수 없습니다.",
  details?: unknown,
): never {
  throw new NotFoundError(message, details);
}

