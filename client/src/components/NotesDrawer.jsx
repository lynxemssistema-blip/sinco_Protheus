import React, { useState, useEffect, useRef } from 'react';
import { X, Send, CheckCircle, User, MessageSquare, Edit2, Trash2, Check, XCircle, Pin, PinOff } from 'lucide-react';
import { getSalesNotes, createSalesNote, resolveSalesNote, updateSalesNote, deleteSalesNote } from '../services/api';

export default function NotesDrawer({ isOpen, onClose, target, currentUser = 'Sistema' }) {
    const [notes, setNotes] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingNote, setEditingNote] = useState(null); // { id, text }
    const [isPinned, setIsPinned] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (isOpen && target) {
            fetchNotes();
        }
    }, [isOpen, target]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [notes]);

    // Handle Layout Shift when Pinned
    useEffect(() => {
        const root = document.getElementById('root');
        if (root) {
            root.style.transition = 'margin-right 0.3s ease-in-out';
            if (isPinned) {
                root.style.marginRight = '448px'; // max-w-md
            } else {
                root.style.marginRight = '0';
            }
        }

        return () => {
            if (root) root.style.marginRight = '0';
        };
    }, [isPinned]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await getSalesNotes(target.order);
            setNotes(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;

        try {
            await createSalesNote({
                order_number: target.order,
                item_number: target.item,
                product_code: target.product,
                note_text: newItem,
                category: 'Geral',
                created_by: currentUser
            });
            setNewItem('');
            fetchNotes();
        } catch (err) {
            alert('Erro ao salvar nota');
        }
    };

    const handleResolve = async (id) => {
        try {
            await resolveSalesNote(id, currentUser);
            fetchNotes();
        } catch (err) {
            alert('Erro ao resolver nota');
        }
    };

    const handleUpdate = async (id) => {
        if (!editingNote || !editingNote.text.trim()) return;
        try {
            await updateSalesNote(id, { note_text: editingNote.text });
            setEditingNote(null);
            fetchNotes();
        } catch (err) { alert('Erro ao atualizar nota'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta anotação?')) return;
        try {
            await deleteSalesNote(id);
            fetchNotes();
        } catch (err) { alert('Erro ao excluir nota'); }
    };

    const groupedNotes = (notesList) => {
        const groups = {};
        notesList.forEach(note => {
            const key = note.item_number || 'GERAL';
            if (!groups[key]) groups[key] = [];
            groups[key].push(note);
        });
        return groups;
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex justify-end transition-all ${isPinned ? 'pointer-events-none' : ''}`}>
            {/* Backdrop - Only visible if not pinned */}
            <div
                className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isPinned ? 'opacity-0' : 'opacity-100'}`}
                onClick={!isPinned ? onClose : undefined}
            />

            <div className={`relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col animate-slideInRight ${isPinned ? 'pointer-events-auto border-l border-gray-200' : ''}`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            Ata Viva / Notas
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {target?.item
                                ? `Item ${target.item} - ${target.product}`
                                : `Pedido Geral ${target?.order}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsPinned(!isPinned)}
                            className={`p-2 rounded-full transition-colors ${isPinned ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
                            title={isPinned ? "Desafixar janela" : "Fixar janela (permite usar o fundo)"}
                        >
                            {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
                    {loading && <div className="text-center text-gray-400 py-4">Carregando...</div>}

                    {Object.keys(groupedNotes(notes)).length === 0 && !loading && (
                        <div className="text-center py-8">
                            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                <MessageSquare className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">Nenhuma anotação neste pedido.</p>
                            <p className="text-gray-400 text-xs">As anotações criadas aqui aparecerão na Ata.</p>
                        </div>
                    )}

                    {Object.entries(groupedNotes(notes)).sort().map(([key, groupNotes]) => (
                        <div key={key} className="mb-4">
                            <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 py-1 rounded w-fit ${key === 'GERAL' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                                {key === 'GERAL' ? 'Geral / Pedido' : `Item ${key}`}
                            </div>

                            <div className="space-y-3 pl-2 border-l-2 border-gray-100">
                                {groupNotes.map(note => (
                                    <div key={note.id} className={`bg-white p-3 rounded-lg shadow-sm border border-gray-100 ${note.is_resolved ? 'opacity-75 bg-gray-50' : ''}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            {/* User Info */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {note.created_by}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(note.created_at).toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                {!note.is_resolved ? (
                                                    <>
                                                        {editingNote?.id === note.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => handleUpdate(note.id)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check className="w-4 h-4" /></button>
                                                                <button onClick={() => setEditingNote(null)} className="text-red-500 hover:bg-red-50 p-1 rounded"><XCircle className="w-4 h-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => setEditingNote({ id: note.id, text: note.note_text })} className="text-gray-400 hover:text-blue-500 p-1 rounded transition-colors" title="Editar">
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                                <button onClick={() => handleDelete(note.id)} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors" title="Excluir">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResolve(note.id)}
                                                                    className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded border border-green-100 hover:border-green-300 transition-colors ml-1"
                                                                >
                                                                    Resolver
                                                                </button>
                                                            </>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Resolvido
                                                        </span>
                                                        <button onClick={() => handleDelete(note.id)} className="text-gray-300 hover:text-red-300 p-1 rounded transition-colors" title="Excluir">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note Content */}
                                        {editingNote?.id === note.id ? (
                                            <textarea
                                                className="w-full text-sm p-2 border rounded focus:ring-1 focus:ring-blue-300 outline-none"
                                                rows="3"
                                                value={editingNote.text}
                                                onChange={e => setEditingNote(prev => ({ ...prev, text: e.target.value }))}
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note_text}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Input */}
                <form onSubmit={handleSend} className="p-4 border-t bg-white">
                    <div className="relative">
                        <textarea
                            className="w-full border border-gray-300 rounded-lg pl-3 pr-12 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none"
                            rows="3"
                            placeholder="Escreva uma observação..."
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                        ></textarea>
                        <button
                            type="submit"
                            disabled={!newItem.trim()}
                            className="absolute bottom-3 right-3 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 pl-1">Pressione Enter para enviar</p>
                </form>
            </div>
        </div>
    );
}
