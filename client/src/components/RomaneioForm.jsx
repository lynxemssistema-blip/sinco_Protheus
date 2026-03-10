import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Plus, ArrowRight, Save, Trash2, FileText, CheckCircle, Truck, Printer, History, Edit, Search as SearchIcon, Camera, Image, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import {
    getClientes, getRomaneioTypes, createRomaneio, addRomaneioItem, updateRomaneio,
    getRomaneioById, updateRomaneioStatus, getProductionOrdersByOp,
    updateRomaneioItem, deleteRomaneioItem, createRevision, getRevisions, getRevisionDetails,
    getProdutos, // Added
    uploadRomaneioPhoto, // Added
    getFileUrl
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import RomaneioPrint from './RomaneioPrint';

export default function RomaneioForm({ romaneioId, initialStep = 1, onSuccess }) {
    const { user } = useAuth();
    const [step, setStep] = useState(initialStep);
    const [loading, setLoading] = useState(false);
    const [types, setTypes] = useState([]);
    const printRef = useRef();

    // Data Strings
    const [header, setHeader] = useState({
        cliente_cod: '',
        cliente_loja: '',
        cliente_nome: '',
        tipo_id: '',
        observacao_geral: '',
        cliente_endereco: '',
        cliente_bairro: '',
        cliente_cidade: '',
        cliente_uf: '',
        cliente_cep: '',
        cliente_telefone: '',
        motorista_nome: '',
        motorista_cnh: '',
        motorista_cnh_validade: '',
        veiculo_modelo: '',
        veiculo_placa: '',
        data_liberacao: new Date().toISOString().split('T')[0], // Default Today
        data_previsao_retorno: '',
        fotos: []
    });

    // Main Data
    const [items, setItems] = useState([]);
    const [currRomaneioId, setCurrRomaneioId] = useState(romaneioId || null);
    const [currRomaneioData, setCurrRomaneioData] = useState(null); // Full object for print

    // Aux Data
    const [clientSearch, setClientSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [showRevisions, setShowRevisions] = useState(false);

    // Photos state (for current session)
    const [fotosModal, setFotosModal] = useState([]); // File objects
    const [fotosPreview, setFotosPreview] = useState([]); // Object URLs

    // Item Form
    const [activeTab, setActiveTab] = useState('op'); // 'op' | 'manual'
    const [newItem, setNewItem] = useState({
        op: '',
        item: '',
        sequencia: '',
        qtd_enviar: '',
        comentario: '',
        client_filter: '',
        product_filter: ''
    });
    const [opResults, setOpResults] = useState([]);
    const [selectedOpItem, setSelectedOpItem] = useState(null);

    // Manual Item Form
    const [manualItem, setManualItem] = useState({
        search: '',
        results: [],
        selected: null,
        qtd: '',
        obs: ''
    });

    // Editing Item
    const [editingItem, setEditingItem] = useState(null); // null or item object

    useEffect(() => {
        console.log('Mounting RomaneioForm...');
        loadTypes();
        if (romaneioId) {
            loadRomaneio(romaneioId);
            loadRevisions(romaneioId);
        }
    }, [romaneioId]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Romaneio_${currRomaneioId || 'Novo'}`,
    });

    const loadTypes = async () => {
        try {
            const data = await getRomaneioTypes();
            setTypes(data);
        } catch (err) { console.error(err); }
    };

    const loadRomaneio = async (id) => {
        setLoading(true);
        try {
            const data = await getRomaneioById(id);
            setCurrRomaneioData(data);
            setCurrRomaneioId(data.id);
            setHeader({
                cliente_cod: data.cliente_cod,
                cliente_loja: data.cliente_loja,
                cliente_nome: data.cliente_nome,
                tipo_id: data.tipo_id,
                observacao_geral: data.observacao_geral || '',
                cliente_endereco: data.cliente_endereco,
                cliente_bairro: data.cliente_bairro,
                cliente_cidade: data.cliente_cidade,
                cliente_uf: data.cliente_uf,
                cliente_cep: data.cliente_cep,
                cliente_telefone: data.cliente_telefone,
                motorista_nome: data.motorista_nome || '',
                motorista_cnh: data.motorista_cnh || '',
                motorista_cnh_validade: data.motorista_cnh_validade ? data.motorista_cnh_validade.substring(0, 10) : '',
                veiculo_modelo: data.veiculo_modelo || '',
                veiculo_placa: data.veiculo_placa || '',
                data_liberacao: data.data_liberacao ? data.data_liberacao.substring(0, 10) : new Date().toISOString().split('T')[0],
                data_previsao_retorno: data.data_previsao_retorno ? data.data_previsao_retorno.substring(0, 10) : '',
                fotos: data.fotos ? (typeof data.fotos === 'string' ? JSON.parse(data.fotos) : data.fotos) : []
            });

            // Populate search field for better UX
            if (data.cliente_cod && data.cliente_nome) {
                setClientSearch(`${data.cliente_cod} - ${data.cliente_nome}`);
            }

            setItems(data.itens || []);
            // Only force step 2 if no explicit initialStep was provided (or if it matches default behavior)
            // Actually, we should respect the passed initialStep if this is the FIRST load, 
            // but loadRomaneio might be called after save.
            // Let's rely on the fact that setStep(initialStep) was called on mount.
            // But wait, initialStep is passed as prop. 
            // If we are editing (id exists), usually we go to step 2.
            // BUT if user clicked "Edit Header", we want Step 1.

            // If prop is 1, stay 1. If prop is 2, go 2.
            // The prop comes from parent state.
            // setStep(initialStep); // Removed to fix error
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadRevisions = async (id) => {
        try {
            const data = await getRevisions(id);
            setRevisions(data);
        } catch (err) { console.error(err); }
    };

    // --- ACTIONS ---
    const handleCreateRevision = async () => {
        const reason = prompt('Motivo da Revisão:');
        if (!reason) return;
        setLoading(true);
        try {
            await createRevision(currRomaneioId, reason, user?.nome || user?.login);
            alert('Revisão criada!');
            loadRomaneio(currRomaneioId);
            loadRevisions(currRomaneioId);
        } catch (err) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClientSearch = async (e) => {
        const val = e.target.value;
        setClientSearch(val);

        // Always update cliente_nome to allow free-text input
        setHeader({ ...header, cliente_nome: val });

        // Show autocomplete suggestions if 3+ characters
        if (val.length > 2) {
            try {
                const results = await getClientes(val);
                setClients(results);
            } catch (err) {
                console.error(err);
                setClients([]);
            }
        } else {
            setClients([]);
        }
    };

    const selectClient = (cli) => {
        setHeader({
            ...header,
            cliente_cod: cli.codigo,
            cliente_loja: cli.loja,
            cliente_nome: cli.nome,
            cliente_endereco: cli.endereco,
            cliente_bairro: cli.bairro,
            cliente_cidade: cli.cidade,
            cliente_uf: cli.uf,
            cliente_cep: cli.cep,
            cliente_telefone: cli.telefone
        });
        setClients([]);
        setClientSearch(`${cli.codigo} - ${cli.nome}`);
    };

    const handleFotosChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novos = [...fotosModal, ...files].slice(0, 5 - header.fotos.length);
        setFotosModal(novos);
        const newPreviews = novos.map(f => URL.createObjectURL(f));
        setFotosPreview(newPreviews);
    };

    const removerFotoSession = (idx) => {
        const novos = fotosModal.filter((_, i) => i !== idx);
        setFotosModal(novos);
        setFotosPreview(novos.map(f => URL.createObjectURL(f)));
    };

    const removerFotoExistente = (url) => {
        setHeader({ ...header, fotos: header.fotos.filter(f => f !== url) });
    };

    const saveHeader = async () => {
        // Validate: cliente_nome is required (can be manual or from database)
        if (!header.cliente_nome || header.cliente_nome.trim().length === 0) {
            return alert('Informe o Fornecedor');
        }
        if (!header.tipo_id) return alert('Selecione o Tipo de Romaneio');
        if (!header.data_liberacao) return alert('Data de Liberação é obrigatória');

        setLoading(true);
        try {
            let fotosUrls = [...header.fotos];

            // Upload new photos if any
            if (fotosModal.length > 0) {
                for (const file of fotosModal) {
                    const res = await uploadRomaneioPhoto(file);
                    fotosUrls.push(res.url);
                }
            }

            const headerToSave = { ...header, fotos: fotosUrls };

            if (currRomaneioId) {
                // EDIT MODE
                await updateRomaneio(currRomaneioId, headerToSave);
                // Reload to get full object for printing and refresh state
                loadRomaneio(currRomaneioId);
                setFotosModal([]);
                setFotosPreview([]);
                alert('Dados atualizados!');
            } else {
                // CREATE MODE
                const res = await createRomaneio({ ...headerToSave, usuario: user?.nome || user?.login });
                setCurrRomaneioId(res.id);
                loadRomaneio(res.id);
                setFotosModal([]);
                setFotosPreview([]);
                setStep(2); // Auto-advance to items
            }
        } catch (err) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ITEMS ---
    const searchOp = async () => {
        // Require at least one filter
        if (!newItem.op && (!newItem.client_filter || newItem.client_filter.length < 3) && (!newItem.product_filter || newItem.product_filter.length < 3)) {
            return alert('Informe a OP, Cliente (3+ letras) ou Produto (3+ letras)');
        }

        setLoading(true);
        try {
            const res = await getProductionOrdersByOp(
                newItem.op,
                newItem.item,
                newItem.sequencia,
                newItem.client_filter,
                newItem.product_filter
            );
            setOpResults(res);
        } catch (err) { alert('Erro ao buscar OP: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
    };

    const addItem = async () => {
        if (!selectedOpItem || !newItem.qtd_enviar) return alert('Selecione um item e informe a quantidade');
        setLoading(true);
        const payload = {
            pedido: selectedOpItem.op_origem,
            item_pedido: selectedOpItem.item_op,
            codigo_produto: selectedOpItem.codnoarvore,
            descricao_produto: selectedOpItem.descnoarvore,
            quantidade: newItem.qtd_enviar,
            comentario: newItem.comentario
        };
        try {
            await addRomaneioItem(currRomaneioId, payload);
            loadRomaneio(currRomaneioId); // Reload all
            setNewItem({ op: '', item: '', sequencia: '', qtd_enviar: '', comentario: '' });
            setOpResults([]);
            setSelectedOpItem(null);
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    const searchManualProduct = async () => {
        if ((!manualItem.search || manualItem.search.length < 3) && (!manualItem.client_filter || manualItem.client_filter.length < 3)) {
            return alert('Digite pelo menos 3 caracteres em algum filtro');
        }
        setLoading(true);
        try {
            const params = {
                page: 1,
                limit: 50,
                search: manualItem.search,
                client: manualItem.client_filter
            };
            const res = await getProdutos(params);
            setManualItem({ ...manualItem, results: res.data });
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    const addManualItem = async () => {
        if (!manualItem.selected || !manualItem.qtd) return alert('Selecione um produto e informe a quantidade');
        setLoading(true);
        const payload = {
            pedido: null,
            item_pedido: null,
            codigo_produto: manualItem.selected.codigo,
            descricao_produto: manualItem.selected.descricao,
            quantidade: manualItem.qtd,
            comentario: manualItem.obs,
            valor_unitario: manualItem.valor_unitario || 0
        };
        try {
            await addRomaneioItem(currRomaneioId, payload);
            loadRomaneio(currRomaneioId);
            setManualItem({ search: '', client_filter: '', results: [], selected: null, qtd: '', obs: '', valor_unitario: '' });
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('Remover item?')) return;
        setLoading(true);
        try {
            await deleteRomaneioItem(currRomaneioId, itemId);
            loadRomaneio(currRomaneioId);
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    const startEditItem = (item) => {
        setEditingItem({ ...item }); // Clone
    };

    const saveEditItem = async () => {
        setLoading(true);
        try {
            await updateRomaneioItem(currRomaneioId, editingItem.id, {
                quantidade: editingItem.quantidade,
                comentario: editingItem.comentario,
                valor_unitario: editingItem.valor_unitario
            });
            setEditingItem(null);
            loadRomaneio(currRomaneioId);
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                <RomaneioPrint ref={printRef} romaneio={currRomaneioData} items={items} typeDescription={types.find(t => t.id == header.tipo_id)?.description} />
            </div>

            {/* Steps / Toolbar */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4 text-sm">
                    <div
                        className={`flex items-center gap-2 cursor-pointer ${step === 1 ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600'}`}
                        onClick={() => setStep(1)}
                    >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === 1 ? 'bg-blue-100 border-blue-200' : 'bg-slate-100 border-slate-200'}`}>1</span>
                        Dados
                    </div>
                    <div className="h-px bg-slate-200 w-12"></div>
                    <div
                        className={`flex items-center gap-2 ${currRomaneioId ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed'} ${step === 2 ? 'text-blue-600 font-bold' : 'text-slate-500'}`}
                        onClick={() => currRomaneioId && setStep(2)}
                    >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === 2 ? 'bg-blue-100 border-blue-200' : 'bg-slate-100 border-slate-200'}`}>2</span>
                        Itens
                    </div>
                </div>

                {step === 2 && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowRevisions(!showRevisions)} className="text-slate-600 hover:bg-slate-100 p-2 rounded flex gap-2 items-center text-xs border">
                            <History className="w-4 h-4" /> Histórico ({revisions.length})
                        </button>
                        <button onClick={handleCreateRevision} className="text-slate-600 hover:bg-slate-100 p-2 rounded flex gap-2 items-center text-xs border">
                            <Save className="w-4 h-4" /> Nova Revisão
                        </button>
                        <button onClick={handlePrint} className="bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded flex gap-2 items-center text-xs">
                            <Printer className="w-4 h-4" /> Imprimir / PDF
                        </button>
                    </div>
                )}
            </div>

            {showRevisions && (
                <div className="mb-6 p-4 bg-slate-50 rounded border text-sm">
                    <h4 className="font-bold mb-2">Histórico de Revisões</h4>
                    <ul className="space-y-2">
                        {revisions.map(rev => (
                            <li key={rev.id} className="flex justify-between border-b pb-1">
                                <div>
                                    <span className="font-bold">Rev {rev.revision_number}</span>
                                    <span className="mx-2 text-slate-400">|</span>
                                    <span>{new Date(rev.created_at).toLocaleString()}</span>
                                    <span className="mx-2 text-slate-400">|</span>
                                    <span className="text-blue-600 font-medium">{rev.usuario || 'Sistema'}</span>
                                </div>
                                <span className="text-slate-500 italic">{rev.reason}</span>
                            </li>
                        ))}
                        {revisions.length === 0 && <li className="text-slate-400">Nenhuma revisão anterior.</li>}
                    </ul>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-6 max-w-2xl">
                    {/* Dates Section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Liberação</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg font-mono text-sm"
                                value={header.data_liberacao}
                                onChange={e => setHeader({ ...header, data_liberacao: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Previsão Retorno (Opcional)</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg font-mono text-sm"
                                value={header.data_previsao_retorno}
                                onChange={e => setHeader({ ...header, data_previsao_retorno: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Fornecedor
                            {header.cliente_cod && (
                                <span className="ml-2 text-xs text-green-600 font-normal">✓ Do sistema</span>
                            )}
                            {!header.cliente_cod && header.cliente_nome && (
                                <span className="ml-2 text-xs text-blue-600 font-normal">ⓘ Digitação livre</span>
                            )}
                        </label>
                        <input
                            className="w-full p-2 border rounded-lg"
                            placeholder="Digite o fornecedor ou busque no sistema (mín. 3 caracteres)..."
                            value={clientSearch}
                            onChange={handleClientSearch}
                        />
                        {clients.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-auto mt-1">
                                {clients.map(cli => (
                                    <div
                                        key={cli.codigo}
                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                        onClick={() => selectClient(cli)}
                                    >
                                        <div className="font-bold text-slate-900">{cli.nome}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{cli.codigo}/{cli.loja}</span>
                                            <span className="ml-2">{cli.nreduz}</span>
                                            {cli.cidade && <span className="ml-2">• {cli.cidade}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {header.cliente_nome && (
                            <div className="mt-2 p-3 bg-slate-50 rounded border text-sm">
                                <strong>{header.cliente_nome}</strong><br />
                                {header.cliente_endereco && (
                                    <>
                                        {header.cliente_endereco}, {header.cliente_bairro} - {header.cliente_cidade}/{header.cliente_uf}<br />
                                        <span className="text-xs text-slate-500">Tel: {header.cliente_telefone}</span>
                                    </>
                                )}
                                {!header.cliente_endereco && (
                                    <span className="text-xs text-slate-500 italic">Fornecedor digitado manualmente</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-1">Tipo de Romaneio</label>
                        <select className="w-full p-2 border rounded-lg" value={header.tipo_id} onChange={e => setHeader({ ...header, tipo_id: e.target.value })}>
                            <option value="">Selecione...</option>
                            {types.map(t => <option key={t.id} value={t.id}>{t.description}</option>)}
                        </select>
                    </div>

                    <div className="border-t pt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">Motorista</label>
                            <input className="w-full p-2 border rounded" value={header.motorista_nome} onChange={e => setHeader({ ...header, motorista_nome: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Placa Veículo</label>
                            <input className="w-full p-2 border rounded" value={header.veiculo_placa} onChange={e => setHeader({ ...header, veiculo_placa: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Veículo Modelo</label>
                            <input className="w-full p-2 border rounded" value={header.veiculo_modelo} onChange={e => setHeader({ ...header, veiculo_modelo: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Observação Geral</label>
                            <textarea className="w-full p-2 border rounded" value={header.observacao_geral} onChange={e => setHeader({ ...header, observacao_geral: e.target.value })} />
                        </div>
                    </div>

                    {/* Photos Section */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-blue-600" />
                            Fotos do Romaneio (Máx. 5)
                        </label>
                        
                        <div className="grid grid-cols-5 gap-2 mb-3">
                            {/* Existing Photos */}
                            {header.fotos.map((url, i) => (
                                <div key={`exist-${i}`} className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border">
                                    <img src={getFileUrl(url)} alt="Romaneio" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removerFotoExistente(url)}
                                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            
                            {/* Session Previews */}
                            {fotosPreview.map((url, i) => (
                                <div key={`prev-${i}`} className="relative group aspect-square bg-blue-50 rounded-lg overflow-hidden border border-blue-200">
                                    <img src={url} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removerFotoSession(i)}
                                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[8px] text-center py-0.5">Novo</div>
                                </div>
                            ))}

                            {/* Add Button */}
                            {(header.fotos.length + fotosModal.length) < 5 && (
                                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group">
                                    <Plus className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                    <span className="text-[10px] text-slate-500 group-hover:text-blue-600 font-bold mt-1">Anexar</span>
                                    <input 
                                        type="file" 
                                        hidden 
                                        accept="image/*" 
                                        capture="environment"
                                        multiple 
                                        onChange={handleFotosChange} 
                                    />
                                </label>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 italic">Dica: No celular, você pode tirar fotos diretamente com a câmera.</p>
                    </div>

                    <button onClick={saveHeader} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2 items-center hover:bg-blue-700">
                        {loading ? <Loader2 className="animate-spin" /> : (currRomaneioId ? <Save className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
                        {currRomaneioId ? 'Salvar Alterações' : 'Avançar'}
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    {/* Items Grid */}
                    <div className="bg-slate-50 p-4 rounded border text-sm flex justify-between items-center">
                        <div>
                            <span className="font-bold">{header.cliente_nome}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-slate-500">Romaneio #{currRomaneioId} (Rev {currRomaneioData?.current_revision || 1})</span>
                            <div className="text-xs text-slate-500 mt-1">
                                {header.motorista_nome || 'Sem motorista'} - {header.veiculo_placa || 'Sem placa'} | Liberação: {header.data_liberacao ? new Date(header.data_liberacao).toLocaleDateString() : 'N/D'}
                            </div>
                        </div>
                        <button
                            onClick={() => setStep(1)}
                            className="text-blue-600 hover:bg-blue-100 px-3 py-1 rounded text-xs flex gap-1 items-center font-medium transition-colors"
                        >
                            <Edit className="w-3 h-3" /> Editar Dados
                        </button>
                    </div>

                    {/* Add Item Tabs - Only if Rascunho */}
                    {!editingItem && currRomaneioData?.status === 'Rascunho' && (
                        <div className="bg-white border rounded p-4">
                            {/* Tabs */}
                            <div className="flex gap-4 mb-4 border-b">
                                <button
                                    className={`pb-2 px-1 text-sm font-bold ${activeTab === 'op' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                                    onClick={() => setActiveTab('op')}
                                >
                                    Via Ordem de Produção (OP)
                                </button>
                                <button
                                    className={`pb-2 px-1 text-sm font-bold ${activeTab === 'manual' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                                    onClick={() => setActiveTab('manual')}
                                >
                                    Via Produto (Avulso)
                                </button>
                            </div>

                            {activeTab === 'op' ? (
                                <div className="flex gap-2 items-end flex-wrap">
                                    <div><label className="text-xs font-bold block mb-1">OP</label><input className="border p-2 rounded w-24 text-sm" value={newItem.op} onChange={e => setNewItem({ ...newItem, op: e.target.value })} placeholder="OP..." /></div>
                                    <div><label className="text-xs font-bold block mb-1">Item</label><input className="border p-2 rounded w-16 text-sm" value={newItem.item} onChange={e => setNewItem({ ...newItem, item: e.target.value })} placeholder="01" /></div>

                                    {/* New Filters */}
                                    <div className="flex-1 min-w-[150px]">
                                        <label className="text-xs font-bold block mb-1">Filtro Cliente</label>
                                        <input
                                            className="border p-2 rounded w-full text-sm"
                                            value={newItem.client_filter}
                                            onChange={e => setNewItem({ ...newItem, client_filter: e.target.value })}
                                            placeholder="Nome ou Cód..."
                                        />
                                    </div>
                                    <div className="flex-1 min-w-[150px]">
                                        <label className="text-xs font-bold block mb-1">Filtro Produto</label>
                                        <input
                                            className="border p-2 rounded w-full text-sm"
                                            value={newItem.product_filter}
                                            onChange={e => setNewItem({ ...newItem, product_filter: e.target.value })}
                                            placeholder="Cód Produto..."
                                        />
                                    </div>
                                    <button onClick={searchOp} className="bg-slate-100 p-2 rounded"><Plus className="w-4" /></button>

                                    {opResults.length > 0 && (
                                        <div className="w-full bg-slate-50 border p-2 mt-2 overflow-auto max-h-96">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-200 sticky top-0">
                                                    <tr>
                                                        <th className="p-2 text-left">Código</th>
                                                        <th className="p-2 text-left">Descrição</th>
                                                        <th className="p-2 text-right">Qtd. OP</th>
                                                        <th className="p-2 text-center">PDF</th>
                                                        <th className="p-2 text-center">Ação</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {opResults.map((r, i) => (
                                                        <tr key={i} className="border-b hover:bg-slate-100">
                                                            <td className="p-2 font-mono">{r.codnoarvore}</td>
                                                            <td className="p-2">{r.descnoarvore}</td>
                                                            <td className="p-2 text-right font-bold">
                                                                {r.qtdtotalparaop ? Number(r.qtdtotalparaop).toFixed(2) : '-'}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                {r.tem_arquivos ? (
                                                                    <button
                                                                        onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.primeiro_arquivo)}`), '_blank')}
                                                                        className="text-red-600 hover:text-red-800 underline"
                                                                        title="Abrir PDF"
                                                                    >
                                                                        <FileText className="w-4 h-4 inline" /> PDF
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-slate-400">-</span>
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedOpItem(r);
                                                                        // Auto-fill observation from prod doc operation
                                                                        if (r.operacao_doc) {
                                                                            setNewItem(prev => ({ ...prev, comentario: r.operacao_doc }));
                                                                        }
                                                                    }}
                                                                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                                >
                                                                    Selecionar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {selectedOpItem && (
                                        <div className="w-full bg-blue-50 border border-blue-200 p-2 mt-2 flex gap-2 items-end">
                                            <div className="flex-1 text-xs"><strong>{selectedOpItem.codnoarvore}</strong>: {selectedOpItem.descnoarvore}</div>
                                            <div><label className="text-xs">Qtd</label><input type="number" className="border p-1 rounded w-20" value={newItem.qtd_enviar} onChange={e => setNewItem({ ...newItem, qtd_enviar: e.target.value })} /></div>
                                            <div><label className="text-xs">Obs</label><input className="border p-1 rounded w-32" value={newItem.comentario} onChange={e => setNewItem({ ...newItem, comentario: e.target.value })} /></div>
                                            <button onClick={addItem} className="bg-green-600 text-white p-1 px-3 rounded text-xs">Adicionar</button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold block mb-1">Buscar Produto (Código ou Descrição)</label>
                                            <input
                                                className="border p-2 rounded w-full text-sm"
                                                value={manualItem.search}
                                                onChange={e => setManualItem({ ...manualItem, search: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && searchManualProduct()}
                                                placeholder="Digite para buscar..."
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold block mb-1">Filtro Cliente (Opcional)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    className="border p-2 rounded w-full text-sm"
                                                    value={manualItem.client_filter || ''}
                                                    onChange={e => setManualItem({ ...manualItem, client_filter: e.target.value })}
                                                    onKeyDown={e => e.key === 'Enter' && searchManualProduct()}
                                                    placeholder="Filtrar por cliente..."
                                                />
                                                <button onClick={searchManualProduct} className="bg-slate-100 px-3 rounded"><SearchIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Manual Results */}
                                    {manualItem.results.length > 0 && !manualItem.selected && (
                                        <div className="max-h-48 overflow-auto border rounded bg-slate-50">
                                            {manualItem.results.map(prod => (
                                                <div
                                                    key={prod.codigo}
                                                    className="p-2 border-b hover:bg-slate-100 flex items-center text-xs"
                                                >
                                                    <div
                                                        className="flex-1 flex cursor-pointer items-center"
                                                        onClick={() => setManualItem({
                                                            ...manualItem,
                                                            selected: prod,
                                                            results: [],
                                                            obs: prod.metadados?.operacao || '' // Auto-fill Observation
                                                        })}
                                                    >
                                                        <span className="font-mono font-bold w-32">{prod.codigo}</span>
                                                        <span className="flex-1">{prod.descricao}</span>
                                                        <span className="text-slate-500 mr-2">{prod.unidade}</span>
                                                    </div>

                                                    {prod.tem_arquivos ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(prod.primeiro_arquivo)}`), '_blank');
                                                            }}
                                                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 ml-2"
                                                            title="Ver PDF"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="p-1 ml-2 text-slate-300" title="Sem PDF">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Manual Selection */}
                                    {manualItem.selected && (
                                        <div className="w-full bg-green-50 border border-green-200 p-3 rounded flex gap-4 items-end flex-wrap">
                                            <div className="flex-1 text-sm">
                                                <div className="text-xs text-green-800 font-bold mb-1">Produto Selecionado:</div>
                                                <div>{manualItem.selected.codigo} - {manualItem.selected.descricao}</div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1">Qtd</label>
                                                <input type="number" className="border p-2 rounded w-20 text-sm" value={manualItem.qtd} onChange={e => setManualItem({ ...manualItem, qtd: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1">Valor Unit. (R$)</label>
                                                <input
                                                    type="number" step="0.01"
                                                    className="border p-2 rounded w-24 text-sm"
                                                    value={manualItem.valor_unitario || ''}
                                                    onChange={e => setManualItem({ ...manualItem, valor_unitario: e.target.value })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="text-xs font-bold block mb-1">Observação</label>
                                                <input
                                                    className="border p-2 rounded w-full text-sm"
                                                    value={manualItem.obs}
                                                    onChange={e => setManualItem({ ...manualItem, obs: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={addManualItem} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Adicionar</button>
                                                <button onClick={() => setManualItem({ ...manualItem, selected: null, results: [] })} className="text-slate-500 underline text-xs">Trocar</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Edit Item Modal/Inline */}
                    {editingItem && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                            <h4 className="font-bold text-sm mb-2 text-yellow-800">Editando Item: {editingItem.codigo_produto}</h4>
                            <div className="flex gap-4">
                                <div>
                                    <label className="block text-xs font-bold">Quantidade</label>
                                    <input type="number" className="border p-2 rounded w-24" value={editingItem.quantidade} onChange={e => setEditingItem({ ...editingItem, quantidade: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold">Observação</label>
                                    <input className="border p-2 rounded w-full" value={editingItem.comentario} onChange={e => setEditingItem({ ...editingItem, comentario: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold">Valor (R$)</label>
                                    <input type="number" step="0.01" className="border p-2 rounded w-24" value={editingItem.valor_unitario} onChange={e => setEditingItem({ ...editingItem, valor_unitario: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button onClick={saveEditItem} className="bg-green-600 text-white px-3 py-1 rounded text-xs">Salvar</button>
                                <button onClick={() => setEditingItem(null)} className="bg-slate-300 text-slate-800 px-3 py-1 rounded text-xs">Cancelar</button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <table className="w-full text-sm border">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-2 text-left">Código</th>
                                <th className="p-2 text-left">Descrição</th>
                                <th className="p-2 text-right">Peso (kg)</th>
                                <th className="p-2 text-right">Peso Tot.</th>
                                <th className="p-2 text-right">Área (m²)</th>
                                <th className="p-2 text-right">Qtd</th>
                                <th className="p-2 text-right">Qtd Rec.</th>
                                <th className="p-2 text-left">Obs</th>
                                <th className="p-2 text-center">PDF</th>
                                <th className="p-2 text-right">Vlr. Unit</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, idx) => (
                                <tr key={idx} className="border-b hover:bg-slate-50">
                                    <td className="p-2">{it.codigo_produto}</td>
                                    <td className="p-2">{it.descricao_produto}</td>
                                    <td className="p-2 text-right">{it.peso_kg ? Number(it.peso_kg).toFixed(3) : '-'}</td>
                                    <td className="p-2 text-right font-bold text-slate-700">
                                        {it.peso_kg ? (Number(it.peso_kg) * Number(it.quantidade || 0)).toFixed(3) : '-'}
                                    </td>
                                    <td className="p-2 text-right">{it.area_pintura_m2 ? Number(it.area_pintura_m2).toFixed(2) : '-'}</td>
                                    <td className={`p-2 text-right font-bold ${Number(it.qtd_recebida) >= Number(it.quantidade) ? 'text-green-600' : 'text-slate-900'}`}>
                                        {Number(it.quantidade || 0)}
                                    </td>
                                    <td className={`p-2 text-right font-bold ${Number(it.qtd_recebida) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                        {Number(it.qtd_recebida || 0)}
                                        {Number(it.qtd_recebida) >= Number(it.quantidade) && <CheckCircle className="w-3 h-3 inline ml-1 text-green-600" />}
                                    </td>
                                    <td className="p-2 text-xs text-slate-500">{it.comentario}</td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`http://${window.location.hostname}:3001/api/docs/${it.codigo_produto.trim()}`);
                                                    const docs = await response.json();
                                                    if (docs && docs.length > 0) {
                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(docs[0].url_arquivo)}`, '_blank');
                                                    } else {
                                                        alert('Nenhum documento encontrado para este produto.');
                                                    }
                                                } catch (error) {
                                                    console.error('Erro ao abrir PDF:', error);
                                                    alert('Erro ao abrir documento.');
                                                }
                                            }}
                                            className="p-2 rounded-lg transition-all text-red-600 hover:bg-red-50 ring-1 ring-red-200"
                                            title="Abrir PDF do Produto"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    </td>
                                    <td className="p-2 text-right">
                                        R$ {it.valor_unitario ? Number(it.valor_unitario).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="p-2 text-right font-bold text-slate-700">
                                        R$ {(Number(it.valor_unitario || 0) * Number(it.quantidade || 0)).toFixed(2)}
                                    </td>
                                    <td className="p-2 w-24">
                                        {currRomaneioData?.status === 'Rascunho' && (
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => startEditItem(it)} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteItem(it.id)} className="text-red-600 hover:bg-red-100 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                            <tr>
                                <td colSpan="2" className="p-2 text-right">TOTAIS:</td>
                                <td></td> {/* Peso Unit */}
                                <td className="p-2 text-right text-slate-900 border-x">
                                    {items.reduce((acc, it) => acc + (Number(it.peso_kg || 0) * Number(it.quantidade || 0)), 0).toFixed(3)} kg
                                </td>
                                <td className="p-2 text-right">
                                    {items.reduce((acc, it) => acc + (Number(it.area_pintura_m2 || 0) * Number(it.quantidade || 0)), 0).toFixed(2)} m²
                                </td>
                                <td className="p-2 text-right">
                                    {items.reduce((acc, it) => acc + Number(it.quantidade || 0), 0)}
                                </td>
                                <td></td> {/* Obs */}
                                <td></td> {/* PDF */}
                                <td></td> {/* Vlr Unit */}
                                <td className="p-2 text-right text-green-700 text-sm border-x border-green-200 bg-green-50">
                                    R$ {items.reduce((acc, it) => acc + (Number(it.valor_unitario || 0) * Number(it.quantidade || 0)), 0).toFixed(2)}
                                </td>
                                <td></td> {/* Actions */}
                            </tr>
                        </tfoot>
                    </table>

                    <div className="flex justify-end">
                        <button onClick={onSuccess} className="text-slate-500 text-xs underline">Voltar para Lista</button>
                    </div>
                </div>
            )}
        </div>
    );
}
