<?php
/**
 * Script de inicialización para Taskboard v2
 * Crea el workspace y los proyectos necesarios para las integraciones
 * de solicitud_proyecto (tienda / asociado) y solicitud_4d.
 *
 * Ejecutar una sola vez desde el navegador o CLI:
 *   php init_workspace.php
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

if (empty(SUPABASE_SERVICE_ROLE_KEY) || empty(SYSTEM_USER_ID)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Configuración incompleta (SUPABASE_SERVICE_ROLE_KEY o SYSTEM_USER_ID)']);
    exit;
}

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
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    $decoded = json_decode($response, true);

    return [
        'success' => ($httpCode >= 200 && $httpCode < 300 && empty($curlError)),
        'http_code' => $httpCode,
        'error' => $curlError ?: null,
        'data' => $decoded
    ];
}

function buscarOCreate($endpoint, $nombre, $filtro, $datosCreacion)
{
    $res = supabaseRequest('GET', $endpoint, null, $filtro . '&select=id&limit=1');
    if (!empty($res['data'][0]['id'])) {
        return ['id' => $res['data'][0]['id'], 'creado' => false];
    }

    $res = supabaseRequest('POST', $endpoint, $datosCreacion);
    if (!empty($res['data'][0]['id'])) {
        return ['id' => $res['data'][0]['id'], 'creado' => true];
    }

    throw new Exception("Error al crear $endpoint '$nombre': " . json_encode($res));
}

try {
    // 1. Workspace
    $workspace = buscarOCreate(
        'workspaces',
        DEFAULT_WORKSPACE_NAME,
        'name=eq.' . urlencode(DEFAULT_WORKSPACE_NAME),
        [
            'name' => DEFAULT_WORKSPACE_NAME,
            'user_id' => SYSTEM_USER_ID,
            'owner_email' => SYSTEM_USER_EMAIL
        ]
    );

    $workspaceId = $workspace['id'];
    $resultados = [
        'workspace' => [
            'name' => DEFAULT_WORKSPACE_NAME,
            'id' => $workspaceId,
            'creado' => $workspace['creado']
        ]
    ];

    // 2. Proyectos
    $proyectos = [
        ['constante' => 'PROJECT_PROJECTS_NAME', 'nombre' => PROJECT_PROJECTS_NAME],
        ['constante' => 'PROJECT_4D_NAME', 'nombre' => PROJECT_4D_NAME],
        ['constante' => 'PROJECT_ASOCIADO_NAME', 'nombre' => PROJECT_ASOCIADO_NAME],
    ];

    foreach ($proyectos as $proyecto) {
        $project = buscarOCreate(
            'projects',
            $proyecto['nombre'],
            'name=eq.' . urlencode($proyecto['nombre']) . '&workspace_id=eq.' . $workspaceId,
            [
                'name' => $proyecto['nombre'],
                'workspace_id' => $workspaceId,
                'user_id' => SYSTEM_USER_ID,
                'owner_email' => SYSTEM_USER_EMAIL
            ]
        );

        $projectId = $project['id'];

        // Asegurar que el usuario del sistema es owner del proyecto
        supabaseRequest('POST', 'project_members', [
            'project_id' => $projectId,
            'member_id' => SYSTEM_USER_ID,
            'member_email' => SYSTEM_USER_EMAIL,
            'role' => 'owner'
        ]);

        $resultados['projects'][] = [
            'constante' => $proyecto['constante'],
            'name' => $proyecto['nombre'],
            'id' => $projectId,
            'creado' => $project['creado']
        ];
    }

    echo json_encode([
        'success' => true,
        'message' => 'Workspace y proyectos verificados/creados correctamente',
        'resultados' => $resultados
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
