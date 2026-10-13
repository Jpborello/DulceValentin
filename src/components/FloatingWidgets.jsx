'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const WhatsAppButton = dynamic(() => import('@/components/WhatsAppButton'), { ssr: false });
const WebChatWidget = dynamic(() => import('@/components/WebChatWidget'), { ssr: false });

export default function FloatingWidgets() {
  const pathname = usePathname();

  // No mostrar los widgets flotantes (son para clientes) en las pantallas
  // internas: panel de administración, caja y ventas de vendedoras.
  if (pathname && ['/admin', '/caja', '/ventas'].some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
      <WhatsAppButton />
      <WebChatWidget />
    </>
  );
}
