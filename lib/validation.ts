/**
 * @file lib/validation.ts
 * @description Zod 스키마를 사용한 입력 검증 유틸리티
 *
 * 모든 사용자 입력을 검증하여 보안 취약점을 방지합니다.
 *
 * @dependencies
 * - zod: 타입 안전한 스키마 검증
 */

import { z } from "zod";

/**
 * 챗봇 메시지 검증 스키마
 */
export const chatMessageSchema = z.object({
  sessionId: z
    .string()
    .uuid("올바른 세션 ID 형식이 아닙니다.")
    .describe("채팅 세션 ID (UUID)"),
  message: z
    .string()
    .min(1, "메시지는 최소 1자 이상이어야 합니다.")
    .max(5000, "메시지는 5000자를 초과할 수 없습니다.")
    .trim()
    .describe("사용자 메시지"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/**
 * 상품 조회 쿼리 파라미터 검증 스키마
 */
export const productQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int("limit는 정수여야 합니다.")
    .min(1, "limit는 최소 1 이상이어야 합니다.")
    .max(100, "limit는 최대 100까지 가능합니다.")
    .default(12)
    .describe("한 페이지에 표시할 상품 수"),
  skip: z.coerce
    .number()
    .int("skip은 정수여야 합니다.")
    .min(0, "skip은 0 이상이어야 합니다.")
    .max(10000, "skip은 최대 10000까지 가능합니다.")
    .default(0)
    .describe("건너뛸 상품 수"),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

/**
 * 결제 승인 요청 검증 스키마
 */
export const paymentConfirmSchema = z.object({
  paymentKey: z
    .string()
    .min(1, "paymentKey는 필수입니다.")
    .max(200, "paymentKey는 200자를 초과할 수 없습니다.")
    .describe("토스페이먼츠 결제 키"),
  orderId: z
    .string()
    .uuid("올바른 주문 ID 형식이 아닙니다.")
    .describe("주문 ID (UUID)"),
  amount: z.coerce
    .number()
    .int("결제 금액은 정수여야 합니다.")
    .min(100, "결제 금액은 최소 100원 이상이어야 합니다.")
    .max(100000000, "결제 금액은 최대 100,000,000원까지 가능합니다.")
    .describe("결제 금액 (원)"),
});

export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;

/**
 * 결제 요청 검증 스키마
 */
export const paymentRequestSchema = z.object({
  orderId: z
    .string()
    .uuid("올바른 주문 ID 형식이 아닙니다.")
    .describe("주문 ID (UUID)"),
  orderNumber: z
    .string()
    .min(1, "주문 번호는 필수입니다.")
    .max(100, "주문 번호는 100자를 초과할 수 없습니다.")
    .describe("주문 번호"),
  amount: z.coerce
    .number()
    .int("결제 금액은 정수여야 합니다.")
    .min(100, "결제 금액은 최소 100원 이상이어야 합니다.")
    .max(100000000, "결제 금액은 최대 100,000,000원까지 가능합니다.")
    .describe("결제 금액 (원)"),
  customerName: z
    .string()
    .min(1, "고객 이름은 필수입니다.")
    .max(100, "고객 이름은 100자를 초과할 수 없습니다.")
    .trim()
    .describe("고객 이름"),
  customerEmail: z
    .string()
    .email("올바른 이메일 형식이 아닙니다.")
    .max(255, "이메일은 255자를 초과할 수 없습니다.")
    .describe("고객 이메일"),
});

export type PaymentRequestInput = z.infer<typeof paymentRequestSchema>;

/**
 * 결제 준비 요청 검증 스키마 (클라이언트 금액은 검증용)
 */
export const paymentPrepareSchema = z.object({
  amount: z.coerce
    .number()
    .int("결제 금액은 정수여야 합니다.")
    .min(100, "결제 금액은 최소 100원 이상이어야 합니다.")
    .max(100000000, "결제 금액은 최대 100,000,000원까지 가능합니다.")
    .optional()
    .describe("클라이언트에서 전달된 금액 (검증용, 서버에서 재계산)"),
});

export type PaymentPrepareInput = z.infer<typeof paymentPrepareSchema>;

/**
 * Zod 에러를 사용자 친화적인 메시지로 변환
 */
export function formatZodError(error: z.ZodError): string {
  const firstError = error.errors[0];
  if (firstError) {
    return firstError.message;
  }
  return "입력값 검증에 실패했습니다.";
}

/**
 * 스키마 검증 헬퍼 함수
 *
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns 검증 성공 시 파싱된 데이터, 실패 시 null과 에러 메시지
 *
 * @example
 * ```typescript
 * const result = validateSchema(chatMessageSchema, body);
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: result.error },
 *     { status: 400 }
 *   );
 * }
 * const { sessionId, message } = result.data;
 * ```
 */
export function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: formatZodError(result.error),
  };
}

