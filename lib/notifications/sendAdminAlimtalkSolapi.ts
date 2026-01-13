/**
 * @file lib/notifications/sendAdminAlimtalkSolapi.ts
 * @description 솔라피(Solapi) SDK를 통한 관리자 알림톡 발송
 *
 * 주문 완료 시 관리자에게 알림톡을 발송합니다.
 *
 * 주요 기능:
 * - Solapi 공식 SDK (solapi 패키지)를 통한 알림톡 발송
 * - 환경변수 ADMIN_ALIMTALK_ENABLED로 발송 제어
 * - 전화번호 포맷 자동 변환 (국내 형식 -> E.164 형식)
 * - 실패 시 throw하지 않고 결과 반환 (상위에서 로깅)
 *
 * API 방식 설명:
 * - Solapi SDK (solapi@5.5.3) 사용
 * - SolapiMessageService.send() 메서드 호출
 * - memberId, groupId, appUserId 등 member 관련 필드 사용하지 않음
 * - pfId + templateId + variables로 알림톡 발송
 * - SDK가 내부적으로 올바른 형식으로 변환해줌
 *
 * 전화번호 포맷 처리:
 * - 1차 시도: 국내 형식 (010XXXXXXXX)
 * - 실패 시 2차 시도: E.164 형식 (8210XXXXXXXX)
 * - ValidationError 발생 시 자동으로 2차 시도
 *
 * @dependencies
 * - solapi@5.5.3: Solapi 공식 Node.js SDK
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
    // Solapi SDK 클라이언트 생성
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    // 전화번호 포맷 변환 함수
    const formatPhoneNumber = (phone: string, format: "local" | "e164"): string => {
      const cleaned = phone.replace(/-/g, "").replace(/\s/g, "");
      
      if (format === "local") {
        // 국내 형식: 010XXXXXXXX
        return cleaned;
      } else {
        // E.164 형식: +8210XXXXXXXX 또는 8210XXXXXXXX
        if (cleaned.startsWith("010")) {
          return `82${cleaned.substring(1)}`; // 010 -> 8210
        } else if (cleaned.startsWith("0")) {
          return `82${cleaned.substring(1)}`; // 0XX -> 82XX
        } else if (cleaned.startsWith("82")) {
          return cleaned; // 이미 E.164 형식
        } else {
          return `82${cleaned}`; // 기타
        }
      }
    };

    // 1차 시도: 국내 형식 (010XXXXXXXX)
    const phoneNumber = formatPhoneNumber(adminPhone, "local");
    
    logger.info("[알림톡] 전화번호 변환 (1차 시도):", {
      마스킹: maskedPhone,
      길이: phoneNumber.length,
      형식: "국내 형식 (010XXXXXXXX)",
      번호: phoneNumber.substring(0, 3) + "****" + phoneNumber.substring(phoneNumber.length - 4),
    });

    // 메시지 구성
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
        disableSms: true,
      },
    };

    // SDK 호출 직전 로그
    logger.info("[ALIMTALK] using SDK, templateId=" + templateId.substring(0, 6) + "... pfId=" + pfId.substring(0, 6) + "... to=010****#### variablesKeys=" + Object.keys(message.kakaoOptions.variables).join(','));

    logger.info("[알림톡] 메시지 구성 완료:", {
      to: maskedPhone,
      templateId: message.kakaoOptions.templateId,
      pfId: message.kakaoOptions.pfId,
      variables: Object.keys(message.kakaoOptions.variables),
      disableSms: message.kakaoOptions.disableSms,
    });

    logger.info("[ALIMTALK_TRACE] calling: SolapiMessageService.send() (Solapi SDK)");
    logger.info("[알림톡] 🔵 Solapi SDK를 통한 알림톡 발송 시작...");

    let response: any;
    let lastError: any;

    try {
      // 1차 시도: 국내 형식
      response = await messageService.send(message);
      
      // 성공 응답 처리
      const messageId = response.messageList?.[0]?.messageId || response.messageId || response.groupId;

      logger.info("[ALIMTALK_TRACE] solapi response: " + JSON.stringify(response));
      logger.info("[알림톡] ✅ 발송 성공:", {
        orderNo,
        messageId: messageId || "N/A",
        groupId: response.groupId || "N/A",
        fullResponse: JSON.stringify(response, null, 2),
      });

      if (messageId) {
        logger.info("[ALIMTALK] success messageId=" + messageId);
      }
      logger.groupEnd();

      return {
        success: true,
        message: "알림톡 발송 성공",
        messageId: messageId,
      };
    } catch (firstError: any) {
      lastError = firstError;
      
      // 400 ValidationError이고 memberId 관련이거나 전화번호 형식 문제인 경우 2차 시도
      const isValidationError = firstError.response?.status === 400 || 
                               firstError.response?.data?.errorCode === "ValidationError" ||
                               firstError.message?.includes("memberId") ||
                               firstError.message?.includes("전화번호") ||
                               firstError.message?.includes("phone");

      if (isValidationError) {
        logger.warn("[알림톡] 1차 시도 실패, E.164 형식으로 2차 시도:", {
          error: firstError.response?.data?.errorMessage || firstError.message,
        });

        // 2차 시도: E.164 형식 (8210XXXXXXXX)
        const e164Phone = formatPhoneNumber(adminPhone, "e164");
        const e164Message = {
          ...message,
          to: e164Phone,
        };

        logger.info("[알림톡] 전화번호 변환 (2차 시도):", {
          마스킹: maskedPhone,
          길이: e164Phone.length,
          형식: "E.164 형식 (8210XXXXXXXX)",
          번호: e164Phone.substring(0, 3) + "****" + e164Phone.substring(e164Phone.length - 4),
        });

        logger.info("[ALIMTALK] using SDK (2nd attempt), templateId=" + templateId.substring(0, 6) + "... pfId=" + pfId.substring(0, 6) + "... to=82****#### variablesKeys=" + Object.keys(e164Message.kakaoOptions.variables).join(','));

        try {
          response = await messageService.send(e164Message);
          
          // 성공 응답 처리
          const messageId = response.messageList?.[0]?.messageId || response.messageId || response.groupId;

          logger.info("[ALIMTALK_TRACE] solapi response (2nd attempt): " + JSON.stringify(response));
          logger.info("[알림톡] ✅ 발송 성공 (2차 시도):", {
            orderNo,
            messageId: messageId || "N/A",
            groupId: response.groupId || "N/A",
            fullResponse: JSON.stringify(response, null, 2),
          });

          if (messageId) {
            logger.info("[ALIMTALK] success messageId=" + messageId);
          }
          logger.groupEnd();

          return {
            success: true,
            message: "알림톡 발송 성공 (2차 시도)",
            messageId: messageId,
          };
        } catch (secondError: any) {
          lastError = secondError;
          logger.error("[알림톡] 2차 시도도 실패:", {
            error: secondError.response?.data?.errorMessage || secondError.message,
          });
        }
      }
    }

    // 최종 실패 처리
    const errorMessage = lastError.response?.data?.errorMessage || 
                        lastError.response?.data?.message || 
                        lastError.message || 
                        "알 수 없는 오류가 발생했습니다.";

    logger.error("[ALIMTALK] failed status=" + (lastError.response?.status || "N/A") + " body=" + JSON.stringify(lastError.response?.data || lastError));
    logger.error("[알림톡] ❌ 발송 실패:", {
      errorMessage: errorMessage,
      errorResponse: lastError.response?.data || lastError.response || lastError,
    });
    logger.groupEnd();
    return {
      success: false,
      error: `알림톡 발송 실패: ${errorMessage}`,
    };
  } catch (error: any) {
    // 예상치 못한 예외 처리
    logger.error("[ALIMTALK_TRACE] exception caught:", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      errorResponse: error.response?.data || error.response || error,
    });

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



