-- 회원 추가 정보 테이블 생성
-- Clerk 사용자와 연동하여 추가 정보를 저장하는 테이블

CREATE TABLE IF NOT EXISTS member_additional_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_id) ON DELETE CASCADE,
  
  -- 회원 구분
  member_type TEXT NOT NULL CHECK (member_type IN ('p', 'c', 'f')), -- p: 개인, c: 사업자, f: 외국인
  company_type TEXT CHECK (company_type IN ('p', 'c')), -- p: 개인사업자, c: 법인사업자
  
  -- 비밀번호 찾기 질문/답변
  hint TEXT NOT NULL,
  hint_answer TEXT NOT NULL,
  
  -- 주소 정보
  postcode TEXT,
  addr1 TEXT,
  addr2 TEXT,
  
  -- 연락처
  phone TEXT,
  mobile TEXT NOT NULL,
  
  -- 추가 정보
  gender TEXT CHECK (gender IN ('M', 'F')),
  birth_date DATE,
  is_solar_calendar BOOLEAN DEFAULT true,
  
  -- 마케팅 수신 동의
  is_sms BOOLEAN DEFAULT false,
  is_news_mail BOOLEAN DEFAULT false,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX idx_member_additional_info_clerk_id ON member_additional_info(clerk_id);

-- RLS 비활성화 (개발 중)
ALTER TABLE member_additional_info DISABLE ROW LEVEL SECURITY;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_member_additional_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_additional_info_updated_at
  BEFORE UPDATE ON member_additional_info
  FOR EACH ROW
  EXECUTE FUNCTION update_member_additional_info_updated_at();

-- 코멘트 추가
COMMENT ON TABLE member_additional_info IS '회원 추가 정보 (Clerk 연동)';
COMMENT ON COLUMN member_additional_info.clerk_id IS 'Clerk 사용자 ID';
COMMENT ON COLUMN member_additional_info.member_type IS '회원 구분 (p: 개인, c: 사업자, f: 외국인)';
COMMENT ON COLUMN member_additional_info.company_type IS '사업자 구분 (p: 개인사업자, c: 법인사업자)';
COMMENT ON COLUMN member_additional_info.hint IS '비밀번호 찾기 질문';
COMMENT ON COLUMN member_additional_info.hint_answer IS '비밀번호 찾기 답변';

