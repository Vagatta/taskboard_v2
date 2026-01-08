import React, { useMemo, useState } from 'react';
import { Card, Button } from 'flowbite-react';

export default function ProductivityCharts({ tasks = [] }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const weeklyData = useMemo(() => {
        const now = new Date();
        const weeks = [];

        // Generar las últimas 4 semanas empezando desde el lunes de la semana actual
        for (let i = 3; i >= 0; i--) {
            const start = new Date(now);
            // Ajustar al lunes de hace i semanas
            const diff = now.getDay() === 0 ? 6 : now.getDay() - 1;
            start.setDate(now.getDate() - diff - (i * 7));
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(start.getDate() + 7);

            const completedInWeek = tasks.filter(t => {
                const dateToUse = t.completed_at ? new Date(t.completed_at) : (t.completed ? new Date(t.updated_at) : null);
                if (!dateToUse) return false;
                return dateToUse >= start && dateToUse < end;
            }).length;

            weeks.push({
                label: i === 0 ? 'Esta semana' : `Hace ${i} sem.`,
                value: completedInWeek,
                start
            });
        }
        return weeks;
    }, [tasks]);

    const maxValue = Math.max(...weeklyData.map(w => w.value), 5);

    const containerClass = isFullscreen
        ? "fixed inset-0 z-[100] bg-slate-950 p-6 flex flex-col items-center justify-center overflow-auto"
        : "";

    return (
        <div className={containerClass}>
            <Card className={`border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-none ${isFullscreen ? 'w-full max-w-6xl' : ''}`}>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Métricas de Equipo</p>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Productividad Semanal</h3>
                        </div>
                        <Button
                            size="xs"
                            color="light"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? 'Salir' : 'Ampliar'}
                        </Button>
                    </div>

                    <div className={`${isFullscreen ? 'h-96' : 'h-48'} flex items-end justify-between gap-4 px-2`}>
                        {weeklyData.map((week, i) => {
                            const heightPercent = (week.value / maxValue) * 100;
                            return (
                                <div key={i} className="group relative flex flex-1 flex-col items-center gap-2 h-full justify-end">
                                    {/* Tooltip */}
                                    <div className="absolute -top-10 scale-0 rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-transform group-hover:scale-100 dark:bg-slate-100 dark:text-slate-900 shadow-xl">
                                        {week.value} tareas
                                    </div>

                                    {/* Bar */}
                                    <div
                                        className="w-full rounded-t-xl bg-gradient-to-t from-sky-600 to-cyan-400 transition-all duration-500 ease-out hover:from-sky-500 hover:to-cyan-300 shadow-lg shadow-cyan-500/20"
                                        style={{ height: `${heightPercent}%` }}
                                    ></div>

                                    {/* Label */}
                                    <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {week.label}
                                    </span>
                                    <span className="text-[8px] text-slate-400 dark:text-slate-600">
                                        {week.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="h-3 w-3 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50"></div>
                            <span className="text-slate-600 dark:text-slate-400">Tareas completadas</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Total: {weeklyData.reduce((a, b) => a + b.value, 0)}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
