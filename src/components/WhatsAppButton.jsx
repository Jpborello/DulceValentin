'use client';

function checkBusinessHours() {
  try {
    const now = new Date();
    const argStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
    const argDate = new Date(argStr);
    const day = argDate.getDay();
    if (day === 0) return false; // Domingo cerrado
    const mins = argDate.getHours() * 60 + argDate.getMinutes();
    return mins >= 480 && mins <= 1020; // 8:00 a 17:00 hs
  } catch (e) {
    return true;
  }
}

export default function WhatsAppButton({
  phone = '5493415147414',
  message = '¡Hola! Quiero hacer una consulta sobre productos de Dulce Valentín.'
}) {
  const isBusinessHours = checkBusinessHours();
  const outOfHoursNotice = '\n\n📌 *Horario de Atención:* Lunes a Sábados de 8:00 a 17:00 hs. Te responderemos a primera hora.';
  const finalMessage = isBusinessHours ? message : `${message}${outOfHoursNotice}`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(finalMessage)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-fab"
      aria-label="Consultar por WhatsApp"
      title={isBusinessHours ? "Consultanos por WhatsApp" : "Horario de Atención: L-S 8:00 a 17:00 hs. Dejanos tu mensaje y te respondemos a primera hora."}
    >
      <span className="whatsapp-fab-ring"></span>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.05c-.24.68-1.4 1.31-1.93 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.97 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.61-.07.16-.19.7-.82.89-1.1.19-.28.38-.24.63-.14.26.09 1.66.79 1.94.93.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/>
      </svg>
    </a>
  );
}
