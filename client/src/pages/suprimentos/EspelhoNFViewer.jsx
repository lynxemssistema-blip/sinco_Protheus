import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, Printer, Save, CheckSquare, X, Mail, Clock, Eye, History, User, Trash2, Search } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const EspelhoNFViewer = () => {
    const { user, hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [view, setView] = useState('list'); // 'list' | 'viewer'
    const [nfs, setNfs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Viewer states
    const [activeNf, setActiveNf] = useState(null);
    const [xmlData, setXmlData] = useState(null); // Parsed JSON from DB XML
    
    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    
    // Email Modal
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailData, setEmailData] = useState({ destinatarios: '', assunto: '', corpo: '' });
    
    // Receive Item Modal
    const [receiveModal, setReceiveModal] = useState({ open: false, item: null, qty: '' });
    
    // Protheus Product Mapping
    const [productMap, setProductMap] = useState({});

    useEffect(() => {
        if (view === 'list') {
            fetchNfs();
        }
    }, [view]);

    const fetchNfs = async () => {
        try {
            const res = await api.get('/nfe-recebimento');
            setNfs(res.data);
        } catch (error) {
            toast.error('Erro ao buscar lista de notas fiscais');
        }
    };

    const loadNf = async (id) => {
        try {
            const res = await api.get(`/nfe-recebimento/${id}`);
            const nfDB = res.data;
            
            // Parse XML back into object for DANFE
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(nfDB.xml_content, "text/xml");
            
            const getText = (tag, parent = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent || '';
            const emit = xmlDoc.getElementsByTagName('emit')[0];
            const dest = xmlDoc.getElementsByTagName('dest')[0];
            const ide = xmlDoc.getElementsByTagName('ide')[0];
            const total = xmlDoc.getElementsByTagName('total')[0];
            
            const parsedData = {
                ide: {
                    nNF: getText('nNF', ide),
                    serie: getText('serie', ide),
                    dhEmi: getText('dhEmi', ide),
                    natOp: getText('natOp', ide),
                    tpNF: getText('tpNF', ide) === '1' ? 'Saída' : 'Entrada'
                },
                emit: {
                    xNome: getText('xNome', emit),
                    CNPJ: getText('CNPJ', emit),
                    IE: getText('IE', emit),
                    xLgr: getText('xLgr', emit),
                    nro: getText('nro', emit),
                    xBairro: getText('xBairro', emit),
                    xMun: getText('xMun', emit),
                    UF: getText('UF', emit),
                    CEP: getText('CEP', emit)
                },
                dest: {
                    xNome: getText('xNome', dest),
                    CNPJ: getText('CNPJ', dest) || getText('CPF', dest),
                    IE: getText('IE', dest),
                    xLgr: getText('xLgr', dest),
                    nro: getText('nro', dest),
                    xBairro: getText('xBairro', dest),
                    xMun: getText('xMun', dest),
                    UF: getText('UF', dest),
                    CEP: getText('CEP', dest)
                },
                total: {
                    vNF: getText('vNF', total),
                    vProd: getText('vProd', total),
                    vFrete: getText('vFrete', total),
                    vDesc: getText('vDesc', total)
                },
                infAdic: {
                    infCpl: xmlDoc.getElementsByTagName('infAdic')[0] ? getText('infCpl', xmlDoc.getElementsByTagName('infAdic')[0]) : '',
                    infAdFisco: xmlDoc.getElementsByTagName('infAdic')[0] ? getText('infAdFisco', xmlDoc.getElementsByTagName('infAdic')[0]) : ''
                }
            };

            setXmlData(parsedData);
            setActiveNf(nfDB);
            
            // Buscar Associação Fornecedor x Produto (De/Para)
            try {
                const codigos = nfDB.itens.map(i => i.cProd);
                const mapRes = await api.post('/protheus/de-para-produtos', {
                    cnpj: parsedData.emit.CNPJ,
                    codigos_fornecedor: codigos,
                    numero_nf: parsedData.ide.nNF
                });
                setProductMap(mapRes.data || {});
            } catch (err) {
                console.warn('Aviso: Não foi possível carregar a associação de produtos De/Para.');
            }

            setView('viewer');
        } catch (error) {
            toast.error('Erro ao carregar nota fiscal.');
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        // Reset the input value so the same file can be selected again if needed
        e.target.value = null;
        
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");
                
                const nfe = xmlDoc.getElementsByTagName('NFe')[0] || xmlDoc.getElementsByTagName('nfeProc')[0];
                if (!nfe) throw new Error('XML inválido.');

                const getText = (tag, parent = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent || '';
                
                const emit = xmlDoc.getElementsByTagName('emit')[0];
                const ide = xmlDoc.getElementsByTagName('ide')[0];
                const total = xmlDoc.getElementsByTagName('total')[0];
                const prot = xmlDoc.getElementsByTagName('protNFe')[0];
                
                let chave = getText('chNFe', prot);
                if(!chave) chave = xmlDoc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe', '');

                const itens = Array.from(xmlDoc.getElementsByTagName('det')).map(det => {
                    const prod = det.getElementsByTagName('prod')[0];
                    return {
                        cProd: getText('cProd', prod),
                        xProd: getText('xProd', prod),
                        ncm: getText('NCM', prod),
                        cfop: getText('CFOP', prod),
                        uCom: getText('uCom', prod),
                        qCom: getText('qCom', prod),
                        vUnCom: getText('vUnCom', prod),
                        vProd: getText('vProd', prod)
                    };
                });

                const payload = {
                    chave_acesso: chave,
                    numero_nf: getText('nNF', ide),
                    serie: getText('serie', ide),
                    emitente_nome: getText('xNome', emit),
                    emitente_cnpj: getText('CNPJ', emit),
                    data_emissao: getText('dhEmi', ide)?.split('T')[0] || null,
                    valor_total: getText('vNF', total),
                    xml_content: text,
                    usuario: user?.login || 'Sistema',
                    itens
                };

                const res = await api.post('/nfe-recebimento', payload);
                toast.success('Nota Fiscal importada com sucesso!');
                loadNf(res.data.id);
            } catch (err) {
                    const status = err.response?.status;
                    const serverMsg = err.response?.data?.error || '';
                    if (status === 400 && serverMsg.toLowerCase().includes('j\u00e1 foi importada')) {
                        toast.warn('⚠️ Esta Nota Fiscal já foi importada anteriormente. Localize-a na lista abaixo.');
                    } else {
                        toast.error(serverMsg || 'Erro ao processar arquivo XML.');
                    }
                }
        };
        reader.readAsText(file);
    };

    const handleDeleteNf = async (id, numero_nf) => {
        if (!window.confirm(`Tem certeza que deseja excluir a NF ${numero_nf} e todo o seu histórico de recebimento? Esta ação não pode ser desfeita.`)) return;
        
        try {
            await api.delete(`/nfe-recebimento/${id}`);
            toast.success('Nota fiscal e recebimentos excluídos!');
            fetchNfs();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro ao excluir NF.');
        }
    };

    const handleReceiveItem = async () => {
        if (!receiveModal.qty || isNaN(receiveModal.qty) || Number(receiveModal.qty) <= 0) {
            toast.error('Informe uma quantidade válida.');
            return;
        }

        try {
            await api.post('/nfe-recebimento/receber-item', {
                id_nfe_item: receiveModal.item.id,
                qty_received_now: Number(receiveModal.qty),
                usuario: user?.login || 'Sistema'
            });
            toast.success('Recebimento apontado com sucesso!');
            setReceiveModal({ open: false, item: null, qty: '' });
            loadNf(activeNf.id); // Reload to update table and logs
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro ao apontar recebimento.');
        }
    };

    const handleSendEmail = async (e) => {
        e.preventDefault();
        try {
            await api.post('/nfe-recebimento/email', {
                id_nfe: activeNf.id,
                remetente: user?.login || 'Sistema',
                destinatarios: emailData.destinatarios,
                assunto: emailData.assunto,
                corpo: emailData.corpo
            });
            toast.success('E-mail registrado na fila de envio.');
            setIsEmailModalOpen(false);
        } catch (error) {
            toast.error('Erro ao enviar e-mail.');
        }
    };

    const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Concluido': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Concluído</span>;
            case 'Parcial': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">Parcial</span>;
            default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">Pendente</span>;
        }
    };

    const formatInfText = (text) => {
        if (!text) return null;
        return text.split(';').map((line, idx) => {
            const trimmed = line.trim();
            // Don't render empty lines from split
            return trimmed ? <div key={idx} className="mb-1">{trimmed}{idx < text.split(';').length - 1 ? ';' : ''}</div> : null;
        });
    };

    if (view === 'list') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-600" />
                            Recebimento de Notas Fiscais
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gerencie a entrada física de materiais via XML.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 shadow-sm w-full sm:w-64">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar NF, Emissor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-sm text-gray-700"
                            />
                        </div>
                        <label className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg cursor-pointer shadow whitespace-nowrap w-full sm:w-auto">
                            <Upload className="w-4 h-4" />
                            <span>Importar XML</span>
                            <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border overflow-hidden">
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-sm text-left relative">
                            <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                <th className="p-4">NF / Série</th>
                                <th className="p-4">Emitente</th>
                                <th className="p-4">Emissão</th>
                                {canViewValues && <th className="p-4 text-right">Valor</th>}
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nfs.filter(nf => 
                                (nf.numero_nf || '').includes(searchTerm) ||
                                (nf.emitente_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (nf.emitente_cnpj || '').includes(searchTerm)
                            ).length === 0 ? (
                                <tr><td colSpan={canViewValues ? 6 : 5} className="p-6 text-center text-gray-500">Nenhuma NF encontrada.</td></tr>
                            ) : nfs.filter(nf => 
                                (nf.numero_nf || '').includes(searchTerm) ||
                                (nf.emitente_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (nf.emitente_cnpj || '').includes(searchTerm)
                            ).map(nf => (
                                <tr key={nf.id} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold">{nf.numero_nf} <span className="text-gray-400 font-normal">/ {nf.serie}</span></td>
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-800">{nf.emitente_nome}</div>
                                        <div className="text-xs text-gray-500">{nf.emitente_cnpj}</div>
                                    </td>
                                    <td className="p-4">{formatDate(nf.data_emissao)}</td>
                                    {canViewValues && <td className="p-4 text-right font-mono text-gray-600">R$ {formatMoney(nf.valor_total)}</td>}
                                    <td className="p-4 text-center">{getStatusBadge(nf.status)}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => loadNf(nf.id)}
                                                className="bg-white border hover:bg-blue-50 text-blue-600 px-3 py-1.5 rounded flex items-center gap-2"
                                            >
                                                <Eye className="w-4 h-4" /> Conferir
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteNf(nf.id, nf.numero_nf)}
                                                className="bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded flex items-center justify-center"
                                                title="Excluir NF e Histórico"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        );
    }

    // VIEWER/RECEIPT MODE
    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CheckSquare className="w-6 h-6 text-indigo-600" />
                        Conferência de Recebimento
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Aponte as quantidades recebidas fisicamente para NF {xmlData?.ide?.nNF}.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => {
                            setEmailData({
                                destinatarios: '',
                                assunto: `Liberação de Recebimento - NF ${xmlData?.ide?.nNF} (${xmlData?.emit?.xNome})`,
                                corpo: `A Nota Fiscal ${xmlData?.ide?.nNF} foi conferida pelo almoxarifado.\nStatus Atual: ${activeNf.status}\n\nFavor verificar o sistema para mais detalhes.`
                            });
                            setIsEmailModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                    >
                        <Mail className="w-4 h-4" /> Enviar E-mail
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <Printer className="w-4 h-4" /> Imprimir DANFE
                    </button>
                    <button 
                        onClick={() => setView('list')}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Voltar à Lista
                    </button>
                </div>
            </div>

            {/* DANFE Layout */}
            <div className="bg-white print:shadow-none shadow border border-gray-300 mx-auto" style={{ maxWidth: '1000px' }}>
                <div className="bg-yellow-50 border-b border-yellow-200 p-2 text-center print:hidden text-xs font-bold text-yellow-800">
                    ATENÇÃO: ESTE DOCUMENTO É UM ESPELHO VIRTUAL PARA CONFERÊNCIA INTERNA.
                </div>

                <div className="p-4 space-y-2">
                    {/* Header Block */}
                    <div className="flex border border-black rounded">
                        <div className="w-1/2 p-2 border-r border-black flex flex-col justify-center">
                            <h3 className="font-bold text-lg leading-tight uppercase">{xmlData.emit.xNome}</h3>
                            <p className="text-xs uppercase mt-1">
                                {xmlData.emit.xLgr}, {xmlData.emit.nro}<br/>
                                {xmlData.emit.xBairro} - {xmlData.emit.xMun} / {xmlData.emit.UF}
                            </p>
                        </div>
                        <div className="w-1/4 p-2 border-r border-black flex flex-col items-center justify-center text-center">
                            <div className="text-xl font-bold">DANFE</div>
                            <div className="text-[10px] leading-tight">Documento Auxiliar</div>
                            <div className="mt-2 text-sm font-bold border border-black px-4 py-1">{xmlData.ide.tpNF}</div>
                            <div className="mt-2 text-sm">
                                <span className="font-bold">Nº</span> {xmlData.ide.nNF} <span className="font-bold ml-2">SÉRIE</span> {xmlData.ide.serie}
                            </div>
                            <div className="mt-1 text-xs">
                                <span className="font-bold">Emissão:</span> {new Date(xmlData.ide.dhEmi).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                        <div className="w-1/4 p-2 flex flex-col justify-center items-center">
                            <div className="text-[10px] uppercase font-bold text-center">Status Recebimento</div>
                            <div className="mt-2">{getStatusBadge(activeNf.status)}</div>
                        </div>
                    </div>

                    {/* Products & Receive Table */}
                    <div className="mt-4">
                        <div className="font-bold text-[10px] uppercase mb-1">Dados dos Produtos (Conferência Físico)</div>
                        <div className="border border-black rounded max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-left relative" style={{ fontSize: '10px' }}>
                                <thead className="border-b border-black bg-gray-50 sticky top-0 z-10 shadow">
                                    <tr className="uppercase text-gray-700">
                                        <th className="p-2 border-r border-black w-24">Cód. Forn.</th>
                                        <th className="p-2 border-r border-black w-24">Cód. MetalFisa</th>
                                        <th className="p-2 border-r border-black">Descrição do Produto</th>
                                        <th className="p-2 border-r border-black text-center w-10">UN</th>
                                        <th className="p-2 border-r border-black text-right w-16">Qtd NF</th>
                                        <th className="p-2 border-r border-black text-right w-20 bg-blue-50 text-blue-800">Qtd Rec</th>
                                        <th className="p-2 border-r border-black text-right w-16 bg-green-50">Saldo</th>
                                        <th className="p-2 border-r border-black text-center w-16">Status</th>
                                        <th className="p-2 text-center w-24 print:hidden">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeNf.itens.map((item) => {
                                        const saldo = Number(item.qCom) - Number(item.qty_received);
                                        const protheusCode = productMap[item.cProd];
                                        return (
                                            <tr key={item.id} className="border-b border-gray-300 last:border-b-0">
                                                <td className="p-2 border-r border-black font-mono">{item.cProd}</td>
                                                <td className="p-2 border-r border-black font-mono font-bold text-indigo-700 bg-indigo-50/20 text-center">
                                                    {protheusCode || '-'}
                                                </td>
                                                <td className="p-2 border-r border-black font-bold uppercase">{item.xProd}</td>
                                                <td className="p-2 border-r border-black text-center">{item.und}</td>
                                                <td className="p-2 border-r border-black text-right">{formatMoney(item.qCom)}</td>
                                                <td className="p-2 border-r border-black text-right font-bold text-blue-700 bg-blue-50/30">{formatMoney(item.qty_received)}</td>
                                                <td className="p-2 border-r border-black text-right font-bold text-green-700 bg-green-50/30">{formatMoney(saldo)}</td>
                                                <td className="p-2 border-r border-black text-center">{getStatusBadge(item.status)}</td>
                                                <td className="p-2 text-center print:hidden">
                                                    {saldo > 0 ? (
                                                        <button 
                                                            onClick={() => setReceiveModal({ open: true, item, qty: saldo })}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded shadow text-[10px] uppercase font-bold"
                                                        >
                                                            Apontar
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                                                            <CheckSquare className="w-3 h-3"/> OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* Dados Adicionais */}
                    <div className="mt-4">
                        <div className="font-bold text-[10px] uppercase mb-1">Dados Adicionais</div>
                        <div className="border border-black rounded p-2 text-[10px] min-h-[60px]">
                            {xmlData.infAdic?.infCpl && (
                                <div className="mb-3">
                                    <span className="font-bold uppercase text-gray-700">Informações Complementares:</span>
                                    <div className="mt-1 text-gray-800 leading-relaxed">{formatInfText(xmlData.infAdic.infCpl)}</div>
                                </div>
                            )}
                            {xmlData.infAdic?.infAdFisco && (
                                <div>
                                    <span className="font-bold uppercase text-gray-700">Informações ao Fisco:</span>
                                    <div className="mt-1 text-gray-800 leading-relaxed">{formatInfText(xmlData.infAdic.infAdFisco)}</div>
                                </div>
                            )}
                            {!xmlData.infAdic?.infCpl && !xmlData.infAdic?.infAdFisco && (
                                <span className="text-gray-400 italic">Nenhuma informação adicional.</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Histórico de Recebimentos */}
            <div className="max-w-[1000px] mx-auto mt-8 print:mt-4 print:block page-break-inside-avoid">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 print:text-xs print:mb-1 print:uppercase">
                    <History className="w-5 h-5 text-indigo-600 print:hidden" />
                    Histórico de Apontamentos Desta NF
                </h3>
                {activeNf.logs?.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center text-gray-500 print:p-2 print:text-[10px]">
                        Nenhum recebimento foi apontado ainda.
                    </div>
                ) : (
                    <div className="bg-white rounded border border-black overflow-hidden">
                        <table className="w-full text-left" style={{ fontSize: '10px' }}>
                            <thead className="bg-slate-800 text-white print:bg-gray-200 print:text-black border-b border-black">
                                <tr>
                                    <th className="px-3 py-1 border-r border-black print:border-gray-400 w-28">Data / Hora</th>
                                    <th className="px-3 py-1 border-r border-black print:border-gray-400 w-32">Usuário</th>
                                    <th className="px-3 py-1 border-r border-black print:border-gray-400 w-24">Cód. Forn.</th>
                                    <th className="px-3 py-1 border-r border-black print:border-gray-400 w-24">Cód. MetalFisa</th>
                                    <th className="px-3 py-1 border-r border-black print:border-gray-400">Produto</th>
                                    <th className="px-3 py-1 text-right w-24">Qtd Recebida</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeNf.logs?.map(log => (
                                    <tr key={log.id} className="border-b border-gray-300 print:border-gray-400 last:border-b-0">
                                        <td className="px-3 py-1 text-gray-700 border-r border-black print:border-gray-400">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-1 font-semibold text-gray-800 border-r border-black print:border-gray-400">
                                            {log.usuario}
                                        </td>
                                        <td className="px-3 py-1 font-mono border-r border-black print:border-gray-400">
                                            {log.cProd}
                                        </td>
                                        <td className="px-3 py-1 font-mono font-bold text-indigo-700 bg-indigo-50/20 text-center border-r border-black print:border-gray-400">
                                            {log.cProd_metalfisa || '-'}
                                        </td>
                                        <td className="px-3 py-1 border-r border-black print:border-gray-400 uppercase text-gray-800">
                                            {log.xProd}
                                        </td>
                                        <td className="px-3 py-1 text-right font-bold text-blue-700">+{formatMoney(log.qty_received_now)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Apontamento */}
            {receiveModal.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold">Apontar Recebimento</h3>
                            <button onClick={() => setReceiveModal({ open: false, item: null, qty: '' })}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <div className="text-xs text-gray-500 uppercase">Produto</div>
                                <div className="font-bold text-gray-800 leading-tight">{receiveModal.item.xProd}</div>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-gray-100 p-3 rounded flex-1 text-center border">
                                    <div className="text-xs text-gray-500 uppercase">Qtd Nota</div>
                                    <div className="font-bold text-lg">{formatMoney(receiveModal.item.qCom)}</div>
                                </div>
                                <div className="bg-blue-50 p-3 rounded flex-1 text-center border border-blue-200">
                                    <div className="text-xs text-blue-600 uppercase">Falta Receber</div>
                                    <div className="font-bold text-lg text-blue-700">
                                        {formatMoney(Number(receiveModal.item.qCom) - Number(receiveModal.item.qty_received))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Quantidade Chegando Agora:</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    autoFocus
                                    className="w-full border-2 border-indigo-300 rounded-lg p-3 text-xl text-center focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-mono"
                                    value={receiveModal.qty}
                                    onChange={(e) => setReceiveModal({...receiveModal, qty: e.target.value})}
                                    onKeyDown={(e) => e.key === 'Enter' && handleReceiveItem()}
                                />
                            </div>
                            <button 
                                onClick={handleReceiveItem}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" /> Confirmar Apontamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Enviar E-mail */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Mail className="w-5 h-5"/> Enviar Liberação / Status</h3>
                            <button onClick={() => setIsEmailModalOpen(false)}><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSendEmail} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Para (E-mails separados por vírgula)</label>
                                <input 
                                    required
                                    type="text" 
                                    placeholder="engenharia@metalfisa.com.br, compras@metalfisa.com.br"
                                    className="w-full border rounded p-2 focus:ring focus:ring-blue-200 outline-none"
                                    value={emailData.destinatarios}
                                    onChange={(e) => setEmailData({...emailData, destinatarios: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full border rounded p-2 focus:ring focus:ring-blue-200 outline-none"
                                    value={emailData.assunto}
                                    onChange={(e) => setEmailData({...emailData, assunto: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Corpo do E-mail</label>
                                <textarea 
                                    required
                                    rows="5"
                                    className="w-full border rounded p-2 focus:ring focus:ring-blue-200 outline-none"
                                    value={emailData.corpo}
                                    onChange={(e) => setEmailData({...emailData, corpo: e.target.value})}
                                ></textarea>
                            </div>
                            <button 
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                            >
                                <Mail className="w-5 h-5" /> Enviar Mensagem
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EspelhoNFViewer;
