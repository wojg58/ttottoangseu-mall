/**
 * @file lib/notifications/sendAdminAlimtalkSolapi.ts
 * @description 솔라피(Solapi)를 통한 관리자 알림톡 발송
 *
 * 주문 완료 시 관리자에게 알림톡을 발송합니다.
 *
 * 주요 기능:
 * - Solapi API를 통한 알림톡 발송
 * - 환경변수 ADMIN_ALIMTALK_ENABLED로 발송 제어
 * - 실패 시 throw하지 않고 결과 반환 (상위에서 로깅)
 *
 * API 방식 설명:
 * - Solapi SDK (solapi 패키지) 사용
 * - memberId, groupId, appUserId 등 member 관련 필드 사용하지 않음
 * - pfId + templateId + variables로 알림톡 발송
 * - SDK가 내부적으로 올바른 형식으로 변환해줌
 *
 * @dependencies
 * - solapi: Solapi 공식 Node.js SDK
 * - Solapi API Key/Secret (환경변수)
 * - Solapi 알림톡 템플릿 ID (환경변수)
 *
 * @see https://docs.solapi.com/ - Solapi 공식 문서
 * @see https://github.com/solapi/solapi-nodejs - Solapi Node.js SDK
 */

import logger from "@/lib/logger";
import { SolapiMessageService } from "solapi";

