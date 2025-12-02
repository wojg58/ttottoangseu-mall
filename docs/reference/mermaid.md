flowchart TD
    Start([SNS/검색/광고]) --> Landing[홈페이지 방문]
    
    Landing --> Browse{둘러보기}
    Browse --> Category[카테고리별 상품 탐색]
    Browse --> Featured[베스트/신상 상품 확인]
    Browse --> Search[상품 검색]
    
    Category --> ProductList[상품 리스트 페이지]
    Featured --> ProductList
    Search --> ProductList
    
    ProductList --> ProductDetail[상품 상세 페이지]
    
    ProductDetail --> CheckStock{재고 확인}
    CheckStock -->|품절| OutOfStock[품절 알림 표시]
    CheckStock -->|재고 있음| SelectOption[옵션 선택<br/>색상/사이즈 등]
    
    OutOfStock --> ProductList
    
    SelectOption --> AddCart{장바구니 담기}
    
    AddCart -->|비로그인| LoginRequired[로그인 필요 안내]
    LoginRequired --> Login[로그인/회원가입]
    Login --> Clerk[Clerk 인증]
    Clerk --> SocialLogin{소셜 로그인}
    SocialLogin -->|네이버| NaverAuth[네이버 인증]
    SocialLogin -->|구글| GoogleAuth[구글 인증]
    SocialLogin -->|카카오| KakaoAuth[카카오 인증]
    SocialLogin -->|이메일| EmailAuth[이메일/비밀번호]
    
    NaverAuth --> CreateUser[Supabase users 생성<br/>clerk_user_id 연동]
    GoogleAuth --> CreateUser
    KakaoAuth --> CreateUser
    EmailAuth --> CreateUser
    
    CreateUser --> n8nSignup[n8n: 회원가입 알림<br/>→ Slack/카카오톡]
    n8nSignup --> CartAdd[장바구니 담기 완료]
    
    AddCart -->|로그인 상태| CartAdd
    
    CartAdd --> ContinueShopping{계속 쇼핑?}
    ContinueShopping -->|예| ProductList
    ContinueShopping -->|아니오| Cart[장바구니 페이지]
    
    Cart --> CartManage{장바구니 관리}
    CartManage --> UpdateQty[수량 변경]
    CartManage --> RemoveItem[상품 삭제]
    CartManage --> Checkout[주문하기]
    
    UpdateQty --> Cart
    RemoveItem --> Cart
    
    Checkout --> OrderForm[주문서 작성]
    OrderForm --> ShippingInfo[배송 정보 입력]
    ShippingInfo --> ValidateForm{입력값 검증}
    
    ValidateForm -->|필수값 누락| ErrorMsg[유효성 오류 메시지]
    ErrorMsg --> ShippingInfo
    
    ValidateForm -->|정상| CreateOrder[주문 생성<br/>orders 테이블 INSERT]
    
    CreateOrder --> Payment[TossPayments 결제창]
    Payment --> PaymentMethod{결제 수단 선택}
    
    PaymentMethod --> Card[신용카드]
    PaymentMethod --> VirtualAccount[가상계좌]
    PaymentMethod --> Transfer[계좌이체]
    PaymentMethod --> Mobile[휴대폰 결제]
    
    Card --> ProcessPayment[결제 진행]
    VirtualAccount --> ProcessPayment
    Transfer --> ProcessPayment
    Mobile --> ProcessPayment
    
    ProcessPayment --> PaymentResult{결제 결과}
    
    PaymentResult -->|성공| PaymentSuccess[결제 승인]
    PaymentSuccess --> UpdatePayment[payments 테이블<br/>status = done]
    UpdatePayment --> UpdateOrder[orders 테이블<br/>status = confirmed]
    UpdateOrder --> StockDecrease[재고 차감<br/>products.stock -=]
    StockDecrease --> n8nOrder[n8n: 주문 알림<br/>→ Slack/시트 기록]
    n8nOrder --> OrderComplete[주문 완료 페이지]
    
    PaymentResult -->|실패| PaymentFail[결제 실패]
    PaymentFail --> FailReason[실패 사유 표시<br/>failure_message]
    FailReason --> Retry{재시도?}
    Retry -->|예| Payment
    Retry -->|아니오| OrderCancel[주문 취소<br/>orders.status = cancelled]
    
    PaymentResult -->|취소| PaymentCancel[결제 취소]
    PaymentCancel --> OrderCancel
    
    OrderComplete --> MyPage[마이페이지]
    MyPage --> OrderHistory[주문 내역 확인]
    OrderHistory --> OrderDetail[주문 상세 조회]
    OrderDetail --> TrackingInfo[배송 조회<br/>tracking_number]
    
    OrderDetail --> RefundRequest{환불 요청?}
    RefundRequest -->|예| CreateRefund[환불 신청<br/>refunds 테이블 INSERT]
    CreateRefund --> RefundPending[환불 대기<br/>refund_status = pending]
    RefundPending --> AdminApproval[관리자 승인 대기]
    
    OrderComplete --> End([완료])
    OrderCancel --> End
    TrackingInfo --> End

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style LoginRequired fill:#fff3e0
    style PaymentFail fill:#ffcdd2
    style PaymentCancel fill:#ffcdd2
    style OrderComplete fill:#c8e6c9
    style n8nSignup fill:#e1bee7
    style n8nOrder fill:#e1bee7