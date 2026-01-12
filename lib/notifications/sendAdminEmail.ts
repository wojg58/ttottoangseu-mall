/**
 * @file lib/notifications/sendAdminEmail.ts
 * @description 관리자 이메일 알림 발송
 *
 * 주문 완료 시 관리자에게 이메일을 발송합니다.
 *
 * 주요 기능:
 * - Resend API 우선 사용 (권장)
 * - Nodemailer SMTP 대체 옵션 지원
 * - 환경변수 ADMIN_EMAIL_ENABLED로 발송 제어
 * - 실패 시 throw하지 않고 결과 반환 (상위에서 로깅)
 *
 * @dependencies
 * - Resend: @resend/node (우선)
 * - Nodemailer: nodemailer (대체)
 */

import logger from "@/lib/logger";

interface EmailSendResult {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

/**
 * Resend를 통한 이메일 발송 (여러 수신자 지원)
 */
async function sendEmailWithResend(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody: string,
): Promise<EmailSendResult> {
  logger.group("[sendEmailWithResend] Resend 이메일 발송");
  logger.info("[sendEmailWithResend] 발송 정보:", {
    to: Array.isArray(to) ? to : [to],
    subject,
    fromEmail: process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL,
    hasApiKey: !!process.env.RESEND_API_KEY,
  });

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    logger.error(
      "[sendEmailWithResend] ❌ RESEND_API_KEY가 설정되지 않았습니다.",
    );
    logger.groupEnd();
    return {
      success: false,
      error: "RESEND_API_KEY가 설정되지 않았습니다.",
    };
  }

  if (!fromEmail) {
    logger.error(
      "[sendEmailWithResend] ❌ EMAIL_FROM 또는 RESEND_FROM_EMAIL이 설정되지 않았습니다.",
    );
    logger.groupEnd();
    return {
      success: false,
      error: "EMAIL_FROM 또는 RESEND_FROM_EMAIL이 설정되지 않았습니다.",
    };
  }

  logger.info("[sendEmailWithResend] ✅ 환경 변수 확인 완료");

