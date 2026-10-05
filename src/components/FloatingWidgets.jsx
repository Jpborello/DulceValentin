'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const WhatsAppButton = dynamic(() => import('@/components/WhatsAppButton'), { ssr: false });
const WebChatWidget = dynamic(() => import('@/components/WebChatWidget'), { ssr: false });

export default function FloatingWidgets() {
  const pathname = usePathname();

  // No mostrar los widgets flotantes dentro del panel de administración
  if (pathname && pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <WhatsAppButton />
      <WebChatWidget />
    </>
  );
}
