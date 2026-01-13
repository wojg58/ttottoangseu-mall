-- ============================================================================
-- orders 테이블에 관리자 알림 발송 기록 컬럼 추가
-- ============================================================================
-- 
-- 목적: 관리자 알림톡/이메일 발송 여부를 추적하여 중복 발송 방지
-- 
-- 컬럼 설명:
--   - admin_alimtalk_sent_at: 관리자 알림톡 발송 일시 (NULL = 미발송)
--   - admin_email_sent_at: 관리자 이메일 발송 일시 (NULL = 미발송)
-- 
-- 사용 시나리오:
--   1. TossPayments 웹훅에서 결제 완료(DONE) 이벤트 수신
--   2. 주문 상태가 PAID로 업데이트됨
--   3. notifyAdminOnOrderPaid 함수 호출
--   4. 각 채널(알림톡/이메일) 발송 성공 시 해당 컬럼에 now() 저장
--   5. 다음 웹훅 호출 시 이미 발송된 경우 스킵
-- ============================================================================

-- 1. admin_alimtalk_sent_at 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS admin_alimtalk_sent_at TIMESTAMPTZ NULL;

-- 2. admin_email_sent_at 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS admin_email_sent_at TIMESTAMPTZ NULL;

-- 3. 인덱스 추가 (발송 여부 확인 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_orders_admin_alimtalk_sent_at 
  ON public.orders(admin_alimtalk_sent_at) 
  WHERE admin_alimtalk_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_admin_email_sent_at 
  ON public.orders(admin_email_sent_at) 
  WHERE admin_email_sent_at IS NOT NULL;

-- 4. 주석 추가
COMMENT ON COLUMN public.orders.admin_alimtalk_sent_at IS '관리자 알림톡 발송 일시 (NULL = 미발송, 중복 발송 방지용)';
COMMENT ON COLUMN public.orders.admin_email_sent_at IS '관리자 이메일 발송 일시 (NULL = 미발송, 중복 발송 방지용)';