  try {
    logger.info("[sendEmailWithResend] Resend SDK import 시작");
    // Resend SDK 동적 import (필요 시에만 로드)
    const { Resend } = await import("resend");
    logger.info("[sendEmailWithResend] ✅ Resend SDK import 완료");

    const resend = new Resend(apiKey);
    logger.info("[sendEmailWithResend] Resend 클라이언트 생성 완료");

    // 여러 이메일 주소를 배열로 변환
    const toArray = Array.isArray(to) ? to : [to];
    logger.info("[sendEmailWithResend] 이메일 발송 요청:", {
      from: fromEmail,
      to: toArray,
      subject,
    });

    logger.info("[sendEmailWithResend] Resend API 호출 시작:", {
      from: fromEmail,
      to: toArray,
      subject,
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
    });

    const response = await resend.emails.send({
      from: fromEmail,
      to: toArray,
      subject: subject,
      html: htmlBody,
      text: textBody,
    });

    logger.info("[sendEmailWithResend] Resend API 응답:", {
      hasData: !!response.data,
      hasError: !!response.error,
      data: response.data,
      error: response.error,
      errorType: response.error?.constructor?.name,
      errorMessage: response.error?.message,
      errorStatus: (response.error as any)?.status,
      fullError: response.error ? JSON.stringify(response.error, Object.getOwnPropertyNames(response.error), 2) : null,
    });

    if (response.error) {
      const errorStatus = (response.error as any)?.status;
      const errorMessage = response.error.message || JSON.stringify(response.error);
      
      logger.error("[이메일] Resend 발송 실패 (403 Forbidden 가능성):", {
        error: response.error,
        message: errorMessage,
        name: response.error.name,
        status: errorStatus,
        statusCode: errorStatus || "unknown",
        fullError: JSON.stringify(response.error, Object.getOwnPropertyNames(response.error), 2),
        troubleshooting: {
          apiKeyConfigured: !!apiKey,
          fromEmail: fromEmail,
          possibleCauses: [
            "API 키 권한 부족 (Sending access 필요)",
            "발신자 이메일 주소가 Resend에 등록되지 않음",
            "API 키가 만료되었거나 잘못됨",
            "발신자 이메일 주소 형식 오류",
          ],
        },
      });
      logger.groupEnd();
      return {
        success: false,
        error: `이메일 발송 실패 (${errorStatus || "Unknown"}): ${errorMessage}`,
      };
    }

    if (!response.data) {
      logger.error("[이메일] Resend 응답에 data가 없습니다:", response);
      logger.groupEnd();
      return {
        success: false,
        error: "이메일 발송 실패: Resend 응답에 데이터가 없습니다.",
      };
    }

    logger.info("[이메일] Resend 발송 성공:", {
      to: toArray,
      messageId: response.data.id,
      from: fromEmail,
    });
    logger.groupEnd();

    return {
      success: true,
      message: "이메일 발송 성공 (Resend)",
      messageId: response.data.id,
    };
  } catch (error) {
    logger.error("[이메일] Resend 발송 예외:", error);
    logger.groupEnd();
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * Nodemailer SMTP를 통한 이메일 발송 (여러 수신자 지원)
 */
async function sendEmailWithSMTP(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody: string,
): Promise<EmailSendResult> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      success: false,
      error:
        "SMTP 설정이 완료되지 않았습니다. (SMTP_HOST, SMTP_USER, SMTP_PASS 필요)",
    };
  }

  if (!fromEmail) {
    return {
      success: false,
      error: "EMAIL_FROM이 설정되지 않았습니다.",
    };
  }

  try {
    // Nodemailer 동적 import (필요 시에만 로드)
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // 465는 SSL, 587은 TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // 여러 이메일 주소를 문자열 또는 배열로 변환 (Nodemailer는 둘 다 지원)
    const toAddresses = Array.isArray(to) ? to.join(", ") : to;

    const info = await transporter.sendMail({
      from: fromEmail,
      to: toAddresses,
      subject: subject,
      text: textBody,
      html: htmlBody,
    });

    logger.info("[이메일] SMTP 발송 성공:", {
      to: Array.isArray(to) ? to : [to],
      messageId: info.messageId,
    });

    return {
      success: true,
      message: "이메일 발송 성공 (SMTP)",
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error("[이메일] SMTP 발송 예외:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 관리자 이메일 알림 발송
 *
 * @param orderNo - 주문번호
 * @param amount - 결제금액 (숫자, 원 단위)
 * @param orderDateKst - 주문일시 (KST 문자열, YYYY-MM-DD HH:mm:ss)
 * @returns 발송 결과
 */
export async function sendAdminEmail(
  orderNo: string,
  amount: number,
  orderDateKst: string,
): Promise<EmailSendResult> {
  logger.group("[sendAdminEmail] 이메일 발송 시작");
  logger.info("[sendAdminEmail] 주문 정보:", { orderNo, amount, orderDateKst });

  // 환경변수 확인
  const enabled = process.env.ADMIN_EMAIL_ENABLED === "true";
  logger.info("[sendAdminEmail] 환경 변수 확인:", {
    ADMIN_EMAIL_ENABLED: process.env.ADMIN_EMAIL_ENABLED,
    enabled,
    ADMIN_EMAIL_TO: process.env.ADMIN_EMAIL_TO,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "설정됨" : "설정 안됨",
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    EMAIL_FROM: process.env.EMAIL_FROM,
  });

  if (!enabled) {
    logger.info("[이메일] ADMIN_EMAIL_ENABLED=false, 발송 스킵");
    logger.groupEnd();
    return {
      success: true,
      message: "이메일 발송이 비활성화되어 있습니다.",
    };
  }

  const adminEmailRaw = process.env.ADMIN_EMAIL_TO;
  if (!adminEmailRaw) {
    logger.warn("[이메일] ADMIN_EMAIL_TO가 설정되지 않았습니다.");
    return {
      success: false,
      error: "관리자 이메일 주소가 설정되지 않았습니다.",
    };
  }

  // 여러 이메일 주소를 쉼표로 구분하여 배열로 변환
  // 예: "wojg58@gmail.com,ttottoangseu@naver.com" → ["wojg58@gmail.com", "ttottoangseu@naver.com"]
  const adminEmails = adminEmailRaw
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  if (adminEmails.length === 0) {
    logger.warn("[이메일] 유효한 이메일 주소가 없습니다.");
    return {
      success: false,
      error: "유효한 이메일 주소가 없습니다.",
    };
  }

  logger.info(
    `[이메일] ${adminEmails.length}개 주소로 발송 예정:`,
    adminEmails,
  );

  // 이메일 본문 구성
  const subject = `[또또앙스] 새 주문 접수 - ${orderNo}`;
  const textBody = `새 주문이 접수되었습니다.

주문번호: ${orderNo}
결제금액: ${amount.toLocaleString("ko-KR")}원
주문일시: ${orderDateKst}

관리자 페이지에서 확인해주세요.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">새 주문이 접수되었습니다.</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">주문번호</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderNo}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">결제금액</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${amount.toLocaleString(
            "ko-KR",
          )}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">주문일시</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderDateKst}</td>
        </tr>
      </table>
      <p style="color: #666; margin-top: 20px;">관리자 페이지에서 확인해주세요.</p>
    </div>
  `;

  // 이메일 프로바이더 선택
  const emailProvider = process.env.EMAIL_PROVIDER || "resend";
  logger.info("[sendAdminEmail] 이메일 프로바이더:", emailProvider);

  let result: EmailSendResult;
  if (emailProvider === "resend") {
    logger.info("[sendAdminEmail] Resend로 이메일 발송 시작");
    result = await sendEmailWithResend(
      adminEmails,
      subject,
      htmlBody,
      textBody,
    );
  } else if (emailProvider === "smtp") {
    logger.info("[sendAdminEmail] SMTP로 이메일 발송 시작");
    result = await sendEmailWithSMTP(adminEmails, subject, htmlBody, textBody);
  } else {
    logger.warn(
      `[이메일] 지원하지 않는 EMAIL_PROVIDER: ${emailProvider} (resend 또는 smtp만 지원)`,
    );
    result = {
      success: false,
      error: `지원하지 않는 이메일 프로바이더: ${emailProvider}`,
    };
  }

  logger.info("[sendAdminEmail] 이메일 발송 결과:", result);
  logger.groupEnd();
  return result;
}
