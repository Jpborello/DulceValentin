import { NextResponse } from 'next/server';

export async function GET() {
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Sin token configurado: no hay integracion activa, no se muestran datos
  // de prueba (para no confundirlos con transferencias reales).
  if (!mpAccessToken) {
    return NextResponse.json({
      success: true,
      configured: false,
      message: 'Mercado Pago no está conectado todavía.',
      transfers: []
    });
  }

  try {
    // Fetch recent incoming payments/transfers from Mercado Pago API
    const response = await fetch(
      'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=20',
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json'
        },
        next: { revalidate: 10 }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: 'Error al consultar API Mercado Pago', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    const formattedTransfers = (data.results || []).map((item) => ({
      id: item.id?.toString(),
      payer_name: `${item.payer?.first_name || ''} ${item.payer?.last_name || ''}`.trim() || item.payer?.email || 'Pagador MP',
      payer_dni: item.payer?.identification?.number || 'Sin DNI registrado',
      amount: item.transaction_amount || 0,
      status: item.status,
      date: item.date_approved || item.date_created,
      payment_method: item.payment_method_id || 'Transferencia'
    }));

    return NextResponse.json({
      success: true,
      configured: true,
      transfers: formattedTransfers
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Excepción al conectar con Mercado Pago', message: error.message },
      { status: 500 }
    );
  }
}
