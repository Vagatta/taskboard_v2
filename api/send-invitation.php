<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
    require_once $configPath;
}

$mailConfigPath = __DIR__ . '/mail_config.php';
if (file_exists($mailConfigPath)) {
    require_once $mailConfigPath;
}

$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    $envLines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($envLines as $envLine) {
        $trimmedLine = trim($envLine);
        if ($trimmedLine === '' || str_starts_with($trimmedLine, '#') || !str_contains($trimmedLine, '=')) {
            continue;
        }

        [$envKey, $envValue] = explode('=', $trimmedLine, 2);
        $envKey = trim($envKey);
        $envValue = trim($envValue);

        if ($envKey === '') {
            continue;
        }

        if ((str_starts_with($envValue, '"') && str_ends_with($envValue, '"')) || (str_starts_with($envValue, "'") && str_ends_with($envValue, "'"))) {
            $envValue = substr($envValue, 1, -1);
        }

        putenv($envKey . '=' . $envValue);
        $_ENV[$envKey] = $envValue;
        $_SERVER[$envKey] = $envValue;
    }
}

function envValue(array $names, $default = '')
{
    foreach ($names as $name) {
        $value = getenv($name);
        if ($value !== false && $value !== '') {
            return $value;
        }

        if (isset($_ENV[$name]) && $_ENV[$name] !== '') {
            return $_ENV[$name];
        }

        if (isset($_SERVER[$name]) && $_SERVER[$name] !== '') {
            return $_SERVER[$name];
        }
    }

    return $default;
}

function configValue($constantName, array $envNames, $default = '')
{
    if (defined($constantName)) {
        return constant($constantName);
    }

    return envValue($envNames, $default);
}

function smtpRead($socket)
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtpExpect($socket, array $allowedCodes)
{
    $response = smtpRead($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $allowedCodes, true)) {
        throw new Exception(trim($response));
    }
    return $response;
}

function smtpCommand($socket, $command, array $allowedCodes)
{
    fwrite($socket, $command . "\r\n");
    return smtpExpect($socket, $allowedCodes);
}

function encodeMimeHeaderValue($value)
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value, 'UTF-8');
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function sendSmtpMail($host, $port, $username, $password, $fromEmail, $fromName, $toEmail, $subject, $htmlBody, $textBody)
{
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false
        ]
    ]);

    $socket = stream_socket_client(
        'tcp://' . $host . ':' . $port,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        throw new Exception('No se pudo conectar al servidor SMTP: ' . $errstr . ' (' . $errno . ')');
    }

    stream_set_timeout($socket, 20);

    try {
        smtpExpect($socket, [220]);
        smtpCommand($socket, 'EHLO taskboard.local', [250]);
        smtpCommand($socket, 'STARTTLS', [220]);

        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception('No se pudo iniciar TLS con el servidor SMTP.');
        }

        smtpCommand($socket, 'EHLO taskboard.local', [250]);
        smtpCommand($socket, 'AUTH LOGIN', [334]);
        smtpCommand($socket, base64_encode($username), [334]);
        smtpCommand($socket, base64_encode($password), [235]);
        smtpCommand($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $boundary = 'taskboard_' . md5((string) microtime(true));
        $headers = [
            'From: ' . encodeMimeHeaderValue($fromName) . ' <' . $fromEmail . '>',
            'To: <' . $toEmail . '>',
            'Reply-To: ' . $fromEmail,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"'
        ];

        $message = 'Subject: ' . encodeMimeHeaderValue($subject) . "\r\n";
        $message .= implode("\r\n", $headers) . "\r\n\r\n";
        $message .= '--' . $boundary . "\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $message .= $textBody . "\r\n\r\n";
        $message .= '--' . $boundary . "\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $message .= $htmlBody . "\r\n\r\n";
        $message .= '--' . $boundary . '--' . "\r\n.";

        fwrite($socket, $message . "\r\n");
        smtpExpect($socket, [250]);
        smtpCommand($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Body JSON inválido']);
    exit;
}

$toEmail = trim($input['toEmail'] ?? '');
$inviterEmail = trim($input['inviterEmail'] ?? '');
$inviterName = trim($input['inviterName'] ?? 'Taskboard');
$token = trim($input['token'] ?? '');
$role = trim($input['role'] ?? 'viewer');
$type = trim($input['type'] ?? 'workspace');
$workspaceName = trim($input['workspaceName'] ?? 'Taskboard');
$projectName = trim($input['projectName'] ?? '');

if ($toEmail === '' || $token === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'toEmail y token son obligatorios']);
    exit;
}

