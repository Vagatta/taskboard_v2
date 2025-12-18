# Configuración SMTP para Edge Function

## Variables necesarias en Supabase

Ve a Supabase Dashboard > Settings > Edge Functions > **Secrets** y configura:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP de Gmail |
| `SMTP_PORT` | `587` | Puerto SMTP (TLS) |
| `SMTP_USER` | Tu email de Gmail | Ej: `tu-email@gmail.com` |
| `SMTP_PASS` | Contraseña de aplicación | **NO** tu contraseña normal |
| `APP_URL` | `https://cloud.kuchen.es/Taskboard` | URL de tu app |

## Obtener contraseña de aplicación de Gmail

1. Ve a https://myaccount.google.com/security
2. Activa **"Verificación en 2 pasos"** (si no está activada)
3. Ve a **"Contraseñas de aplicaciones"**
4. Selecciona **"Correo"** y **"Otro (nombre personalizado)"**
5. Escribe: `Taskboard`
6. Copia la contraseña generada (16 caracteres)
7. Úsala como `SMTP_PASS` en Supabase

## Redesplegar Edge Function

1. Copia TODO el contenido de `supabase/functions/send-invitation-email/index.ts`
2. Ve a Supabase Dashboard > Edge Functions > send-invitation-email
3. Pega el código
4. Deploy

## Probar

1. Recarga tu app
2. Crea una invitación
3. **El email debería llegar directamente desde tu Gmail** ✅

## Ventajas de SMTP directo

- ✅ No necesitas Resend
- ✅ No hay límites de emails verificados
- ✅ Usa tu propio Gmail
- ✅ Más control sobre los emails
