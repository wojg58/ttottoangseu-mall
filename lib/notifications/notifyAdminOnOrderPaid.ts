/**
 * @file lib/notifications/notifyAdminOnOrderPaid.ts
 * @description 주문 완료 시 관리자 알림 통합 함수
 *
 * 주문 완료(결제 완료) 시 관리자에게 알림톡과 이메일을 발송합니다.
 * 
 * 주요 기능:
 * - UTC 시간을 KST로 변환
 * - 알림톡/이메일을 Promise.allSettled로 병렬 실행
 * - 성공한 채널은 orders 테이블에 sent_at 기록 업데이트
 * - 실패한 채널은 로그만 남기고 주문 처리 흐름에 영향 없음
 * - 중복 발송 방지 (이미 sent_at이 있으면 스킵)
 * 
 * @dependencies
 * - @/lib/notifications/formatTime: KST 변환
 * - @/lib/notifications/sendAdminAlimtalkSolapi: 알림톡 발송
 * - @/lib/notifications/sendAdminEmail: 이메일 발송
 * - @/lib/supabase/service-role: Supabase 클라이언트
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";
import { formatTimeForNotification } from "./formatTime";
import { sendAdminAlimtalkSolapi } from "./sendAdminAlimtalkSolapi";
import { sendAdminEmail } from "./sendAdminEmail";

interface NotifyAdminParams {
  orderId: string;
  orderNo: string;
  amount: number;
  createdAtUtc: string; // UTC ISO string
}

interface NotifyAdminResult {
  success: boolean;
  alimtalkSent: boolean;
  emailSent: boolean;
  errors?: string[];
}

/**
 * 주문 완료 시 관리자 알림 발송
 * 
 * @param params - 주문 정보
 * @returns 알림 발송 결과
 */
