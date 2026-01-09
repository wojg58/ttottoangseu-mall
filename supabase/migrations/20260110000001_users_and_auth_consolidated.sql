-- ============================================================================
-- 사용자 및 인증 관련 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - member_additional_info 테이블 (회원 추가 정보)
-- - clerk_user_id UNIQUE 제약조건
-- ============================================================================

-- ============================================================================
-- 1. member_additional_info 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_additional_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  
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

-- 외래키 제약조건 (users.clerk_id 참조)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_member_additional_info_clerk_id'
    ) THEN
        -- users 테이블에 clerk_id 컬럼이 있는지 확인 후 외래키 추가
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'clerk_id'
        ) THEN
            ALTER TABLE public.member_additional_info
                ADD CONSTRAINT fk_member_additional_info_clerk_id
                FOREIGN KEY (clerk_id) REFERENCES public.users(clerk_id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_member_additional_info_clerk_id 
    ON public.member_additional_info(clerk_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_member_additional_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_member_additional_info_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_member_additional_info_updated_at
            BEFORE UPDATE ON public.member_additional_info
            FOR EACH ROW
            EXECUTE FUNCTION update_member_additional_info_updated_at();
    END IF;
END $$;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.member_additional_info DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.member_additional_info TO anon;
GRANT ALL ON TABLE public.member_additional_info TO authenticated;
GRANT ALL ON TABLE public.member_additional_info TO service_role;

-- 주석
COMMENT ON TABLE public.member_additional_info IS '회원 추가 정보 (Clerk 연동)';
COMMENT ON COLUMN public.member_additional_info.clerk_id IS 'Clerk 사용자 ID';
COMMENT ON COLUMN public.member_additional_info.member_type IS '회원 구분 (p: 개인, c: 사업자, f: 외국인)';
COMMENT ON COLUMN public.member_additional_info.company_type IS '사업자 구분 (p: 개인사업자, c: 법인사업자)';
COMMENT ON COLUMN public.member_additional_info.hint IS '비밀번호 찾기 질문';
COMMENT ON COLUMN public.member_additional_info.hint_answer IS '비밀번호 찾기 답변';

-- ============================================================================
-- 2. clerk_user_id UNIQUE 제약조건 추가
-- ============================================================================

-- users 테이블에 clerk_user_id 컬럼이 있는지 확인 후 제약조건 추가
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'clerk_user_id'
    ) THEN
        -- 전체 UNIQUE 제약조건 추가 (ON CONFLICT 사용을 위해 필요)
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_clerk_user_id'
        ) THEN
            ALTER TABLE public.users 
                ADD CONSTRAINT uq_users_clerk_user_id 
                UNIQUE (clerk_user_id);
            
            COMMENT ON CONSTRAINT uq_users_clerk_user_id ON public.users IS 
                'Clerk 사용자 ID 유니크 제약조건 (ON CONFLICT 사용을 위해 필요)';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

