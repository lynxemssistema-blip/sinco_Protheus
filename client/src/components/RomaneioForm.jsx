import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Plus, ArrowRight, Save, Trash2, FileText, CheckCircle, Truck, Printer, History, Edit, Search as SearchIcon, Camera, Image, X, Link as LinkIcon, ExternalLink, Info, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import {
    getClientes, getRomaneioTypes, createRomaneio, addRomaneioItem, updateRomaneio,
    getRomaneioById, updateRomaneioStatus, getProductionOrdersByOp, checkOpItemAvailability,
    updateRomaneioItem, deleteRomaneioItem, createRevision, getRevisions, getRevisionDetails,
    getProdutos,
    uploadRomaneioPhoto,
    getRomaneioLinkedNfs, linkRomaneioNf, unlinkRomaneioNf, // NFs
    getFileUrl,
    downloadRomaneioBundle,
    getProductDocs
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import RomaneioPrint from './RomaneioPrint';
import NfSearchModal from './RomaneioModals/NfSearchModal';
import NfMirrorModal from './RomaneioModals/NfMirrorModal';
import { Button, IconButton } from './ui';

export default function RomaneioForm({ romaneioId, initialStep = 1, onSuccess }) {
    const { user, hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
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
        fotos: [],
        nf_saida: [],
        nf_retorno: []
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
    const [loadingBundle, setLoadingBundle] = useState(false);

    // Photos state (for current session)
    const [fotosModal, setFotosModal] = useState([]); // File objects
    const [fotosPreview, setFotosPreview] = useState([]); // Object URLs

    // Custom NF States
    const [nfsVinculadas, setNfsVinculadas] = useState({ saida: [], retorno: [] });
    const [isNfSearchModalOpen, setIsNfSearchModalOpen] = useState(false);
    const [isNfMirrorModalOpen, setIsNfMirrorModalOpen] = useState(false);
    const [currentTipoNfSearch, setCurrentTipoNfSearch] = useState('');
    const [selectedMirrorNf, setSelectedMirrorNf] = useState(null);

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
    const [opItemAlert, setOpItemAlert] = useState(null);

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

    // Ensure step updates if parent changes it
    useEffect(() => {
        setStep(initialStep);
    }, [initialStep]);

    const handlePrint = async () => {
        if (!currRomaneioId) return;
        try {
            setLoadingBundle(true);
            const blob = await downloadRomaneioBundle(currRomaneioId);
            if (blob) {
                const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                window.open(url, '_blank');
                toast.success('Romaneio Impresso + Desenhos + Lista de Status aberto com sucesso!');
            }
        } catch (err) {
            toast.error('Erro ao chamar servidor Node para Caderno: ' + err.message);
        } finally {
            setLoadingBundle(false);
        }
    };

    const loadTypes = async () => {
        try {
            const data = await getRomaneioTypes();
            setTypes(data);
        } catch (err) { console.error(err); }
    };

    const fetchNfsVinculadas = async (id) => {
        try {
            const vinculados = await getRomaneioLinkedNfs(id);
            const saida = vinculados.filter(nf => nf.tipo_nf === 'saida');
            const retorno = vinculados.filter(nf => nf.tipo_nf === 'retorno');
            setNfsVinculadas({ saida, retorno });
        } catch (err) {
            console.error('Erro ao buscar NFs vinculadas', err);
        }
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
                fotos: data.fotos ? (typeof data.fotos === 'string' ? JSON.parse(data.fotos) : data.fotos) : [],
                nf_saida: data.nf_saida ? (typeof data.nf_saida === 'string' ? JSON.parse(data.nf_saida) : data.nf_saida) : [],
                nf_retorno: data.nf_retorno ? (typeof data.nf_retorno === 'string' ? JSON.parse(data.nf_retorno) : data.nf_retorno) : []
            });

            // Populate search field for better UX
            if (data.cliente_cod && data.cliente_nome) {
                setClientSearch(`${data.cliente_cod} - ${data.cliente_nome}`);
            }

            setItems(data.itens || []);
            await fetchNfsVinculadas(data.id);
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
    const handleLinkNf = async (nf, tipoNf) => {
        if (!currRomaneioId) return alert('Salve o romaneio primeiro!');
        setLoading(true);
        try {
            await linkRomaneioNf(currRomaneioId, {
                tipo_nf: tipoNf,
                nf_numero: nf.Num_NF,
                nf_serie: nf.Serie || '',
                fornecedor_cod: nf.Cod_Fornecedor,
                fornecedor_loja: nf.Loja || header.cliente_loja || ''
            });
            await fetchNfsVinculadas(currRomaneioId);
            setIsNfSearchModalOpen(false);
        } catch (err) {
            alert('Erro ao vincular NF: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleUnlinkNf = async (nfId) => {
        if (!window.confirm('Tem certeza que deseja desvincular esta Nota Fiscal?')) return;
        setLoading(true);
        try {
            await unlinkRomaneioNf(currRomaneioId, nfId);
            await fetchNfsVinculadas(currRomaneioId);
        } catch (err) {
            alert('Erro ao desvincular NF: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

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
            alert('Erro: ' + (err.response?.data?.error || err.message));
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
        try {
            console.log('📸 [RomaneioForm] Inserindo imagens', e.target.files);
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            
            const existingCount = Array.isArray(header?.fotos) ? header.fotos.length : 0;
            const limit = Math.max(0, 5 - existingCount);
            
            const novos = [...(fotosModal || []), ...files].slice(0, limit);
            setFotosModal(novos);
            
            const newPreviews = novos.map(f => {
                try { return URL.createObjectURL(f); } catch (err) { return ''; }
            }).filter(Boolean);
            
            setFotosPreview(newPreviews);
            e.target.value = ''; // Reset input so same file can be selected again if needed
        } catch (error) {
            console.error('❌ Erro ao inserir imagem:', error);
            alert('Não foi possível carregar a imagem selecionada. Verifique se o formato é suportado.');
        }
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
            return toast.warn('Informe o Fornecedor');
        }
        if (!header.tipo_id) return toast.warn('Selecione o Tipo de Romaneio');
        if (!header.data_liberacao) return toast.warn('Data de Liberação é obrigatória');

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

            const peso_total = items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.peso_kg || 0)), 0);
            const area_pintura_total = items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.area_pintura_m2 || 0)), 0);

            const headerToSave = { ...header, fotos: fotosUrls, peso_total, area_pintura_total };

            if (currRomaneioId) {
                // EDIT MODE
                await updateRomaneio(currRomaneioId, headerToSave);
                // Reload to get full object for printing and refresh state
                loadRomaneio(currRomaneioId);
                setFotosModal([]);
                setFotosPreview([]);
                toast.success('Dados atualizados!');
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
            alert('Erro: ' + (err.response?.data?.error || err.message));
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
            setOpItemAlert(null);
        } catch (err) { alert('Erro: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
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
        } catch (err) { alert('Erro: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
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
        } catch (err) { alert('Erro: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('Remover item?')) return;
        setLoading(true);
        try {
            await deleteRomaneioItem(currRomaneioId, itemId);
            loadRomaneio(currRomaneioId);
        } catch (err) { alert('Erro: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
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
                valor_unitario: editingItem.valor_unitario,
                peso_unitario: editingItem.peso_unitario,
                area_pintura_unitario: editingItem.area_pintura_unitario
            });
            setEditingItem(null);
            loadRomaneio(currRomaneioId);
        } catch (err) { alert('Erro: ' + (err.response?.data?.error || err.message)); } finally { setLoading(false); }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                <RomaneioPrint ref={printRef} romaneio={currRomaneioData} items={items} nfs={nfsVinculadas} typeDescription={types.find(t => t.id == header.tipo_id)?.description} />
                <button id="btn-print-romaneio" onClick={handlePrint}>Print</button>
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
                        <button
                            onClick={async () => {
                                if (!currRomaneioId) return;
                                try {
                                    setLoadingBundle(true);
                                    const blob = await downloadRomaneioBundle(currRomaneioId);
                                    const url = window.URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                    toast.success('Caderno de Engenharia gerado e salvo na rede!');
                                } catch (err) {
                                    toast.error('Erro ao gerar Caderno: ' + (err.response?.data?.error || err.message));
                                } finally {
                                    setLoadingBundle(false);
                                }
                            }}
                            disabled={loadingBundle}
                            className="text-red-600 hover:bg-red-50 p-2 rounded flex gap-2 items-center text-xs border border-red-200 font-medium disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" /> 
                            {loadingBundle ? 'Gerando...' : 'Gerar conjunto de PDF'}
                        </button>
                        <Button
                            variant="light"
                            size="sm"
                            icon={History}
                            onClick={() => setShowRevisions(!showRevisions)}
                        >
                            Histórico ({revisions.length})
                        </Button>
                        <Button
                            variant="light"
                            size="sm"
                            icon={Save}
                            onClick={handleCreateRevision}
                        >
                            Nova Revisão
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Printer}
                            onClick={handlePrint}
                        >
                            Imprimir / PDF
                        </Button>
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
                                    <span>{new Date(rev.created_at).toLocaleString('pt-BR')}</span>
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
                    {/* Top Banner */}
                    <div className="bg-slate-50 border p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">
                                Romaneio <span className="text-slate-900">#{currRomaneioId || 'NOVO'}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                Criado por <span className="font-medium text-slate-700">{currRomaneioData?.usuario || user?.nome || 'Você'}</span> • 
                                Em <span className="font-medium text-slate-700">{currRomaneioData?.created_at ? new Date(currRomaneioData.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>
                        <div className="text-right flex gap-4">
                            <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Peso Total</div>
                                <div className="font-mono font-bold text-slate-700">
                                    {(items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.peso_kg || 0)), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">kg</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Área Pint. Total</div>
                                <div className="font-mono font-bold text-slate-700">
                                    {(items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.area_pintura_m2 || 0)), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">m²</span>
                                </div>
                            </div>
                        </div>
                    </div>

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
                                        key={`${cli.codigo}-${cli.loja}-${cli.tipo}`}
                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                        onClick={() => selectClient(cli)}
                                    >
                                        <div className="font-bold text-slate-900 flex items-center justify-between">
                                            <span>{cli.nome}</span>
                                            {cli.tipo && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2 ${cli.tipo === 'Fornecedor' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                    {cli.tipo}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border">{cli.codigo}/{cli.loja}</span>
                                            <span className="ml-2 font-medium">{cli.nreduz}</span>
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
                        <div className="col-span-2">
                            {currRomaneioId ? (
                                <div className="border bg-slate-50 p-4 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-slate-800 text-lg">Notas Fiscais Vinculadas (Protheus)</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* NFs de Saída */}
                                        <div className="bg-white border rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 border-b p-2 flex justify-between items-center">
                                                <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                    <Truck className="w-4 h-4 text-blue-500" />
                                                    NFs de Saída
                                                </div>
                                                <button 
                                                    onClick={() => { setCurrentTipoNfSearch('saida'); setIsNfSearchModalOpen(true); }}
                                                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded flex items-center gap-1 transition-colors border border-blue-200"
                                                >
                                                    <LinkIcon className="w-3 h-3" /> Buscar NF
                                                </button>
                                            </div>
                                            <div className="p-2 min-h-[60px]">
                                                {nfsVinculadas.saida.length === 0 ? (
                                                    <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhuma NF de Saída.</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {nfsVinculadas.saida.map(nf => (
                                                            <div key={nf.id} className="flex items-center justify-between bg-blue-50/50 p-1.5 rounded border border-blue-100">
                                                                <div>
                                                                    <span className="font-mono font-bold text-blue-900 text-sm">{nf.nf_numero}</span>
                                                                    {nf.nf_serie && <span className="text-xs text-blue-600 ml-1">Série: {nf.nf_serie}</span>}
                                                                </div>
                                                                <div className="flex gap-1 border-l pl-1 border-blue-200">
                                                                    <button 
                                                                        onClick={async () => { 
                                                                            setSelectedMirrorNf(nf); 
                                                                            setIsNfMirrorModalOpen(true); 
                                                                        }}
                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Ver Espelho (Itens)"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleUnlinkNf(nf.id)}
                                                                        className="p-1 text-red-500 hover:bg-red-50 rounded" title="Desvincular"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* NFs de Retorno */}
                                        <div className="bg-white border rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 border-b p-2 flex justify-between items-center">
                                                <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                    NFs de Retorno
                                                </div>
                                                <button 
                                                    onClick={() => { setCurrentTipoNfSearch('retorno'); setIsNfSearchModalOpen(true); }}
                                                    className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded flex items-center gap-1 transition-colors border border-emerald-200"
                                                >
                                                    <LinkIcon className="w-3 h-3" /> Buscar NF
                                                </button>
                                            </div>
                                            <div className="p-2 min-h-[60px]">
                                                {nfsVinculadas.retorno.length === 0 ? (
                                                    <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhuma NF de Retorno.</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {nfsVinculadas.retorno.map(nf => (
                                                            <div key={nf.id} className="flex items-center justify-between bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
                                                                <div>
                                                                    <span className="font-mono font-bold text-emerald-900 text-sm">{nf.nf_numero}</span>
                                                                    {nf.nf_serie && <span className="text-xs text-emerald-600 ml-1">Série: {nf.nf_serie}</span>}
                                                                </div>
                                                                <div className="flex gap-1 border-l pl-1 border-emerald-200">
                                                                    <button 
                                                                        onClick={() => { setSelectedMirrorNf(nf); setIsNfMirrorModalOpen(true); }}
                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Ver Espelho (Itens)"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleUnlinkNf(nf.id)}
                                                                        className="p-1 text-red-500 hover:bg-red-50 rounded" title="Desvincular"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="border bg-slate-50 p-4 rounded-xl flex items-center gap-3 text-slate-600">
                                    <Info className="w-5 h-5 min-w-[20px] text-blue-500" />
                                    <span className="text-sm">Para buscar e vincular **Notas Fiscais do Protheus**, primeiro salve os dados iniciais do Romaneio clicando em <strong>Avançar</strong>.</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Motorista</label>
                            <input className="w-full p-2 border rounded" value={header.motorista_nome} onChange={e => setHeader({ ...header, motorista_nome: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold mb-1">Placa Veículo</label>
                                <input className="w-full p-2 border rounded" value={header.veiculo_placa} onChange={e => setHeader({ ...header, veiculo_placa: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">Veículo Modelo</label>
                                <input className="w-full p-2 border rounded" value={header.veiculo_modelo} onChange={e => setHeader({ ...header, veiculo_modelo: e.target.value })} />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold mb-1">Observação Geral</label>
                            <textarea rows="3" className="w-full p-3 border rounded-lg text-sm bg-yellow-50 focus:bg-white transition-colors" placeholder="Digite observações importantes sobre este romaneio..." value={header.observacao_geral} onChange={e => setHeader({ ...header, observacao_geral: e.target.value })} />
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

                    <div className="flex gap-4 mt-4">
                        <Button
                            variant="primary"
                            size="md"
                            onClick={saveHeader}
                            loading={loading}
                            icon={currRomaneioId ? Save : ArrowRight}
                        >
                            {currRomaneioId ? 'Salvar Alterações' : 'Avançar'}
                        </Button>

                        {currRomaneioId && (
                            <Button 
                                variant="secondary"
                                size="md"
                                onClick={() => setStep(2)} 
                                icon={Plus}
                            >
                                Adicionar/Editar Item
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    {/* Items Grid */}
                    <div className="bg-slate-50 border p-4 rounded-xl flex justify-between items-center mb-6">
                        <div>
                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">
                                Romaneio <span className="text-slate-900">#{currRomaneioId}</span>
                                <span className="ml-2 text-xs font-normal text-slate-400">(Rev {currRomaneioData?.current_revision || 1})</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                <span className="font-bold text-slate-700">{header.cliente_nome}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                {header.motorista_nome || 'Sem motorista'} - {header.veiculo_placa || 'Sem placa'} | Liberação: {header.data_liberacao ? new Date(header.data_liberacao).toLocaleDateString('pt-BR') : 'N/D'}
                            </div>
                        </div>
                        <div className="text-right flex flex-col sm:flex-row items-end sm:items-center gap-4 sm:gap-6">
                            <div className="flex gap-4 sm:border-r sm:pr-6 sm:mr-2">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">Peso Total</div>
                                    <div className="font-mono font-bold text-slate-700">
                                        {(items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.peso_kg || 0)), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">kg</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">Área Pint. Total</div>
                                    <div className="font-mono font-bold text-slate-700">
                                        {(items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.area_pintura_m2 || 0)), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-normal">m²</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setStep(1)}
                                className="text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg text-xs flex gap-1 items-center font-bold transition-colors border border-blue-200"
                            >
                                <Edit className="w-4 h-4" /> Editar Dados
                            </button>
                        </div>
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
                                            onKeyDown={e => e.key === 'Enter' && searchOp()}
                                            placeholder="Cód Produto..."
                                        />
                                    </div>
                                    <button 
                                        onClick={searchOp} 
                                        disabled={loading}
                                        className="bg-blue-600 text-white font-medium p-2 px-4 rounded hover:bg-blue-700 flex items-center justify-center gap-2 h-[38px] disabled:bg-blue-400 min-w-[120px]"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-sm">Buscando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <SearchIcon className="w-4 h-4" />
                                                <span className="text-sm">Pesquisar</span>
                                            </>
                                        )}
                                    </button>

                                    {selectedOpItem && (
                                        <div className="w-full bg-blue-50 border border-blue-200 p-3 mt-2 rounded">
                                            {opItemAlert && opItemAlert.length > 0 && (
                                                <div className="bg-yellow-100 border border-yellow-300 p-2 mb-3 rounded text-xs text-yellow-800">
                                                    <div className="font-bold flex items-center gap-1 mb-1">
                                                        <AlertCircle className="w-4 h-4" /> 
                                                        Atenção! Este item já possui envios anteriores:
                                                    </div>
                                                    <ul className="list-disc list-inside ml-2">
                                                        {opItemAlert.map((alertItem, idx) => (
                                                            <li key={idx}>
                                                                Romaneio <strong>#{alertItem.romaneio_id}</strong> ({alertItem.status}) - Qtd: <strong>{Number(alertItem.qtd_enviada).toFixed(2)}</strong> em {new Date(alertItem.data_criacao).toLocaleDateString('pt-BR')}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1 text-sm text-blue-900">
                                                    <strong className="block text-xs mb-1 text-blue-800">OP: {selectedOpItem.op_origem}-{selectedOpItem.item_op}</strong>
                                                    <span><strong>{selectedOpItem.codnoarvore}</strong>: {selectedOpItem.descnoarvore}</span>
                                                </div>
                                                <div><label className="text-xs font-bold block mb-1">Qtd Enviar</label><input type="number" className="border p-2 rounded w-24 text-sm" value={newItem.qtd_enviar} onChange={e => setNewItem({ ...newItem, qtd_enviar: e.target.value })} /></div>
                                                <div className="flex-1 min-w-[200px]"><label className="text-xs font-bold block mb-1">Observação</label><input className="border p-2 rounded w-full text-sm" value={newItem.comentario} onChange={e => setNewItem({ ...newItem, comentario: e.target.value })} /></div>
                                                <button onClick={addItem} className="bg-green-600 font-bold text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition shadow">Adicionar</button>
                                            </div>
                                        </div>
                                    )}

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
                                                                    onClick={async () => {
                                                                        setSelectedOpItem(r);
                                                                        
                                                                        // Pre-fill fields
                                                                        let initialObs = r.operacao_doc || '';
                                                                        let initialQtd = r.qtdtotalparaop ? Number(r.qtdtotalparaop).toFixed(2) : '';

                                                                        setNewItem(prev => ({ 
                                                                            ...prev, 
                                                                            comentario: initialObs,
                                                                            qtd_enviar: initialQtd
                                                                        }));

                                                                        // Check previous shipments
                                                                        if (r.op_origem && r.item_op) {
                                                                            try {
                                                                                const alerts = await checkOpItemAvailability(r.op_origem, r.item_op);
                                                                                if (alerts && alerts.length > 0) {
                                                                                    setOpItemAlert(alerts);
                                                                                } else {
                                                                                    setOpItemAlert(null);
                                                                                }
                                                                            } catch (err) {
                                                                                console.error("Erro ao checar envios anteriores:", err);
                                                                                setOpItemAlert(null);
                                                                            }
                                                                        } else {
                                                                            setOpItemAlert(null);
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

                                    {/* Manual Selection */}
                                    {manualItem.selected && (
                                        <div className="w-full bg-green-50 border border-green-200 p-3 mt-2 rounded flex gap-4 items-end flex-wrap">
                                            <div className="flex-1 text-sm">
                                                <div className="text-xs text-green-800 font-bold mb-1">Produto Selecionado:</div>
                                                <div>{manualItem.selected.codigo} - {manualItem.selected.descricao}</div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1">Qtd</label>
                                                <input type="number" className="border p-2 rounded w-20 text-sm" value={manualItem.qtd} onChange={e => setManualItem({ ...manualItem, qtd: e.target.value })} />
                                            </div>
                                            {canViewValues && (
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
                                            )}
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

                                    {/* Manual Results */}
                                    {manualItem.results.length > 0 && !manualItem.selected && (
                                        <div className="max-h-48 overflow-auto border rounded bg-slate-50">
                                            {manualItem.results.map((prod, idx) => (
                                                <div
                                                    key={`${prod.codigo}-${idx}`}
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
                                </div>
                            )}
                        </div>
                    )}

                    {/* Edit Item Modal/Inline */}
                    {editingItem && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                            <h4 className="font-bold text-sm mb-2 text-yellow-800">Editando Item: {editingItem.codigo_produto}</h4>
                            <div className="flex flex-wrap gap-4">
                                <div>
                                    <label className="block text-xs font-bold">Quantidade</label>
                                    <input type="number" className="border p-2 rounded w-24" value={editingItem.quantidade} onChange={e => setEditingItem({ ...editingItem, quantidade: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold">Observação</label>
                                    <input className="border p-2 rounded w-full" value={editingItem.comentario} onChange={e => setEditingItem({ ...editingItem, comentario: e.target.value })} />
                                </div>
                                {canViewValues && (
                                    <div>
                                        <label className="block text-xs font-bold">Valor (R$)</label>
                                        <input type="number" step="0.01" className="border p-2 rounded w-24" value={editingItem.valor_unitario} onChange={e => setEditingItem({ ...editingItem, valor_unitario: e.target.value })} />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold">Peso Unit. (kg)</label>
                                    <input type="number" step="0.001" className="border p-2 rounded w-28" placeholder={editingItem.peso_kg ? Number(editingItem.peso_kg).toFixed(3) : '0.000'} value={editingItem.peso_unitario ?? ''} onChange={e => setEditingItem({ ...editingItem, peso_unitario: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold">Área Pint. Unit. (m²)</label>
                                    <input type="number" step="0.0001" className="border p-2 rounded w-32" placeholder={editingItem.area_pintura_m2 ? Number(editingItem.area_pintura_m2).toFixed(4) : '0.0000'} value={editingItem.area_pintura_unitario ?? ''} onChange={e => setEditingItem({ ...editingItem, area_pintura_unitario: e.target.value })} />
                                </div>
                            </div>
                            <p className="text-xs text-yellow-700 mt-2">Os valores de peso e área serão atualizados no cadastro do produto.</p>
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
                                {canViewValues && <th className="p-2 text-right">Vlr. Unit</th>}
                                {canViewValues && <th className="p-2 text-right">Total</th>}
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
                                        {it.url_arquivo ? (
                                            <button
                                                onClick={() => {
                                                    window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(it.url_arquivo)}`, '_blank');
                                                }}
                                                className="p-2 rounded-lg transition-all text-red-600 hover:bg-red-50 ring-1 ring-red-200"
                                                title="Abrir PDF do Produto"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <div className="p-2 text-slate-300" title="Sem PDF cadastrado">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                        )}
                                    </td>
                                    {canViewValues && (
                                        <td className="p-2 text-right">
                                            R$ {it.valor_unitario ? Number(it.valor_unitario).toFixed(2) : '0.00'}
                                        </td>
                                    )}
                                    {canViewValues && (
                                        <td className="p-2 text-right font-bold text-slate-700">
                                            R$ {(Number(it.valor_unitario || 0) * Number(it.quantidade || 0)).toFixed(2)}
                                        </td>
                                    )}
                                    <td className="p-2 w-24">
                                        {currRomaneioData?.status === 'Rascunho' && (
                                            <div className="flex gap-1.5 justify-end">
                                                <IconButton
                                                    icon={Edit}
                                                    title="Editar Item"
                                                    onClick={() => startEditItem(it)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-slate-500 hover:text-white hover:bg-[#425750]"
                                                />
                                                <IconButton
                                                    icon={Trash2}
                                                    title="Remover Item"
                                                    onClick={() => handleDeleteItem(it.id)}
                                                    variant="danger"
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                            <tr>
                                <td colSpan="2" className="p-2 text-right">TOTAIS:</td>
                                <td>{/* Peso Unit */}</td>
                                <td className="p-2 text-right text-slate-900 border-x">
                                    {items.reduce((acc, it) => acc + (Number(it.peso_kg || 0) * Number(it.quantidade || 0)), 0).toFixed(3)} kg
                                </td>
                                <td className="p-2 text-right">
                                    {items.reduce((acc, it) => acc + (Number(it.area_pintura_m2 || 0) * Number(it.quantidade || 0)), 0).toFixed(2)} m²
                                </td>
                                <td className="p-2 text-right">
                                    {items.reduce((acc, it) => acc + Number(it.quantidade || 0), 0)}
                                </td>
                                <td>{/* Obs */}</td>
                                <td>{/* PDF */}</td>
                                {canViewValues && <td>{/* Vlr Unit */}</td>}
                                {canViewValues && (
                                    <td className="p-2 text-right text-green-700 text-sm border-x border-green-200 bg-green-50">
                                        R$ {items.reduce((acc, it) => acc + (Number(it.valor_unitario || 0) * Number(it.quantidade || 0)), 0).toFixed(2)}
                                    </td>
                                )}
                                <td>{/* Actions */}</td>
                            </tr>
                        </tfoot>
                    </table>



                    <div className="flex justify-end mt-4">
                        <button onClick={onSuccess} className="text-slate-500 text-xs underline">Voltar para Lista</button>
                    </div>
                </div>
            )}

            {/* Modals para NFs */}
            <NfSearchModal
                isOpen={isNfSearchModalOpen}
                onClose={() => setIsNfSearchModalOpen(false)}
                onSelectNf={handleLinkNf}
                fornecedorCod={header.cliente_cod}
                fornecedorLoja={header.cliente_loja}
                tipoNf={currentTipoNfSearch}
            />

            <NfMirrorModal
                isOpen={isNfMirrorModalOpen}
                onClose={() => setIsNfMirrorModalOpen(false)}
                nf={selectedMirrorNf}
                fornecedorCod={header.cliente_cod}
            />

        </div>
    );
}
