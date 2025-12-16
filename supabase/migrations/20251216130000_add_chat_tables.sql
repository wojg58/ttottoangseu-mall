-- ============================================================================
-- Chat tables for Ttottoangseumall (login-only chatbot history)
-- 생성일: 2025-12-16
--
-- 포함:
-- - chat_sessions: 대화방(세션)
-- - chat_messages: 메시지(사용자/봇)
--
-- 개발 환경 원칙:
-- - RLS 비활성화 (프로덕션 전환 시 정책 검토 필요)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) updated_at 자동 업데이트 함수(없으면 생성)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- 함수가 없으면 생성
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) chat_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_sessions IS '챗봇 대화방(세션)';
COMMENT ON COLUMN public.chat_sessions.user_id IS 'Supabase users.id (로그인 사용자)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_chat_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_chat_sessions_updated_at
      BEFORE UPDATE ON public.chat_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2) chat_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_chat_messages_role CHECK (role IN ('user', 'assistant', 'system'))
);

COMMENT ON TABLE public.chat_messages IS '챗봇 대화 메시지';
COMMENT ON COLUMN public.chat_messages.role IS '메시지 작성 주체(user/assistant/system)';

-- ----------------------------------------------------------------------------
-- 3) 인덱스
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON public.chat_sessions(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_created_at
  ON public.chat_messages(session_id, created_at);

-- ----------------------------------------------------------------------------
-- 4) 개발 환경: RLS 비활성화 + 권한 부여
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.chat_sessions TO anon;
GRANT ALL ON TABLE public.chat_sessions TO authenticated;
GRANT ALL ON TABLE public.chat_sessions TO service_role;

GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


