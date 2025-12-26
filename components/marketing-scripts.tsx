/**
 * @file components/marketing-scripts.tsx
 * @description 마케팅 스크립트 최적화 컴포넌트
 *
 * 주요 기능:
 * 1. Google Analytics (gtag.js) - lazyOnload 전략으로 로드
 * 2. ChannelTalk - lazyOnload 전략으로 로드
 *
 * 성능 최적화:
 * - lazyOnload: 페이지가 완전히 로드되고 사용자가 쉴 때 로드
 * - 메인 스레드를 막지 않도록 비동기 로드
 * - 환경 변수로 활성화/비활성화 제어
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
      {/* Google Analytics */}
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
              gtag('config', '${gaId}');
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