$smtpHost = configValue('TASKBOARD_SMTP_HOST', ['TASKBOARD_SMTP_HOST', 'REACT_APP_SMTP_HOST'], 'smtp.gmail.com');
$smtpPort = (int) configValue('TASKBOARD_SMTP_PORT', ['TASKBOARD_SMTP_PORT', 'REACT_APP_SMTP_PORT'], '587');
$smtpUser = configValue('TASKBOARD_SMTP_USER', ['TASKBOARD_SMTP_USER', 'REACT_APP_SMTP_USER'], '');
$smtpPass = configValue('TASKBOARD_SMTP_PASS', ['TASKBOARD_SMTP_PASS', 'REACT_APP_SMTP_PASS'], '');
$fromEmail = configValue('TASKBOARD_SMTP_FROM_EMAIL', ['TASKBOARD_SMTP_FROM_EMAIL', 'REACT_APP_SMTP_FROM_EMAIL'], $smtpUser);
$fromName = configValue('TASKBOARD_SMTP_FROM_NAME', ['TASKBOARD_SMTP_FROM_NAME', 'REACT_APP_SMTP_FROM_NAME'], 'Taskboard');
$baseUrl = rtrim(configValue('TASKBOARD_BASE_URL', ['TASKBOARD_BASE_URL', 'REACT_APP_BASE_URL'], 'http://localhost/taskboard_v2'), '/');

if ($smtpUser === '' || $smtpPass === '' || $fromEmail === '') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Configuración SMTP incompleta. Revisa .env o api/mail_config.php']);
    exit;
}

$inviteUrl = $baseUrl . '/?token=' . urlencode($token);
$roleLabel = $role === 'owner' ? 'Owner' : ($role === 'editor' ? 'Editor' : 'Viewer');
$subject = $type === 'project'
    ? 'Invitación al tablero: ' . ($projectName !== '' ? $projectName : 'Taskboard')
    : 'Invitación al workspace: ' . $workspaceName;

$intro = $type === 'project'
    ? 'te ha invitado a colaborar en el tablero <strong>' . htmlspecialchars($projectName !== '' ? $projectName : 'Taskboard', ENT_QUOTES, 'UTF-8') . '</strong>.'
    : 'te ha invitado a unirte al workspace <strong>' . htmlspecialchars($workspaceName, ENT_QUOTES, 'UTF-8') . '</strong>.';

$htmlBody = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:Arial,sans-serif;background:#f8fafc;color:#334155;padding:24px;">'
    . '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">'
    . '<div style="background:linear-gradient(135deg,#06b6d4,#2563eb);padding:24px;color:#fff;"><h1 style="margin:0;font-size:24px;">Invitación a Taskboard</h1></div>'
    . '<div style="padding:24px;">'
    . '<p>Hola,</p>'
    . '<p><strong>' . htmlspecialchars($inviterName, ENT_QUOTES, 'UTF-8') . '</strong>' . ($inviterEmail !== '' ? ' (' . htmlspecialchars($inviterEmail, ENT_QUOTES, 'UTF-8') . ')' : '') . ' ' . $intro . '</p>'
    . '<p><strong>Rol asignado:</strong> ' . htmlspecialchars($roleLabel, ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p style="margin:24px 0;"><a href="' . htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Aceptar invitación</a></p>'
    . '<p>Si el botón no funciona, copia este enlace:</p>'
    . '<p><a href="' . htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8') . '</a></p>'
    . '</div></div></body></html>';

$textBody = "Hola,\n\n"
    . $inviterName . ($inviterEmail !== '' ? ' (' . $inviterEmail . ')' : '') . ' te ha invitado a '
    . ($type === 'project' ? 'colaborar en el tablero ' . ($projectName !== '' ? $projectName : 'Taskboard') : 'unirte al workspace ' . $workspaceName)
    . ".\n"
    . 'Rol asignado: ' . $roleLabel . "\n\n"
    . 'Acepta la invitación en: ' . $inviteUrl . "\n";

try {
    sendSmtpMail($smtpHost, $smtpPort, $smtpUser, $smtpPass, $fromEmail, $fromName, $toEmail, $subject, $htmlBody, $textBody);
    echo json_encode(['success' => true, 'message' => 'Correo enviado correctamente']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
