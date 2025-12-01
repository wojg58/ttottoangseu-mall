-- =============================================
-- 카테고리 데이터 추가
-- =============================================

-- 카테고리 데이터 삽입 (기존 데이터가 없을 때만)
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT * FROM (VALUES
  ('베스트', 'best', '베스트 상품 모음', 1, true),
  ('산리오', 'sanrio', '헬로키티, 마이멜로디, 쿠로미 등 산리오 캐릭터 굿즈', 2, true),
  ('캐릭터', 'character', '다양한 인기 캐릭터 굿즈', 3, true),
  ('핸드폰줄', 'phone-strap', '귀여운 핸드폰 스트랩 모음', 4, true),
  ('키링/지비츠', 'keyring', '키링과 크록스 지비츠 컬렉션', 5, true),
  ('패션잡화', 'fashion', '가방, 파우치, 악세서리', 6, true),
  ('곰돌이', 'bear', '귀여운 곰돌이 캐릭터 상품', 7, true),
  ('완구문구', 'stationery', '문구용품과 장난감', 8, true)
) AS v(name, slug, description, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.slug = v.slug AND categories.deleted_at IS NULL
);

