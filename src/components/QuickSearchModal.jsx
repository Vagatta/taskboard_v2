import React, { useState, useMemo } from 'react';
import { Modal, TextInput, Badge, Kbd } from 'flowbite-react';

export default function QuickSearchModal({
    isOpen,
    onClose,
    workspaces,
    projects,
    onSelectProject,
    onSelectWorkspace
}) {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();

        const projectMatches = projects
            .filter(p => p.name.toLowerCase().includes(q))
            .map(p => ({ type: 'project', id: p.id, name: p.name, workspace_id: p.workspace_id }));

        const workspaceMatches = workspaces
            .filter(w => w.name.toLowerCase().includes(q))
            .map(w => ({ type: 'workspace', id: w.id, name: w.name }));

        return [...workspaceMatches, ...projectMatches].slice(0, 8);
    }, [query, projects, workspaces]);

    const handleSelect = (item) => {
        if (item.type === 'workspace') {
            onSelectWorkspace(item.id);
        } else if (item.type === 'project') {
            onSelectWorkspace(item.workspace_id);
            onSelectProject(item.id);
        }
        onClose();
        setQuery('');
    };

    return (
        <Modal show={isOpen} onClose={onClose} size="md" popup>
            <Modal.Header />
            <Modal.Body>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-medium text-gray-900 dark:text-white">Búsqueda Global</h3>
                        <div className="flex gap-1">
                            <Kbd>esc</Kbd>
                        </div>
                    </div>
                    <TextInput
                        placeholder="Busca proyectos o workspaces..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="space-y-2">
                        {results.length > 0 ? (
                            results.map((item) => (
                                <button
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => handleSelect(item)}
                                    className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-cyan-500/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="rounded bg-slate-200 p-1.5 dark:bg-slate-700">
                                            {item.type === 'workspace' ? (
                                                <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            ) : (
                                                <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{item.name}</span>
                                    </div>
                                    <Badge color={item.type === 'workspace' ? 'info' : 'purple'}>
                                        {item.type === 'workspace' ? 'Workspace' : 'Proyecto'}
                                    </Badge>
                                </button>
                            ))
                        ) : query.trim() ? (
                            <p className="py-4 text-center text-sm text-slate-500">No se encontraron resultados.</p>
                        ) : (
                            <p className="py-4 text-center text-sm text-slate-500 italic">Escribe algo para empezar a buscar...</p>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
}
