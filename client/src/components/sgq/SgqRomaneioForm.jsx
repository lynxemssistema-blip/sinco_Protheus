import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Printer, Search, CheckCircle, Mail, FileUp } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';
import RomaneioPrintSGQ from './RomaneioPrintSGQ';

// To generate PDF for email
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const SgqRomaneioForm = ({ romaneioId, onBack, user }) => {
    const [step, setStep] = useState(1); // 1: Dados, 2: Itens
    const [loading, setLoading] = useState(false);
    
    // Header Data
    const [header, setHeader] = useState({
        id: null,
        data_envio: new Date().toISOString().split('T')[0],
        previsao_retorno: '',
        fornecedor_id: '',
        destinatario: '',
        observacao: '',
        status: 'aberto',
        email_enviado: 0
    });

    const [fornecedores, setFornecedores] = useState([]);
    const [showNewFornecedor, setShowNewFornecedor] = useState(false);
    const [newFornecedor, setNewFornecedor] = useState({ nome: '', email: '', telefone: '', contato: '' });

    // Items Data
    const [items, setItems] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState('');

    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Romaneio_SGQ_${header.id || ''}`
    });

    useEffect(() => {
        fetchFornecedores();
        if (romaneioId) {
            loadRomaneio(romaneioId);
        }
    }, [romaneioId]);

    useEffect(() => {
        if (step === 2) {
            fetchAvailableAssets();
        }
    }, [step]);

    const fetchFornecedores = async () => {
        try {
            const res = await api.get('/sgq/fornecedores');
            setFornecedores(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadRomaneio = async (id) => {
        try {
            setLoading(true);
            const res = await api.get(`/sgq/romaneios/${id}`);
            const data = res.data;
            setHeader({
                id: data.id,
                data_envio: data.data_envio ? data.data_envio.split('T')[0] : '',
                previsao_retorno: data.previsao_retorno ? data.previsao_retorno.split('T')[0] : '',
                fornecedor_id: data.fornecedor_id || '',
                destinatario: data.destinatario || '',
                observacao: data.observacao || '',
                status: data.status,
                email_enviado: data.email_enviado
            });
            setItems(data.items || []);
        } catch (err) {
            alert('Erro ao carregar romaneio');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableAssets = async () => {
        try {
            const res = await api.get('/sgq/assets');
            setAvailableAssets(res.data.filter(a => a.status === 'available'));
        } catch (err) {
            console.error(err);
        }
    };

    const saveHeader = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            let fornecedorId = header.fornecedor_id;
            let destinatario = header.destinatario;

            // Se for novo fornecedor, cadastra
            if (showNewFornecedor) {
                if (!newFornecedor.nome) return alert('Nome do fornecedor é obrigatório');
                const resForn = await api.post('/sgq/fornecedores', newFornecedor);
                fornecedorId = resForn.data.id;
                destinatario = resForn.data.nome;
                setFornecedores([...fornecedores, resForn.data]);
                setShowNewFornecedor(false);
            } else if (fornecedorId) {
                const f = fornecedores.find(x => x.id == fornecedorId);
                if (f) destinatario = f.nome;
            }

            const payload = {
                ...header,
                fornecedor_id: fornecedorId,
                destinatario,
                responsavel: user?.nome || 'Sistema'
            };

            if (header.id) {
                await api.put(`/sgq/romaneios/${header.id}`, payload);
                alert('Dados atualizados com sucesso!');
                setHeader(prev => ({ ...prev, fornecedor_id: fornecedorId, destinatario }));
            } else {
                const res = await api.post('/sgq/romaneios', payload);
                setHeader(prev => ({ ...prev, id: res.data.id, fornecedor_id: fornecedorId, destinatario }));
                alert('Romaneio criado com sucesso!');
            }
            setStep(2);
        } catch (err) {
            alert('Erro ao salvar dados');
        } finally {
            setLoading(false);
        }
    };

    const addItem = async () => {
        if (!selectedAsset) return alert('Selecione um ativo');
        try {
            setLoading(true);
            await api.post(`/sgq/romaneios/${header.id}/items`, { asset_ids: [selectedAsset] });
            setSelectedAsset('');
            loadRomaneio(header.id);
            fetchAvailableAssets();
        } catch (err) {
            alert('Erro ao adicionar item');
        } finally {
            setLoading(false);
        }
    };

    const removeItem = async (itemId) => {
        if (!window.confirm('Remover este item do romaneio?')) return;
        try {
            setLoading(true);
            await api.delete(`/sgq/romaneios/${header.id}/items/${itemId}`);
            loadRomaneio(header.id);
            fetchAvailableAssets();
        } catch (err) {
            alert('Erro ao remover item');
        } finally {
            setLoading(false);
        }
    };

    const markAsSent = async () => {
        if (items.length === 0) return alert('Adicione itens antes de enviar.');
        if (!window.confirm('Confirmar o envio deste romaneio?')) return;
        try {
            setLoading(true);
            await api.put(`/sgq/romaneios/${header.id}`, { ...header, status: 'enviado' });
            setHeader(prev => ({ ...prev, status: 'enviado' }));
            alert('Romaneio marcado como Enviado!');
        } catch (err) {
            alert('Erro ao enviar');
        } finally {
            setLoading(false);
        }
    };

    const [returnModal, setReturnModal] = useState(null); // { itemId, assetName }
    const [returnForm, setReturnForm] = useState({ validade_calibracao: '', file: null });

    const submitReturn = async (e) => {
        e.preventDefault();
        if (!returnForm.validade_calibracao) return alert('Informe a validade da calibração');
        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('validade_calibracao', returnForm.validade_calibracao);
            if (returnForm.file) formData.append('certificado', returnForm.file);

            await api.put(`/sgq/romaneios/${header.id}/items/${returnModal.itemId}/retorno`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Retorno registrado com sucesso!');
            setReturnModal(null);
            setReturnForm({ validade_calibracao: '', file: null });
            loadRomaneio(header.id);
        } catch (err) {
            alert('Erro ao registrar retorno');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        const forn = fornecedores.find(f => f.id == header.fornecedor_id);
        if (!forn || !forn.email) {
            return alert('O fornecedor selecionado não possui e-mail cadastrado.');
        }

        if (!window.confirm(`Enviar e-mail para ${forn.email}?`)) return;

        try {
            setLoading(true);
            
            // Gerar PDF na memória usando o div do print
            const element = printRef.current;
            element.style.display = 'block'; // Temporarily show
            
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            const pdfBlob = pdf.output('blob');
            element.style.display = 'none';

            const formData = new FormData();
            formData.append('pdf', pdfBlob, `Romaneio_${header.id}.pdf`);
            formData.append('email', forn.email);

            await api.post(`/sgq/romaneios/${header.id}/send-email`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('E-mail enviado com sucesso!');
            setHeader(prev => ({ ...prev, email_enviado: 1 }));
        } catch (err) {
            console.error(err);
            alert('Erro ao enviar e-mail');
            if (printRef.current) printRef.current.style.display = 'none';
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <button onClick={onBack} className="text-slate-600 hover:text-slate-800 flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Voltar
                </button>
                <div className="flex gap-2">
                    {header.id && (
                        <>
                            <button onClick={handlePrint} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-200">
                                <Printer className="w-4 h-4" /> Imprimir
                            </button>
                            {header.status === 'enviado' && (
                                <button onClick={handleSendEmail} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                                    <Mail className="w-4 h-4" /> {header.email_enviado ? 'Re-enviar E-mail' : 'Enviar E-mail'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stepper */}
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <button 
                    onClick={() => setStep(1)} 
                    className={`flex-1 py-4 text-center font-bold ${step === 1 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    1. Dados do Romaneio
                </button>
                <button 
                    onClick={() => header.id && setStep(2)} 
                    disabled={!header.id}
                    className={`flex-1 py-4 text-center font-bold ${step === 2 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                >
                    2. Equipamentos & Retorno
                </button>
            </div>

            {step === 1 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <form onSubmit={saveHeader} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                                    Fornecedor / Laboratório
                                    <button 
                                        type="button"
                                        onClick={() => setShowNewFornecedor(!showNewFornecedor)}
                                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded"
                                    >
                                        {showNewFornecedor ? 'Usar Existente' : '+ Cadastrar Novo'}
                                    </button>
                                </h3>

                                {!showNewFornecedor ? (
                                    <div>
                                        <select
                                            required={!header.destinatario}
                                            className="w-full p-2 border border-slate-300 rounded-lg"
                                            value={header.fornecedor_id}
                                            onChange={e => setHeader({...header, fornecedor_id: e.target.value})}
                                        >
                                            <option value="">Selecione um Fornecedor...</option>
                                            {fornecedores.map(f => (
                                                <option key={f.id} value={f.id}>{f.nome} {f.email ? `(${f.email})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <input required placeholder="Nome do Fornecedor" className="w-full p-2 border border-slate-300 rounded-lg" value={newFornecedor.nome} onChange={e => setNewFornecedor({...newFornecedor, nome: e.target.value})} />
                                        <input type="email" placeholder="E-mail (Para Envio Automático)" className="w-full p-2 border border-slate-300 rounded-lg" value={newFornecedor.email} onChange={e => setNewFornecedor({...newFornecedor, email: e.target.value})} />
                                        <div className="flex gap-4">
                                            <input placeholder="Telefone" className="w-1/2 p-2 border border-slate-300 rounded-lg" value={newFornecedor.telefone} onChange={e => setNewFornecedor({...newFornecedor, telefone: e.target.value})} />
                                            <input placeholder="Contato" className="w-1/2 p-2 border border-slate-300 rounded-lg" value={newFornecedor.contato} onChange={e => setNewFornecedor({...newFornecedor, contato: e.target.value})} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data de Envio *</label>
                                    <input type="date" required className="w-full p-2 border border-slate-300 rounded-lg" value={header.data_envio} onChange={e => setHeader({...header, data_envio: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Previsão de Retorno</label>
                                    <input type="date" className="w-full p-2 border border-slate-300 rounded-lg" value={header.previsao_retorno} onChange={e => setHeader({...header, previsao_retorno: e.target.value})} />
                                </div>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                                <textarea className="w-full p-2 border border-slate-300 rounded-lg h-24" value={header.observacao} onChange={e => setHeader({...header, observacao: e.target.value})}></textarea>
                            </div>

                        </div>
                        <div className="flex justify-end">
                            <button disabled={loading} type="submit" className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700">
                                {loading ? 'Salvando...' : 'Salvar Dados e Avançar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    {header.status === 'aberto' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Plus className="w-5 h-5"/> Adicionar Equipamento</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm text-slate-600 mb-1">Selecione o Equipamento Disponível</label>
                                    <select className="w-full p-2 border border-slate-300 rounded-lg" value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {availableAssets.map(a => (
                                            <option key={a.id} value={a.id}>{a.patrimonio} - {a.name} ({a.model})</option>
                                        ))}
                                    </select>
                                </div>
                                <button onClick={addItem} disabled={loading || !selectedAsset} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-medium">
                                <tr>
                                    <th className="p-4">Patrimônio</th>
                                    <th className="p-4">Equipamento</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.length === 0 ? (
                                    <tr><td colSpan="4" className="p-8 text-center text-slate-400">Nenhum equipamento adicionado.</td></tr>
                                ) : (
                                    items.map(item => (
                                        <tr key={item.item_romaneio_id} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold text-slate-700">{item.patrimonio}</td>
                                            <td className="p-4">{item.name} <span className="text-slate-400 text-xs ml-2">{item.model}</span></td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${item.item_status === 'enviado' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    {item.item_status === 'enviado' ? 'Aguardando Retorno' : 'Retornado'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                {header.status === 'aberto' && (
                                                    <button onClick={() => removeItem(item.item_romaneio_id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                )}
                                                {header.status === 'enviado' && item.item_status === 'enviado' && (
                                                    <button onClick={() => setReturnModal({ itemId: item.item_romaneio_id, assetName: item.name })} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-200 font-medium">
                                                        Registrar Retorno
                                                    </button>
                                                )}
                                                {item.certificado_url && (
                                                    <a href={`http://192.168.1.77:3001${item.certificado_url}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                                                        <FileUp className="w-3 h-3"/> Certificado
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {header.status === 'aberto' && items.length > 0 && (
                        <div className="flex justify-end pt-4 border-t">
                            <button onClick={markAsSent} disabled={loading} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5"/> Concluir Romaneio
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Print Component */}
            <div className="hidden" style={{ display: 'none' }}>
                <RomaneioPrintSGQ ref={printRef} romaneio={{...header, items}} items={items} />
            </div>

            {/* Return Modal */}
            {returnModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-100 p-6">
                            <h2 className="text-xl font-bold text-slate-800">Retorno de Equipamento</h2>
                            <p className="text-sm text-slate-500 mt-1">{returnModal.assetName}</p>
                        </div>
                        <form onSubmit={submitReturn} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nova Validade de Calibração *</label>
                                <input type="date" required className="w-full p-2 border border-slate-300 rounded-lg" value={returnForm.validade_calibracao} onChange={e => setReturnForm({...returnForm, validade_calibracao: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Certificado de Calibração (Opcional)</label>
                                <input type="file" accept=".pdf,image/*" className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50" onChange={e => setReturnForm({...returnForm, file: e.target.files[0]})} />
                                <p className="text-xs text-slate-500 mt-1">Será salvo no histórico de anexos do ativo automaticamente.</p>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setReturnModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50">
                                    Confirmar Retorno
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SgqRomaneioForm;
