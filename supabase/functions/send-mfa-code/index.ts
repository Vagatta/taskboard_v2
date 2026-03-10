const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('[send-mfa-code] Request received');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, code, name } = await req.json();
    console.log('[send-mfa-code] Payload received for:', email);

    if (!email || !code) {
      throw new Error('Se requiere email y code')
    }

    if (!RESEND_API_KEY) {
      throw new Error('Configuración incompleta: RESEND_API_KEY no encontrada en Supabase Secrets.')
    }

    console.log('[send-mfa-code] Attempting to send email via Resend API...');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Taskboard <onboarding@resend.dev>',
        to: [email],
        subject: 'Código de acceso Taskboard: ' + code,
        html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
    <div style="background: #0ea5e9; padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Verificación de Seguridad</h1>
    </div>
    <div style="padding: 40px 30px; text-align: center;">
      <p>Hola <strong>${name || 'Usuario'}</strong>,</p>
      <p>Utiliza el siguiente código para completar la verificación:</p>
      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.2em; color: #0f172a;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">Este código expirará en 10 minutos.</p>
    </div>
  </div>
</body>
</html>
`,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[send-mfa-code] Resend API Error:', data);
      const errorMsg = data.message || JSON.stringify(data);
      throw new Error('Resend Error: ' + errorMsg);
    }

    console.log('[send-mfa-code] Email sent successfully via Resend:', data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('[send-mfa-code] Final Error Catch:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error desconocido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
})
