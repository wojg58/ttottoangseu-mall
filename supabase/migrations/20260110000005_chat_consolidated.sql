-- ============================================================================
-- 채팅 시스템 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - chat_sessions 테이블 (대화방/세션)
-- - chat_messages 테이블 (메시지)
-- ============================================================================

-- ============================================================================
-- 1. chat_sessions 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at'
    ) THEN
        CREATE TRIGGER trg_chat_sessions_updated_at
            BEFORE UPDATE ON public.chat_sessions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
    ON public.chat_sessions(user_id)
    WHERE deleted_at IS NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.chat_sessions TO anon;
GRANT ALL ON TABLE public.chat_sessions TO authenticated;
GRANT ALL ON TABLE public.chat_sessions TO service_role;

-- 주석
COMMENT ON TABLE public.chat_sessions IS '챗봇 대화방(세션)';
COMMENT ON COLUMN public.chat_sessions.user_id IS 'Supabase users.id (로그인 사용자)';

-- ============================================================================
-- 2. chat_messages 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_chat_messages_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_created_at
    ON public.chat_messages(session_id, created_at);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;

-- 주석
COMMENT ON TABLE public.chat_messages IS '챗봇 대화 메시지';
COMMENT ON COLUMN public.chat_messages.role IS '메시지 작성 주체(user/assistant/system)';

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

