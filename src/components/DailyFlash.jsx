import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Card, Spinner, Alert } from 'flowbite-react';
import { supabase } from '../supabaseClient';

export default function DailyFlash({ projectId, onClose }) {
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const generateFlash = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError('');

        try {
            // 1. Obtener actividad reciente (últimos 10 logs)
            const { data: logs } = await supabase
                .from('activity_log')
                .select('event_type, payload, created_at')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(10);

            // 2. Obtener tareas completadas recientemente
            const { data: completedTasks } = await supabase
                .from('tasks')
                .select('title, completed_at')
                .eq('project_id', projectId)
                .eq('completed', true)
                .order('completed_at', { ascending: false })
                .limit(5);

            const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
            if (!API_KEY) throw new Error('Falta la API Key de Gemini en el archivo .env');

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

            const prompt = `
        Eres un asistente de productividad inteligente. Resume la actividad reciente de este proyecto en 3-4 puntos clave basándote en los logs y sugiere en qué enfocarse hoy para ser más eficiente.
        Actividad reciente (logs): ${JSON.stringify(logs)}
        Tareas completadas recientemente: ${JSON.stringify(completedTasks)}
        
        Instrucciones:
        - Usa un tono motivador, conciso y profesional.
        - Responde siempre en español.
        - Usa formato Markdown (negritas, listas con puntos).
        - No incluyas bloques de código ni metadatos técnicos (como UUIDs) en el texto final.
        - Máximo 150 palabras.
      `;

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || 'Error comunicando con Gemini AI');
            }

            const data = await response.json();
            if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
                throw new Error('Respuesta inválida de Gemini');
            }

            setSummary(data.candidates[0].content.parts[0].text);

        } catch (err) {
            console.error('Error generating Daily Flash:', err);
            setError(err.message || 'No se pudo generar el Daily Flash.');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        generateFlash();
    }, [generateFlash]);

    return (
        <Card className="border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-900/10 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    <span>Daily Flash</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-cyan-200/50 dark:bg-cyan-800/50 px-2 py-0.5 rounded-full text-cyan-700 dark:text-cyan-200">IA Power</span>
                </h3>
                <button
                    onClick={onClose}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 transition-colors"
                    title="Cerrar resumen"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                    <Spinner size="md" color="info" />
                    <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 animate-pulse">Generando tu reporte diario...</p>
                </div>
            ) : error ? (
                <Alert color="failure" className="text-xs py-2 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <div className="flex flex-col gap-2">
                        <span>{error}</span>
                        <Button size="xs" color="gray" onClick={generateFlash} className="w-fit">Reintentar</Button>
                    </div>
                </Alert>
            ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200 custom-scrollbar max-h-48 overflow-y-auto pr-1">
                    {summary}
                </div>
            )}

            {!loading && !error && (
                <div className="mt-4 flex items-center justify-between border-t border-cyan-200 dark:border-cyan-800 pt-3">
                    <p className="text-[10px] text-slate-500 italic">Actualizado justo ahora</p>
                    <Button size="xs" color="light" onClick={generateFlash} className="!px-2 !py-1">
                        Re-generar
                    </Button>
                </div>
            )}
        </Card>
    );
}

DailyFlash.propTypes = {
    projectId: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired
};
