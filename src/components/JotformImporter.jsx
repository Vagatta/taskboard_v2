import { useState } from 'react';
import { Alert, Button, Card, FileInput, Label, Progress, Spinner } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { parseCSV, validateJotformCSV } from '../utils/csvParser';
import { mapJotformRowsToTasks } from '../utils/jotformMapper';

export default function JotformImporter({ projectId, userId, userEmail, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [preview, setPreview] = useState(null);
  const [deleteExisting, setDeleteExisting] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setPreview(null);

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Por favor selecciona un archivo CSV válido');
      setFile(null);
      return;
    }

    try {
      const text = await selectedFile.text();
      const data = parseCSV(text);
      
      if (!data || data.length === 0) {
        setError('El archivo CSV no contiene datos. Asegúrate de que tiene al menos una fila con información además de los encabezados.');
        setFile(null);
        return;
      }

      const validation = validateJotformCSV(data);
      
      if (!validation.valid) {
        const errorMsg = `Errores en el archivo CSV:\n${validation.errors.join('\n')}\n\nCampos detectados: ${Object.keys(data[0] || {}).slice(0, 5).join(', ')}...`;
        setError(errorMsg);
        setFile(null);
        return;
      }

      setPreview({
        totalRows: data.length,
        sampleRows: data.slice(0, 3),
        headers: Object.keys(data[0] || {})
      });

    } catch (err) {
      setError(`Error al leer el archivo: ${err.message}\n\nAsegúrate de que es un archivo CSV válido exportado desde Jotform.`);
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file || !projectId) return;

    setImporting(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      const validation = validateJotformCSV(data);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Eliminar tareas existentes si está marcado
      if (deleteExisting) {
        const { data: existingTasks, error: fetchError } = await supabase
          .from('tasks')
          .select('id')
          .eq('project_id', projectId);

        if (!fetchError && existingTasks && existingTasks.length > 0) {
          const taskIds = existingTasks.map(t => t.id);
          const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .in('id', taskIds);

          if (deleteError) {
            throw new Error(`Error al eliminar tareas existentes: ${deleteError.message}`);
          }
        }
      }

      const tasks = mapJotformRowsToTasks(data, projectId, userId, userEmail);
      
      const totalTasks = tasks.length;
      let imported = 0;
      let failed = 0;
      const errors = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        try {
          const { data, error } = await supabase
            .from('tasks')
            .insert([task])
            .select()
            .single();

          if (error) throw error;
          
          imported++;
        } catch (err) {
          console.error(`Error importing task ${i + 1}:`, err);
          failed++;
          errors.push(`Fila ${i + 1}: ${err.message}`);
        }

        setProgress(Math.round(((i + 1) / totalTasks) * 100));
      }

      if (imported > 0) {
        setSuccess(`✅ Importación completada: ${imported} tareas creadas${failed > 0 ? `, ${failed} fallidas` : ''}`);
        
        if (onImportComplete) {
          onImportComplete(imported);
        }
      }

      if (errors.length > 0 && errors.length <= 5) {
        setError(`Algunos errores durante la importación:\n${errors.join('\n')}`);
      } else if (errors.length > 5) {
        setError(`${failed} tareas fallaron durante la importación. Revisa el formato del CSV.`);
      }

      setFile(null);
      setPreview(null);
      
      const fileInput = document.getElementById('jotform-csv-input');
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (err) {
      setError(`Error durante la importación: ${err.message}`);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <Card className="w-full">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Importar desde Jotform
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sube un archivo CSV exportado desde Jotform para crear tareas automáticamente
          </p>
        </div>

        {error && (
          <Alert color="failure" onDismiss={() => setError(null)}>
            <div className="whitespace-pre-line">{error}</div>
          </Alert>
        )}

        {success && (
          <Alert color="success" onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <div>
          <Label htmlFor="jotform-csv-input" value="Seleccionar archivo CSV" />
          <FileInput
            id="jotform-csv-input"
            accept=".csv"
            onChange={handleFileChange}
            disabled={importing}
            className="mt-2"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Formato: CSV exportado desde Jotform con datos de proyectos
          </p>
          
          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="delete-existing"
              checked={deleteExisting}
              onChange={(e) => setDeleteExisting(e.target.checked)}
              disabled={importing}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <Label htmlFor="delete-existing" className="text-sm font-normal">
              Eliminar todas las tareas existentes antes de importar
            </Label>
          </div>
        </div>

        {preview && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
              Vista Previa
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Total de registros:</span> {preview.totalRows}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Campos detectados:</span> {preview.headers.length}
              </p>
              
              {preview.sampleRows.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Muestra de proyectos a importar:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    {preview.sampleRows.map((row, idx) => {
                      const nombre = row['Nombre'] || '';
                      const apellido = row['Apellido'] || '';
                      const titulo = row['Titulo de proyecto'] || `${nombre} ${apellido}`.trim() || 'Sin título';
                      const tienda = row['Tienda'] || '';
                      
                      return (
                        <li key={idx}>
                          {titulo}
                          {tienda && ` - ${tienda}`}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    ✓ Campos Nombre y Apellido detectados correctamente
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {importing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Importando tareas...</span>
              <span className="font-medium text-gray-900 dark:text-white">{progress}%</span>
            </div>
            <Progress progress={progress} color="blue" />
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleImport}
            disabled={!file || importing || !projectId}
            color="blue"
            className="flex-1"
          >
            {importing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Importando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importar Tareas
              </>
            )}
          </Button>
          
          {file && !importing && (
            <Button
              color="gray"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setError(null);
                const fileInput = document.getElementById('jotform-csv-input');
                if (fileInput) fileInput.value = '';
              }}
            >
              Cancelar
            </Button>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            ℹ️ Información sobre la importación
          </h4>
          <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>El CSV debe contener los campos de Jotform estándar</li>
            <li>Se crearán tareas con toda la información del formulario</li>
            <li>Los archivos adjuntos se incluirán como URLs en la descripción</li>
            <li>Las fechas se parsearán automáticamente al formato correcto</li>
            <li>Las etiquetas se generarán desde tienda, espacios y colección</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
