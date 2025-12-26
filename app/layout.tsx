import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import { Gowun_Dodum, Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";

import ShopHeader from "@/components/shop-header";
import ShopFooter from "@/components/shop-footer";
import { SyncUserProvider } from "@/components/providers/sync-user-provider";
import ChatWidgetWrapper from "@/components/chatbot/chat-widget-wrapper";
import "./globals.css";

// Google Fonts 최적화 - 한글 서브셋 포함
const gowunDodum = Gowun_Dodum({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-gowun-dodum",
  preload: true,
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  preload: true,
});

// Nanum Gothic 대신 Noto Sans KR 사용 (더 나은 최적화 지원)
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-kr",
  preload: true,
});

export const metadata: Metadata = {
  title: "또또앙스 | 캐릭터 굿즈 전문 쇼핑몰",
  description:
    "산리오, 디즈니 등 다양한 캐릭터 굿즈를 만나보세요. 귀여운 키링, 파우치, 핸드폰 스트랩 등 두근거리는 설렘을 선사합니다.",
  keywords: [
    "캐릭터 굿즈",
    "산리오",
    "헬로키티",
    "키링",
    "굿즈 쇼핑몰",
    "또또앙스",
  ],
  openGraph: {
    title: "또또앙스 | 캐릭터 굿즈 전문 쇼핑몰",
    description:
      "산리오, 디즈니 등 다양한 캐릭터 굿즈를 만나보세요. 두근거리는 설렘 (*´v`*) Love",
    type: "website",
    locale: "ko_KR",
  },
};

// Clerk localization 커스터마이징 - "사용자 이름"을 "아이디"로 변경
const customKoKR: any = {
  ...koKR,
  formFieldLabel__username: "아이디",
  formFieldLabel__identifier: "아이디",
  // 중첩 구조도 시도
  formFields: {
    ...(koKR as any).formFields,
    username: {
      ...((koKR as any).formFields as any)?.username,
      label: "아이디",
    },
    identifier: {
      ...((koKR as any).formFields as any)?.identifier,
      label: "아이디",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={customKoKR}>
      <html
        lang="ko"
        className={`${gowunDodum.variable} ${plusJakartaSans.variable} ${notoSansKR.variable}`}
      >
        <body
          className="antialiased min-h-screen flex flex-col"
          suppressHydrationWarning
        >
          <SyncUserProvider>
            <ShopHeader />
            <div className="flex-1">{children}</div>
            <ShopFooter />
            <ChatWidgetWrapper />
          </SyncUserProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