export async function notifyAdminOnOrderPaid(
  params: NotifyAdminParams,
): Promise<NotifyAdminResult> {
  const { orderId, orderNo, amount, createdAtUtc } = params;

  logger.group(`[notifyAdminOnOrderPaid] 주문 완료 알림: ${orderNo}`);

  try {
    const supabase = getServiceRoleClient();

    // 1. 중복 발송 방지: 이미 발송된 경우 스킵
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("admin_alimtalk_sent_at, admin_email_sent_at")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      logger.error("[알림] 주문 조회 실패:", orderError);
      logger.groupEnd();
      return {
        success: false,
        alimtalkSent: false,
        emailSent: false,
        errors: ["주문 조회 실패"],
      };
    }

    const alimtalkAlreadySent = !!order.admin_alimtalk_sent_at;
    const emailAlreadySent = !!order.admin_email_sent_at;

    logger.info("[알림] 발송 상태 확인:", {
      alimtalkAlreadySent,
      emailAlreadySent,
      alimtalkSentAt: order.admin_alimtalk_sent_at,
      emailSentAt: order.admin_email_sent_at,
    });

    if (alimtalkAlreadySent && emailAlreadySent) {
      logger.info("[알림] 이미 모든 알림이 발송되었습니다. 스킵");
      logger.groupEnd();
      return {
        success: true,
        alimtalkSent: true,
        emailSent: true,
      };
    }

    // 2. UTC → KST 변환
    const orderDateKst = formatTimeForNotification(createdAtUtc);
    logger.info("[알림] 주문일시 (KST):", orderDateKst);

    // 3. 알림톡/이메일 병렬 발송 (Promise.allSettled 사용)
    logger.info("[알림] 알림 발송 시작:", {
      alimtalkWillSend: !alimtalkAlreadySent,
      emailWillSend: !emailAlreadySent,
    });

    const results = await Promise.allSettled([
      // 알림톡 발송 (이미 발송된 경우 스킵)
      alimtalkAlreadySent
        ? Promise.resolve({ success: true, message: "이미 발송됨" })
        : (() => {
            logger.info("[알림] 🔵 알림톡 발송 함수 호출 시작");
            logger.info("[ALIMTALK_TRACE] notifyAdminOnOrderPaid -> sendAdminAlimtalkSolapi called");
            return sendAdminAlimtalkSolapi(orderNo, amount, orderDateKst);
          })(),
      // 이메일 발송 (이미 발송된 경우 스킵)
      emailAlreadySent
        ? Promise.resolve({ success: true, message: "이미 발송됨" })
        : (() => {
            logger.info("[알림] 🔵 이메일 발송 함수 호출 시작");
            return sendAdminEmail(orderNo, amount, orderDateKst);
          })(),
    ]);

    logger.info("[알림] 알림 발송 완료 (결과 처리 시작):", {
      alimtalkStatus: results[0].status,
      emailStatus: results[1].status,
    });

    const alimtalkResult = results[0];
    const emailResult = results[1];

    // 4. 결과 처리 및 DB 업데이트
    let alimtalkSent = false;
    let emailSent = false;
    const errors: string[] = [];

    // 알림톡 결과 처리
    if (alimtalkResult.status === "fulfilled") {
      if (alimtalkResult.value.success && !alimtalkAlreadySent) {
        // DB에 발송 기록 저장
        const { error: updateError } = await supabase
          .from("orders")
          .update({ admin_alimtalk_sent_at: new Date().toISOString() })
          .eq("id", orderId);

        if (updateError) {
          logger.error("[알림] 알림톡 발송 기록 저장 실패:", updateError);
          errors.push("알림톡 발송 기록 저장 실패");
        } else {
          alimtalkSent = true;
          logger.info("[알림] ✅ 알림톡 발송 완료 및 기록 저장");
        }
      } else if (!alimtalkResult.value.success) {
        logger.error("[알림] ❌ 알림톡 발송 실패:", alimtalkResult.value.error);
        errors.push(`알림톡: ${alimtalkResult.value.error || "알 수 없는 오류"}`);
      } else {
        alimtalkSent = true; // 이미 발송됨
      }
    } else {
      logger.error("[알림] ❌ 알림톡 발송 예외:", alimtalkResult.reason);
      errors.push(`알림톡: ${alimtalkResult.reason?.message || "알 수 없는 오류"}`);
    }

    // 이메일 결과 처리
    if (emailResult.status === "fulfilled") {
      if (emailResult.value.success && !emailAlreadySent) {
        // DB에 발송 기록 저장
        const { error: updateError } = await supabase
          .from("orders")
          .update({ admin_email_sent_at: new Date().toISOString() })
          .eq("id", orderId);

        if (updateError) {
          logger.error("[알림] 이메일 발송 기록 저장 실패:", updateError);
          errors.push("이메일 발송 기록 저장 실패");
        } else {
          emailSent = true;
          logger.info("[알림] ✅ 이메일 발송 완료 및 기록 저장");
        }
      } else if (!emailResult.value.success) {
        logger.error("[알림] ❌ 이메일 발송 실패:", emailResult.value.error);
        errors.push(`이메일: ${emailResult.value.error || "알 수 없는 오류"}`);
      } else {
        emailSent = true; // 이미 발송됨
      }
    } else {
      logger.error("[알림] ❌ 이메일 발송 예외:", emailResult.reason);
      errors.push(`이메일: ${emailResult.reason?.message || "알 수 없는 오류"}`);
    }

    // 5. 최종 결과 반환
    const success = alimtalkSent || emailSent; // 하나라도 성공하면 success

    logger.info("[알림] 알림 발송 완료:", {
      alimtalkSent,
      emailSent,
      errors: errors.length > 0 ? errors : undefined,
    });
    logger.groupEnd();

    return {
      success,
      alimtalkSent,
      emailSent,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    // 예상치 못한 예외 처리
    logger.error("[알림] 알림 발송 중 예외:", error);
    logger.groupEnd();
    return {
      success: false,
      alimtalkSent: false,
      emailSent: false,
      errors: [error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."],
    };
  }
}



