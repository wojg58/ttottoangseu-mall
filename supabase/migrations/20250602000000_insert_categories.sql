-- =============================================
-- 카테고리 데이터 추가
-- =============================================

-- 카테고리 데이터 삽입 (기존 데이터가 없을 때만)
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT * FROM (VALUES
  ('베스트', 'best', '베스트 상품 모음', 1, true),
  ('산리오', 'sanrio', '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈', 2, true),
  ('치이카와', 'character', '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터', 3, true),
  ('모프샌드', 'phone-strap', '사랑스럽고 귀여운 고양이', 4, true),
  ('유키오', 'keyring', '순수하고 말없이 곁에 있어주는 납작한 친구', 5, true),
  ('짱구', 'fashion', '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이', 6, true),
  ('반다이', 'bear', '다마고치, 배스킨라빈스 등 반다이 상품', 7, true),
  ('가차,리멘트', 'stationery', '다양한 캡슐토이와 리멘트', 8, true)
) AS v(name, slug, description, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.slug = v.slug AND categories.deleted_at IS NULL
);

