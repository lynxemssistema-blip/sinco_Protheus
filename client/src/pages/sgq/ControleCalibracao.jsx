import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Search, AlertTriangle, Upload, CheckCircle2, Calendar, FileText, Download } from 'lucide-react';

export default function ControleCalibracao() {
    const [ativos, setAtivos] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('vencimentos'); // 'vencimentos' | 'historico'
    
    const [uploadingId, setUploadingId] = useState(null);
    const fileInputRef = useRef(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const [assetsRes, histRes] = await Promise.all([
                api.get('/sgq/assets'),
                api.get('/sgq/assets/calibrations')
            ]);
            
            // Filtrar apenas ativos que possuem data de calibração definida
            const calibratableAssets = assetsRes.data.filter(a => a.calibration_validity);
            setAtivos(calibratableAssets);
            setHistorico(histRes.data);
        } catch (err) {
            console.error('Erro ao carregar dados de calibração:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFileUploadClick = (id) => {
        setUploadingId(id);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadingId) return;

        const formData = new FormData();
        formData.append('certificate', file);

        try {
            setLoading(true);
            await api.post(`/sgq/assets/calibrations/upload/${uploadingId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Certificado de calibração enviado com sucesso!');
            loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao enviar certificado.');
        } finally {
            setUploadingId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setLoading(false);
        }
    };

    const getValidityStatus = (dateStr) => {
        if (!dateStr) return { status: 'unknown', label: 'Desconhecido', color: 'bg-slate-100 text-slate-600' };
        
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { status: 'overdue', label: `Vencido há ${Math.abs(diffDays)} dias`, color: 'bg-red-100 text-red-700' };
        } else if (diffDays <= 30) {
            return { status: 'warning', label: `Vence em ${diffDays} dias`, color: 'bg-yellow-100 text-yellow-700' };
        } else {
            return { status: 'ok', label: 'No Prazo', color: 'bg-green-100 text-green-700' };
        }
    };

    const filteredAtivos = ativos.filter(a => 
        (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.patrimonio && a.patrimonio.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Ordenar ativos: Vencidos primeiro, depois próximos a vencer
    const sortedAtivos = [...filteredAtivos].sort((a, b) => {
        const dateA = new Date(a.calibration_validity);
        const dateB = new Date(b.calibration_validity);
        return dateA - dateB;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-indigo-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Controle de Calibração</h1>
                        <p className="text-sm text-slate-500">Gestão de vencimentos e certificados de calibração de instrumentos</p>
                    </div>
                </div>
            </div>

            {/* Abas */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('vencimentos')}
                    className={`pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'vencimentos' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Calendar size={18} />
                    Vencimentos e Alertas
                </button>
                <button 
                    onClick={() => setActiveTab('historico')}
                    className={`pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'historico' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText size={18} />
                    Histórico de Certificados
                </button>
            </div>

            {activeTab === 'vencimentos' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar instrumento por nome ou patrimônio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                <tr>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Patrimônio</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Instrumento</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Data Vencimento</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center">Status</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedAtivos.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-slate-500">
                                            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="font-medium text-lg text-slate-700">Nenhum instrumento requer calibração.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedAtivos.map(a => {
                                        const validity = getValidityStatus(a.calibration_validity);
                                        return (
                                            <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-4">
                                                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 font-bold">
                                                        {a.patrimonio || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-800">
                                                    {a.name}
                                                    <div className="font-normal text-xs text-slate-500">{a.model || ''}</div>
                                                </td>
                                                <td className="p-4 font-medium">
                                                    {new Date(a.calibration_validity).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center ${validity.color}`}>
                                                        {validity.label}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={() => handleFileUploadClick(a.id)}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded transition-colors shadow-sm"
                                                        title="Fazer Upload de Novo Certificado"
                                                    >
                                                        <Upload size={14} /> Novo Certificado
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'historico' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                <tr>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Data do Upload</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Patrimônio / Instrumento</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">Certificado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="3" className="p-8 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : historico.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="p-12 text-center text-slate-500">
                                            <p className="font-medium text-lg text-slate-700">Nenhum histórico de calibração encontrado.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    historico.map(h => {
                                        const asset = ativos.find(a => a.id === h.asset_id);
                                        return (
                                            <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-4 font-medium text-slate-700">
                                                    {new Date(h.date_returned).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4">
                                                    {asset ? (
                                                        <>
                                                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mr-2">
                                                                {asset.patrimonio}
                                                            </span>
                                                            <span className="font-bold">{asset.name}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400">Ativo ID {h.asset_id}</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <a 
                                                        href={h.certificate_url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                                                    >
                                                        <Download size={16} /> Ver PDF
                                                    </a>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Input escondido para upload de arquivo */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="application/pdf,image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
