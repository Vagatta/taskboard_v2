<?php
/**
 * API Endpoint: Crear tarea en Taskboard desde sistemas externos
 * POST /taskboard_v2/api/create-task.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

// Carga la configuración del servidor (no se toca nada en ella)
require_once __DIR__ . '/config.php';

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
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
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
        CURLOPT_TIMEOUT => 15
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
    // 2. Buscar o crear Proyecto Unificado
    // ============================
    $unifiedName = 'Solicitudes Kh tiendas';
    $projRes = supabaseRequest('GET', 'projects', null, 'name=eq.' . urlencode($unifiedName) . '&workspace_id=eq.' . $workspaceId . '&select=id&limit=1');

    if (!empty($projRes[0]['id'])) {
        $projectId = $projRes[0]['id'];
    } else {
        // Crear proyecto unificado si no existe
        $newProj = supabaseRequest('POST', 'projects', [
            'name' => $unifiedName,
            'workspace_id' => $workspaceId,
            'user_id' => SYSTEM_USER_ID,
            'owner_email' => SYSTEM_USER_EMAIL
        ]);
        if (empty($newProj[0]['id'])) {
            throw new Exception("Error al crear el proyecto unificado '$unifiedName'");
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

    // ============================
    // 3. Crear la tarea
    // ============================
    $descLines = [];
    if ($clienteNombre || $clienteApellido)
        $descLines[] = "Cliente: " . trim($clienteNombre . ' ' . $clienteApellido);
    $descLines[] = "Tienda: " . $tienda;
    if ($vendedor)
        $descLines[] = "Vendedor: " . $vendedor . ($emailVendedor ? " ($emailVendedor)" : "");
    if ($solicitudId)
        $descLines[] = "Solicitud ID: #" . $solicitudId;
    if ($descripcion)
        $descLines[] = "\n" . $descripcion;

    $taskResult = supabaseRequest('POST', 'tasks', [
        'title' => $referencia,
        'project_id' => $projectId,
        'user_id' => SYSTEM_USER_ID,
        'created_by' => SYSTEM_USER_ID,
        'updated_by' => SYSTEM_USER_ID,
        'description' => implode("\n", $descLines),
        'owner_email' => SYSTEM_USER_EMAIL,
        'priority' => 'high',
        'effort' => 'm',
        'due_date' => ($fechaPresentacion ?: null)
    ]);

    if (empty($taskResult[0]['id'])) {
        throw new Exception("Error al crear la tarea en Supabase");
    }

    echo json_encode([
        'success' => true,
        'task_id' => $taskResult[0]['id'],
        'project_id' => $projectId,
        'workspace_id' => $workspaceId,
        'message' => 'Tarea registrada correctamente en ' . $unifiedName
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
