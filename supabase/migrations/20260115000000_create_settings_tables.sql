-- ============================================================================
-- 설정 관련 테이블 생성
-- ============================================================================
-- 
-- 포함 내용:
-- - shipping_settings: 배송비 설정
-- - return_policies: 반품 정책
-- - system_logs: 시스템 로그
-- 
-- 개발 환경 원칙:
-- - RLS 비활성화 (프로덕션 전환 시 정책 검토 필요)
-- ============================================================================

-- ============================================================================
-- 1. shipping_settings (배송비 설정)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- 설정 이름 (예: "기본 배송비", "제주/도서산간 배송비")
    base_shipping_fee INTEGER NOT NULL DEFAULT 0, -- 기본 배송비 (원)
    free_shipping_threshold INTEGER, -- 무료배송 기준 금액 (원, NULL이면 무료배송 없음)
    is_active BOOLEAN NOT NULL DEFAULT true, -- 활성화 여부
    description TEXT, -- 설명
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성 (기존 트리거가 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS trg_shipping_settings_updated_at ON public.shipping_settings;
CREATE TRIGGER trg_shipping_settings_updated_at
    BEFORE UPDATE ON public.shipping_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.shipping_settings DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.shipping_settings TO anon;
GRANT ALL ON TABLE public.shipping_settings TO authenticated;
GRANT ALL ON TABLE public.shipping_settings TO service_role;

-- 주석
COMMENT ON TABLE public.shipping_settings IS '배송비 설정';
COMMENT ON COLUMN public.shipping_settings.base_shipping_fee IS '기본 배송비 (원)';
COMMENT ON COLUMN public.shipping_settings.free_shipping_threshold IS '무료배송 기준 금액 (원, NULL이면 무료배송 없음)';

-- 기본 데이터 삽입
INSERT INTO public.shipping_settings (name, base_shipping_fee, free_shipping_threshold, description)
VALUES 
    ('기본 배송비', 3000, 50000, '일반 지역 배송비 설정'),
    ('제주/도서산간 배송비', 5000, 100000, '제주도 및 도서산간 지역 배송비 설정')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. return_policies (반품 정책)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.return_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL, -- 정책 제목
    content TEXT NOT NULL, -- 정책 내용
    return_period_days INTEGER NOT NULL DEFAULT 7, -- 반품 가능 기간 (일)
    exchange_period_days INTEGER NOT NULL DEFAULT 7, -- 교환 가능 기간 (일)
    return_shipping_fee INTEGER NOT NULL DEFAULT 0, -- 반품 배송비 (원)
    is_active BOOLEAN NOT NULL DEFAULT true, -- 활성화 여부
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성 (기존 트리거가 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS trg_return_policies_updated_at ON public.return_policies;
CREATE TRIGGER trg_return_policies_updated_at
    BEFORE UPDATE ON public.return_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.return_policies DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.return_policies TO anon;
GRANT ALL ON TABLE public.return_policies TO authenticated;
GRANT ALL ON TABLE public.return_policies TO service_role;

-- 주석
COMMENT ON TABLE public.return_policies IS '반품 정책';
COMMENT ON COLUMN public.return_policies.return_period_days IS '반품 가능 기간 (일)';
COMMENT ON COLUMN public.return_policies.exchange_period_days IS '교환 가능 기간 (일)';

-- 기본 데이터 삽입
INSERT INTO public.return_policies (title, content, return_period_days, exchange_period_days, return_shipping_fee)
VALUES 
    ('기본 반품 정책', 
     '상품 수령 후 7일 이내에 반품/교환 신청이 가능합니다.\n\n반품/교환 시 배송비는 고객 부담입니다.\n\n상품이 손상되었거나 불량인 경우에는 배송비를 환불해드립니다.',
     7, 7, 3000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. system_logs (시스템 로그)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- 사용자 ID (관리자 작업인 경우)
    action TEXT NOT NULL, -- 액션 (예: "order_created", "product_updated")
    entity_type TEXT, -- 엔티티 타입 (예: "order", "product")
    entity_id TEXT, -- 엔티티 ID
    description TEXT, -- 설명
    metadata JSONB, -- 추가 메타데이터
    ip_address TEXT, -- IP 주소
    user_agent TEXT, -- User Agent
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON public.system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity_type ON public.system_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.system_logs DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.system_logs TO anon;
GRANT ALL ON TABLE public.system_logs TO authenticated;
GRANT ALL ON TABLE public.system_logs TO service_role;

-- 주석
COMMENT ON TABLE public.system_logs IS '시스템 로그';
COMMENT ON COLUMN public.system_logs.action IS '액션 (예: "order_created", "product_updated")';
COMMENT ON COLUMN public.system_logs.entity_type IS '엔티티 타입 (예: "order", "product")';
COMMENT ON COLUMN public.system_logs.metadata IS '추가 메타데이터 (JSON)';

-- ============================================================================
-- 4. audit_logs (관리자 활동 로그 - 변경 이력 추적)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL, -- 관리자 사용자 ID (users 테이블 참조)
    admin_email TEXT, -- 관리자 이메일 (조회 성능 향상)
    admin_name TEXT, -- 관리자 이름 (조회 성능 향상)
    action TEXT NOT NULL, -- 액션 (예: "order_status_changed", "product_price_updated", "inventory_updated")
    entity_type TEXT NOT NULL, -- 엔티티 타입 (예: "order", "product", "inventory")
    entity_id TEXT NOT NULL, -- 엔티티 ID
    entity_name TEXT, -- 엔티티 이름 (예: 주문번호, 상품명) - 조회 성능 향상
    field_name TEXT, -- 변경된 필드명 (예: "payment_status", "price", "stock")
    old_value TEXT, -- 변경 전 값 (JSON 문자열)
    new_value TEXT, -- 변경 후 값 (JSON 문자열)
    description TEXT, -- 설명
    ip_address TEXT, -- IP 주소
    user_agent TEXT, -- User Agent
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON public.audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON public.audit_logs(entity_type, entity_id);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

-- 주석
COMMENT ON TABLE public.audit_logs IS '관리자 활동 로그 (변경 이력 추적)';
COMMENT ON COLUMN public.audit_logs.action IS '액션 (예: "order_status_changed", "product_price_updated")';
COMMENT ON COLUMN public.audit_logs.entity_type IS '엔티티 타입 (예: "order", "product", "inventory")';
COMMENT ON COLUMN public.audit_logs.field_name IS '변경된 필드명 (예: "payment_status", "price")';
COMMENT ON COLUMN public.audit_logs.old_value IS '변경 전 값 (JSON 문자열)';
COMMENT ON COLUMN public.audit_logs.new_value IS '변경 후 값 (JSON 문자열)';
