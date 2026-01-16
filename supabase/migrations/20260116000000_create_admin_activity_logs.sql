-- ============================================================================
-- admin_activity_logs 테이블 생성
-- ============================================================================
-- 
-- 관리자 활동 로그 테이블
-- - 관리자의 모든 활동을 추적
-- - 변경 전/후 값을 JSONB로 저장
-- - RLS 활성화 및 관리자만 접근 가능
-- ============================================================================

-- ============================================================================
-- 1. admin_activity_logs 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    admin_user_id TEXT NOT NULL, -- Clerk user ID (TEXT 타입)
    admin_email TEXT, -- 관리자 이메일 (조회 성능 향상)
    action TEXT NOT NULL, -- 액션 (예: "order_status_changed", "product_updated")
    entity_type TEXT NOT NULL, -- 엔티티 타입 (예: "order", "product", "inventory")
    entity_id TEXT NOT NULL, -- 엔티티 ID
    before JSONB, -- 변경 전 값 (JSONB)
    after JSONB, -- 변경 후 값 (JSONB)
    ip TEXT, -- IP 주소
    user_agent TEXT -- User Agent
);

-- ============================================================================
-- 2. 인덱스 생성 (권장)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON public.admin_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_entity_type ON public.admin_activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON public.admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_entity_type_id ON public.admin_activity_logs(entity_type, entity_id);

-- ============================================================================
-- 3. RLS 활성화
-- ============================================================================

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS 정책 생성 (관리자만 SELECT/INSERT 가능)
-- ============================================================================

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "admin_only_select_admin_activity_logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "admin_only_insert_admin_activity_logs" ON public.admin_activity_logs;

-- SELECT 정책: 관리자만 조회 가능
-- Clerk user ID를 users 테이블에서 조회하여 role='admin'인 경우만 허용
CREATE POLICY "admin_only_select_admin_activity_logs"
ON public.admin_activity_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
        AND users.role = 'admin'
        AND users.deleted_at IS NULL
    )
);

-- INSERT 정책: 관리자만 삽입 가능
CREATE POLICY "admin_only_insert_admin_activity_logs"
ON public.admin_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
        AND users.role = 'admin'
        AND users.deleted_at IS NULL
    )
);

-- UPDATE 정책: 로그는 수정 불가 (읽기 전용)
-- UPDATE 정책은 생성하지 않음 (로그는 수정하면 안 됨)

-- DELETE 정책: 로그는 삭제 불가 (읽기 전용)
-- DELETE 정책은 생성하지 않음 (로그는 삭제하면 안 됨)

-- ============================================================================
-- 5. 권한 부여
-- ============================================================================

GRANT SELECT, INSERT ON TABLE public.admin_activity_logs TO authenticated;
GRANT ALL ON TABLE public.admin_activity_logs TO service_role;

-- ============================================================================
-- 6. 주석
-- ============================================================================

COMMENT ON TABLE public.admin_activity_logs IS '관리자 활동 로그 (변경 이력 추적)';
COMMENT ON COLUMN public.admin_activity_logs.admin_user_id IS 'Clerk user ID (TEXT)';
COMMENT ON COLUMN public.admin_activity_logs.action IS '액션 (예: "order_status_changed", "product_updated")';
COMMENT ON COLUMN public.admin_activity_logs.entity_type IS '엔티티 타입 (예: "order", "product", "inventory")';
COMMENT ON COLUMN public.admin_activity_logs.before IS '변경 전 값 (JSONB)';
COMMENT ON COLUMN public.admin_activity_logs.after IS '변경 후 값 (JSONB)';
