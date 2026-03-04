import React, { useState, useEffect } from 'react';
import { X, Clock, Save } from 'lucide-react';
import api from '../services/api';
import './OrderItemNotesModal.css';

const OrderItemNotesModal = ({ visible, onClose, pedido, item, itemDesc }) => {
    const [nota, setNota] = useState('');
    const [status, setStatus] = useState('PENDENTE');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('notes');

    useEffect(() => {
        if (visible && pedido && item) {
            loadNote();
            loadHistory();
        }
    }, [visible, pedido, item]);

    const loadNote = async () => {
        try {
            const response = await api.get(`/pedidos/${pedido}/items/notes`);
            const noteData = response.data.find(n => n.item === item);
            if (noteData) {
                setNota(noteData.nota || '');
                setStatus(noteData.status || 'PENDENTE');
            } else {
                setNota('');
                setStatus('PENDENTE');
            }
        } catch (err) {
            console.error('Error loading note:', err);
        }
    };

    const loadHistory = async () => {
        try {
            const response = await api.get(`/pedidos/${pedido}/items/${item}/notes/history`);
            setHistory(response.data);
        } catch (err) {
            console.error('Error loading history:', err);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post(`/pedidos/${pedido}/items/${item}/notes`, {
                nota,
                status
            });
            onClose(true); // true = saved
        } catch (err) {
            alert('Erro ao salvar anotação');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (s) => {
        const colors = {
            PENDENTE: '#ff9800',
            EM_ANDAMENTO: '#2196f3',
            CONCLUIDO: '#4caf50'
        };
        return (
            <span style={{
                backgroundColor: colors[s],
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold'
            }}>
                {s.replace('_', ' ')}
            </span>
        );
    };

    const getActionIcon = (actionType) => {
        const icons = {
            CREATED: '➕',
            UPDATED: '✏️',
            STATUS_CHANGED: '🔄',
            DELETED: '🗑️'
        };
        return icons[actionType] || '📝';
    };

    const formatTimestamp = (ts) => {
        return new Date(ts).toLocaleString('pt-BR');
    };

    if (!visible) return null;

    return (
        <div className="modal-overlay" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Anotações - Item {item}</h3>
                        <p className="modal-subtitle">{itemDesc}</p>
                    </div>
                    <button className="close-btn" onClick={() => onClose(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notes')}
                    >
                        Anotações
                    </button>
                    <button
                        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <Clock size={16} /> Histórico ({history.length})
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'notes' ? (
                        <div className="notes-editor">
                            <div className="form-group">
                                <label>Status:</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="EM_ANDAMENTO">Em Andamento</option>
                                    <option value="CONCLUIDO">Concluído</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Anotações / Tarefas:</label>
                                <textarea
                                    value={nota}
                                    onChange={(e) => setNota(e.target.value)}
                                    rows={10}
                                    placeholder="Digite suas anotações aqui..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {history.length === 0 ? (
                                <p className="empty-message">Nenhum histórico disponível</p>
                            ) : (
                                history.map((h, idx) => (
                                    <div key={idx} className="history-item">
                                        <div className="history-icon">{getActionIcon(h.action_type)}</div>
                                        <div className="history-content">
                                            <div className="history-header">
                                                <strong>{h.user_name}</strong>
                                                <span className="history-timestamp">{formatTimestamp(h.action_timestamp)}</span>
                                            </div>
                                            <div className="history-action">
                                                {h.action_type === 'CREATED' && 'Criou a anotação'}
                                                {h.action_type === 'UPDATED' && `Atualizou: ${h.field_changed}`}
                                                {h.action_type === 'STATUS_CHANGED' && (
                                                    <span>
                                                        Mudou status: {getStatusBadge(h.old_value)} → {getStatusBadge(h.new_value)}
                                                    </span>
                                                )}
                                                {h.action_type === 'DELETED' && 'Excluiu a anotação'}
                                            </div>
                                            {h.old_value && h.action_type === 'UPDATED' && (
                                                <div className="history-diff">
                                                    <small>De: {h.old_value}</small><br />
                                                    <small>Para: {h.new_value}</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => onClose(false)}>
                        Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        <Save size={16} />
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderItemNotesModal;

