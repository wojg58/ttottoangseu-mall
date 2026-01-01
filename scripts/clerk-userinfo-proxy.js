/**
 * scripts/clerk-userinfo-proxy.js
 * Clerk Custom OAuth Provider를 위한 네이버 UserInfo 프록시 서버
 *
 * 네이버의 중첩된 JSON 응답을 평탄화하여 Clerk가 매핑하기 쉽게 만듭니다.
 *
 * AWS EC2에서 PM2로 실행:
 *   pm2 start scripts/clerk-userinfo-proxy.js --name "clerk-userinfo-proxy"
 *
 * 환경 변수:
 *   - PORT: 서버 포트 (기본값: 3001)
 *   - NAVER_USERINFO_URL: 네이버 UserInfo 엔드포인트 (기본값: https://openapi.naver.com/v1/nid/me)
 */
require("dotenv").config();
const http = require("http");

// 환경 변수
const PORT = process.env.PORT || 3001;
const NAVER_USERINFO_URL =
  process.env.NAVER_USERINFO_URL || "https://openapi.naver.com/v1/nid/me";

/**
 * 중첩 객체에서 안전하게 값을 꺼내는 유틸
 * get(raw, ["response", "email"]) 형태로 사용
 */
function get(obj, path, fallback = undefined) {
  if (!obj || !Array.isArray(path)) return fallback;
  return (
    path.reduce((acc, key) => (acc != null ? acc[key] : undefined), obj) ??
    fallback
  );
}

/**
 * 네이버의 중첩된 JSON을 평탄화하여 Clerk가 매핑하기 쉽게 변환
 */
function flattenNaverResponse(raw) {
  console.log("[INFO] 네이버 응답 평탄화 시작");
  console.log("[DEBUG] 원본 응답:", JSON.stringify(raw, null, 2));

  // 네이버 응답 구조:
  // {
  //   "resultcode": "00",
  //   "message": "success",
  //   "response": {
  //     "id": "...",
  //     "email": "...",
  //     "name": "...",
  //     "profile_image": "...",
  //     ...
  //   }
  // }

  const flat = {
    // OAuth 2.0 표준 필드
    sub: get(raw, ["response", "id"]), // User ID
    email: get(raw, ["response", "email"]), // 이메일 (필수)
    name: get(raw, ["response", "name"]), // 이름
    given_name: get(raw, ["response", "name"]), // First name (Clerk 호환)
    family_name: "", // Last name (네이버는 제공하지 않음)
    picture: get(raw, ["response", "profile_image"]), // 프로필 이미지
    email_verified: true, // 네이버는 이메일 인증된 사용자만 제공

    // 추가 필드 (선택)
    nickname: get(raw, ["response", "nickname"]),
    gender: get(raw, ["response", "gender"]),
    birthday: get(raw, ["response", "birthday"]),
    birthyear: get(raw, ["response", "birthyear"]),
    mobile: get(raw, ["response", "mobile"]),
  };

  console.log("[INFO] 평탄화된 응답:", JSON.stringify(flat, null, 2));

  // 필수 필드 검증
  if (!flat.sub) {
    console.warn("[WARN] sub (user id)가 없습니다");
  }
  if (!flat.email) {
    console.error(
      "[ERROR] email이 없습니다! Clerk가 사용자를 생성하지 못할 수 있습니다.",
    );
  }

  return flat;
}

/**
 * HTTP 서버 생성
 */
const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정 (Clerk가 호출하므로 필요)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  // OPTIONS 요청 처리
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET 요청만 처리
  if (req.method !== "GET") {
    console.warn(`[WARN] 지원하지 않는 메서드: ${req.method}`);
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    console.group(`[INFO] 요청 수신: ${req.method} ${req.url}`);
    console.log("[INFO] 시간:", new Date().toISOString());
    console.log("[INFO] 헤더:", {
      authorization: req.headers.authorization ? "Bearer ***" : "없음",
      "user-agent": req.headers["user-agent"],
    });

    // 1) Clerk가 보내는 Authorization 헤더(토큰) 확인
    const authorization = req.headers.authorization;
    if (!authorization) {
      console.error("[ERROR] Authorization 헤더가 없습니다");
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing_authorization" }));
      console.groupEnd();
      return;
    }

    console.log(
      "[INFO] Authorization 헤더 확인됨 (토큰 길이:",
      authorization.length,
      ")",
    );

    // 2) 네이버 UserInfo 호출 (Bearer 토큰을 그대로 전달)
    console.log("[INFO] 네이버 UserInfo 호출 중:", NAVER_USERINFO_URL);
    const idpRes = await fetch(NAVER_USERINFO_URL, {
      method: "GET",
      headers: {
        Authorization: authorization, // Clerk가 보낸 토큰을 그대로 전달
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    console.log("[INFO] 네이버 응답 상태:", idpRes.status);

    if (!idpRes.ok) {
      const errorText = await idpRes.text();
      console.error(
        "[ERROR] 네이버 UserInfo 호출 실패:",
        idpRes.status,
        errorText.substring(0, 500),
      );
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "idp_userinfo_failed",
          status: idpRes.status,
          detail: errorText.substring(0, 2000),
        }),
      );
      console.groupEnd();
      return;
    }

    const raw = await idpRes.json();
    console.log("[INFO] 네이버 응답 수신 완료");

    // 3) 중첩 JSON을 평탄화
    const flat = flattenNaverResponse(raw);

    // 4) Clerk가 매핑할 수 있는 flat JSON 반환
    console.log("[INFO] 평탄화된 응답 반환");
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(flat));
    console.groupEnd();
  } catch (error) {
    console.error("[ERROR] 프록시 처리 중 예외 발생:", error);
    console.error("[ERROR] 스택:", error.stack);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "internal_server_error",
        message: error.message,
      }),
    );
    console.groupEnd();
  }
});

// 서버 시작
server.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("🚀 Clerk UserInfo 프록시 서버 시작");
  console.log("=".repeat(60));
  console.log(`[INFO] 포트: ${PORT}`);
  console.log(`[INFO] 네이버 UserInfo URL: ${NAVER_USERINFO_URL}`);
  console.log(`[INFO] 프록시 엔드포인트: http://localhost:${PORT}/`);
  console.log(`[INFO] Clerk 대시보드 설정: http://<YOUR_SERVER_IP>:${PORT}/`);
  console.log("=".repeat(60));
});

// 에러 처리
server.on("error", (error) => {
  console.error("[ERROR] 서버 에러:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[INFO] SIGTERM 수신, 서버 종료 중...");
  server.close(() => {
    console.log("[INFO] 서버 종료 완료");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[INFO] SIGINT 수신, 서버 종료 중...");
  server.close(() => {
    console.log("[INFO] 서버 종료 완료");
    process.exit(0);
  });
});
