import { Select, Badge } from 'flowbite-react';
import { useMemo } from 'react';

const Icons = {
    workspaces: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    ),
    projects: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
    ),
    members: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    ),
    tasks: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h2a2 2 0 002-2" />
        </svg>
    ),
    auth: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
    )
};

function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
    const colorClasses = {
        blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
        indigo: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
        emerald: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
        amber: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
        rose: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30',
    };

    const bgGlow = {
        blue: 'bg-blue-500/10',
        indigo: 'bg-indigo-500/10',
        emerald: 'bg-emerald-500/10',
        amber: 'bg-amber-500/10',
        rose: 'bg-rose-500/10',
    };

    return (
        <div className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-${color}-500/10 ${colorClasses[color]} bg-white/5 dark:bg-slate-900/40 backdrop-blur-md`}>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-50 ${bgGlow[color]}`} />

            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{title}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
                    <p className="mt-1 text-xs font-medium opacity-60 line-clamp-1">{subtitle}</p>
                </div>
                <div className={`rounded-xl bg-white/10 dark:bg-slate-800/50 p-3 shadow-inner transition-transform group-hover:scale-110`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

export default function StatsDashboard({
    workspaces = [],
    projects = [],
    activeWorkspace = null,
    workspaceMembers = {},
    selectedProjectMembers = [],
    selectedProject = null,
    statsWorkspaceId = null,
    setStatsWorkspaceId = () => { },
    selectedWorkspaceId = null,
    taskSummary = { total: 0, pending: 0, completed: 0, completedOnTime: 0, completedLate: 0 },
    authProvider = 'email',
    globalStats = { workspaces: 0, projects: 0, tasks: 0, completed: 0, collaborators: 0 }
}) {
    const completionRate = useMemo(() => {
        if (taskSummary.total === 0) return 0;
        return Math.round((taskSummary.completed / taskSummary.total) * 100);
    }, [taskSummary]);

    const globalCompletionRate = useMemo(() => {
        if (globalStats.tasks === 0) return 0;
        return Math.round((globalStats.completed / globalStats.tasks) * 100);
    }, [globalStats]);

    return (
        <div className="mt-4 space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Workspace Selector */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 p-4 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary-500/10 p-2 text-primary-500">
                        {Icons.workspaces}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Estadísticas por Workspace</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-medium">Cambia el contexto para ver otros datos</p>
                    </div>
                </div>
                <Select
                    sizing="sm"
                    value={statsWorkspaceId ?? selectedWorkspaceId ?? ''}
                    onChange={(event) => setStatsWorkspaceId(event.target.value || null)}
                    className="w-full sm:w-64"
                >
                    {workspaces.length === 0 ? (
                        <option value="">Sin workspaces</option>
                    ) : (
                        workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                            </option>
                        ))
                    )}
                </Select>
            </div>

            {/* Main Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Workspaces"
                    value={workspaces.length}
                    subtitle="Creados en tu cuenta"
                    icon={Icons.workspaces}
                    color="blue"
                />
                <StatCard
                    title="Proyectos"
                    value={projects.length}
                    subtitle="En el workspace actual"
                    icon={Icons.projects}
                    color="indigo"
                />
                <StatCard
                    title="Miembros"
                    value={activeWorkspace ? (workspaceMembers[activeWorkspace.id]?.length ?? 0) : 0}
                    subtitle="Colaboradores disponibles"
                    icon={Icons.members}
                    color="emerald"
                />
                <StatCard
                    title="Equipo Proyecto"
                    value={selectedProjectMembers.length}
                    subtitle={selectedProject ? 'En el proyecto activo' : 'Selecciona un proyecto'}
                    icon={Icons.members}
                    color="amber"
                />
            </div>

            {/* Detail Stats Section */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Tasks Breakdown */}
                <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Tareas del Proyecto Activo</h4>
                            <p className="text-sm text-slate-500">Progreso y cumplimiento de plazos</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-primary-500">{completionRate}%</p>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Completado</p>
                        </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-3">
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-white/5 shadow-inner">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{taskSummary.total}</span>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Total</span>
                        </div>
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-amber-500/5 p-4 border border-amber-500/20 shadow-inner">
                            <span className="text-2xl font-bold text-amber-500">{taskSummary.pending}</span>
                            <span className="text-[10px] font-bold uppercase text-amber-500/70 tracking-tighter">Pendientes</span>
                        </div>
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-500/5 p-4 border border-emerald-500/20 shadow-inner">
                            <span className="text-2xl font-bold text-emerald-500">{taskSummary.completed}</span>
                            <span className="text-[10px] font-bold uppercase text-emerald-500/70">Finalizadas</span>
                        </div>
                    </div>

                    <div className="mt-8 space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                            <span>Rendimiento vs Plazos</span>
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5 text-emerald-500">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> En plazo: {taskSummary.completedOnTime}
                                </span>
                                <span className="flex items-center gap-1.5 text-rose-500">
                                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Retraso: {taskSummary.completedLate}
                                </span>
                            </div>
                        </div>
                        <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 shadow-inner">
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                style={{ width: `${completionRate}%` }}
                            />
                            {taskSummary.completed > 0 && taskSummary.completedLate > 0 && (
                                <div
                                    className="absolute inset-y-0 right-0 bg-rose-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${(taskSummary.completedLate / Math.max(1, taskSummary.completed)) * (completionRate)}%` }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Security / Access Info */}
                <div className="rounded-3xl border border-slate-200 dark:border-rose-500/20 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 shadow-xl backdrop-blur-md">
                    <div className="flex flex-col h-full">
                        <div className="rounded-2xl bg-rose-500/10 p-4 text-rose-500 inline-block self-start mb-4">
                            {Icons.auth}
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Proveedor de Acceso</h4>
                        <div className="mt-auto">
                            <div className="flex items-center gap-2 mb-4">
                                <Badge color="info" className="px-3 py-1 text-xs font-bold">ACTIVO</Badge>
                                <Badge color="gray" className="px-3 py-1 text-xs uppercase font-bold">{authProvider}</Badge>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white capitalize">{authProvider}</p>
                            <p className="text-xs text-slate-500 mt-1 italic">Este es tu método actual de autenticación segura.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Impact Branding */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl dark:shadow-cyan-500/10 border border-white/5">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/10 blur-[100px]" />
                <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px]" />

                <div className="relative grid gap-8 md:grid-cols-2 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                            </span>
                            Tu Impacto Global
                        </div>
                        <h3 className="text-3xl font-black text-white leading-tight">
                            Has completado <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{globalStats.completed}</span> tareas en toda la plataforma
                        </h3>
                        <p className="mt-4 text-slate-400 text-sm max-w-md">
                            Tu productividad impulsa el éxito de {globalStats.workspaces} workspaces y {globalStats.projects} proyectos activos. ¡Sigue así!
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-6 border border-white/10 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Colaboradores</p>
                            <p className="mt-1 text-4xl font-black text-white">{globalStats.collaborators}</p>
                            <div className="mt-2 h-1 w-12 bg-indigo-500 rounded-full" />
                        </div>
                        <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-6 border border-white/10 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tasa de Éxito</p>
                            <p className="mt-1 text-4xl font-black text-white">{globalCompletionRate}%</p>
                            <div className="mt-2 h-1 w-12 bg-emerald-500 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
