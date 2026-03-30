import React, { useMemo, useState } from 'react';
import { Card, Button } from 'flowbite-react';

export default function ProductivityCharts({ tasks = [] }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const weeklyData = useMemo(() => {
        const now = new Date();
        const weeks = [];
        const rangeFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

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
                start,
                end,
                rangeLabel: `${rangeFormatter.format(start)} - ${rangeFormatter.format(new Date(end.getTime() - 86400000))}`
            });
        }
        return weeks;
    }, [tasks]);

    const maxValue = Math.max(...weeklyData.map(w => w.value), 5);
    const totalCompleted = useMemo(() => weeklyData.reduce((sum, week) => sum + week.value, 0), [weeklyData]);
    const currentWeekValue = weeklyData[weeklyData.length - 1]?.value ?? 0;
    const previousWeekValue = weeklyData[weeklyData.length - 2]?.value ?? 0;
    const weeklyAverage = weeklyData.length > 0 ? (totalCompleted / weeklyData.length) : 0;
    const bestWeek = useMemo(() => {
        if (weeklyData.length === 0) {
            return null;
        }

        return weeklyData.reduce((best, week) => (week.value > best.value ? week : best), weeklyData[0]);
    }, [weeklyData]);
    const delta = currentWeekValue - previousWeekValue;
    const deltaLabel = delta === 0 ? 'Sin cambio vs semana anterior' : delta > 0 ? `+${delta} vs semana anterior` : `${delta} vs semana anterior`;
    const deltaToneClassName = delta > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : delta < 0
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-500 dark:text-slate-400';

    const containerClass = isFullscreen
        ? "fixed inset-0 z-[100] bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm p-6 flex flex-col items-center justify-center overflow-auto"
        : "";

    const expandButtonClassName = "border border-slate-200 bg-white/95 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600 dark:focus:ring-cyan-900/40";
    const summaryCards = [
        {
            label: 'Esta semana',
            value: currentWeekValue,
            helper: weeklyData[weeklyData.length - 1]?.rangeLabel ?? 'Sin rango'
        },
        {
            label: 'Promedio semanal',
            value: weeklyAverage.toFixed(1),
            helper: 'Media de las últimas 4 semanas'
        },
        {
            label: 'Mejor semana',
            value: bestWeek?.value ?? 0,
            helper: bestWeek?.rangeLabel ?? 'Sin datos'
        },
        {
            label: 'Evolución',
            value: delta > 0 ? `+${delta}` : `${delta}`,
            helper: 'Comparativa con la semana anterior',
            toneClassName: deltaToneClassName
        }
    ];

    return (
        <div className={containerClass}>
            <Card className={`border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 shadow-none ${isFullscreen ? 'w-full max-w-6xl shadow-2xl dark:shadow-black/30' : ''}`}>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Métricas de Equipo</p>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Productividad Semanal</h3>
                        </div>
                        <Button
                            size="xs"
                            color="alternative"
                            className={expandButtonClassName}
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? 'Salir' : 'Ampliar'}
                        </Button>
                    </div>

                    {isFullscreen ? (
                        <div className="grid gap-3 md:grid-cols-4">
                            {summaryCards.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                    <p className={`mt-2 text-2xl font-black text-slate-900 dark:text-white ${item.toneClassName ?? ''}`}>{item.value}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.helper}</p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {isFullscreen ? (
                        <div className="flex flex-col gap-1 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Lectura rápida</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                {currentWeekValue === 0
                                    ? 'Esta semana todavía no hay tareas completadas.'
                                    : `Llevas ${currentWeekValue} tarea${currentWeekValue === 1 ? '' : 's'} completada${currentWeekValue === 1 ? '' : 's'} en la semana actual.`}
                            </p>
                            <p className={`text-xs font-semibold ${deltaToneClassName}`}>{deltaLabel}</p>
                        </div>
                    ) : null}

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
                                    >
                                        {isFullscreen ? (
                                            <div className="flex h-full items-start justify-center pt-3">
                                                <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-sky-700 shadow-sm dark:bg-slate-900/70 dark:text-cyan-200">
                                                    {week.value}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Label */}
                                    <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {week.label}
                                    </span>
                                    <span className="text-[8px] text-slate-400 dark:text-slate-600">
                                        {week.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                    {isFullscreen ? (
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {week.rangeLabel}
                                        </span>
                                    ) : null}
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
                            Total: {totalCompleted}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
