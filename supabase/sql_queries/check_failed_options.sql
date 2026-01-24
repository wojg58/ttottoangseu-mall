-- 실패한 상품들의 옵션명 확인 쿼리
-- 스마트스토어 매핑 실패 상품들의 variant_value 확인

-- 실패한 상품 목록 (스마트스토어 옵션명과 DB 옵션명 비교)
SELECT 
    p.id,
    p.name as product_name,
    pv.id as variant_id,
    pv.variant_name,
    pv.variant_value,
    pv.sku,
    pv.smartstore_option_id,
    pv.smartstore_channel_product_no,
    pv.stock
FROM products p
INNER JOIN product_variants pv ON p.id = pv.product_id
WHERE p.deleted_at IS NULL
    AND pv.deleted_at IS NULL
    AND p.status = 'active'
    AND (
        -- 실패한 상품들 (상품명으로 검색)
        p.name LIKE '%블랙엔젤 스타일업 롱다리 마스코트 인형 키링 그레이 드레스%'
        OR p.name LIKE '%블랙엔젤 퀼팅 하트 파우치 동전지갑 실버%'
        OR p.name LIKE '%블랙엔젤 퀼팅 패스 케이스 카드지갑 실버%'
        OR p.name LIKE '%MC컬렉션 마스코트 스탠다드 인형 키링%'
        OR p.name LIKE '%MC컬렉션 마스코트 타이니참 인형 키링%'
        OR p.name LIKE '%시나모롤 과자 패키지 미니 파우치 카드지갑%'
        OR p.name LIKE '%딸기 디저트 파티 마스코트 가챠 캡슐토이%'
        OR p.name LIKE '%고고걸 갸류 마스코트 브라운 호피 꼬리 달린 인형 키링%'
        OR p.name LIKE '%90s 고고걸 갸류 글리터 반짝이 파우치%'
        OR p.name LIKE '%라떼아트 케이스 레트로카페 8종 굿즈%'
        OR p.name LIKE '%그리운 폴더폰 아크릴 키링 피처폰 핸드폰 모양 키홀더%'
        OR p.name LIKE '%50주년 팬시 미니 지퍼백%'
        OR p.name LIKE '%캐릭터 스탬프 세트 다꾸 도장 세트%'
        OR p.name LIKE '%캐릭터 얼굴 마스코트 키링 키홀더 시나모롤 한교동 구데타마 턱시도샘%'
        OR p.name LIKE '%헬로키티 포차코 한교동 캐로피 스퀘어 떡메모지%'
        OR p.name LIKE '%MC컬렉션 마스코트 타탄 체크 인형 키링%'
        OR p.name LIKE '%캐릭터즈 친구들 플로키 턱시도샘%'
    )
ORDER BY p.name, pv.variant_value;

-- 상세 비교를 위한 쿼리 (옵션명 패턴 분석)
SELECT 
    p.name as product_name,
    pv.variant_value as db_option_name,
    COUNT(*) as variant_count,
    STRING_AGG(DISTINCT pv.variant_value, ', ' ORDER BY pv.variant_value) as all_variants
FROM products p
INNER JOIN product_variants pv ON p.id = pv.product_id
WHERE p.deleted_at IS NULL
    AND pv.deleted_at IS NULL
    AND p.status = 'active'
    AND (
        p.name LIKE '%블랙엔젤%'
        OR p.name LIKE '%MC컬렉션%'
        OR p.name LIKE '%고고걸 갸류%'
        OR p.name LIKE '%라떼아트%'
        OR p.name LIKE '%스탬프 세트%'
        OR p.name LIKE '%캐릭터 얼굴 마스코트%'
    )
GROUP BY p.name, pv.variant_value
ORDER BY p.name, pv.variant_value;
