import React, { useState } from 'react';
import { Search, Settings, GripVertical, X, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { saveUserPreference, getUserPreference } from '../../services/api';

export function loadColConfigLocal(prefKey, allColumns) {
    try {
        const saved = localStorage.getItem(prefKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            const knownKeys = new Set(parsed.map(c => c.key));
            const extra = allColumns.filter(c => !knownKeys.has(c.key)).map(c => ({ ...c, visible: true }));
            return [...parsed, ...extra];
        }
    } catch (_) { /* ignore */ }
    return allColumns.map(c => ({ ...c, visible: true }));
}

export function saveColConfig(prefKey, cols) {
    localStorage.setItem(prefKey, JSON.stringify(cols));
    saveUserPreference(prefKey, cols).catch(() => { });
}

export async function loadColConfigFromServer(prefKey, allColumns) {
    try {
        const saved = await getUserPreference(prefKey);
        if (saved && Array.isArray(saved)) {
            const knownKeys = new Set(saved.map(c => c.key));
            const extra = allColumns.filter(c => !knownKeys.has(c.key)).map(c => ({ ...c, visible: true }));
            return [...saved, ...extra];
        }
    } catch (_) { /* fallback to local */ }
    return null;
}

export default function ColumnSettingsPanel({ columns, allColumns, prefKey, onChange, onClose }) {
    const [cols, setCols] = useState(columns);
    const [dragging, setDragging] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const filteredCols = cols.filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleDragStart = (idx) => setDragging(idx);
    const handleDragOver = (e, idx) => {
        e.preventDefault();
        if (dragging === null || dragging === idx) return;
        
        // Find actual indices in the full list if filtered
        const actualDraggingIdx = cols.findIndex(c => c.key === filteredCols[dragging].key);
        const actualTargetIdx = cols.findIndex(c => c.key === filteredCols[idx].key);
        
        const next = [...cols];
        const [moved] = next.splice(actualDraggingIdx, 1);
        next.splice(actualTargetIdx, 0, moved);
        setCols(next);
        setDragging(idx);
    };
    const handleDrop = () => setDragging(null);

    const toggleVisible = (key) => {
        const idx = cols.findIndex(c => c.key === key);
        if (cols[idx].required) return;
        const next = [...cols];
        next[idx] = { ...next[idx], visible: !next[idx].visible };
        setCols(next);
    };

    const setAllVisible = (visible) => {
        setCols(cols.map(c => c.required ? c : { ...c, visible }));
    };

    const handleSave = () => {
        saveColConfig(prefKey, cols);
        onChange(cols);
        onClose();
    };

    const handleReset = () => {
        const def = allColumns.map(c => ({ ...c, visible: true }));
        setCols(def);
        setSearchTerm('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-base font-bold text-gray-800">Ordem e Visibilidade das Colunas</h2>
                        <button 
                            onClick={() => setShowHelp(!showHelp)}
                            className={`p-1 rounded-full transition-colors ${showHelp ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                            title="Ajuda sobre o painel"
                        >
                            <HelpCircle className="h-4 w-4" />
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
                
                {showHelp && (
                    <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 text-sm text-indigo-900 leading-relaxed">
                        <p className="font-semibold mb-1">Como usar este painel:</p>
                        <ul className="list-disc pl-5 space-y-1 text-xs">
                            <li><strong>Reordenar:</strong> Clique e segure no ícone <GripVertical className="inline h-3 w-3 text-indigo-400"/> e arraste a coluna para a posição desejada. Note que o arraste é desabilitado enquanto você usa a barra de busca.</li>
                            <li><strong>Ocultar/Mostrar:</strong> Clique no ícone de olho (<Eye className="inline h-3 w-3 text-indigo-500"/>) para esconder colunas que você não utiliza, deixando a tela mais limpa. Colunas com selo <span className="bg-indigo-100 text-indigo-600 px-1 rounded text-[9px] uppercase font-bold">Fixo</span> não podem ser ocultadas.</li>
                            <li><strong>Mostrar Todas / Ocultar Todas:</strong> Use os botões abaixo para ligar ou desligar várias colunas de uma vez.</li>
                            <li><strong>Pesquisa:</strong> Use a barra de busca para encontrar rapidamente uma coluna numa lista grande.</li>
                            <li><strong>Resetar:</strong> Volta as colunas para o padrão de fábrica.</li>
                        </ul>
                        <p className="mt-2 text-xs italic text-indigo-700">Ao clicar em "Salvar", sua configuração ficará armazenada no seu navegador para seus próximos acessos!</p>
                    </div>
                )}

                <div className="px-5 pt-3 pb-2 space-y-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar coluna..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">Arraste para reordenar.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setAllVisible(true)} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition">
                                Mostrar Todas
                            </button>
                            <button onClick={() => setAllVisible(false)} className="text-[10px] font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition">
                                Ocultar Todas
                            </button>
                        </div>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 px-5 py-2 space-y-1.5">
                    {filteredCols.map((col, idx) => (
                        <div
                            key={col.key}
                            draggable={searchTerm === ''} // Only allow dragging when not filtering
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={handleDrop}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${searchTerm === '' ? 'cursor-grab active:cursor-grabbing' : ''} select-none
                                ${dragging === idx ? 'border-indigo-400 bg-indigo-50 shadow-md' : 'border-gray-100 bg-gray-50 hover:border-indigo-200'}`}
                        >
                            <GripVertical className={`h-4 w-4 flex-shrink-0 ${searchTerm === '' ? 'text-gray-300' : 'text-gray-100'}`} />
                            <span className={`flex-1 text-sm font-medium ${!col.visible ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {col.label}
                            </span>
                            {col.required
                                ? <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold uppercase">Fixo</span>
                                : (
                                    <button onClick={() => toggleVisible(col.key)} className="p-1 rounded-lg hover:bg-gray-200 transition">
                                        {col.visible
                                            ? <Eye className="h-4 w-4 text-indigo-500" />
                                            : <EyeOff className="h-4 w-4 text-gray-400" />
                                        }
                                    </button>
                                )
                            }
                        </div>
                    ))}
                    {filteredCols.length === 0 && (
                        <div className="text-center py-8 text-sm text-gray-400">Nenhuma coluna encontrada</div>
                    )}
                </div>
                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button onClick={handleReset} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                        Resetar
                    </button>
                    <button onClick={handleSave} className="flex-1 py-2 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition font-semibold">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}
