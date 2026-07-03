import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Plus, Minus, Search, Edit2, Trash2, X, Save, AlertCircle, Upload, Wrench, Copy, Check, Camera, FileText, Download, Star, Bell, Mail, MessageSquare, Calendar, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 as metalfisaLogoBase64 } from '../../services/metalfisaLogoBase64';

export default function GestaoAtivos() {
    const [ativos, setAtivos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('@MetalFisa:sgq_assets_search') || '');
    const [selectedRow, setSelectedRow] = useState(null);
    const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('@MetalFisa:sgq_assets_status') || 'all');
    const [columnFilters, setColumnFilters] = useState({
        patrimonio: '',
        name: '',
        model: '',
        status: '',
        validade: '',
        certificado: ''
    });

    const [globalTab, setGlobalTab] = useState(() => localStorage.getItem('@MetalFisa:sgq_assets_tab') || 'ativos'); // 'ativos' | 'calibracoes' | 'historico'
    const [historico, setHistorico] = useState([]);

    useEffect(() => {
        localStorage.setItem('@MetalFisa:sgq_assets_search', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('@MetalFisa:sgq_assets_status', statusFilter);
    }, [statusFilter]);

    useEffect(() => {
        localStorage.setItem('@MetalFisa:sgq_assets_tab', globalTab);
    }, [globalTab]);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isBulk, setIsBulk] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [formData, setFormData] = useState({
        id: null,
        patrimonio: '',
        name: '',
        model: '',
        serial_number: '',
        status: 'available',
        calibration_validity: '',
        requires_calibration: true,
        stock_quantity: 1
    });

    // Alerts and Users state
    const [users, setUsers] = useState([]);
    const [alerts, setAlerts] = useState([]);

    // Upload state
    const [uploadingId, setUploadingId] = useState(null);
    const fileInputRef = useRef(null);

    // Attachments state
    const [newAttachments, setNewAttachments] = useState({ photos: [], pdfs: [] });
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);
    const [mainPhotoName, setMainPhotoName] = useState(null);

    // Transaction state
    const [assetTransactions, setAssetTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [resAtivos, resHist] = await Promise.all([
                api.get('/sgq/assets'),
                api.get('/sgq/assets/calibrations').catch(() => ({ data: [] }))
            ]);
            setAtivos(resAtivos.data);
            setHistorico(resHist.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error('Erro ao buscar usuários:', err);
        }
    };

    useEffect(() => {
        loadData();
        loadUsers();
    }, []);

    const handleOpenModal = async (ativo = null) => {
        setNewAttachments({ photos: [], pdfs: [] });
        setExistingAttachments([]);
        setMainPhotoName(null);
        
        if (ativo) {
            setFormData({
                id: ativo.id,
                patrimonio: ativo.patrimonio || '',
                name: ativo.name || '',
                model: ativo.model || '',
                serial_number: ativo.serial_number || '',
                status: ativo.status || 'available',
                calibration_validity: ativo.calibration_validity ? ativo.calibration_validity.split('T')[0] : '',
                requires_calibration: ativo.requires_calibration !== 0 && ativo.requires_calibration !== false,
                stock_quantity: ativo.stock_quantity || 1
            });
            setIsBulk(false);
            setQuantity(1);
            setIsModalOpen(true);
            
            // Carregar anexos existentes
            try {
                setLoadingAttachments(true);
                const res = await api.get(`/sgq/assets/${ativo.id}/attachments`);
                setExistingAttachments(res.data);
            } catch (err) {
                console.error('Erro ao carregar anexos:', err);
            } finally {
                setLoadingAttachments(false);
            }

            // Carregar alertas existentes
            try {
                const resAlerts = await api.get(`/sgq/assets/${ativo.id}/alerts`);
                setAlerts(resAlerts.data.map(a => ({
                    ...a,
                    target_users: typeof a.target_users === 'string' ? JSON.parse(a.target_users || '[]') : (a.target_users || [])
                })));
            } catch (err) {
                console.error('Erro ao carregar alertas:', err);
            }

            // Carregar histórico de transações se for ferramenta geral
            if (ativo.requires_calibration === 0 || ativo.requires_calibration === false) {
                try {
                    setLoadingTransactions(true);
                    const resTransactions = await api.get(`/sgq/assets/${ativo.id}/transactions`);
                    setAssetTransactions(resTransactions.data);
                } catch (err) {
                    console.error('Erro ao carregar transações:', err);
                } finally {
                    setLoadingTransactions(false);
                }
            } else {
                setAssetTransactions([]);
            }
        } else {
            setFormData({
                id: null,
                patrimonio: '',
                name: '',
                model: '',
                serial_number: '',
                status: 'available',
                calibration_validity: '',
                requires_calibration: true,
                stock_quantity: 1
            });
            setIsBulk(false);
            setQuantity(1);
            setAlerts([]);
            setAssetTransactions([]);
            setIsModalOpen(true);
        }
    };

    const handleApplyAlertsToAll = async () => {
        if (!window.confirm('Tem certeza que deseja aplicar essas regras de alerta a TODOS os ativos do sistema? Isso substituirá as regras atuais deles.')) return;
        
        try {
            const loadingToast = toast.loading('Aplicando alertas em lote...');
            await api.post('/sgq/assets/alerts/apply-all', { alerts });
            toast.dismiss(loadingToast);
            toast.success('Regras aplicadas a todos os ativos com sucesso!');
        } catch (error) {
            console.error('Erro ao aplicar alertas:', error);
            toast.error(error.response?.data?.error || 'Erro ao aplicar regras de alerta.');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const payload = {
                patrimonio: formData.patrimonio,
                name: formData.name,
                model: formData.model,
                serial_number: formData.serial_number,
                status: formData.status,
                calibration_validity: formData.calibration_validity || null,
                requires_calibration: formData.requires_calibration,
                stock_quantity: formData.stock_quantity,
                alerts: formData.calibration_validity ? alerts : [] 
            };

            let savedAssetId = formData.id;

            if (formData.id) {
                await api.put(`/sgq/assets/${formData.id}`, payload);
            } else if (isBulk && quantity > 1) {
                await api.post('/sgq/assets/bulk', {
                    masterAsset: payload,
                    quantity: parseInt(quantity, 10)
                });
                // In bulk mode, we skip attachments for now as it would duplicate them N times unnecessarily
            } else {
                const res = await api.post('/sgq/assets', payload);
                savedAssetId = res.data.id;
            }

            // Fazer upload dos anexos se houver e não for bulk
            if (savedAssetId && !isBulk && (newAttachments.photos.length > 0 || newAttachments.pdfs.length > 0)) {
                const uploadData = new FormData();
                if (mainPhotoName) {
                    uploadData.append('mainPhotoName', mainPhotoName);
                }
                newAttachments.photos.forEach(f => uploadData.append('photos', f));
                newAttachments.pdfs.forEach(f => uploadData.append('pdfs', f));

                await api.post(`/sgq/assets/${savedAssetId}/attachments`, uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            if (err.response?.data?.error) {
                alert(err.response.data.error);
            } else {
                alert("Erro ao salvar ativo(s).");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSetMainPhoto = async (attachmentId) => {
        try {
            await api.put(`/sgq/assets/attachments/${attachmentId}/main`);
            setExistingAttachments(prev => prev.map(a => {
                if (a.file_type === 'photo') {
                    return { ...a, is_main: a.id === attachmentId };
                }
                return a;
            }));
            setMainPhotoName(null); // Clear new main photo selection since we selected an existing one
        } catch (err) {
            console.error(err);
            alert("Erro ao definir foto principal.");
        }
    };

    const handleDeleteAttachment = async (attachmentId) => {
        if (window.confirm("Remover este anexo permanentemente?")) {
            try {
                await api.delete(`/sgq/assets/attachments/${attachmentId}`);
                setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
            } catch (err) {
                console.error(err);
                alert("Erro ao remover anexo.");
            }
        }
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Tem certeza que deseja excluir o ativo "${name}"?`)) {
            try {
                await api.delete(`/sgq/assets/${id}`);
                loadData();
            } catch (err) {
                console.error(err);
                alert("Erro ao excluir ativo.");
            }
        }
    };

    const handleTransaction = async (id, type, amount = 1) => {
        try {
            await api.post(`/sgq/assets/${id}/transaction`, { type, quantity: amount });
            loadData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || "Erro ao atualizar estoque.");
        }
    };

    const handleFileUploadClick = (id) => {
        setUploadingId(id);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadingId) return;

        const formDataData = new FormData();
        formDataData.append('certificate', file);

        try {
            setLoading(true);
            await api.post(`/sgq/assets/calibrations/upload/${uploadingId}`, formDataData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Certificado anexado com sucesso!');
            loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao realizar upload do certificado.');
        } finally {
            setUploadingId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-700';
            case 'in_use': return 'bg-blue-100 text-blue-700';
            case 'calibration': return 'bg-orange-100 text-orange-700';
            case 'pending_certificate': return 'bg-yellow-100 text-yellow-700';
            case 'maintenance': return 'bg-red-100 text-red-700';
            case 'discarded': return 'bg-slate-200 text-slate-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'available': return 'Disponível';
            case 'in_use': return 'Em Uso';
            case 'calibration': return 'Em Calibração';
            case 'pending_certificate': return 'Pendente Certificado';
            case 'maintenance': return 'Em Manutenção';
            case 'discarded': return 'Descartado';
            default: return status;
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

    const filteredAtivos = ativos.filter(a => {
        const matchesSearch = (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.patrimonio && a.patrimonio.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
        
        const matchesColPatrimonio = !columnFilters.patrimonio || (a.patrimonio && a.patrimonio.toLowerCase().includes(columnFilters.patrimonio.toLowerCase()));
        const matchesColName = !columnFilters.name || (a.name && a.name.toLowerCase().includes(columnFilters.name.toLowerCase()));
        const matchesColModel = !columnFilters.model || ((a.model || '').toLowerCase().includes(columnFilters.model.toLowerCase()) || (a.serial_number || '').toLowerCase().includes(columnFilters.model.toLowerCase()));
        
        const labelStatus = a.requires_calibration === 0 || a.requires_calibration === false ? `Estoque: ${a.stock_quantity}` : getStatusLabel(a.status);
        const matchesColStatus = !columnFilters.status || (labelStatus.toLowerCase().includes(columnFilters.status.toLowerCase()));
        
        const validadeStr = a.calibration_validity ? new Date(a.calibration_validity).toLocaleDateString('pt-BR') : '-';
        const matchesColValidade = !columnFilters.validade || (validadeStr.toLowerCase().includes(columnFilters.validade.toLowerCase()));

        return matchesSearch && matchesStatus && matchesColPatrimonio && matchesColName && matchesColModel && matchesColStatus && matchesColValidade;
    });

    const sortedAtivos = [...filteredAtivos.filter(a => a.calibration_validity)].sort((a, b) => {
        const dateA = new Date(a.calibration_validity);
        const dateB = new Date(b.calibration_validity);
        return dateA - dateB;
    });

    const filteredHistorico = historico.filter(h => {
        const asset = ativos.find(a => a.id === h.asset_id);
        const matchesSearch = !searchTerm || (asset && ((asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) || (asset.patrimonio && asset.patrimonio.toLowerCase().includes(searchTerm.toLowerCase()))));
        
        const dataUpload = h.date_returned ? new Date(h.date_returned).toLocaleDateString('pt-BR') : '';
        const matchesUpload = !columnFilters.validade || dataUpload.includes(columnFilters.validade);
        
        const patrimonioStr = asset ? `[${asset.patrimonio || ''}] ${asset.name || ''}`.toLowerCase() : '';
        const matchesPatrimonio = !columnFilters.patrimonio || patrimonioStr.includes(columnFilters.patrimonio.toLowerCase());
        
        const matchesCertificado = !columnFilters.certificado || (h.certificate_number && h.certificate_number.toLowerCase().includes(columnFilters.certificado.toLowerCase()));

        return matchesSearch && matchesUpload && matchesPatrimonio && matchesCertificado;
    });

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        // Header
        if (metalfisaLogoBase64) {
            doc.addImage(metalfisaLogoBase64, 'PNG', 14, 10, 40, 15);
        }
        
        doc.setFontSize(16);
        doc.setTextColor(40);
        
        let title = 'Relatório de Ativos SGQ';
        if (globalTab === 'calibracoes') title = 'Vencimentos e Alertas de Calibração SGQ';
        if (globalTab === 'historico') title = 'Histórico de Calibrações SGQ';
        
        doc.text(title, 60, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 60, 26);
        
        let filterText = "Filtros: ";
        if (searchTerm) filterText += `Busca: "${searchTerm}" | `;
        filterText += `Status: ${statusFilter === 'all' ? 'Todos' : statusFilter}`;
        doc.text(filterText, 14, 35);

        let tableColumn = [];
        let tableRows = [];

        if (globalTab === 'ativos') {
            tableColumn = ["Patrimônio", "Equipamento", "Modelo", "Nº Série", "Calibração", "Vencimento", "Status", "Estoque"];
            tableRows = filteredAtivos.map(a => [
                a.patrimonio || '-',
                a.name || '-',
                a.model || '-',
                a.serial_number || '-',
                a.requires_calibration ? 'Sim' : 'Não',
                a.calibration_validity ? new Date(a.calibration_validity).toLocaleDateString('pt-BR') : '-',
                a.status === 'available' ? 'Em Uso' : a.status === 'maintenance' ? 'Manutenção' : a.status === 'calibration' ? 'Calibração' : 'Inativo',
                a.stock_quantity || 1
            ]);
        } else if (globalTab === 'calibracoes') {
            tableColumn = ["Patrimônio", "Equipamento", "Modelo", "Vencimento", "Dias p/ Vencer", "Status"];
            tableRows = sortedAtivos.map(a => {
                const isValid = a.calibration_validity ? new Date(a.calibration_validity) >= new Date() : false;
                const daysToExpire = a.calibration_validity ? Math.ceil((new Date(a.calibration_validity) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                return [
                    a.patrimonio || '-',
                    a.name || '-',
                    a.model || '-',
                    a.calibration_validity ? new Date(a.calibration_validity).toLocaleDateString('pt-BR') : '-',
                    daysToExpire,
                    isValid ? 'OK' : 'Vencido'
                ];
            });
        } else if (globalTab === 'historico') {
            tableColumn = ["Ativo", "Data Calib.", "Próx. Vencimento", "Certificado", "Avaliador"];
            
            let filteredHist = historico;
            if (searchTerm) {
                filteredHist = historico.filter(h => {
                    const asset = ativos.find(a => a.id === h.asset_id);
                    return asset && (
                        (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (asset.patrimonio && asset.patrimonio.toLowerCase().includes(searchTerm.toLowerCase()))
                    );
                });
            }

            tableRows = filteredHist.map(h => {
                const asset = ativos.find(a => a.id === h.asset_id);
                return [
                    asset ? `[${asset.patrimonio}] ${asset.name}` : '-',
                    h.calibration_date ? new Date(h.calibration_date).toLocaleDateString('pt-BR') : '-',
                    h.next_due_date ? new Date(h.next_due_date).toLocaleDateString('pt-BR') : '-',
                    h.certificate_number || '-',
                    h.evaluator_name || '-'
                ];
            });
        }

        autoTable(doc, {
            startY: 40,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
            styles: { fontSize: 8 }
        });

        doc.save(`SGQ_Relatorio_${globalTab}_${new Date().getTime()}.pdf`);
    };

    const handleExportExcel = () => {
        let tableColumn = [];
        let tableRows = [];

        if (globalTab === 'ativos') {
            tableColumn = ["Patrimônio", "Equipamento", "Modelo", "Nº Série", "Exige Calibração", "Vencimento", "Status", "Qtd Estoque"];
            tableRows = filteredAtivos.map(a => [
                a.patrimonio || '-',
                a.name || '-',
                a.model || '-',
                a.serial_number || '-',
                a.requires_calibration ? 'Sim' : 'Não',
                a.calibration_validity ? new Date(a.calibration_validity).toLocaleDateString('pt-BR') : '-',
                a.status === 'available' ? 'Em Uso' : a.status === 'maintenance' ? 'Manutenção' : a.status === 'calibration' ? 'Calibração' : 'Inativo',
                a.stock_quantity || 1
            ]);
        } else if (globalTab === 'calibracoes') {
            tableColumn = ["Patrimônio", "Equipamento", "Modelo", "Vencimento", "Dias p/ Vencer", "Status"];
            tableRows = sortedAtivos.map(a => {
                const isValid = a.calibration_validity ? new Date(a.calibration_validity) >= new Date() : false;
                const daysToExpire = a.calibration_validity ? Math.ceil((new Date(a.calibration_validity) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                return [
                    a.patrimonio || '-',
                    a.name || '-',
                    a.model || '-',
                    a.calibration_validity ? new Date(a.calibration_validity).toLocaleDateString('pt-BR') : '-',
                    daysToExpire,
                    isValid ? 'OK' : 'Vencido'
                ];
            });
        } else if (globalTab === 'historico') {
            tableColumn = ["Ativo", "Data Calibração", "Próx. Vencimento", "Nº Certificado", "Avaliador", "Observações"];
            
            let filteredHist = historico;
            if (searchTerm) {
                filteredHist = historico.filter(h => {
                    const asset = ativos.find(a => a.id === h.asset_id);
                    return asset && (
                        (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (asset.patrimonio && asset.patrimonio.toLowerCase().includes(searchTerm.toLowerCase()))
                    );
                });
            }

            tableRows = filteredHist.map(h => {
                const asset = ativos.find(a => a.id === h.asset_id);
                return [
                    asset ? `[${asset.patrimonio}] ${asset.name}` : '-',
                    h.calibration_date ? new Date(h.calibration_date).toLocaleDateString('pt-BR') : '-',
                    h.next_due_date ? new Date(h.next_due_date).toLocaleDateString('pt-BR') : '-',
                    h.certificate_number || '-',
                    h.evaluator_name || '-',
                    h.notes || '-'
                ];
            });
        }

        const wsData = [tableColumn, ...tableRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `SGQ_Relatorio_${globalTab}_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <Wrench className="w-6 h-6 text-indigo-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Ativos & Calibração</h1>
                        <p className="text-sm text-slate-500">Controle de equipamentos de medição, ferramentas e seus certificados</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} /> Novo Ativo
                </button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setGlobalTab('ativos')}
                    className={`pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${globalTab === 'ativos' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Wrench size={18} /> Inventário Geral
                </button>
                <button 
                    onClick={() => setGlobalTab('calibracoes')}
                    className={`pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${globalTab === 'calibracoes' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Calendar size={18} /> Vencimentos e Alertas
                </button>
                <button 
                    onClick={() => setGlobalTab('historico')}
                    className={`pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${globalTab === 'historico' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText size={18} /> Histórico de Calibrações
                </button>
            </div>

            {globalTab === 'ativos' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, patrimônio ou serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 bg-white"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="available">Disponível</option>
                            <option value="in_use">Em Uso</option>
                            <option value="calibration">Em Calibração</option>
                            <option value="pending_certificate">Pendente Certificado</option>
                            <option value="maintenance">Em Manutenção</option>
                            <option value="discarded">Descartado</option>
                        </select>
                    </div>
                    <div className="flex gap-2 items-center w-full sm:w-auto">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
                            title="Exportar para Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                            title="Exportar para PDF"
                        >
                            <FileText className="w-4 h-4" /> PDF
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                    <table className="w-full text-left text-sm text-slate-600 relative">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider">
                                    Patrimônio
                                    <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.patrimonio} onChange={e => setColumnFilters({...columnFilters, patrimonio: e.target.value})} />
                                </th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center w-16 align-top">Foto</th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider">
                                    Descrição / Nome
                                    <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.name} onChange={e => setColumnFilters({...columnFilters, name: e.target.value})} />
                                </th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider">
                                    Modelo / Serial
                                    <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.model} onChange={e => setColumnFilters({...columnFilters, model: e.target.value})} />
                                </th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center align-top">
                                    Status
                                    <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.status} onChange={e => setColumnFilters({...columnFilters, status: e.target.value})} />
                                </th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center align-top">
                                    Validade Calibração
                                    <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.validade} onChange={e => setColumnFilters({...columnFilters, validade: e.target.value})} />
                                </th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider text-right align-top w-20">Ações</th>
                                <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center align-top w-16">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAtivos.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-12 text-center text-slate-500">
                                        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="font-medium text-lg text-slate-700">Nenhum ativo encontrado.</p>
                                        <p className="text-sm">Cadastre um novo ativo para visualizar aqui.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAtivos.map(a => (
                                    <tr 
                                        key={a.id} 
                                        onClick={() => setSelectedRow(a.id)}
                                        className={`transition-colors cursor-pointer ${selectedRow === a.id ? 'bg-indigo-50/80 shadow-sm ring-1 ring-indigo-200' : 'hover:bg-slate-50/80'}`}
                                    >
                                        <td className="p-4">
                                            {a.patrimonio ? (
                                                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 font-bold">
                                                    {a.patrimonio}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {a.main_photo_id ? (
                                                <img 
                                                    src={`/api/sgq/assets/attachments/${a.main_photo_id}/download?token=${localStorage.getItem('@MetalFisa:token')}`} 
                                                    alt={a.name} 
                                                    className="w-10 h-10 object-cover rounded-md border border-slate-200 shadow-sm mx-auto cursor-pointer hover:scale-110 transition-transform"
                                                    onClick={() => window.open(`/api/sgq/assets/attachments/${a.main_photo_id}/download?token=${localStorage.getItem('@MetalFisa:token')}`, '_blank')}
                                                    title="Clique para ampliar"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center border border-slate-200 mx-auto" title="Sem foto">
                                                    <Camera className="w-4 h-4 text-slate-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">{a.name}</td>
                                        <td className="p-4">
                                            <div className="text-xs font-medium text-slate-700">{a.model || '-'}</div>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">{a.serial_number ? `S/N: ${a.serial_number}` : ''}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {a.requires_calibration === 0 || a.requires_calibration === false ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded">Estoque: {a.stock_quantity}</span>
                                                    <div className="flex flex-col gap-0.5">
                                                        <button onClick={() => handleTransaction(a.id, 'entrada', 1)} className="bg-green-100 hover:bg-green-200 text-green-700 p-0.5 rounded" title="Entrada (+1)"><Plus size={12} /></button>
                                                        <button onClick={() => handleTransaction(a.id, 'baixa', 1)} className="bg-red-100 hover:bg-red-200 text-red-700 p-0.5 rounded" title="Baixa (-1)"><Minus size={12} /></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center ${getStatusStyle(a.status)}`}>
                                                    {getStatusLabel(a.status)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {a.calibration_validity && a.requires_calibration ? (
                                                <span className={`text-sm font-medium ${new Date(a.calibration_validity) < new Date() ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                    {new Date(a.calibration_validity).toLocaleDateString('pt-BR')}
                                                    {new Date(a.calibration_validity) < new Date() && ' (Vencida)'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">Não exige</span>
                                            )}
                                        </td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            {a.status === 'pending_certificate' && (
                                                <button 
                                                    onClick={() => handleFileUploadClick(a.id)}
                                                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-1.5 rounded transition-colors"
                                                    title="Anexar Certificado"
                                                >
                                                    <Upload size={14} /> Certificado
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleOpenModal(a)}
                                                className="text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 shadow-sm hover:border-indigo-300 p-1.5 rounded transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(a.id, a.name)}
                                                className="text-slate-500 hover:text-red-600 bg-white border border-slate-200 shadow-sm hover:border-red-300 p-1.5 rounded transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                        <td className="p-4 text-center">
                                            {(() => {
                                                if (a.requires_calibration === 0 || a.requires_calibration === false) {
                                                    return <span className="text-xs text-slate-300">-</span>;
                                                }
                                                const latestCal = historico.find(h => h.asset_id === a.id);
                                                if (latestCal && latestCal.certificate_url) {
                                                    return (
                                                        <a 
                                                            href={latestCal.certificate_url} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="inline-flex flex-col items-center justify-center text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 p-2 rounded-lg border border-red-100"
                                                            title="Ver Certificado de Calibração"
                                                        >
                                                            <FileText size={18} className="mb-0.5" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">PDF</span>
                                                        </a>
                                                    );
                                                }
                                                return <span className="text-xs text-slate-400 font-medium">Nenhum</span>;
                                            })()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {globalTab === 'calibracoes' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar instrumento por nome ou patrimônio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-2 items-center w-full sm:w-auto">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
                                title="Exportar para Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                                title="Exportar para PDF"
                            >
                                <FileText className="w-4 h-4" /> PDF
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm text-slate-600 relative">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">
                                        Patrimônio
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.patrimonio} onChange={e => setColumnFilters({...columnFilters, patrimonio: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center w-16 align-top">Foto</th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider">
                                        Instrumento
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.name} onChange={e => setColumnFilters({...columnFilters, name: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider align-top">
                                        Data Vencimento
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.validade} onChange={e => setColumnFilters({...columnFilters, validade: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider text-center align-top">
                                        Status
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.status} onChange={e => setColumnFilters({...columnFilters, status: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider text-right align-top w-20">Ações</th>
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
                                                <td className="p-4 text-center">
                                                    {a.main_photo_id ? (
                                                        <img 
                                                            src={`/api/sgq/assets/attachments/${a.main_photo_id}/download?token=${localStorage.getItem('@MetalFisa:token')}`} 
                                                            alt={a.name} 
                                                            className="w-10 h-10 object-cover rounded-md border border-slate-200 shadow-sm mx-auto cursor-pointer hover:scale-110 transition-transform"
                                                            onClick={() => window.open(`/api/sgq/assets/attachments/${a.main_photo_id}/download?token=${localStorage.getItem('@MetalFisa:token')}`, '_blank')}
                                                            title="Clique para ampliar"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center border border-slate-200 mx-auto" title="Sem foto">
                                                            <Camera className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                    )}
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

            {globalTab === 'historico' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar histórico por nome ou patrimônio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-2 items-center w-full sm:w-auto">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
                                title="Exportar para Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                                title="Exportar para PDF"
                            >
                                <FileText className="w-4 h-4" /> PDF
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm text-slate-600 relative">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider align-top">
                                        Data do Upload
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.validade} onChange={e => setColumnFilters({...columnFilters, validade: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider align-top">
                                        Patrimônio / Instrumento
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.patrimonio} onChange={e => setColumnFilters({...columnFilters, patrimonio: e.target.value})} />
                                    </th>
                                    <th className="p-4 font-semibold uppercase text-xs tracking-wider align-top">
                                        Certificado
                                        <input type="text" placeholder="Filtrar..." className="block mt-1 w-full p-1 text-xs font-normal border border-slate-300 rounded" value={columnFilters.certificado} onChange={e => setColumnFilters({...columnFilters, certificado: e.target.value})} />
                                    </th>
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
                                ) : filteredHistorico.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="p-12 text-center text-slate-500">
                                            <p className="font-medium text-lg text-slate-700">Nenhum histórico de calibração encontrado.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHistorico.map(h => {
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

            {/* Modal CRUD */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-indigo-600" />
                                {formData.id ? 'Editar Ativo' : 'Cadastrar Novo Ativo'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white p-1 rounded-full shadow-sm border border-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="ativo-form" onSubmit={handleSave} className="space-y-5">
                                
                                {!formData.id && (
                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-indigo-800">
                                            <Copy className="w-4 h-4" />
                                            <span className="text-sm font-medium">Clonar Vários Ativos?</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={isBulk} onChange={(e) => setIsBulk(e.target.checked)} />
                                                <div className="w-9 h-5 bg-indigo-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {isBulk && (
                                    <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <label className="text-sm font-bold text-yellow-800">Quantidade a gerar:</label>
                                        <input 
                                            type="number" 
                                            min="2" 
                                            max="100" 
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                            className="w-20 border border-yellow-300 rounded p-1.5 focus:ring-2 focus:ring-yellow-500 font-bold"
                                        />
                                        <span className="text-xs text-yellow-700 ml-2">Sufixos (-1, -2, etc) serão adicionados ao Patrimônio e Serial.</span>
                                    </div>
                                )}

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Rastreabilidade e Calibração</h4>
                                        <p className="text-xs text-slate-500">Desative para ferramentas gerais controladas apenas por saldo de estoque.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={formData.requires_calibration} 
                                            onChange={(e) => setFormData({...formData, requires_calibration: e.target.checked})} 
                                            disabled={!!formData.id}
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome / Descrição *</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ex: Trena Digital 5m"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {formData.requires_calibration ? (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Patrimônio</label>
                                            <input 
                                                type="text" 
                                                value={formData.patrimonio}
                                                onChange={e => setFormData({...formData, patrimonio: e.target.value.toUpperCase()})}
                                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                                placeholder="Ex: MTL-1029"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Quantidade em Estoque</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={formData.stock_quantity}
                                                onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value, 10) || 0})}
                                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                                disabled={!!formData.id}
                                                title={formData.id ? "Ajuste o saldo pelos botões + e - na tela principal" : ""}
                                            />
                                            {formData.id && <p className="text-xs text-slate-500 mt-1">O saldo deve ser ajustado pelos botões de + e - na tabela principal para gerar histórico.</p>}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                        <select 
                                            value={formData.status}
                                            onChange={e => setFormData({...formData, status: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                        >
                                            <option value="available">Disponível</option>
                                            <option value="in_use">Em Uso</option>
                                            <option value="calibration">Em Calibração</option>
                                            <option value="pending_certificate">Pendente Certificado</option>
                                            <option value="maintenance">Em Manutenção</option>
                                            <option value="discarded">Descartado</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Modelo</label>
                                        <input 
                                            type="text" 
                                            value={formData.model}
                                            onChange={e => setFormData({...formData, model: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: Bosch GLM 50 / Stanley"
                                        />
                                    </div>
                                    {formData.requires_calibration && (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Número de Série</label>
                                            <input 
                                                type="text" 
                                                value={formData.serial_number}
                                                onChange={e => setFormData({...formData, serial_number: e.target.value})}
                                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                            />
                                        </div>
                                    )}
                                </div>

                                {formData.requires_calibration && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Validade da Calibração (Opcional)</label>
                                        <input 
                                            type="date" 
                                            value={formData.calibration_validity}
                                            onChange={e => setFormData({...formData, calibration_validity: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Preencha apenas para instrumentos de medição que requerem calibração.</p>
                                    </div>
                                )}

                                {/* Sessão de Alertas Inteligentes (só mostra se houver validade) */}
                                {formData.requires_calibration && formData.calibration_validity && (
                                    <div className="border-t border-slate-200 pt-4 mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-md font-bold text-indigo-900 flex items-center gap-2">
                                                <Bell className="w-5 h-5 text-indigo-600" />
                                                Alertas Automáticos de Vencimento
                                            </h3>
                                            {alerts.length < 3 && (
                                                <div className="flex items-center gap-2">
                                                    {alerts.length > 0 && (
                                                        <button 
                                                            type="button"
                                                            onClick={handleApplyAlertsToAll}
                                                            className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors flex items-center gap-1"
                                                            title="Aplica exatamente estas regras a todos os equipamentos do sistema."
                                                        >
                                                            Aplicar a Todos
                                                        </button>
                                                    )}
                                                    <button 
                                                        type="button"
                                                        onClick={() => setAlerts([...alerts, { days_before: 30, notify_email: true, notify_whatsapp: false, target_users: [] }])}
                                                        className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <Plus size={14} /> Novo Alerta
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {alerts.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic">Nenhum alerta configurado. O sistema não avisará sobre o vencimento.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {alerts.map((al, idx) => (
                                                    <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm relative">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setAlerts(alerts.filter((_, i) => i !== idx))}
                                                            className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                        <div className="flex flex-wrap items-center gap-4 mb-2 pr-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-700">Avisar</span>
                                                                <input 
                                                                    type="number" 
                                                                    min="1" 
                                                                    max="365" 
                                                                    value={al.days_before}
                                                                    onChange={e => {
                                                                        const newAlerts = [...alerts];
                                                                        newAlerts[idx].days_before = parseInt(e.target.value) || 0;
                                                                        setAlerts(newAlerts);
                                                                    }}
                                                                    className="w-16 border border-slate-300 rounded p-1 text-center font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                />
                                                                <span className="text-sm font-bold text-slate-700">dias antes</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
                                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={al.notify_email}
                                                                        onChange={e => {
                                                                            const newAlerts = [...alerts];
                                                                            newAlerts[idx].notify_email = e.target.checked;
                                                                            setAlerts(newAlerts);
                                                                        }}
                                                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                                    />
                                                                    <Mail size={16} className={al.notify_email ? 'text-indigo-600' : 'text-slate-400'} />
                                                                    <span className={`text-sm ${al.notify_email ? 'font-medium text-slate-700' : 'text-slate-500'}`}>E-mail</span>
                                                                </label>
                                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={al.notify_whatsapp}
                                                                        onChange={e => {
                                                                            const newAlerts = [...alerts];
                                                                            newAlerts[idx].notify_whatsapp = e.target.checked;
                                                                            setAlerts(newAlerts);
                                                                        }}
                                                                        className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                                                                    />
                                                                    <MessageSquare size={16} className={al.notify_whatsapp ? 'text-green-500' : 'text-slate-400'} />
                                                                    <span className={`text-sm ${al.notify_whatsapp ? 'font-medium text-slate-700' : 'text-slate-500'}`}>WhatsApp</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2">
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Destinatários do Alerta:</label>
                                                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                                                {users.map(u => (
                                                                    <label key={u.idUsuario} className="flex items-center gap-1.5 bg-white px-2 py-1 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                                                                        <input 
                                                                            type="checkbox"
                                                                            checked={al.target_users.includes(u.idUsuario)}
                                                                            onChange={e => {
                                                                                const newAlerts = [...alerts];
                                                                                if (e.target.checked) {
                                                                                    newAlerts[idx].target_users.push(u.idUsuario);
                                                                                } else {
                                                                                    newAlerts[idx].target_users = newAlerts[idx].target_users.filter(id => id !== u.idUsuario);
                                                                                }
                                                                                setAlerts(newAlerts);
                                                                            }}
                                                                            className="rounded text-indigo-600 w-3.5 h-3.5"
                                                                        />
                                                                        <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]" title={u.NomeCompleto}>{u.NomeCompleto.split(' ')[0]} {u.NomeCompleto.split(' ')[1] || ''}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Sessão de Anexos */}
                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        Anexos do Equipamento
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {/* Upload de Fotos / Camera */}
                                        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-slate-700 mb-1">Fotos do Equipamento</p>
                                            <p className="text-xs text-slate-500 mb-3">Máx: 5 fotos</p>
                                            <label className="cursor-pointer bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors inline-block">
                                                Tirar Foto ou Escolher
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*" 
                                                    capture="environment" 
                                                    multiple
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files);
                                                        const currentCount = newAttachments.photos.length + existingAttachments.filter(a => a.file_type === 'photo').length;
                                                        if (currentCount + files.length > 5) {
                                                            alert('Limite máximo de 5 fotos atingido.');
                                                            return;
                                                        }
                                                        setNewAttachments(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                                                    }}
                                                />
                                            </label>
                                            
                                            {/* Listar novas fotos selecionadas */}
                                            {newAttachments.photos.length > 0 && (
                                                <div className="mt-3 text-left">
                                                    <p className="text-xs font-bold text-indigo-600 mb-1">Novas fotos a enviar:</p>
                                                    <ul className="text-xs text-slate-600 space-y-1">
                                                        {newAttachments.photos.map((f, i) => (
                                                            <li key={i} className="flex items-center justify-between bg-white px-2 py-1 border border-slate-200 rounded">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setMainPhotoName(f.name)}
                                                                        className={`p-1 transition-colors ${mainPhotoName === f.name ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}
                                                                        title="Definir como foto principal"
                                                                    >
                                                                        <Star size={14} fill={mainPhotoName === f.name ? 'currentColor' : 'none'} />
                                                                    </button>
                                                                    <span className="truncate max-w-[100px]" title={f.name}>{f.name}</span>
                                                                </div>
                                                                <button type="button" onClick={() => {
                                                                    setNewAttachments(prev => ({...prev, photos: prev.photos.filter((_, idx) => idx !== i)}));
                                                                    if (mainPhotoName === f.name) setMainPhotoName(null);
                                                                }} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Upload de PDFs */}
                                        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-slate-700 mb-1">Manuais / PDFs</p>
                                            <p className="text-xs text-slate-500 mb-3">Máx: 10 arquivos</p>
                                            <label className="cursor-pointer bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors inline-block">
                                                Selecionar PDFs
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="application/pdf" 
                                                    multiple
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files);
                                                        const currentCount = newAttachments.pdfs.length + existingAttachments.filter(a => a.file_type === 'pdf').length;
                                                        if (currentCount + files.length > 10) {
                                                            alert('Limite máximo de 10 PDFs atingido.');
                                                            return;
                                                        }
                                                        setNewAttachments(prev => ({ ...prev, pdfs: [...prev.pdfs, ...files] }));
                                                    }}
                                                />
                                            </label>

                                            {/* Listar novos PDFs selecionados */}
                                            {newAttachments.pdfs.length > 0 && (
                                                <div className="mt-3 text-left">
                                                    <p className="text-xs font-bold text-indigo-600 mb-1">Novos PDFs a enviar:</p>
                                                    <ul className="text-xs text-slate-600 space-y-1">
                                                        {newAttachments.pdfs.map((f, i) => (
                                                            <li key={i} className="flex items-center justify-between bg-white px-2 py-1 border border-slate-200 rounded">
                                                                <span className="truncate max-w-[120px]">{f.name}</span>
                                                                <button type="button" onClick={() => setNewAttachments(prev => ({...prev, pdfs: prev.pdfs.filter((_, idx) => idx !== i)}))} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mostrar Anexos Existentes (edição) */}
                                    {formData.id && (
                                        <div>
                                            {loadingAttachments ? (
                                                <p className="text-sm text-slate-500 text-center py-2">Carregando anexos salvos...</p>
                                            ) : existingAttachments.length > 0 ? (
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700 mb-2">Arquivos já salvos:</p>
                                                    <ul className="space-y-2">
                                                        {existingAttachments.map(a => (
                                                            <li key={a.id} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    {a.file_type === 'photo' ? (
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => handleSetMainPhoto(a.id)}
                                                                            className={`flex-shrink-0 transition-colors ${a.is_main && !mainPhotoName ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}
                                                                            title="Definir como foto principal"
                                                                        >
                                                                            <Star size={16} fill={a.is_main && !mainPhotoName ? 'currentColor' : 'none'} />
                                                                        </button>
                                                                    ) : (
                                                                        <FileText className="w-4 h-4 text-orange-500 flex-shrink-0"/>
                                                                    )}
                                                                    <span className="text-sm text-slate-700 truncate" title={a.original_name}>{a.original_name}</span>
                                                                    {a.is_main && !mainPhotoName && a.file_type === 'photo' && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">Principal</span>}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <a href={`/api/sgq/assets/attachments/${a.id}/download?token=${localStorage.getItem('@MetalFisa:token')}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 p-1" title="Download">
                                                                        <Download size={16} />
                                                                    </a>
                                                                    <button type="button" onClick={() => handleDeleteAttachment(a.id)} className="text-red-500 hover:text-red-700 p-1" title="Remover">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500 text-center py-2 bg-slate-50 rounded-lg border border-slate-200">Nenhum anexo salvo para este equipamento.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Mostrar Histórico de Movimentações para itens não calibráveis */}
                                {formData.id && !formData.requires_calibration && (
                                    <div className="border-t border-slate-200 pt-4 mt-4">
                                        <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            Histórico de Movimentações (Estoque)
                                        </h3>
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-sm text-slate-600">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-2 font-semibold">Data</th>
                                                        <th className="p-2 font-semibold">Tipo</th>
                                                        <th className="p-2 font-semibold text-center">Quantidade</th>
                                                        <th className="p-2 font-semibold">Usuário</th>
                                                        <th className="p-2 font-semibold">Detalhes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {loadingTransactions ? (
                                                        <tr>
                                                            <td colSpan="5" className="p-4 text-center text-slate-500">Carregando...</td>
                                                        </tr>
                                                    ) : assetTransactions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="p-4 text-center text-slate-500">Nenhuma movimentação registrada.</td>
                                                        </tr>
                                                    ) : (
                                                        assetTransactions.map(tx => (
                                                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="p-2">{new Date(tx.created_at).toLocaleString('pt-BR')}</td>
                                                                <td className="p-2">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                        tx.type === 'entrada' ? 'bg-green-100 text-green-700' :
                                                                        tx.type === 'baixa' ? 'bg-red-100 text-red-700' :
                                                                        tx.type === 'caixa_adicionar' ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-orange-100 text-orange-700'
                                                                    }`}>
                                                                        {tx.type === 'entrada' ? 'Entrada (+)' :
                                                                         tx.type === 'baixa' ? 'Baixa (-)' :
                                                                         tx.type === 'caixa_adicionar' ? 'Atribuição (Caixa)' :
                                                                         'Devolução (Caixa)'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 text-center font-bold">
                                                                    {['baixa', 'caixa_adicionar'].includes(tx.type) ? '-' : '+'}{tx.quantity}
                                                                </td>
                                                                <td className="p-2">{tx.user_name || 'Sistema'}</td>
                                                                <td className="p-2 text-xs text-slate-500">{tx.notes || '-'}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                            </form>
                        </div>
                        
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="ativo-form"
                                disabled={saving}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                {saving ? 'Aguarde...' : (
                                    <>
                                        {isBulk ? <Copy size={18} /> : <Save size={18} />} 
                                        {isBulk ? `Clonar ${quantity} Ativos` : 'Salvar Ativo'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
