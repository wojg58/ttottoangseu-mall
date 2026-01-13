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
 * - Solapi 'messages.send' 방식 사용 (알림톡 템플릿 발송)
 * - memberId, groupId, appUserId 등 member 관련 필드 사용하지 않음
 * - pfId + templateId + variables로 알림톡 발송
 *
 * @dependencies
 * - Solapi API Key/Secret (환경변수)
 * - Solapi 알림톡 템플릿 ID (환경변수)
 *
 * @see https://docs.solapi.com/ - Solapi 공식 문서
 */

import logger from "@/lib/logger";

interface AlimtalkSendResult {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

interface AlimtalkMessage {
  to: string;
  type?: string; // 카카오 전용 엔드포인트에서는 자동 판별되므로 optional
  from?: string; // Solapi 발신번호 (필요시)
  kakaoOptions: {
    pfId: string;
    templateId: string;
    variables: Record<string, string>;
    disableSms?: boolean; // 알림톡 실패 시 SMS 폴백 OFF
  };
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
  logger.group("[sendAdminAlimtalkSolapi] 알림톡 발송 시작");
  logger.info("[알림톡] 주문 정보:", { orderNo, amount, orderDateKst });

  // 환경변수 확인
  const enabled = process.env.ADMIN_ALIMTALK_ENABLED === "true";
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

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.SOLAPI_PF_ID;
  const templateId = process.env.SOLAPI_TEMPLATE_ID_ADMIN_ORDER;
  let adminPhone = process.env.ADMIN_PHONE;

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
    // Solapi 카카오 알림톡 전용 API 엔드포인트
    // messages/v4/send/kakao - 카카오 메시지 전용 엔드포인트
    const apiUrl = "https://api.solapi.com/messages/v4/send/kakao";

    // Solapi 인증: "user apiKey:apiSecret" 형식
    const authHeader = `user ${apiKey}:${apiSecret}`;

    // 전화번호 하이픈 제거 및 형식 확인
    let phoneNumber = adminPhone.replace(/-/g, "").replace(/\s/g, "");

    logger.info("[알림톡] 전화번호 변환:", {
      마스킹: maskedPhone,
      길이: phoneNumber.length,
      형식: phoneNumber.startsWith("010") ? "국내 형식" : "기타",
    });

    // Solapi 카카오 알림톡 템플릿 발송 방식
    // pfId + templateId + variables로 알림톡 발송 (memberId 불필요)
    // 카카오 전용 엔드포인트에서는 type 지정 불필요 (kakaoOptions로 자동 판별)
    const message: AlimtalkMessage = {
      to: phoneNumber,
      // type: "KAKAO_ALIMTALK", // 카카오 전용 엔드포인트에서는 불필요
      // from: 필요하면 Solapi 발신번호 설정 (현재는 생략)
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

    // 디버깅 로그 강화: 발송 직전 상세 정보
    logger.info("[ALIMTALK] enabled=true templateId=" + templateId.substring(0, 6) + "... pfId=" + pfId.substring(0, 6) + "... to=010****#### variablesKeys=" + Object.keys(message.kakaoOptions.variables).join(','));

    logger.info("[알림톡] 메시지 구성 완료:", {
      to: maskedPhone,
      templateId: message.kakaoOptions.templateId,
      pfId: message.kakaoOptions.pfId,
      variables: Object.keys(message.kakaoOptions.variables),
      disableSms: message.kakaoOptions.disableSms,
    });

    const requestBody = {
      messages: [message],
    };

    logger.info("[알림톡] API 요청 준비:", {
      url: apiUrl,
      method: "POST",
      auth: "user apiKey:apiSecret",
      messageCount: 1,
      templateId: templateId,
      pfId: pfId.substring(0, 10) + "...",
      variables: Object.keys(message.kakaoOptions.variables),
    });

    logger.info("[알림톡] 🔵 Solapi API 호출 시작...");

    // API 요청
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader, // "user apiKey:apiSecret" 형식
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    logger.info("[알림톡] API 응답 수신:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    const responseData = await response.json();

    if (!response.ok) {
      logger.error("[ALIMTALK] failed status=" + response.status + " body=" + JSON.stringify(responseData));
      logger.error("[알림톡] ❌ 발송 실패:", {
        statusCode: response.status,
        statusText: response.statusText,
        responseBody: JSON.stringify(responseData, null, 2), // 전체 응답 본문 로그
        errorMessage: responseData.errorMessage || responseData.message || response.statusText,
      });
      logger.groupEnd();
      return {
        success: false,
        error: `알림톡 발송 실패 [${response.status}]: ${responseData.errorMessage || responseData.message || response.statusText}`,
      };
    }

    // 성공 응답 처리
    const messageId = responseData.messageList?.[0]?.messageId || responseData.messageId || responseData.groupId;

    logger.info("[알림톡] ✅ 발송 성공:", {
      orderNo,
      messageId: messageId || "N/A",
      groupId: responseData.groupId || "N/A",
      fullResponse: JSON.stringify(responseData, null, 2), // 전체 성공 응답 로그
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
  } catch (error) {
    logger.error("[알림톡] ❌ 발송 예외 발생:", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    logger.groupEnd();
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}



