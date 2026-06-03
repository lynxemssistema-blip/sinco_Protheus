import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Edit, Save, X, RefreshCw, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../services/api';

const WinSCPTab = () => {
    const [connections, setConnections] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        nome: '',
        usuario: '',
        senha: '',
        endereco_origem: '',
        endereco_destino: '',
        extensao: '',
        objetivo: ''
    });

    useEffect(() => {
        fetchConnections();
        fetchLogs();
    }, []);

    const fetchConnections = async () => {
        try {
            const res = await api.get('/winscp/connections');
            setConnections(res.data);
        } catch (error) {
            console.error('Erro ao buscar conexões:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await api.get('/winscp/logs');
            setLogs(res.data);
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (formData.id) {
                await api.put(`/winscp/connections/${formData.id}`, formData);
            } else {
                await api.post('/winscp/connections', formData);
            }
            setIsEditing(false);
            setFormData({
                nome: '', usuario: '', senha: '', endereco_origem: '', 
                endereco_destino: '', extensao: '', objetivo: ''
            });
            fetchConnections();
        } catch (error) {
            alert('Erro ao salvar conexão.');
        }
        setLoading(false);
    };

    const handleEdit = (conn) => {
        setFormData(conn);
        setIsEditing(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Deseja realmente excluir esta conexão?')) return;
        try {
            await api.delete(`/winscp/connections/${id}`);
            fetchConnections();
        } catch (error) {
            alert('Erro ao deletar.');
        }
    };

    const handleExecute = async (id) => {
        if (!window.confirm('Executar esta transferência agora?')) return;
        try {
            await api.post(`/winscp/execute/${id}`);
            alert('Processo iniciado em background.');
            setTimeout(fetchLogs, 2000); // refresh logs after 2s
        } catch (error) {
            alert('Erro ao executar.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Send className="w-6 h-6 text-indigo-600" />
                        Processos WinSCP
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Configure rotinas de transferência de arquivos (origem/destino).</p>
                </div>
                {!isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Nova Conexão
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="bg-gray-50 p-6 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-700">{formData.id ? 'Editar' : 'Nova'} Conexão</h3>
                        <button onClick={() => {
                            setIsEditing(false);
                            setFormData({
                                nome: '', usuario: '', senha: '', endereco_origem: '', 
                                endereco_destino: '', extensao: '', objetivo: ''
                            });
                        }} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5"/></button>
                    </div>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Conexão</label>
                            <input required type="text" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className="w-full border rounded p-2" placeholder="Ex: Importador XML" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label>
                            <input required type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full border rounded p-2" placeholder="Ex: Nota Fiscal" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Origem</label>
                            <input required type="text" value={formData.endereco_origem} onChange={(e) => setFormData({...formData, endereco_origem: e.target.value})} className="w-full border rounded p-2" placeholder="C:\Users\adm\Desktop\xml" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Destino</label>
                            <input required type="text" value={formData.endereco_destino} onChange={(e) => setFormData({...formData, endereco_destino: e.target.value})} className="w-full border rounded p-2" placeholder="/totvs/microsiga/protheus_data/importadorxml" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                            <input required type="text" value={formData.usuario} onChange={(e) => setFormData({...formData, usuario: e.target.value})} className="w-full border rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                            <input required type="password" value={formData.senha} onChange={(e) => setFormData({...formData, senha: e.target.value})} className="w-full border rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Extensão</label>
                            <input required type="text" value={formData.extensao} onChange={(e) => setFormData({...formData, extensao: e.target.value})} className="w-full border rounded p-2" placeholder="xml" />
                        </div>
                        
                        <div className="md:col-span-2 flex justify-end mt-4">
                            <button disabled={loading} type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow flex items-center gap-2">
                                <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!isEditing && (
                <div className="grid grid-cols-1 gap-6">
                    {/* Lista de Conexões */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-3">Conexões Cadastradas</h3>
                        <div className="bg-white rounded-lg shadow overflow-x-auto border">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="p-3">Nome / Objetivo</th>
                                        <th className="p-3">Origem</th>
                                        <th className="p-3">Destino</th>
                                        <th className="p-3">Ext.</th>
                                        <th className="p-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {connections.length === 0 ? (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">Nenhuma conexão cadastrada.</td></tr>
                                    ) : connections.map(conn => (
                                        <tr key={conn.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-semibold">{conn.nome}</div>
                                                <div className="text-xs text-gray-500">{conn.objetivo}</div>
                                            </td>
                                            <td className="p-3 font-mono text-xs">{conn.endereco_origem}</td>
                                            <td className="p-3 font-mono text-xs">{conn.endereco_destino}</td>
                                            <td className="p-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{conn.extensao}</span></td>
                                            <td className="p-3 text-center space-x-2">
                                                <button onClick={() => handleExecute(conn.id)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Executar Processo">
                                                    <Play className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleEdit(conn)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Editar">
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDelete(conn.id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Excluir">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Logs */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-gray-700">Histórico de Transmissões (Logs)</h3>
                            <button onClick={fetchLogs} className="text-indigo-600 hover:underline flex items-center gap-1 text-sm">
                                <RefreshCw className="w-4 h-4" /> Atualizar Logs
                            </button>
                        </div>
                        <div className="bg-white rounded-lg shadow overflow-x-auto border max-h-96 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                                    <tr>
                                        <th className="p-3">Data/Hora</th>
                                        <th className="p-3">Conexão</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Mensagem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-500">Nenhum log encontrado.</td></tr>
                                    ) : logs.map(log => (
                                        <tr key={log.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                                                {new Date(log.created_at).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 font-medium text-gray-700">{log.connection_name || `ID ${log.connection_id}`}</td>
                                            <td className="p-3">
                                                {log.status === 'success' ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><CheckCircle className="w-4 h-4"/> Sucesso</span> : 
                                                 log.status === 'error' ? <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><XCircle className="w-4 h-4"/> Erro</span> : 
                                                 <span className="flex items-center gap-1 text-blue-600 text-xs font-semibold"><Clock className="w-4 h-4"/> Tentativa</span>}
                                            </td>
                                            <td className="p-3 text-xs text-gray-600">{log.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WinSCPTab;
