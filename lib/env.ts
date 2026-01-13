/**
 * @file lib/env.ts
 * @description 환경 변수 검증 및 타입 정의
 *
 * 애플리케이션 시작 시 환경 변수를 검증하고 타입 안전하게 접근할 수 있도록 합니다.
 */

/**
 * 환경 변수 가져오기 (필수)
 * 환경 변수가 없으면 에러를 던집니다.
 */
function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `환경 변수 ${key}가 설정되지 않았습니다. .env 파일을 확인해주세요.`,
    );
  }
  return value;
}

/**
 * 환경 변수 가져오기 (선택)
 * 환경 변수가 없으면 기본값을 반환합니다.
 */
function getEnvVarOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * 환경 변수 검증 및 타입 정의
 */
export const env = {
  // Clerk 인증
  clerk: {
    publishableKey: getEnvVar("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    secretKey: getEnvVar("CLERK_SECRET_KEY"),
    signInUrl: getEnvVarOptional(
      "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
      "/sign-in",
    ),
    signInFallbackRedirectUrl: getEnvVarOptional(
      "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
      "/",
    ),
    signUpFallbackRedirectUrl: getEnvVarOptional(
      "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
      "/",
    ),
  },

  // Supabase
  supabase: {
    url: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
    storageBucket: getEnvVarOptional(
      "NEXT_PUBLIC_STORAGE_BUCKET",
      "uploads",
    ),
  },

  // 네이버 스마트스토어
  naver: {
    clientId: process.env.NAVER_SMARTSTORE_CLIENT_ID,
    clientSecret: process.env.NAVER_SMARTSTORE_CLIENT_SECRET,
  },

  // Toss Payments
  toss: {
    clientKey: process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY,
    secretKey: process.env.TOSS_PAYMENTS_SECRET_KEY,
  },

  // 기타
  nodeEnv: getEnvVarOptional("NODE_ENV", "development"),
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
} as const;

/**
 * 환경 변수 검증
 * 앱 시작 시 호출하여 필수 환경 변수가 모두 설정되었는지 확인합니다.
 */
export function validateEnv(): void {
  try {
    // 필수 환경 변수들이 모두 로드되었는지 확인
    // getEnvVar가 호출되면 자동으로 검증됨
    void env;
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ 환경 변수 검증 실패:", error.message);
      console.error(
        "💡 .env 파일을 확인하고 필수 환경 변수를 설정해주세요.",
      );
    }
    throw error;
  }
}

