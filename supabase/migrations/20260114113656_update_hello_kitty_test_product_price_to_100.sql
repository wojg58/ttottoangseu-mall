-- 헬로키티 미니 마스코트 인형 키링 하트 카라비너 키홀더 상품 가격을 1원에서 100원으로 변경
-- 결제 테스트가 100원 이상부터 가능하므로 가격 변경

UPDATE products 
SET price = 100 
WHERE name = '헬로키티 미니 마스코트 인형 키링 하트 카라비너 키홀더'
  AND price = 1;

-- 업데이트 확인 (주석 처리 - 마이그레이션 실행 시 자동으로 확인됨)
-- SELECT id, name, price, discount_price 
-- FROM products 
-- WHERE name = '헬로키티 미니 마스코트 인형 키링 하트 카라비너 키홀더';
