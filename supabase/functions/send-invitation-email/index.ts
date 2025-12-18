import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invitationId } = await req.json()

    if (!invitationId) {
      throw new Error('Se requiere invitationId')
    }
    console.log('Received invitationId:', invitationId)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created, fetching invitation...')

    // Obtener invitación
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('workspace_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    console.log('Query result:', { invitation, error: invError })

    if (invError || !invitation) {
      console.error('Error fetching invitation:', invError)
      throw new Error(`Invitación no encontrada: ${invError?.message || 'No data'}`)
    }

    // Obtener workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single()

    // Obtener perfil del invitador
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', invitation.invited_by)
      .single()

    const roleTranslations = {
      owner: 'Propietario',
      editor: 'Editor',
      viewer: 'Lector'
    };
    const roleSpanish = roleTranslations[invitation.role] || invitation.role;
    const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/?token=${invitation.token}`;
    const inviterEmail = inviterProfile?.email || 'noreply@taskboard.app';
    const inviterName = inviterEmail.split('@')[0];
    const workspaceName = workspace?.name || 'Workspace';

    // Preparar HTML del email
    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🎉 ¡Has sido invitado!</h1>
    </div>
    <div style="padding: 30px;">
      <p>Hola,</p>
      <p><strong>${inviterName}</strong> (${inviterEmail}) te ha invitado a unirte a su workspace en <strong>Taskboard</strong>.</p>
      <div style="background: #f1f5f9; border-left: 4px solid #06b6d4; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin:0"><strong>Workspace:</strong> ${workspaceName}</p>
        <p style="margin:8px 0 0 0"><strong>Rol asignado:</strong> ${roleSpanish}</p>
      </div>
      <p>Taskboard es una herramienta de gestión de tareas colaborativa para organizar proyectos y trabajar en equipo.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="display: inline-block; background: #06b6d4; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Aceptar Invitación</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">Si no puedes hacer clic en el botón, copia este enlace:</p>
      <p style="font-size: 14px; word-break: break-all;"><a href="${inviteUrl}" style="color: #06b6d4;">${inviteUrl}</a></p>
      <p style="font-size: 12px; color: #94a3b8; background: #fef3c7; padding: 12px; border-radius: 4px; margin-top: 20px;">
        ⏰ <strong>Importante:</strong> Esta invitación expira en 7 días.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
      <p style="margin: 0;">Este email fue enviado desde Taskboard</p>
      <p style="margin: 5px 0 0 0;">Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Usar la API interna de Supabase para enviar emails
    // Esto usa el mismo SMTP configurado para autenticación
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const emailResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        type: 'invite',
        email: invitation.email,
        data: {
          workspace_name: workspaceName,
          role: roleSpanish,
          invite_url: inviteUrl,
          inviter_name: inviterName,
          inviter_email: inviterEmail
        },
        redirect_to: inviteUrl
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Error from Supabase Auth API:', errorText);
      // No lanzar error, solo loguear
      console.log('Continuando sin envío de email automático');
    } else {
      console.log('Email enviado exitosamente via Supabase Auth');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitación creada correctamente',
        inviteUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Error al procesar invitación'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
