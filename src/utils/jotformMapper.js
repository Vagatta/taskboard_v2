import { extractURLs } from './csvParser';

/**
 * Mapea los datos de Jotform al formato de tareas de la aplicación
 */

/**
 * Convierte una fila de Jotform a un objeto de tarea
 * @param {Object} jotformRow - Fila del CSV de Jotform
 * @param {string} projectId - ID del proyecto donde se creará la tarea
 * @param {string} userId - ID del usuario que importa
 * @param {string} userEmail - Email del usuario que importa
 * @returns {Object} Objeto de tarea formateado
 */
export function mapJotformToTask(jotformRow, projectId, userId, userEmail) {
  // Generar título del proyecto
  let title = jotformRow['Titulo de proyecto'] || '';
  
  if (!title && jotformRow['Nombre'] && jotformRow['Apellido']) {
    const tienda = jotformRow['Tienda'] ? ` - ${jotformRow['Tienda']}` : '';
    title = `Proyecto ${jotformRow['Nombre']} ${jotformRow['Apellido']}${tienda}`;
  }
  
  if (!title) {
    title = 'Proyecto sin título';
  }
  
  title = title.trim();

  const description = buildDescription(jotformRow);
  
  const dueDate = parseJotformDate(jotformRow['Fecha tope de entrega']) || 
                  parseJotformDate(jotformRow['Fecha de presentación al cliente']) ||
                  null;

  const priority = determinePriority(jotformRow);

  const tags = buildTags(jotformRow);

  return {
    title,
    description,
    project_id: projectId,
    created_by: userId,
    owner_email: userEmail,
    due_date: dueDate,
    priority,
    tags,
    completed: false,
    effort: 'l'
  };
}

/**
 * Formatea una fecha de formato americano a español
 * @param {string} dateString - Fecha en formato MM-DD-YYYY o YYYY-MM-DD
 * @returns {string} Fecha en formato DD-MM-YYYY
 */
