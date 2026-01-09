-- ============================================================================
-- 상품-카테고리 다대다 관계 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - product_categories 중간 테이블 생성
-- - products.category_id를 nullable로 변경
-- - 동기화 트리거 함수
-- ============================================================================

-- ============================================================================
-- 1. product_categories 중간 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    category_id UUID NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false, -- 기본 카테고리 여부
    sort_order INT NOT NULL DEFAULT 0, -- 정렬 순서
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- UNIQUE 제약조건: 같은 상품-카테고리 조합은 중복 불가
    CONSTRAINT uq_product_categories_product_category UNIQUE (product_id, category_id)
);

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_categories_product_id'
    ) THEN
        ALTER TABLE public.product_categories
            ADD CONSTRAINT fk_product_categories_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_categories_category_id'
    ) THEN
        ALTER TABLE public.product_categories
            ADD CONSTRAINT fk_product_categories_category_id
            FOREIGN KEY (category_id) REFERENCES public.categories(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id 
    ON public.product_categories(product_id) 
    WHERE product_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id 
    ON public.product_categories(category_id) 
    WHERE category_id IS NOT NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.product_categories IS '상품-카테고리 다중 관계 (Many-to-Many)';
COMMENT ON COLUMN public.product_categories.id IS '관계 고유 ID';
COMMENT ON COLUMN public.product_categories.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN public.product_categories.category_id IS '카테고리 ID (FK)';
COMMENT ON COLUMN public.product_categories.is_primary IS '기본 카테고리 여부 (products.category_id와 동기화)';
COMMENT ON COLUMN public.product_categories.sort_order IS '정렬 순서 (작을수록 먼저 표시)';
COMMENT ON COLUMN public.product_categories.created_at IS '생성일시';

-- ============================================================================
-- 2. products.category_id를 nullable로 변경
-- ============================================================================

-- products 테이블에 category_id 컬럼이 있고 NOT NULL이면 nullable로 변경
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'category_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.products
            ALTER COLUMN category_id DROP NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. 동기화 트리거 함수 생성
-- ============================================================================

-- products.category_id 변경 시 product_categories의 is_primary 업데이트
CREATE OR REPLACE FUNCTION sync_product_category_id()
RETURNS TRIGGER AS $$
BEGIN
    -- category_id가 변경되면 product_categories의 is_primary 업데이트
    IF NEW.category_id IS NOT NULL THEN
        -- 기존 기본 카테고리 해제
        UPDATE public.product_categories
        SET is_primary = false
        WHERE product_id = NEW.id AND is_primary = true;
        
        -- 새로운 기본 카테고리 설정 (없으면 생성)
        INSERT INTO public.product_categories (product_id, category_id, is_primary, sort_order)
        VALUES (NEW.id, NEW.category_id, true, 0)
        ON CONFLICT (product_id, category_id)
        DO UPDATE SET is_primary = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_product_category_id() IS 'products.category_id 변경 시 product_categories 동기화';

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_product_category_id'
    ) THEN
        CREATE TRIGGER trg_sync_product_category_id
            AFTER INSERT OR UPDATE OF category_id ON public.products
            FOR EACH ROW
            WHEN (NEW.category_id IS NOT NULL)
            EXECUTE FUNCTION sync_product_category_id();
    END IF;
END $$;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

