/**
 * Utilidad para parsear archivos CSV
 */

/**
 * Parsea un archivo CSV y devuelve un array de objetos
 * @param {string} csvText - Contenido del archivo CSV
 * @returns {Array<Object>} Array de objetos con los datos parseados
 */
export function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length === 0) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }

  return data;
}

/**
 * Parsea una línea CSV teniendo en cuenta comillas y delimitadores
 * @param {string} line - Línea del CSV
 * @returns {Array<string>} Array de valores
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\t' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Valida que el CSV tenga los campos mínimos requeridos
 * @param {Array<Object>} data - Datos parseados del CSV
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateJotformCSV(data) {
  const errors = [];

  if (!data || data.length === 0) {
    errors.push('El archivo CSV está vacío o no contiene datos');
    return { valid: false, errors };
  }

  const firstRow = data[0];
  
  // Verificar que los campos existen en los encabezados
  const requiredFields = ['Nombre', 'Apellido'];
  const missingFields = requiredFields.filter(field => !(field in firstRow));

  if (missingFields.length > 0) {
    errors.push(`Faltan campos requeridos en los encabezados: ${missingFields.join(', ')}`);
    return { valid: false, errors };
  }

  // Verificar que al menos tenga algunos campos de Jotform
  const jotformFields = [
    'Submission Date',
    'Tienda',
    'Vendedor',
    'Presupuesto aproximado'
  ];

  const hasJotformFields = jotformFields.some(field => field in firstRow);
  
  if (!hasJotformFields) {
    errors.push('El archivo no parece ser un CSV de Jotform válido (faltan campos típicos de Jotform)');
    return { valid: false, errors };
  }

  // Verificar que los campos obligatorios tienen valores
  const nombre = firstRow['Nombre'];
  const apellido = firstRow['Apellido'];
  
  if (!nombre || nombre.trim() === '') {
    errors.push('El campo "Nombre" está vacío en la primera fila de datos');
  }
  
  if (!apellido || apellido.trim() === '') {
    errors.push('El campo "Apellido" está vacío en la primera fila de datos');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extrae URLs de un campo de texto
 * @param {string} text - Texto que puede contener URLs
 * @returns {Array<string>} Array de URLs encontradas
 */
export function extractURLs(text) {
  if (!text) return [];
  
  const urlRegex = /https?:\/\/[^\s"]+/g;
  const matches = text.match(urlRegex);
  
  return matches ? matches.map(url => url.trim()) : [];
}