function formatDateToSpanish(dateString) {
  if (!dateString || dateString.trim() === '') {
    return '';
  }

  // Si ya está en formato YYYY-MM-DD (ISO), convertir a DD-MM-YYYY
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}-${month}-${year}`;
  }

  // Detectar formato XX-XX-XXXX y determinar si es MM-DD-YYYY o DD-MM-YYYY
  const dateMatch = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dateMatch) {
    const [, first, second, year] = dateMatch;
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);
    
    // Si first > 12, definitivamente es DD-MM-YYYY (día, mes, año) - ya está en formato español
    if (firstNum > 12) {
      return dateString;
    }
    
    // Si second > 12, definitivamente es MM-DD-YYYY (mes, día, año) - convertir a español
    if (secondNum > 12) {
      return `${second}-${first}-${year}`;
    }
    
    // Si ambos <= 12, asumir que viene de Jotform en formato MM-DD-YYYY
    // Convertir a DD-MM-YYYY
    return `${second}-${first}-${year}`;
  }

  // Si no coincide con ningún formato conocido, devolver tal cual
  return dateString;
}

/**
 * Construye la descripción simplificada de la tarea con solo información esencial
 */
function buildDescription(row) {
  const sections = [];

  // Descripción del proyecto (esencial)
  if (row['Descripcion amplia del proyecto, indicando todos aquellos aspectos a tener en cuenta de valor a la hora de crear el proyecto. Indicado todos los pequeños detalles que espera ver el cliente, estilo del espacio a crear, descripción y porqué.']) {
    sections.push(row['Descripcion amplia del proyecto, indicando todos aquellos aspectos a tener en cuenta de valor a la hora de crear el proyecto. Indicado todos los pequeños detalles que espera ver el cliente, estilo del espacio a crear, descripción y porqué.']);
  }

  // Cliente y contacto
  const clienteInfo = [];
  if (row['Nombre'] && row['Apellido']) {
    clienteInfo.push(`**Cliente:** ${row['Nombre']} ${row['Apellido']}`);
  }
  if (row['Tienda']) {
    clienteInfo.push(`**Tienda:** ${row['Tienda']}`);
  }
  if (row['Vendedor']) {
    clienteInfo.push(`**Vendedor:** ${row['Vendedor']}`);
  }
  if (clienteInfo.length > 0) {
    sections.push(clienteInfo.join(' | '));
  }

  // Presupuesto (crítico)
  if (row['Presupuesto aproximado']) {
    let presupuestoText = `**Presupuesto:** ${row['Presupuesto aproximado']}`;
    if (row['Comentarios respecto al presupuesto']) {
      presupuestoText += ` - ${row['Comentarios respecto al presupuesto']}`;
    }
    sections.push(presupuestoText);
  }

  // Espacios a diseñar
  if (row['Espacios a diseñar. Marca todas las estancias a tener en cuenta para el proyecto']) {
    sections.push(`**Espacios:** ${row['Espacios a diseñar. Marca todas las estancias a tener en cuenta para el proyecto']}`);
  }

  // Colección y diseño (solo lo básico)
  const designInfo = [];
  if (row['Colección fabricante']) {
    designInfo.push(`Colección: ${row['Colección fabricante']}`);
  }
  if (row['Modelo Frente Principal']) {
    designInfo.push(`Frente: ${row['Modelo Frente Principal']}${row['Color de frente'] ? ' - ' + row['Color de frente'] : ''}`);
  }
  if (designInfo.length > 0) {
    sections.push(`**Diseño:** ${designInfo.join(' | ')}`);
  }

  // Requisitos obligatorios (MUY IMPORTANTE)
  if (row['Cosas que si o si quiere tener...']) {
    sections.push(`**REQUISITOS:** ${row['Cosas que si o si quiere tener...']}`);
  }

  // Exclusiones (IMPORTANTE)
  if (row['Aquello que bajo ningun concepto No quiere...']) {
    sections.push(`**NO INCLUIR:** ${row['Aquello que bajo ningun concepto No quiere...']}`);
  }

  // Fechas importantes (formato español DD-MM-YYYY)
  const fechas = [];
  if (row['Fecha estimada fin de obra']) {
    const fechaFormateada = formatDateToSpanish(row['Fecha estimada fin de obra']);
    fechas.push(`Fin obra: ${fechaFormateada}`);
  }
  if (row['Fecha de presentación al cliente']) {
    const fechaFormateada = formatDateToSpanish(row['Fecha de presentación al cliente']);
    fechas.push(`Presentación: ${fechaFormateada}`);
  }
  if (fechas.length > 0) {
    sections.push(`**Fechas:** ${fechas.join(' | ')}`);
  }

  // Archivos adjuntos
  const attachmentURLs = extractURLs(row['Carga de los archivo necesarios para el correcto trabajo técnico. Incluye al menos una plano, anque sea a mano alzada y/o aproximado con las anotaciones. Tambien si puedes, las tomas mas importantes. Se agradecen imagenes con notas, ideas o gustos del cliente, asi como si es posible un video con la cocina actual. Mejor que sobre y no que falte ;-)']);
  
  if (attachmentURLs.length > 0) {
    sections.push(`**Archivos:** ${attachmentURLs.length} adjunto(s)\n${attachmentURLs.map(url => `- ${url}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Determina la prioridad basándose en los datos del formulario
 */
function determinePriority(row) {
  const prioridadField = row['Prioridad'];
  
  if (prioridadField) {
    const prioLower = prioridadField.toLowerCase();
    if (prioLower.includes('alta') || prioLower.includes('urgente')) {
      return 'high';
    }
    if (prioLower.includes('baja')) {
      return 'low';
    }
  }

  if (row['Plazo Apretado: Solicita tu Cita Explicando la Urgencia']) {
    return 'high';
  }

  return 'medium';
}

/**
 * Construye el array de tags basándose en los datos
 */
function buildTags(row) {
  const tags = [];

  if (row['Tienda']) {
    tags.push(row['Tienda']);
  }

  if (row['Espacios a diseñar. Marca todas las estancias a tener en cuenta para el proyecto']) {
    const espacios = row['Espacios a diseñar. Marca todas las estancias a tener en cuenta para el proyecto']
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(e => e);
    tags.push(...espacios);
  }

  if (row['Colección fabricante']) {
    tags.push(row['Colección fabricante']);
  }

  if (row['Estado en que se encuentra la reforma']) {
    tags.push(row['Estado en que se encuentra la reforma']);
  }

  return tags.filter((tag, index, self) => self.indexOf(tag) === index);
}

/**
 * Parsea fechas en varios formatos
 */
function parseJotformDate(dateString) {
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  const cleanDate = dateString.trim();
  
  // YYYY-MM-DD (ISO) - Detectar primero
  const isoMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const paddedMonth = String(monthNum).padStart(2, '0');
      const paddedDay = String(dayNum).padStart(2, '0');
      return `${yearNum}-${paddedMonth}-${paddedDay}`;
    }
  }

  // DD-MM-YYYY o MM-DD-YYYY (ambiguo) - Detectar automáticamente
  const dateMatch = cleanDate.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)?$/i);
  if (dateMatch) {
    const [, first, second, year] = dateMatch;
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);
    const yearNum = parseInt(year);
    
    if (yearNum < 1900 || yearNum > 2100) return null;
    
    // Si first > 12, entonces es DD-MM-YYYY (día, mes, año)
    if (firstNum > 12) {
      if (secondNum >= 1 && secondNum <= 12 && firstNum >= 1 && firstNum <= 31) {
        const paddedMonth = String(secondNum).padStart(2, '0');
        const paddedDay = String(firstNum).padStart(2, '0');
        return `${yearNum}-${paddedMonth}-${paddedDay}`;
      }
    }
    // Si second > 12, entonces es MM-DD-YYYY (mes, día, año)
    else if (secondNum > 12) {
      if (firstNum >= 1 && firstNum <= 12 && secondNum >= 1 && secondNum <= 31) {
        const paddedMonth = String(firstNum).padStart(2, '0');
        const paddedDay = String(secondNum).padStart(2, '0');
        return `${yearNum}-${paddedMonth}-${paddedDay}`;
      }
    }
    // Ambos <= 12, asumir MM-DD-YYYY (formato americano por defecto de Jotform)
    else {
      if (firstNum >= 1 && firstNum <= 12 && secondNum >= 1 && secondNum <= 31) {
        const paddedMonth = String(firstNum).padStart(2, '0');
        const paddedDay = String(secondNum).padStart(2, '0');
        return `${yearNum}-${paddedMonth}-${paddedDay}`;
      }
    }
  }

  // DD/MM/YYYY con barras
  const slashMatch = cleanDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const paddedMonth = String(monthNum).padStart(2, '0');
      const paddedDay = String(dayNum).padStart(2, '0');
      return `${yearNum}-${paddedMonth}-${paddedDay}`;
    }
  }

  // Intentar parseo genérico como último recurso
  const timestamp = Date.parse(cleanDate);
  if (!isNaN(timestamp)) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Procesa múltiples filas de Jotform
 */
export function mapJotformRowsToTasks(jotformRows, projectId, userId, userEmail) {
  return jotformRows.map(row => mapJotformToTask(row, projectId, userId, userEmail));
}
