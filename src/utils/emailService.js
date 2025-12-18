import nodemailer from 'nodemailer';

/**
 * Servicio de envío de emails usando Gmail SMTP
 * 
 * CONFIGURACIÓN REQUERIDA:
 * 1. Crear variables de entorno en .env:
 *    REACT_APP_SMTP_HOST=smtp.gmail.com
 *    REACT_APP_SMTP_PORT=587
 *    REACT_APP_SMTP_USER=tu-email@gmail.com
 *    REACT_APP_SMTP_PASS=tu-contraseña-de-aplicación
 *    REACT_APP_BASE_URL=http://localhost:3000
 * 
 * 2. Generar contraseña de aplicación en Gmail:
 *    - Ir a https://myaccount.google.com/security
 *    - Activar verificación en 2 pasos
 *    - Generar contraseña de aplicación
 */

// Configuración del transportador de email
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.REACT_APP_SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.REACT_APP_SMTP_PORT || '587'),
        secure: false, // true para 465, false para otros puertos
        auth: {
            user: process.env.REACT_APP_SMTP_USER,
            pass: process.env.REACT_APP_SMTP_PASS,
        },
    });
};

/**
 * Envía un email de invitación a un workspace
 * @param {Object} params - Parámetros de la invitación
 * @param {string} params.toEmail - Email del destinatario
 * @param {string} params.workspaceName - Nombre del workspace
 * @param {string} params.inviterName - Nombre de quien invita
 * @param {string} params.inviterEmail - Email de quien invita
 * @param {string} params.token - Token único de invitación
 * @param {string} params.role - Rol asignado
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
export const sendInvitationEmail = async ({
    toEmail,
    workspaceName,
    inviterName,
    inviterEmail,
    token,
    role
}) => {
    try {
        const transporter = createTransporter();

        const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:3000';
        const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;

        // Traducir rol al español
        const roleTranslations = {
            owner: 'Propietario',
            editor: 'Editor',
            viewer: 'Lector'
        };
        const roleSpanish = roleTranslations[role] || role;

        const mailOptions = {
            from: `"Taskboard" <${process.env.REACT_APP_SMTP_USER}>`,
            to: toEmail,
            replyTo: inviterEmail,
            subject: `Invitación a workspace: ${workspaceName}`,
            html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #334155;
              background-color: #f8fafc;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
              color: #ffffff;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              padding: 40px 30px;
            }
            .content p {
              margin: 0 0 16px 0;
              font-size: 16px;
            }
            .workspace-info {
              background-color: #f1f5f9;
              border-left: 4px solid #06b6d4;
              padding: 16px;
              margin: 24px 0;
              border-radius: 4px;
            }
            .workspace-info strong {
              color: #0891b2;
            }
            .cta-button {
              display: inline-block;
              background-color: #06b6d4;
              color: #ffffff;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              margin: 24px 0;
              transition: background-color 0.3s;
            }
            .cta-button:hover {
              background-color: #0891b2;
            }
            .footer {
              background-color: #f8fafc;
              padding: 24px 30px;
              text-align: center;
              font-size: 14px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 8px 0;
            }
            .link {
              color: #0891b2;
              text-decoration: none;
            }
            .expiry-notice {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 16px 0;
              border-radius: 4px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ¡Has sido invitado!</h1>
            </div>
            
            <div class="content">
              <p>Hola,</p>
              
              <p><strong>${inviterName}</strong> (${inviterEmail}) te ha invitado a unirte a su workspace en <strong>Taskboard</strong>.</p>
              
              <div class="workspace-info">
                <p style="margin: 0;"><strong>Workspace:</strong> ${workspaceName}</p>
                <p style="margin: 8px 0 0 0;"><strong>Rol asignado:</strong> ${roleSpanish}</p>
              </div>
              
              <p>Taskboard es una herramienta de gestión de tareas colaborativa que te permitirá organizar proyectos, asignar tareas y trabajar en equipo de manera eficiente.</p>
              
              <div style="text-align: center;">
                <a href="${inviteUrl}" class="cta-button">Aceptar Invitación</a>
              </div>
              
              <div class="expiry-notice">
                ⏰ <strong>Importante:</strong> Esta invitación expira en 7 días.
              </div>
              
              <p style="font-size: 14px; color: #64748b;">Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
              <p style="font-size: 14px; word-break: break-all;"><a href="${inviteUrl}" class="link">${inviteUrl}</a></p>
            </div>
            
            <div class="footer">
              <p>Este email fue enviado desde Taskboard</p>
              <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `
¡Has sido invitado a ${workspaceName}!

${inviterName} (${inviterEmail}) te ha invitado a unirte a su workspace en Taskboard como ${roleSpanish}.

Para aceptar la invitación, visita el siguiente enlace:
${inviteUrl}

Esta invitación expira en 7 días.

Si no esperabas esta invitación, puedes ignorar este mensaje.
      `.trim()
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error enviando email de invitación:', error);
        throw new Error(`Error al enviar email: ${error.message}`);
    }
};

/**
 * Verifica la configuración SMTP
 * @returns {Promise<boolean>} - true si la configuración es válida
 */
export const verifyEmailConfig = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return true;
    } catch (error) {
        console.error('Error en configuración SMTP:', error);
        return false;
    }
};
