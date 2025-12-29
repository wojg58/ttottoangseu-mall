/**
 * @file lib/chat-widget-utils.ts
 * @description 상담 챗봇을 여는 통합 함수
 * 
 * 여러 방식의 챗봇 위젯을 지원:
 * 1. ChannelIO (채널톡) - window API
 * 2. ChatWidget (React 상태) - window.__openChatWidget
 * 3. DOM 런처 버튼 클릭
 */

let openMethod: "window-api" | "react-state" | "dom-click" | null = null;

export function openChatWidget(): boolean {
  // 이미 어떤 방식으로 열렸는지 확인했으면 그 방식 사용
  if (openMethod) {
    return executeOpen(openMethod);
  }

  // 1. ChannelIO (채널톡) window API
  if ((window as any).ChannelIO) {
    openMethod = "window-api";
    console.log("[ChatWidget] 열기 방식: ChannelIO window API");
    (window as any).ChannelIO("show");
    (window as any).ChannelIO("openChat");
    return true;
  }

  // 2. Crisp window API
  if ((window as any).$crisp) {
    openMethod = "window-api";
    console.log("[ChatWidget] 열기 방식: Crisp window API");
    (window as any).$crisp.push(["do", "chat:open"]);
    return true;
  }

  // 3. Tawk.to window API
  if ((window as any).Tawk_API) {
    openMethod = "window-api";
    console.log("[ChatWidget] 열기 방식: Tawk_API window API");
    (window as any).Tawk_API.maximize();
    return true;
  }

  // 4. Intercom window API
  if ((window as any).Intercom) {
    openMethod = "window-api";
    console.log("[ChatWidget] 열기 방식: Intercom window API");
    (window as any).Intercom("show");
    return true;
  }

  // 5. ChatWidget React 상태 (window.__openChatWidget)
  if ((window as any).__openChatWidget) {
    openMethod = "react-state";
    console.log("[ChatWidget] 열기 방식: ChatWidget React 상태");
    (window as any).__openChatWidget();
    return true;
  }

  // 6. DOM 런처 버튼 클릭 (fallback)
  const launcherSelectors = [
    "#chatbot-launcher",
    ".chatbot-launcher",
    ".chat-widget-launcher",
    "[data-chatbot-launcher]",
    "#channelio-launcher",
    ".channelio-launcher",
    "[data-channelio-id]",
    'button[aria-label*="상담"]',
    'button[aria-label*="챗봇"]',
    'button[aria-label*="채팅"]',
  ];

  for (const selector of launcherSelectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el && el.offsetParent !== null) {
      // 요소가 보이는 경우에만 클릭
      openMethod = "dom-click";
      console.log("[ChatWidget] 열기 방식: DOM 런처 버튼 클릭", selector);
      el.click();
      return true;
    }
  }

  // 7. iframe 컨테이너 클릭 (최후의 수단)
  const iframes = document.querySelectorAll("iframe[src*='channel.io'], iframe[src*='crisp'], iframe[src*='tawk'], iframe[src*='intercom']");
  for (const iframe of iframes) {
    const container = iframe.parentElement;
    if (container) {
      openMethod = "dom-click";
      console.log("[ChatWidget] 열기 방식: iframe 컨테이너 클릭");
      container.click();
      return true;
    }
  }

  console.warn("[ChatWidget] ❌ 상담 위젯을 찾을 수 없습니다.");
  return false;
}

function executeOpen(method: "window-api" | "react-state" | "dom-click"): boolean {
  switch (method) {
    case "window-api":
      if ((window as any).ChannelIO) {
        (window as any).ChannelIO("show");
        (window as any).ChannelIO("openChat");
        return true;
      }
      if ((window as any).$crisp) {
        (window as any).$crisp.push(["do", "chat:open"]);
        return true;
      }
      if ((window as any).Tawk_API) {
        (window as any).Tawk_API.maximize();
        return true;
      }
      if ((window as any).Intercom) {
        (window as any).Intercom("show");
        return true;
      }
      break;
    case "react-state":
      if ((window as any).__openChatWidget) {
        (window as any).__openChatWidget();
        return true;
      }
      break;
    case "dom-click":
      // DOM 클릭은 매번 다시 찾아야 할 수 있음
      return openChatWidget();
  }
  return false;
}

