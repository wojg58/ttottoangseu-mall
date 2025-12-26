/**
 * @file components/marketing-scripts.tsx
 * @description 마케팅 스크립트 최적화 컴포넌트
 *
 * 주요 기능:
 * 1. Google Analytics (gtag.js) - lazyOnload 전략으로 로드, 쿠키 최적화
 * 2. ChannelTalk - lazyOnload 전략으로 로드
 *
 * 성능 최적화:
 * - lazyOnload: 페이지가 완전히 로드되고 사용자가 쉴 때 로드
 * - 메인 스레드를 막지 않도록 비동기 로드
 * - 환경 변수로 활성화/비활성화 제어
 *
 * 쿠키 최적화:
 * - Google Analytics: 쿠키 사용 최소화 설정
 * - SameSite 속성으로 서드 파티 쿠키 문제 완화
 * - 사용자 프라이버시 보호
 *
 * @dependencies
 * - next/script: Next.js Script 컴포넌트
 */

import Script from "next/script";

export default function MarketingScripts() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const channelTalkPluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;

  return (
    <>
      {/* Google Analytics - 쿠키 최적화 설정 */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              // 쿠키 사용 최소화 및 프라이버시 보호 설정
              gtag('config', '${gaId}', {
                'anonymize_ip': true,
                'cookie_flags': 'SameSite=Lax;Secure', // SameSite=Lax로 변경 (서드 파티 쿠키 문제 완화)
                'cookie_expires': 63072000, // 2년
                'cookie_update': true,
                'cookie_domain': 'auto',
                'allow_google_signals': false, // 광고 개인화 비활성화
                'allow_ad_personalization_signals': false,
                // 'storage': 'none' // 주석 처리 (GA4는 storage 옵션을 지원하지 않음)
              });
            `}
          </Script>
        </>
      )}

      {/* ChannelTalk */}
      {channelTalkPluginKey && (
        <>
          <Script
            src="https://cdn.channel.io/plugin/ch-plugin-web.js"
            strategy="lazyOnload"
          />
          <Script id="channel-talk-init" strategy="lazyOnload">
            {`
              (function(){var w=window;if(w.ChannelIO){return w.ChannelIO('boot',{pluginKey:'${channelTalkPluginKey}'});}var ch=function(c){ch.c?ch.c.push(c):ch.c=[c];};ch.q=[];ch.c=[];w.ChannelIO=ch;if(document.readyState==='complete'){w.ChannelIO('boot',{pluginKey:'${channelTalkPluginKey}'});}else if(window.attachEvent){window.attachEvent('onload',function(){w.ChannelIO('boot',{pluginKey:'${channelTalkPluginKey}'});});}else{window.addEventListener('load',function(){w.ChannelIO('boot',{pluginKey:'${channelTalkPluginKey}'});},false);}})();
            `}
          </Script>
        </>
      )}
    </>
  );
}