interface AlimtalkSendResult {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

/**
 * 솔라피 알림톡 발송
 * 
 * @param orderNo - 주문번호
 * @param amount - 결제금액 (숫자, 원 단위)
 * @param orderDateKst - 주문일시 (KST 문자열, YYYY-MM-DD HH:mm)
 * @returns 발송 결과
 */
export async function sendAdminAlimtalkSolapi(
  orderNo: string,
  amount: number,
  orderDateKst: string,
): Promise<AlimtalkSendResult> {
  // 강제 트레이싱: 함수 시작
  logger.info("[ALIMTALK_TRACE] function entered with params:", { orderNo, amount: amount + "원", orderDateKst });

  logger.group("[sendAdminAlimtalkSolapi] 알림톡 발송 시작");
  logger.info("[알림톡] 주문 정보:", { orderNo, amount, orderDateKst });

  // 환경변수 확인
  const enabled = process.env.ADMIN_ALIMTALK_ENABLED === "true";

  // 강제 트레이싱: 환경변수 값들 (앞 6자만)
  const pfId = process.env.SOLAPI_PF_ID;
  const templateId = process.env.SOLAPI_TEMPLATE_ID_ADMIN_ORDER;
  const apiKey = process.env.SOLAPI_API_KEY;
  const adminPhone = process.env.ADMIN_PHONE;
  logger.info("[ALIMTALK_TRACE] env values: enabled=" + enabled + " pfId=" + (pfId ? pfId.substring(0, 6) + "..." : "null") + " templateId=" + (templateId ? templateId.substring(0, 6) + "..." : "null") + " apiKey=" + (apiKey ? apiKey.substring(0, 6) + "..." : "null") + " adminPhone=" + (adminPhone ? adminPhone.substring(0, 4) + "****" : "null"));

  logger.info("[알림톡] 환경 변수 확인:", {
    ADMIN_ALIMTALK_ENABLED: enabled,
    SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ? "설정됨" : "설정 안됨",
    SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ? "설정됨" : "설정 안됨",
    SOLAPI_PF_ID: process.env.SOLAPI_PF_ID ? `설정됨 (${process.env.SOLAPI_PF_ID.substring(0, 10)}...)` : "설정 안됨",
    SOLAPI_TEMPLATE_ID_ADMIN_ORDER: process.env.SOLAPI_TEMPLATE_ID_ADMIN_ORDER ? "설정됨" : "설정 안됨",
    ADMIN_PHONE: process.env.ADMIN_PHONE ? `설정됨 (${process.env.ADMIN_PHONE.substring(0, 4)}****)` : "설정 안됨",
  });

  if (!enabled) {
    logger.warn("[알림톡] ⚠️ ADMIN_ALIMTALK_ENABLED가 'true'가 아닙니다.");
    logger.groupEnd();
    return {
      success: true,
      message: "알림톡 발송이 비활성화되어 있습니다.",
    };
  }

  // apiSecret은 위에서 선언하지 않았으므로 여기서 선언
  const apiSecret = process.env.SOLAPI_API_SECRET;

  // 필수 환경변수 확인
  if (!apiKey || !apiSecret) {
    logger.error("[알림톡] ❌ Solapi API 인증 정보가 설정되지 않았습니다.");
    logger.groupEnd();
    return {
      success: false,
      error: "Solapi API 인증 정보가 설정되지 않았습니다.",
    };
  }

  if (!pfId) {
    logger.error("[알림톡] ❌ SOLAPI_PF_ID가 설정되지 않았습니다.");
    logger.groupEnd();
    return {
      success: false,
      error: "카카오 채널 PF ID가 설정되지 않았습니다.",
    };
  }

  if (!templateId) {
    logger.error("[알림톡] ❌ SOLAPI_TEMPLATE_ID_ADMIN_ORDER가 설정되지 않았습니다.");
    logger.groupEnd();
    return {
      success: false,
      error: "알림톡 템플릿 ID가 설정되지 않았습니다.",
    };
  }

  if (!adminPhone) {
    logger.error("[알림톡] ❌ ADMIN_PHONE이 설정되지 않았습니다.");
    logger.groupEnd();
    return {
      success: false,
      error: "관리자 전화번호가 설정되지 않았습니다.",
    };
  }

  // 전화번호 마스킹 처리 (로그용)
  const maskedPhone = `${adminPhone.substring(0, 4)}****`;
  logger.info("[알림톡] ✅ 필수 환경변수 모두 확인 완료");

  try {
    // 전화번호 하이픈 제거 및 형식 확인
    let phoneNumber = adminPhone.replace(/-/g, "").replace(/\s/g, "");

    logger.info("[알림톡] 전화번호 변환:", {
      마스킹: maskedPhone,
      길이: phoneNumber.length,
      형식: phoneNumber.startsWith("010") ? "국내 형식" : "기타",
    });

    // Solapi SDK를 사용한 카카오 알림톡 발송
    // SDK가 내부적으로 올바른 형식으로 변환해줌
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    const message = {
      to: phoneNumber,
      kakaoOptions: {
        pfId: pfId,
        templateId: templateId,
        variables: {
          orderNo: orderNo,
          amount: amount.toLocaleString("ko-KR"),
          orderDate: orderDateKst,
        },
        disableSms: true, // 알림톡 실패 시 SMS 폴백 OFF
      },
    };

    // 강제 트레이싱: 최종 request payload (개인정보 마스킹)
    const maskedMessage = {
      ...message,
      to: phoneNumber.substring(0, 3) + "****" + phoneNumber.substring(phoneNumber.length - 4),
    };
    logger.info("[ALIMTALK_TRACE] final request payload: " + JSON.stringify(maskedMessage));

    // memberId 포함 여부 확인
    const payloadString = JSON.stringify(message);
    if (payloadString.includes('memberId')) {
      logger.error("[ALIMTALK_TRACE] CRITICAL: memberId found in payload! payload=" + payloadString);
    } else {
      logger.info("[ALIMTALK_TRACE] memberId not found in payload - OK");
    }

    // 디버깅 로그 강화: 발송 직전 상세 정보
    logger.info("[ALIMTALK] enabled=true templateId=" + templateId.substring(0, 6) + "... pfId=" + pfId.substring(0, 6) + "... to=010****#### variablesKeys=" + Object.keys(message.kakaoOptions.variables).join(','));

    logger.info("[알림톡] 메시지 구성 완료:", {
      to: maskedPhone,
      templateId: message.kakaoOptions.templateId,
      pfId: message.kakaoOptions.pfId,
      variables: Object.keys(message.kakaoOptions.variables),
      disableSms: message.kakaoOptions.disableSms,
    });

    logger.info("[ALIMTALK_TRACE] calling: SolapiMessageService.send() (Solapi SDK)");

    logger.info("[알림톡] 🔵 Solapi SDK를 통한 알림톡 발송 시작...");

    // Solapi SDK를 사용한 메시지 발송
    const response = await messageService.send(message);

    // 강제 트레이싱: Solapi 응답 상세 정보
    logger.info("[ALIMTALK_TRACE] solapi response: " + JSON.stringify(response));

    // 성공 응답 처리
    const messageId = response.messageList?.[0]?.messageId || response.messageId || response.groupId;

    logger.info("[알림톡] ✅ 발송 성공:", {
      orderNo,
      messageId: messageId || "N/A",
      groupId: response.groupId || "N/A",
      fullResponse: JSON.stringify(response, null, 2),
    });

    // messageId 확인을 위한 추가 로그
    if (messageId) {
      logger.info("[ALIMTALK] success messageId=" + messageId);
    }
    logger.groupEnd();

    return {
      success: true,
      message: "알림톡 발송 성공",
      messageId: messageId,
    };
  } catch (error: any) {
    // 강제 트레이싱: 에러 상세 정보
    logger.error("[ALIMTALK_TRACE] exception caught:", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      errorResponse: error.response?.data || error.response || error,
    });

    // Solapi SDK 에러 응답 처리
    const errorMessage = error.response?.data?.errorMessage || 
                        error.response?.data?.message || 
                        error.message || 
                        "알 수 없는 오류가 발생했습니다.";

    logger.error("[ALIMTALK] failed error=" + JSON.stringify(error.response?.data || error));
    logger.error("[알림톡] ❌ 발송 실패:", {
      errorMessage: errorMessage,
      errorResponse: error.response?.data || error.response || error,
    });
    logger.groupEnd();
    return {
      success: false,
      error: `알림톡 발송 실패: ${errorMessage}`,
    };
  }
}



