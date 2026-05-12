import React, { useState, useEffect } from 'react';
import { Search, Plus, Upload, Users, FileText, CheckCircle, XCircle, Clock, ChevronRight, MessageSquare, Download, ListChecks } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const CurriculosAnalyzer = () => {
    const { user } = useAuth();
    const [candidatos, setCandidatos] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [vagas, setVagas] = useState([]);
    
    // States for Upload
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadData, setUploadData] = useState({
        cargo_id: '',
        vaga_id: '',
        nome_candidato: '',
        telefone: '',
        email: '',
        file: null
    });

    // States for Detail View
    const [selectedCandidato, setSelectedCandidato] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    
    // Comments
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        fetchCandidatos();
        fetchCargos();
    }, []);

    const fetchCandidatos = async () => {
        try {
            const res = await api.get('/rh/curriculos');
            setCandidatos(res.data);
        } catch (error) {
            toast.error('Erro ao carregar candidatos.');
            console.error(error);
        }
    };

    const fetchCargos = async () => {
        try {
            const [cargosRes, vagasRes] = await Promise.all([
                api.get('/sgq/cargos-funcoes'),
                api.get('/rh/vagas')
            ]);
            setCargos(cargosRes.data);
            setVagas(vagasRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadData.file) return toast.warning('Selecione um currículo (PDF ou DOC).');
        if (!uploadData.cargo_id) return toast.warning('Selecione o cargo desejado.');

        setIsUploading(true);
        const formData = new FormData();
        formData.append('curriculo', uploadData.file);
        formData.append('cargo_id', uploadData.cargo_id);
        if (uploadData.vaga_id) formData.append('vaga_id', uploadData.vaga_id);
        formData.append('nome_candidato', uploadData.nome_candidato);
        formData.append('telefone', uploadData.telefone);
        formData.append('email', uploadData.email);

        try {
            const res = await api.post('/rh/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Currículo analisado com sucesso!');
            setIsUploadModalOpen(false);
            setUploadData({ cargo_id: '', nome_candidato: '', telefone: '', email: '', file: null });
            fetchCandidatos();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro processando upload do arquivo.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.put(`/rh/curriculos/${id}/status`, { status: newStatus });
            toast.success('Status atualizado!');
            fetchCandidatos();
            if (selectedCandidato && selectedCandidato.id === id) {
                setSelectedCandidato({ ...selectedCandidato, status: newStatus });
            }
        } catch (error) {
            toast.error('Erro ao atualizar status.');
        }
    };

    const handleVagaChange = async (vagaId) => {
        try {
            await api.put(`/rh/curriculos/${selectedCandidato.id}/vaga`, { vaga_id: vagaId });
            toast.success('Vaga vinculada! Clique em "Reavaliar com IA" para a nova análise.');
            fetchCandidatos();
            setSelectedCandidato({ ...selectedCandidato, vaga_id: vagaId });
        } catch (error) {
            toast.error('Erro ao vincular vaga.');
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            const res = await api.put(`/rh/curriculos/${selectedCandidato.id}/comentarios`, {
                comentario: newComment,
                autor: user?.nome || 'RH'
            });
            setSelectedCandidato({ ...selectedCandidato, comentarios: res.data.comentarios });
            setNewComment('');
            toast.success('Comentário salvo.');
            fetchCandidatos();
        } catch (error) {
            toast.error('Erro ao salvar comentário.');
        }
    };

    const handleReUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('curriculo', file);

        try {
            const res = await api.post(`/rh/curriculos/${selectedCandidato.id}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(res.data.message);
            setSelectedCandidato({ 
                ...selectedCandidato, 
                file_path: res.data.file_path,
                curriculo_texto: res.data.curriculo_texto,
                resumo_ai: null
            });
            fetchCandidatos();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro ao substituir arquivo.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReavaliar = async () => {
        setIsUploading(true);
        try {
            const res = await api.post(`/rh/curriculos/${selectedCandidato.id}/reavaliar`);
            toast.success('Currículo reavaliado com sucesso!');
            setSelectedCandidato({ ...selectedCandidato, resumo_ai: res.data.resumo_ai });
            fetchCandidatos();
        } catch (error) {
            toast.error('Erro ao reavaliar currículo.');
        } finally {
            setIsUploading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score === undefined || score === null) return 'text-gray-500 bg-gray-100 border-transparent';
        const numScore = Number(score);
        if (numScore >= 8) return 'text-green-700 bg-green-100 border-green-200';
        if (numScore >= 6) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
        return 'text-red-700 bg-red-100 border-red-200';
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'Em Avaliação': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Em Avaliação</span>;
            case 'Entrevista Agendada': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">Entrevista Agendada</span>;
            case 'Aprovado': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">Aprovado</span>;
            case 'Reprovado': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">Reprovado</span>;
            case 'Banco de Talentos': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 border border-orange-200">Banco de Talentos</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const formatCurriculoTexto = (texto) => {
        if (!texto) return 'Texto indisponível.';
    
        const linhas = texto.split('\n');
        const titles = ['experiência', 'experiencia', 'historico profissional', 'histórico profissional', 'formação', 'formacao', 'educação', 'educacao', 'cursos', 'habilidades', 'idiomas', 'objetivo', 'resumo', 'dados pessoais', 'informações adicionais'];
    
        const isTitle = (line) => {
            const l = line.trim().toLowerCase();
            return l.length > 2 && l.length < 50 && titles.some(t => l.includes(t)) && (line === line.toUpperCase() || l.split(' ').length <= 4);
        };
    
        return linhas.map((linha, i) => {
            const text = linha.trim();
            if (!text) return <div key={i} className="h-2"></div>;
    
            if (isTitle(text)) {
                return (
                    <div key={i} className="mt-8 mb-4 pb-1 border-b border-indigo-100 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-sm"></div>
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{text}</h4>
                    </div>
                );
            }
    
            let content = text;
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
            const phoneRegex = /(\(?\d{2}\)?\s?(?:9\s?)?\d{4}[-\s]?\d{4})/g;
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|linkedin\.com[^\s]+)/gi;
    
            const isCompany = text.toLowerCase().includes('ltda') || text.toLowerCase().includes(' s/a ') || text.toLowerCase().startsWith('empresa:') || text.toLowerCase().includes(' s.a');
    
            if (isCompany) {
                return <div key={i} className="font-bold text-slate-700 mt-5 mb-2 text-[13px] bg-slate-100 border border-slate-200 inline-block px-2.5 py-1.5 rounded-md">{text}</div>;
            }
            
            const isCargo = text.toLowerCase().startsWith('cargo:') || text.toLowerCase().startsWith('função:');
            if (isCargo) {
                return <div key={i} className="font-semibold text-indigo-700 mt-2 mb-1.5 text-[13px] flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> {text}</div>;
            }
    
            const isDate = /\b(?:19|20)\d{2}\b/.test(text) && (text.toLowerCase().includes(' até ') || text.includes('-') || text.toLowerCase().includes(' a ') || text.toLowerCase().includes('atual'));
            if (isDate && text.length < 50) {
                return <div key={i} className="text-orange-600 font-medium text-xs mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {text}</div>;
            }
    
            return (
                <div key={i} className="text-slate-600 leading-relaxed mb-1 text-[13px] text-justify" dangerouslySetInnerHTML={{ 
                    __html: content
                        .replace(linkRegex, (match) => `<a href="${match.startsWith('http') ? match : 'https://' + match}" target="_blank" class="text-blue-600 hover:underline cursor-pointer break-all">${match}</a>`)
                        .replace(emailRegex, '<strong class="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-semibold">$1</strong>')
                        .replace(phoneRegex, '<strong class="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-semibold">$1</strong>') 
                }} />
            );
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="w-7 h-7 text-indigo-600" />
                        Análise de Currículos com IA
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Automatize a triagem e avaliação de candidatos para os cargos da MetalFisa.</p>
                </div>
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Novo Currículo
                </button>
            </div>

            {/* Grid de Candidatos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 text-xs uppercase font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Candidato</th>
                                <th className="px-6 py-4">Cargo Pretendido</th>
                                <th className="px-6 py-4 text-center">Score IA</th>
                                <th className="px-6 py-4">Data Recebimento</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {candidatos.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Nenhum currículo cadastrado ainda.</td>
                                </tr>
                            ) : candidatos.map(cand => (
                                <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{cand.nome_candidato}</td>
                                    <td className="px-6 py-4 text-slate-500">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-700">{cand.vaga_titulo || 'Banco de Talentos'}</span>
                                            <span className="text-xs">{cand.cargo_nome || `Cargo ID: ${cand.cargo_id}`}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-md border font-bold ${getScoreColor(cand.resumo_ai?.score)}`}>
                                            {cand.resumo_ai?.score !== undefined ? `${cand.resumo_ai.score}/10` : 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{new Date(cand.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4">{getStatusBadge(cand.status)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => {
                                                setSelectedCandidato(cand);
                                                setIsDetailModalOpen(true);
                                            }}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium inline-flex items-center"
                                        >
                                            Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Upload */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-indigo-600" />
                                Submeter Currículo
                            </h2>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
                            <div className="bg-indigo-50 text-indigo-800 text-sm p-3 rounded-lg flex items-start gap-2 border border-indigo-100">
                                <Users className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>A Inteligência Artificial extrairá automaticamente o <strong>Nome, Telefone e E-mail</strong> do candidato diretamente do currículo.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Processo Seletivo (Opcional)</label>
                                <select 
                                    value={uploadData.vaga_id}
                                    onChange={e => {
                                        const vId = e.target.value;
                                        const vTarget = vagas.find(v => v.id == vId);
                                        setUploadData({...uploadData, vaga_id: vId, cargo_id: vTarget ? vTarget.cargo_id : uploadData.cargo_id});
                                    }}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                                >
                                    <option value="">Nenhum (Somente Banco de Talentos)</option>
                                    {vagas.filter(v => v.status === 'Aberta').map(v => (
                                        <option key={v.id} value={v.id}>{v.titulo}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Cargo Desejado <span className="text-red-500">*</span></label>
                                <select 
                                    required
                                    value={uploadData.cargo_id}
                                    onChange={e => setUploadData({...uploadData, cargo_id: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50"
                                >
                                    <option value="">Selecione o cargo para base da IA...</option>
                                    {cargos.map(c => (
                                        <option key={c.id} value={c.id}>{c.denominacao}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Arquivo (PDF ou DOC) <span className="text-red-500">*</span></label>
                                <label htmlFor="cv-upload" className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-colors cursor-pointer group">
                                    <div className="space-y-1 text-center">
                                        <FileText className="mx-auto h-12 w-12 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                        <div className="flex justify-center text-sm text-slate-600">
                                            <span className="font-medium text-indigo-600 group-hover:text-indigo-500 focus-within:outline-none">
                                                Clique aqui para selecionar
                                                <input id="cv-upload" name="cv-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx" 
                                                       onChange={e => setUploadData({...uploadData, file: e.target.files[0]})} />
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{uploadData.file ? uploadData.file.name : 'PDF ou DOC até 10MB'}</p>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isUploading} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-70 flex items-center">
                                    {isUploading ? <><div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full mr-2" /> Analisando com IA...</> : 'Enviar e Analisar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Detalhes (Leitura da Análise) */}
            {isDetailModalOpen && selectedCandidato && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-100 overflow-hidden animate-in zoom-in-95">
                        
                        {/* Detail Header */}
                        <div className="p-5 border-b border-slate-200 bg-white sticky top-0 z-10 flex justify-between items-start">
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{selectedCandidato.resumo_ai?.nome_candidato || selectedCandidato.nome_candidato}</h2>
                                <p className="text-slate-500 text-xs mt-1">
                                    Vaga Vinculada: <span className="font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{selectedCandidato.vaga_titulo || 'Banco de Talentos'}</span> 
                                    <span className="mx-2">•</span>
                                    Cargo Base: <span className="font-semibold text-slate-600">{selectedCandidato.cargo_nome}</span>
                                    <span className="mx-2">•</span>
                                    Adicionado no sistema em {new Date(selectedCandidato.created_at).toLocaleDateString()}
                                </p>
                                
                                <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700 font-medium">
                                    <div className="flex items-center gap-1.5 min-w-max">
                                        <strong className="text-slate-900">Email:</strong> 
                                        {(selectedCandidato.resumo_ai?.email || selectedCandidato.email) && (selectedCandidato.resumo_ai?.email !== 'null') ? (
                                            <a href={`mailto:${selectedCandidato.resumo_ai?.email || selectedCandidato.email}`} className="text-blue-600 hover:text-blue-800 underline font-normal truncate max-w-[200px] sm:max-w-[250px] inline-block align-bottom">
                                                {selectedCandidato.resumo_ai?.email || selectedCandidato.email}
                                            </a>
                                        ) : (
                                            <span className="font-normal text-slate-500">N/A</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5"><strong className="text-slate-900">Tel:</strong> <span className="font-normal">{selectedCandidato.resumo_ai?.telefone || selectedCandidato.telefone || 'N/A'}</span></div>
                                    <div className="flex items-center gap-1.5"><strong className="text-slate-900">Residência:</strong> <span className="font-normal">{selectedCandidato.resumo_ai?.endereco || 'N/A'}</span></div>
                                    <div className="flex items-center gap-1.5"><strong className="text-slate-900">CNH:</strong> <span className="font-normal">{selectedCandidato.resumo_ai?.cnh || 'N/A'}</span></div>
                                    {selectedCandidato.resumo_ai?.linkedin && selectedCandidato.resumo_ai.linkedin !== 'null' && (
                                        <div className="flex items-center gap-1.5"><strong className="text-slate-900">LinkedIn:</strong> 
                                            <a 
                                                href={selectedCandidato.resumo_ai.linkedin.replace(/\s+/g, '').startsWith('http') ? selectedCandidato.resumo_ai.linkedin.replace(/\s+/g, '') : 'https://' + selectedCandidato.resumo_ai.linkedin.replace(/\s+/g, '')} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-blue-600 hover:text-blue-800 underline font-normal truncate max-w-[200px] sm:max-w-[250px] inline-block align-bottom"
                                            >
                                                {selectedCandidato.resumo_ai.linkedin.replace(/\s+/g, '')}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 items-end mr-4 border-r border-slate-200 pr-4">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Vaga Associada</label>
                                    <select 
                                        value={selectedCandidato.vaga_id || ''}
                                        onChange={(e) => handleVagaChange(e.target.value)}
                                        className="px-2 py-1 text-xs border border-slate-300 rounded text-slate-700 bg-slate-50"
                                    >
                                        <option value="">-- Sem Vaga (Banco de Talentos) --</option>
                                        {vagas.filter(v => v.status === 'Aberta').map(v => (
                                            <option key={v.id} value={v.id}>{v.titulo}</option>
                                        ))}
                                    </select>
                                </div>
                                <select 
                                    value={selectedCandidato.status}
                                    onChange={(e) => handleStatusChange(selectedCandidato.id, e.target.value)}
                                    className="px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Em Análise">Em Análise</option>
                                    <option value="Em Avaliação">Em Avaliação</option>
                                    <option value="Entrevista Agendada">Entrevista Agendada</option>
                                    <option value="Aprovado">Aprovado</option>
                                    <option value="Reprovado">Reprovado</option>
                                    <option value="Banco de Talentos">Banco de Talentos</option>
                                </select>
                                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <XCircle className="w-8 h-8" />
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                
                                {/* Col 1: AI Analysis */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                    <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg"><Users className="w-5 h-5" /></span>
                                                    Parecer da Inteligência Artificial
                                                </h3>
                                                <button 
                                                    onClick={handleReavaliar}
                                                    disabled={isUploading}
                                                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs border border-indigo-200 rounded-md transition-colors disabled:opacity-50"
                                                >
                                                    {isUploading ? 'Processando...' : 'Reavaliar com IA'}
                                                </button>
                                            </div>
                                            <div className={`text-2xl font-black px-4 py-1.5 rounded-lg border ${getScoreColor(selectedCandidato.resumo_ai?.score)}`}>
                                                {selectedCandidato.resumo_ai?.score !== undefined ? `${selectedCandidato.resumo_ai.score}/10` : 'N/A'}
                                            </div>
                                        </div>
                                        
                                        <div className="prose prose-sm max-w-none text-slate-600">
                                            <p className="whitespace-pre-wrap leading-relaxed">
                                                {selectedCandidato.resumo_ai?.resumo_gerencial || 'Sem resumo gerencial disponível.'}
                                            </p>
                                        </div>

                                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-green-50/50 border border-green-100 rounded-lg p-4">
                                                <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Pontos Fortes</h4>
                                                <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                                                    {selectedCandidato.resumo_ai?.pontosForte?.map((p, i) => <li key={i}>{p}</li>)}
                                                </ul>
                                            </div>
                                            <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-4">
                                                <h4 className="font-bold text-orange-800 text-sm mb-2 flex items-center"><Clock className="w-4 h-4 mr-1"/> Pontos de Atenção</h4>
                                                <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                                                    {selectedCandidato.resumo_ai?.pontosFracos?.map((p, i) => <li key={i}>{p}</li>)}
                                                </ul>
                                            </div>
                                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                                                <h4 className="font-bold text-blue-800 text-sm">Experiência</h4>
                                                <p className="text-blue-700 text-sm mt-1">{selectedCandidato.resumo_ai?.adequacao_experiencia}</p>
                                            </div>
                                            <div className="bg-sky-50/50 border border-sky-100 rounded-lg p-4">
                                                <h4 className="font-bold text-sky-800 text-sm">Educação</h4>
                                                <p className="text-sky-700 text-sm mt-1">{selectedCandidato.resumo_ai?.adequacao_educacao}</p>
                                            </div>
                                        </div>

                                        {selectedCandidato.resumo_ai?.checklist && selectedCandidato.resumo_ai.checklist.length > 0 && (
                                            <div className="mt-6">
                                                <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center border-b border-slate-100 pb-2">
                                                    <ListChecks className="w-5 h-5 mr-2 text-indigo-500"/> Checklist de Aderência ao Cargo
                                                </h4>
                                                <div className="space-y-3">
                                                    {selectedCandidato.resumo_ai.checklist.map((item, i) => (
                                                        <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-sm transition-all hover:shadow-md">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-bold text-slate-800 mb-1">{item.requisito}</p>
                                                                <p className="text-xs text-slate-600 leading-relaxed">{item.justificativa}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {item.status?.includes('Não') ? <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-md bg-red-100 text-red-700 border border-red-200">Não Atendido</span> :
                                                                 item.status?.includes('Parcial') ? <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-md bg-yellow-100 text-yellow-700 border border-yellow-200">Parcial</span> :
                                                                 <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-md bg-green-100 text-green-700 border border-green-200">Atendido</span>}
                                                                <span className="text-sm font-black bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm text-slate-700">{item.score}/10</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedCandidato.resumo_ai?.perguntas_entrevista && selectedCandidato.resumo_ai.perguntas_entrevista.length > 0 && (
                                            <div className="mt-6 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                                                <h4 className="font-bold text-indigo-900 text-sm mb-3 flex items-center border-b border-indigo-100 pb-2">
                                                    <MessageSquare className="w-5 h-5 mr-2 text-indigo-500"/> Roteiro de Entrevista Sugerido pela IA
                                                </h4>
                                                <ul className="space-y-2 mt-3">
                                                    {selectedCandidato.resumo_ai.perguntas_entrevista.map((pergunta, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                                                            <span className="font-bold text-indigo-400 select-none mt-0.5">{i + 1}.</span>
                                                            <span className="font-medium">{pergunta}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Raw Text View */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-slate-500" />
                                                Currículo Original
                                            </h3>
                                            <div className="flex gap-2">
                                                <button onClick={() => setFileToReUpload(selectedCandidato)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 transition-colors">
                                                    <Upload className="w-3.5 h-3.5" /> Substituir
                                                </button>
                                                <button onClick={() => window.open(`/api/rh/curriculos/download/${encodeURIComponent(selectedCandidato.file_path)}`, '_blank')} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-colors shadow-sm">
                                                    <FileText className="w-3.5 h-3.5" /> Ver PDF Original (com fotos)
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="p-5">
                                            <div className="bg-white p-6 rounded-lg border border-slate-200 max-h-[75vh] overflow-y-auto font-sans shadow-inner">
                                                {formatCurriculoTexto(selectedCandidato.curriculo_texto) || <div className="text-slate-500 italic p-4 text-center">Texto indisponível.</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Col 2: Comments & History */}
                                <div className="space-y-6 flex flex-col h-full">
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                                            <MessageSquare className="w-5 h-5 text-slate-500" />
                                            Anotações do RH
                                        </h3>
                                        
                                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 h-0 min-h-[200px]">
                                            {(!selectedCandidato.comentarios || selectedCandidato.comentarios.length === 0) && (
                                                <p className="text-sm text-slate-400 text-center mt-10">Nenhuma anotação registrada ainda.</p>
                                            )}
                                            {selectedCandidato.comentarios?.map(com => (
                                                <div key={com.id} className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-semibold text-slate-700">{com.autor}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(com.data).toLocaleString('pt-BR')}</span>
                                                    </div>
                                                    <p className="text-slate-600 whitespace-pre-wrap">{com.texto}</p>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="mt-auto border-t border-slate-100 pt-4 relative">
                                            <textarea 
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                placeholder="Adicionar nota sobre a entrevista, contato..."
                                                className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 pr-20"
                                                rows="3"
                                            />
                                            <button 
                                                onClick={handleAddComment}
                                                className="absolute bottom-6 right-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800"
                                            >
                                                Salvar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CurriculosAnalyzer;
