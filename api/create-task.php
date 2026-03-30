<?php
/**
 * API Endpoint: Crear tarea en Taskboard desde sistemas externos
 * POST /taskboard_v2/api/create-task.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Carga la configuración del servidor (no se toca nada en ella)
require_once __DIR__ . '/config.php';

// Sistema de log personalizado para depuración (AL PRINCIPIO PARA CAPTURAR TODO)
$log_file = __DIR__ . '/debug.log';
$inputRaw = file_get_contents('php://input');
$headers = getallheaders();
$log_entry = "[" . date('Y-m-d H:i:s') . "] METHOD: " . $_SERVER['REQUEST_METHOD'] . "\n";
$log_entry .= "HEADERS: " . json_encode($headers) . "\n";
$log_entry .= "PAYLOAD: " . $inputRaw . "\n";
file_put_contents($log_file, $log_entry, FILE_APPEND);

// ============================
// Autenticación
// ============================
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (empty(TASKBOARD_API_SECRET) || $apiKey !== TASKBOARD_API_SECRET) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API key inválida']);
    exit;
}

if (empty(SUPABASE_SERVICE_ROLE_KEY) || empty(SYSTEM_USER_ID)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Configuración de servidor incompleta (Supabase Key o User ID)']);
    exit;
}

// ============================
// Leer body JSON
// ============================
$input = json_decode($inputRaw, true);

if (!$input && $_SERVER['REQUEST_METHOD'] === 'POST') {
    http_response_code(400);
    file_put_contents($log_file, "ERROR: JSON inválido\n", FILE_APPEND);
    echo json_encode(['success' => false, 'error' => 'Body JSON inválido']);
    exit;
}

$referencia = trim($input['referencia'] ?? '');
$tienda = trim($input['tienda'] ?? 'GENERAL');
$clienteNombre = trim($input['cliente_nombre'] ?? '');
$clienteApellido = trim($input['cliente_apellido'] ?? '');
$vendedor = trim($input['vendedor'] ?? '');
$emailVendedor = trim($input['email_vendedor'] ?? '');
$fechaPresentacion = trim($input['fecha_presentacion'] ?? '');
$solicitudId = intval($input['solicitud_id'] ?? 0);
$descripcion = trim($input['descripcion'] ?? '');

// Nuevos campos para integraciones generales (como 4D)
$source = trim($input['source'] ?? ''); // e.g. 'solicitud_4d'
$externalProjectId = trim($input['project_id'] ?? ''); // UUID opcional
$esUrgente = !empty($input['es_urgente']);
$motivoUrgencia = trim($input['motivo_urgencia'] ?? '');
$fechaVisita = trim($input['fecha_visita'] ?? '');

// Datos de adjunto
$fileUrl = trim($input['file_url'] ?? '');
$fileName = trim($input['file_name'] ?? '');
$fileType = trim($input['file_type'] ?? '');

if (empty($referencia)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'referencia es obligatoria']);
    exit;
}

// ============================
// Helper: llamar a Supabase REST API
// ============================
function supabaseRequest($method, $endpoint, $data = null, $queryParams = '')
{
    $url = SUPABASE_URL . '/rest/v1/' . $endpoint . ($queryParams ? '?' . $queryParams : '');

    $headers = [
        'apikey: ' . SUPABASE_SERVICE_ROLE_KEY,
        'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false // Deshabilitado para compatibilidad con entornos locales (XAMPP/Windows) sin certificados CA actualizados
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data)
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return json_decode($response, true);
}

try {
    // ============================
    // 1. Identificar Workspace por nombre (desde config.php)
    // ============================
    $wsName = DEFAULT_WORKSPACE_NAME;
    $wsRes = supabaseRequest('GET', 'workspaces', null, 'name=eq.' . urlencode($wsName) . '&select=id&limit=1');
    if (empty($wsRes[0]['id'])) {
        throw new Exception("Workspace '$wsName' no encontrado en Supabase");
    }
    $workspaceId = $wsRes[0]['id'];

    // ============================
    // 2. Buscar o crear Proyecto
    // ============================
    // Determinamos el nombre del proyecto según el origen si no viene por ID
    if (!empty($externalProjectId)) {
        $projectId = $externalProjectId;
        $unifiedName = "Proyecto Externo (ID: $projectId)";
    }
    else {
        $unifiedName = ($source === 'solicitud_4d') ? PROJECT_4D_NAME : PROJECT_PROJECTS_NAME;

        $projRes = supabaseRequest('GET', 'projects', null, 'name=eq.' . urlencode($unifiedName) . '&workspace_id=eq.' . $workspaceId . '&select=id&limit=1');

        if (!empty($projRes[0]['id'])) {
            $projectId = $projRes[0]['id'];
        }
        else {
            // Crear proyecto si no existe
            $newProj = supabaseRequest('POST', 'projects', [
                'name' => $unifiedName,
                'workspace_id' => $workspaceId,
                'user_id' => SYSTEM_USER_ID,
                'owner_email' => SYSTEM_USER_EMAIL
            ]);
            if (empty($newProj[0]['id'])) {
                error_log("Taskboard API ERROR al crear proyecto '$unifiedName'. Respuesta: " . json_encode($newProj));
                throw new Exception("Error al crear el proyecto '$unifiedName'. Ver logs del servidor.");
            }
            $projectId = $newProj[0]['id'];

            // Auto-asignar al usuario del sistema como owner del proyecto
            supabaseRequest('POST', 'project_members', [
                'project_id' => $projectId,
                'member_id' => SYSTEM_USER_ID,
                'member_email' => SYSTEM_USER_EMAIL,
                'role' => 'owner'
            ]);
        }
    }

    // ============================
    // 3. Crear la tarea
    // ============================
    $descLines = [];

    if ($source === 'solicitud_4d') {
        $descLines[] = "--- SOLICITUD 4D ---";
        $descLines[] = "Tienda: " . $tienda;
        if ($fechaVisita)
            $descLines[] = "Fecha Visita: " . $fechaVisita;
        if ($esUrgente)
            $descLines[] = "URGENTE: SI" . ($motivoUrgencia ? " ($motivoUrgencia)" : "");
        if ($solicitudId)
            $descLines[] = "ID Solicitud Local: #" . $solicitudId;
    }
    else {
        if ($clienteNombre || $clienteApellido)
            $descLines[] = "Cliente: " . trim($clienteNombre . ' ' . $clienteApellido);
        $descLines[] = "Tienda: " . $tienda;
        if ($vendedor)
            $descLines[] = "Vendedor: " . $vendedor . ($emailVendedor ? " ($emailVendedor)" : "");
        if ($solicitudId)
            $descLines[] = "Solicitud ID: #" . $solicitudId;
    }

    if ($descripcion)
        $descLines[] = "\nDescripción:\n" . $descripcion;

    $taskResult = supabaseRequest('POST', 'tasks', [
        'title' => $referencia,
        'project_id' => $projectId,
        'user_id' => SYSTEM_USER_ID,
        'created_by' => SYSTEM_USER_ID,
        'updated_by' => SYSTEM_USER_ID,
        'description' => implode("\n", $descLines),
        'owner_email' => SYSTEM_USER_EMAIL,
        'priority' => ($esUrgente ? 'high' : 'medium'),
        'effort' => 'm',
        'due_date' => ($fechaPresentacion ?: ($fechaVisita ?: null))
    ]);

    if (empty($taskResult[0]['id'])) {
        throw new Exception("Error al crear la tarea en Supabase");
    }

    $taskId = $taskResult[0]['id'];

    // ============================
    // 4. Adjuntar archivo si existe
    // ============================
    if (!empty($fileUrl)) {
        supabaseRequest('POST', 'task_comments', [
            'task_id' => $taskId,
            'author_id' => SYSTEM_USER_ID,
            'body' => "Archivo adjunto desde el sistema original: " . ($fileName ?: 'adjunto'),
            'file_url' => $fileUrl,
            'file_name' => $fileName ?: 'adjunto.drw',
            'file_type' => $fileType ?: 'application/octet-stream'
        ]);
    }

    echo json_encode([
        'success' => true,
        'task_id' => $taskId,
        'project_id' => $projectId,
        'workspace_id' => $workspaceId,
        'message' => 'Tarea registrada correctamente en ' . $unifiedName,
        'has_attachment' => !empty($fileUrl)
    ]);

}
catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
