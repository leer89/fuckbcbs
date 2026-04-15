'use client';

import { useEffect, useRef } from 'react';

// Unique ID counter so multiple widgets on the same page don't clash
let _widgetCount = 0;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    turnstile?: any;
  }
}

export default function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const instanceId = useRef(`_ts_${_widgetCount++}`);

  useEffect(() => {
    const cbKey = instanceId.current;
    const expKey = `${instanceId.current}_exp`;

    // Register global callbacks Turnstile calls by name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[cbKey] = onVerify;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[expKey] = onExpire ?? (() => {});

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const render = () => {
      if (!containerRef.current || !window.turnstile || !sitekey) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey,
        callback: cbKey,
        'expired-callback': expKey,
        theme: 'light',
        size: 'normal',
      });
    };

    if (window.turnstile) {
      render();
    } else {
      // Poll until the Turnstile script has loaded
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[cbKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[expKey];
    };
  }, [onVerify, onExpire]);

  return <div ref={containerRef} />;
}
