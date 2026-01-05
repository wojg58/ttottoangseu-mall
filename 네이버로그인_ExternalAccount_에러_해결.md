# "The External Account was not found" 에러 해결 가이드

## 현재 상황

- ✅ 프록시 서버 응답: 정상 (base64url 인코딩 또는 원본 값)
- ✅ Attribute Mapping: 올바르게 설정됨
  - User ID → `sub`
  - Email → `email`
  - First name → `given_name`
- ❌ "The External Account was not found" 에러 발생
- ❌ 계정 생성 실패

## 가능한 원인

### 1. 프록시 서버가 호출되지 않음 (가장 가능성 높음)

**증상**: Network 탭에 `http://15.165.148.244:3001/` 요청이 없음

**확인 방법**:

1. 브라우저 개발자 도구(F12) 열기
2. Network 탭 선택
3. "Preserve log" 옵션 활성화
4. 네이버 로그인 시도
5. `15.165.148.244:3001` 또는 `clerk-userinfo-proxy` 검색

**해결 방법**:

- Clerk Dashboard → SSO Connections → 네이버
- UserInfo URL 확인: `http://15.165.148.244:3001/`
- HTTPS가 아닌 HTTP인지 확인 (프록시 서버가 HTTP로 실행 중)

### 2. 프록시 서버 응답 형식 문제

**증상**: 프록시 서버는 호출되지만 Clerk가 응답을 파싱하지 못함

**확인 방법**:

- 프록시 서버 로그에서 최종 응답 JSON 확인
- Network 탭에서 프록시 서버 Response 확인

**해결 방법**:

- 프록시 서버가 올바른 JSON 형식으로 반환하는지 확인
- Content-Type 헤더가 `application/json`인지 확인

### 3. `sub` 값이 이미 다른 사용자와 연결됨

**증상**: 같은 네이버 계정이 이미 다른 Clerk 사용자와 연결됨

**확인 방법**:

- Clerk Dashboard → Users
- 네이버 계정 이메일로 검색
- 기존 사용자가 있는지 확인

**해결 방법**:

- 기존 사용자 삭제 또는 External Account 연결 해제
- 또는 기존 사용자에 네이버 계정 연결

### 4. Clerk 정책 제한

**증상**: "Allow users to sign up" 비활성화 또는 다른 정책 제한

**확인 방법**:

- Clerk Dashboard → Settings → User Management
- "Allow users to sign up": Enabled 확인
- SSO Connections → 네이버 → Settings
- "Allow users to sign up": Enabled 확인

## 단계별 진단

### Step 1: Network 탭 확인 (가장 중요!)

1. 브라우저 개발자 도구(F12) 열기
2. Network 탭 선택
3. "Preserve log" 옵션 활성화
4. 네이버 로그인 시도
5. 다음 요청 확인:
   - `http://15.165.148.244:3001/` (프록시 서버)
   - `/v1/oauth_callback` (Clerk OAuth 콜백)
   - `/v1/client/sign_ins` (Clerk Sign-in API)

**프록시 서버 요청이 없다면**:

- Clerk Dashboard의 UserInfo URL 설정 확인
- 프록시 서버가 실행 중인지 확인: `pm2 list`

**프록시 서버 요청이 있다면**:

- Response 본문 확인
- `sub` 필드 값 확인
- Status Code 확인 (200이어야 함)

### Step 2: 프록시 서버 로그 확인

```bash
ssh -i "aws_server.pem" ubuntu@15.165.148.244
pm2 logs clerk-userinfo-proxy --lines 50
```

확인 사항:

- Clerk가 프록시 서버를 호출했는지
- 프록시 서버가 네이버 UserInfo API를 호출했는지
- 최종 응답 JSON 확인
- `sub` 필드 값 확인 (원본 또는 base64url)

### Step 3: Clerk Dashboard Logs 확인

Clerk Dashboard → Logs:

- 최근 OAuth 관련 로그 확인
- "External Account was not found" 에러 상세 확인
- 에러 메시지의 전체 내용 확인

### Step 4: Attribute Mapping 재확인

Clerk Dashboard → SSO Connections → 네이버 → Attribute Mapping:

- User ID / Subject → `sub` (정확히 소문자 `sub`, 대소문자 주의!)
- Email → `email` (정확히 소문자 `email`)
- First Name → `given_name` 또는 `name`

**중요**: 필드명이 정확히 일치해야 합니다. `Sub`, `SUB`, `sub_` 등은 작동하지 않습니다.

## 해결 방법

### 방법 1: 원본 `sub` 값 사용 (현재 적용됨)

프록시 서버가 이제 원본 `sub` 값을 사용합니다 (기본값).

네이버 로그인을 다시 시도해보세요.

### 방법 2: base64url 인코딩 사용

원본 값이 작동하지 않으면 base64url 인코딩을 사용:

```bash
ssh -i "aws_server.pem" ubuntu@15.165.148.244
cd /home/ubuntu/ttottoangseu-mall
# .env 파일에 추가
echo "CLERK_SUB_ENCODING=base64url" >> .env
pm2 restart clerk-userinfo-proxy --update-env
```

### 방법 3: Clerk Dashboard 설정 재확인

1. **UserInfo URL 확인**:

   - SSO Connections → 네이버
   - UserInfo URL: `http://15.165.148.244:3001/`
   - HTTPS가 아닌 HTTP인지 확인

2. **Attribute Mapping 재확인**:

   - User ID / Subject → `sub` (정확히 소문자)
   - Email → `email` (정확히 소문자)

3. **"Allow users to sign up" 확인**:
   - Settings → User Management
   - SSO Connections → 네이버 → Settings

## 즉시 확인할 사항

1. **Network 탭에서 프록시 서버 호출 여부**

   - `http://15.165.148.244:3001/` 요청이 있는지 확인
   - 이것이 가장 중요합니다!

2. **프록시 서버 로그**

   - 최근 요청 로그 확인
   - `sub` 필드 값 확인

3. **Clerk Dashboard Logs**
   - 최근 OAuth 에러 로그 확인
   - "External Account was not found" 에러 상세 확인

## 다음 단계

위 정보를 확인한 후 공유해주시면 정확한 원인을 파악할 수 있습니다.

특히 다음 정보가 중요합니다:

- Network 탭에 프록시 서버 호출이 있는지 여부
- 프록시 서버 로그의 최근 요청
- Clerk Dashboard Logs의 에러 메시지
