# CAMBIO URGENTE - Línea 553-554

## Archivo: src/components/WorkspaceSelector.jsx

### LÍNEA 553 - CAMBIAR DE:
```javascript
const baseUrl = window.location.origin;
```

### A:
```javascript
const baseUrl = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
```

### LÍNEA 554 - CAMBIAR DE:
```javascript
const inviteUrl = `${baseUrl}/accept-invite?token=${invitation.token}`;
```

### A:
```javascript
const inviteUrl = `${baseUrl}/?token=${invitation.token}`;
```

## Después del cambio:
1. Guarda el archivo (Ctrl+S)
2. La app se recargará automáticamente
3. Crea una nueva invitación
4. Copia el enlace - ahora será correcto: `https://cloud.kuchen.es/Taskboard/?token=xxx`

## Error 400 de Edge Function:
Ve a Supabase Dashboard > Edge Functions > send-invitation-email > Logs
Busca el error específico para ver por qué falla el envío de email.
