/**
 * @file lib/rate-limit.ts
 * @description Rate Limiting 유틸리티
 *
 * API 엔드포인트에 Rate Limiting을 적용하여 DDoS 공격을 방지합니다.
 *
 * 현재 구현: 메모리 기반 (서버 재시작 시 초기화)
 * 향후 확장: Upstash Redis로 업그레이드 가능
 *
 * @dependencies
 * - 메모리 기반: 내장 Map 사용
 * - Redis 기반: @upstash/ratelimit, @upstash/redis (선택사항)
 */

interface RateLimitConfig {
  /** 시간 윈도우 (초) */
  window: number;
  /** 허용 요청 수 */
  limit: number;
  /** 식별자 (IP 주소 또는 사용자 ID) */
  identifier: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (초)
}

/**
 * 메모리 기반 Rate Limiter
 * 서버 재시작 시 초기화되지만, 단일 서버 환경에서는 충분합니다.
 */
class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  /**
   * Rate Limit 체크
   */
  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `${config.identifier}:${config.window}`;
    const now = Math.floor(Date.now() / 1000);
    const reset = now + config.window;

    const record = this.store.get(key);

    // 레코드가 없거나 만료된 경우 새로 생성
    if (!record || record.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: reset });
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset,
      };
    }

    // 레코드가 있고 만료되지 않은 경우
    if (record.count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: record.resetAt,
      };
    }

    // 카운트 증가
    record.count++;
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - record.count,
      reset: record.resetAt,
    };
  }

  /**
   * 만료된 레코드 정리 (메모리 누수 방지)
   */
  cleanup() {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

// 싱글톤 인스턴스
const limiter = new MemoryRateLimiter();

// 주기적으로 정리 (5분마다)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    limiter.cleanup();
  }, 5 * 60 * 1000); // 5분
}

/**
 * Rate Limit 체크 헬퍼 함수
 *
 * @param identifier - 요청 식별자 (IP 주소 또는 사용자 ID)
 * @param limit - 허용 요청 수
 * @param window - 시간 윈도우 (초)
 * @returns Rate Limit 결과
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit(ipAddress, 10, 60); // 60초에 10회
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: "Too many requests" },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: number,
): Promise<RateLimitResult> {
  return limiter.check({ identifier, limit, window });
}

/**
 * API 라우트에서 사용하기 위한 Rate Limit 미들웨어
 *
 * @param request - Next.js Request 객체
 * @param limit - 허용 요청 수
 * @param window - 시간 윈도우 (초)
 * @returns Rate Limit 결과 또는 null (체크 실패 시)
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimitMiddleware(request, 10, 60);
 *   if (!rateLimitResult?.success) {
 *     return NextResponse.json(
 *       { error: "Too many requests" },
 *       { status: 429, headers: rateLimitHeaders(rateLimitResult) }
 *     );
 *   }
 *   // ... API 로직
 * }
 * ```
 */
export async function rateLimitMiddleware(
  request: Request,
  limit: number,
  window: number,
): Promise<RateLimitResult | null> {
  try {
    // IP 주소 추출
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";

    return await checkRateLimit(ip, limit, window);
  } catch (error) {
    console.error("[RateLimit] 체크 실패:", error);
    // Rate Limit 체크 실패 시 요청을 허용 (fail-open)
    return null;
  }
}

/**
 * Rate Limit 헤더 생성
 */
export function rateLimitHeaders(result: RateLimitResult | null): HeadersInit {
  if (!result) {
    return {};
  }

  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
    "Retry-After": result.success
      ? "0"
      : Math.max(1, result.reset - Math.floor(Date.now() / 1000)).toString(),
  };
}

/**
 * 사전 정의된 Rate Limit 설정
 */
export const RATE_LIMITS = {
  /** 일반 API: 10초에 20회 */
  DEFAULT: { limit: 20, window: 10 },
  /** 챗봇 API: 10초에 5회 (비용 절감) */
  CHAT: { limit: 5, window: 10 },
  /** 결제 API: 1분에 10회 (보안 강화) */
  PAYMENT: { limit: 10, window: 60 },
  /** 사용자 동기화: 1분에 5회 */
  SYNC_USER: { limit: 5, window: 60 },
  /** 상품 조회: 10초에 30회 */
  PRODUCTS: { limit: 30, window: 10 },
} as const;

