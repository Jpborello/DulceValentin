import { HelpCircle } from 'lucide-react';
import { COMPANY_INFO } from '@/lib/companyInfo';

// Mismas respuestas oficiales que ya usa el bot de WhatsApp/chat web
// (ver src/lib/whatsappBot.js) -- asi no hay dos fuentes de verdad distintas
// sobre minimo de compra, envios, medios de pago, etc.
const FAQ_ITEMS = [
  {
    question: '¿Cuál es el mínimo de compra mayorista?',
    answer:
      'En pedidos hechos por la web, el mínimo es de $50.000 en total — podés combinarlo entre todos los productos que quieras. Comprando en persona en el local no hay mínimo. Además, para acceder al precio mayorista, al menos un artículo del pedido tiene que llevar 3 unidades o más (salvo medias y productos en pack, que están exceptuados).'
  },
  {
    question: '¿Hacen envíos a todo el país?',
    answer:
      'Sí, enviamos a todo el país por transporte. El costo del envío no está incluido en el precio y corre por cuenta del comprador; también podés retirar sin cargo en nuestro local en Rosario.'
  },
  {
    question: '¿Dónde está ubicado el local y qué horario tienen?',
    answer: `Estamos en ${COMPANY_INFO.address}, ${COMPANY_INFO.locality}, ${COMPANY_INFO.province}. Atendemos de lunes a sábado de 8:00 a 17:00 hs.`
  },
  {
    question: '¿Qué medios de pago aceptan?',
    answer: 'Transferencia bancaria, Mercado Pago, o efectivo si comprás en el local.'
  },
  {
    question: '¿Puedo comprar por unidad o tengo que llevar talle completo?',
    answer: 'Como quieras: por unidad, por talle completo, o armando tu propio surtido de productos y variedades.'
  },
  {
    question: '¿Cómo hago un pedido?',
    answer: 'Podés armarlo directo en nuestro catálogo web, o escribirnos por WhatsApp y te ayudamos a armarlo.'
  },
  {
    question: '¿Participo de algún sorteo si compro por mayor?',
    answer:
      'Sí — registrándote con tu WhatsApp en el Club Mayorista, participás del sorteo en cada compra de $50.000 o más.'
  }
];

// Schema FAQPage: tiene que reflejar EXACTAMENTE el texto visible de abajo
// (Google penaliza si no coincide), por eso se arma desde el mismo array en
// vez de escribirlo aparte a mano. Es lo que mas ayuda a que ChatGPT/
// Perplexity/Google AI Overviews puedan citar estas respuestas tal cual.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer
    }
  }))
};

export default function FaqSection() {
  return (
    <section className="faq-section" id="preguntas-frecuentes" aria-labelledby="faq-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="faq-header">
        <HelpCircle size={22} className="faq-header-icon" />
        <h2 id="faq-title" className="faq-title">
          Preguntas Frecuentes
        </h2>
      </div>

      {/* <details>/<summary> nativos: el texto queda en el HTML aunque este
          colapsado (bueno para SEO/GEO) y no necesita JS para funcionar. */}
      <div className="faq-list">
        {FAQ_ITEMS.map((item, idx) => (
          <details key={idx} className="faq-item">
            <summary className="faq-question">{item.question}</summary>
            <p className="faq-answer">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
