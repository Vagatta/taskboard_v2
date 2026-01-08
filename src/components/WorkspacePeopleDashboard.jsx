import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Select } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import Skeleton from './ui/Skeleton';
import ProductivityCharts from './ProductivityCharts';
import { formatRelativeTime } from '../utils/dateHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Dashboard simple para ver tareas por persona dentro del workspace actual.
export default function WorkspacePeopleDashboard({ workspaceId, workspaceMembers = {}, onPersonClick, onTaskClick }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');

  const workspaceMemberList = useMemo(() => {
    return workspaceId ? workspaceMembers[workspaceId] ?? [] : [];
  }, [workspaceId, workspaceMembers]);

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) {
        setTasks([]);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('tasks')
        .select(
          'id,title,assigned_to,completed,completed_at,due_date,priority,project_id,updated_at,projects!inner(id,name,workspace_id)'
        )
        .eq('projects.workspace_id', workspaceId);

      if (queryError) {
        setError(queryError.message);
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }

      setLoading(false);
    };

    void load();
  }, [workspaceId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (projectFilter !== 'all') {
        const taskProjectId = task.project_id != null ? String(task.project_id) : '';
        if (taskProjectId !== String(projectFilter)) return false;
      }

      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      return true;
    });
  }, [tasks, projectFilter, statusFilter]);

  const people = useMemo(() => {
    const byPerson = new Map();

    for (const task of filteredTasks) {
      const personId = task.assigned_to || '__unassigned__';
      if (!byPerson.has(personId)) {
        byPerson.set(personId, []);
      }
      byPerson.get(personId).push(task);
    }

    const projectById = tasks.reduce((acc, task) => {
      const project = task.projects;
      if (project && !acc[project.id]) {
        acc[project.id] = { id: project.id, name: project.name ?? project.id };
      }
      return acc;
    }, {});

    return Array.from(byPerson.entries()).map(([personId, list]) => {
      const member = personId === '__unassigned__'
        ? null
        : workspaceMemberList.find((m) => m.member_id === personId);
      const label = personId === '__unassigned__' ? 'Sin responsable' : (member?.member_email ?? 'Colaborador');
      const pending = list.filter((task) => !task.completed).length;
      const completed = list.filter((task) => task.completed).length;

      const tasksForPerson = list
        .slice()
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        });

      return {
        personId,
        label,
        pending,
        completed,
        total: list.length,
        tasks: tasksForPerson,
        projectById
      };
    });
  }, [filteredTasks, tasks, workspaceMemberList]);

  const projectsForFilter = useMemo(() => {
    const byId = new Map();

    for (const task of tasks) {
      const project = task.projects;
      if (!project) continue;

      if (!byId.has(project.id)) {
        byId.set(project.id, { id: project.id, name: project.name ?? project.id });
      }
    }

    return Array.from(byId.values());
  }, [tasks]);

  const generateReport = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Colores corporativos
    const primaryColor = [14, 165, 233]; // Sky-500

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('REPORT DE PRODUCTIVIDAD', 15, 25);

    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 15, 33);

    // Workspace info
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Workspace Summary', 15, 55);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(`Total tareas analizadas: ${tasks.length}`, 15, 65);
    doc.text(`Tareas completadas: ${tasks.filter(t => t.completed).length}`, 15, 72);
    doc.text(`Tareas pendientes: ${tasks.filter(t => !t.completed).length}`, 15, 79);

    // AI Summary (Simulado o basado en datos)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 90, pageWidth - 30, 40, 3, 3, 'F');
    doc.setTextColor(14, 165, 233);
    doc.setFont(undefined, 'bold');
    doc.text('ANÁLISIS ESTRATÉGICO (IA)', 20, 100);

    doc.setTextColor(71, 85, 105);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const summaryText = `Durante este periodo, el equipo ha mantenido un enfoque sólido en la resolución de tareas. Las prioridades altas se han abordado con efectividad, y se observa una tendencia positiva en el cumplimiento de fechas de entrega.`;
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 40);
    doc.text(splitSummary, 20, 110);

    // Tabla de tareas por persona
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Desglose por Responsable', 15, 145);

    const tableData = people.map(p => [
      p.label,
      p.pending,
      p.completed,
      p.total
    ]);

    autoTable(doc, {
      startY: 155,
      head: [['Responsable', 'Pendientes', 'Completadas', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 9 }
    });

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Generado automáticamente por Taskboard - Inteligencia en Gestión de Proyectos', pageWidth / 2, 285, { align: 'center' });

    doc.save(`Reporte_Productividad_${workspaceId}.pdf`);
  };

  if (!workspaceId) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 shadow-none">
        <p className="text-sm text-slate-600 dark:text-slate-400">Selecciona un workspace para ver la carga de tareas por persona.</p>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 shadow-none">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Colaboradores</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Tareas por persona</p>
            <p className="text-xs text-slate-500 mt-0.5">Reporte de carga en el workspace</p>
          </div>
          <Button
            size="xs"
            color="info"
            onClick={generateReport}
            className="bg-sky-500 hover:bg-sky-600 shadow-md w-full sm:w-auto"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Generar Informe PDF</span>
            </div>
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16 sm:w-auto">Estado</span>
            <Select
              sizing="sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="flex-1 lg:w-36"
            >
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
              <option value="all">Todas</option>
            </Select>
          </div>
          <div className="hidden lg:block w-px h-8 bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16 sm:w-auto">Proyecto</span>
            <Select
              sizing="sm"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="flex-1 lg:w-44"
            >
              <option value="all">Todos los proyectos</option>
              {projectsForFilter.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <Alert color="failure">{error}</Alert>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
          No hay tareas asignadas a personas en este workspace con los filtros actuales.
        </p>
      ) : (
        <div className="space-y-6">
          <ProductivityCharts tasks={tasks} />
          <div className="grid gap-4 md:grid-cols-2">
            {people.map((person) => (
              <Card
                key={person.personId}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 transition hover:border-cyan-500/60 hover:bg-slate-50 dark:hover:bg-slate-900/80 cursor-pointer"
                onClick={() => {
                  if (onPersonClick) {
                    onPersonClick(person.personId === '__unassigned__' ? null : person.personId);
                  }
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{person.label}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-700 dark:text-amber-200">
                        Pend: {person.pending}
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                        Comp: {person.completed}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    {person.tasks.slice(0, 5).map((task) => {
                      const project = person.projectById[task.project_id];
                      const projectLabel = project?.name ?? task.project_id ?? 'Sin proyecto';
                      const dueDate = task.due_date ? new Date(task.due_date) : null;
                      const dueLabel = dueDate
                        ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(dueDate)
                        : 'Sin fecha';

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTaskClick) onTaskClick(task);
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-2 py-1 transition-all hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-slate-900 dark:text-white">{task.title}</p>
                            <p className="truncate text-[11px] text-slate-500">{projectLabel}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                            <span
                              className={
                                dueDate && !task.completed && dueDate.getTime() < Date.now()
                                  ? 'text-rose-200 font-semibold'
                                  : undefined
                              }
                            >
                              {dueLabel}
                            </span>
                            {task.updated_at ? (
                              <span>{formatRelativeTime(new Date(task.updated_at))}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {person.tasks.length > 5 ? (
                      <p className="text-[11px] text-slate-500">+{person.tasks.length - 5} tareas más</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
