-- ============================================================================
-- Reviews and Inquiries tables for Ttottoangseumall
-- 생성일: 2025-12-23
--
-- 포함:
-- - reviews: 상품 리뷰 (구매한 상품만 리뷰 가능)
-- - inquiries: 상품 문의
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
-- 1) reviews (상품 리뷰)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  
  -- 한 주문에서 같은 상품에 대한 중복 리뷰 방지
  CONSTRAINT chk_reviews_rating_range CHECK (rating >= 1 AND rating <= 5)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC) WHERE deleted_at IS NULL;

-- 트리거
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE public.reviews IS '상품 리뷰';
COMMENT ON COLUMN public.reviews.product_id IS '상품 ID';
COMMENT ON COLUMN public.reviews.user_id IS '작성자 ID (Supabase users.id)';
COMMENT ON COLUMN public.reviews.order_id IS '주문 ID (구매 확인용)';
COMMENT ON COLUMN public.reviews.rating IS '평점 (1-5)';
COMMENT ON COLUMN public.reviews.content IS '리뷰 내용';
COMMENT ON COLUMN public.reviews.images IS '리뷰 이미지 URL 배열 (JSONB)';

-- ----------------------------------------------------------------------------
-- 2) inquiries (상품 문의)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT chk_inquiries_status CHECK (status IN ('pending', 'answered'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inquiries_product_id ON public.inquiries(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON public.inquiries(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC) WHERE deleted_at IS NULL;

-- 트리거
CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE public.inquiries IS '상품 문의';
COMMENT ON COLUMN public.inquiries.product_id IS '상품 ID';
COMMENT ON COLUMN public.inquiries.user_id IS '작성자 ID (비회원 문의는 NULL)';
COMMENT ON COLUMN public.inquiries.title IS '문의 제목';
COMMENT ON COLUMN public.inquiries.content IS '문의 내용';
COMMENT ON COLUMN public.inquiries.is_secret IS '비밀글 여부';
COMMENT ON COLUMN public.inquiries.status IS '문의 상태 (pending: 대기, answered: 답변완료)';
COMMENT ON COLUMN public.inquiries.answer IS '답변 내용';
COMMENT ON COLUMN public.inquiries.answered_at IS '답변 일시';

