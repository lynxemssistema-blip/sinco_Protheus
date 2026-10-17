import React, { useState, useEffect } from 'react';
import { Upload, Search, CheckCircle, XCircle, Mail, ChevronRight, X, BarChart2, List, ShieldCheck, Save, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function AuditoriaPC() {
    const { user, hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [view, setView] = useState('list'); // list or new
    const [auditorias, setAuditorias] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form state
    const [pcNumero, setPcNumero] = useState('');
    const [xmlFile, setXmlFile] = useState(null);
    const [xmlData, setXmlData] = useState(null);
    const [pcItens, setPcItens] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailData, setEmailData] = useState({ destinatarios: '', assunto: '', corpo: '' });

    const [dbOffline, setDbOffline] = useState(false);

    const fetchAuditorias = async () => {
        try {
            const res = await api.get('/auditoria-pc');
            // Backend retorna { data: [...], offline: bool }
            const payload = res.data;
            setAuditorias(Array.isArray(payload) ? payload : (payload.data || []));
            setDbOffline(payload.offline === true);
        } catch (e) {
            // Só chega aqui se o servidor estiver completamente down (network error)
            setDbOffline(true);
            setAuditorias([]);
        }
    };

    useEffect(() => {
        if (view === 'list' || view === 'kpi') fetchAuditorias();
    }, [view]);

    const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const kpiData = React.useMemo(() => {
        if (!auditorias || auditorias.length === 0) return [];
        const suppliers = {};
        auditorias.forEach(aud => {
            const nome = aud.fornecedor_nome || 'Desconhecido';
            if (!suppliers[nome]) {
                suppliers[nome] = { nome, total: 0, conformes: 0, divergentes: 0 };
            }
            // Count items instead of NFs
            suppliers[nome].total += Number(aud.total_itens || (aud.status === 'Conforme' ? 1 : 1));
            suppliers[nome].conformes += Number(aud.itens_conformes || (aud.status === 'Conforme' ? 1 : 0));
            suppliers[nome].divergentes += Number(aud.itens_divergentes || (aud.status !== 'Conforme' ? 1 : 0));
        });
        const result = Object.values(suppliers).map(s => ({
            ...s,
            percentConforme: s.total > 0 ? Math.round((s.conformes / s.total) * 100) : 0
        }));
        // Sort by amount of divergentes DESC (worst first)
        return result.sort((a, b) => b.divergentes - a.divergentes || b.total - a.total);
    }, [auditorias]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        e.target.value = null;
        if (!file) return;

        setXmlFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            const nfe = xmlDoc.getElementsByTagName('NFe')[0] || xmlDoc.getElementsByTagName('nfeProc')[0];
            if (!nfe) {
                toast.error('XML inválido.');
                return;
            }

            const getText = (tag, parent = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent || '';
            const emit = xmlDoc.getElementsByTagName('emit')[0];
            const ide = xmlDoc.getElementsByTagName('ide')[0];
            const prot = xmlDoc.getElementsByTagName('protNFe')[0];
            let chave = getText('chNFe', prot);
            if(!chave) chave = xmlDoc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe', '');

            const itens = Array.from(xmlDoc.getElementsByTagName('det')).map(det => {
                const prod = det.getElementsByTagName('prod')[0];
                return {
                    cProd: getText('cProd', prod),
                    xProd: getText('xProd', prod),
                    qCom: Number(getText('qCom', prod)),
                    vUnCom: Number(getText('vUnCom', prod))
                };
            });

            setXmlData({
                chave_acesso: chave,
                numero_nf: getText('nNF', ide),
                emitente_nome: getText('xNome', emit),
                emitente_cnpj: getText('CNPJ', emit),
                itens
            });
            toast.success('XML carregado.');
        };
        reader.readAsText(file);
    };

    const runAuditoria = async () => {
        if (!pcNumero || !xmlData) {
            return toast.error('Informe o Pedido e carregue o XML.');
        }

        try {
            // 1. Fetch PC
            const resPc = await api.get(`/protheus/pedido/${pcNumero}`);
            const pcItensDb = resPc.data;
            setPcItens(pcItensDb);

            // 2. Fetch De/Para
            const codigos = xmlData.itens.map(i => i.cProd);
            const resMap = await api.post('/protheus/de-para-produtos', {
                cnpj: xmlData.emitente_cnpj,
                codigos_fornecedor: codigos,
                numero_nf: xmlData.numero_nf
            });
            const productMap = resMap.data || {};

            // 3. Compare
            const auditResult = [];
            let hasDivergence = false;

            for (let i = 0; i < xmlData.itens.length; i++) {
                const xmlItem = xmlData.itens[i];
                const protheusCode = productMap[xmlItem.cProd];

                if (!protheusCode) {
                    hasDivergence = true;
                    auditResult.push({
                        item_xml: String(i + 1),
                        cprod_xml: xmlItem.cProd,
                        qtd_xml: xmlItem.qCom,
                        vlr_xml: xmlItem.vUnCom,
                        cprod_protheus: null,
                        qtd_protheus: null,
                        vlr_protheus: null,
                        status: '❌ Produto não mapeado',
                        detalhe_divergencia: `Fornecedor enviou Cód: ${xmlItem.cProd}, mas não há "De/Para" ativo no Protheus para o CNPJ ${xmlData.emitente_cnpj}.`
                    });
                    continue;
                }

                // Encontrar o item no pedido
                const pcItem = pcItensDb.find(p => p.c7_produto === protheusCode);

                if (!pcItem) {
                    hasDivergence = true;
                    auditResult.push({
                        item_xml: String(i + 1),
                        cprod_xml: xmlItem.cProd,
                        qtd_xml: xmlItem.qCom,
                        vlr_xml: xmlItem.vUnCom,
                        cprod_protheus: protheusCode,
                        qtd_protheus: null,
                        vlr_protheus: null,
                        status: '❌ Divergência de Quantidade',
                        detalhe_divergencia: `Produto ${protheusCode} não existe no Pedido de Compra ${pcNumero}.`
                    });
                    continue;
                }

                const saldoPc = Number(pcItem.c7_quant) - Number(pcItem.c7_quje);
                const precoPc = Number(pcItem.c7_preco);

                let isQtyDiv = Math.abs(xmlItem.qCom - saldoPc) > 0.01;
                let isValDiv = canViewValues && Math.abs(xmlItem.vUnCom - precoPc) > 0.05; // 5 centavos de tolerancia

                if (isQtyDiv || isValDiv) {
                    hasDivergence = true;
                    let desc = [];
                    if (isQtyDiv) desc.push(`Qtd NF: ${xmlItem.qCom} vs Saldo PC: ${saldoPc}`);
                    if (isValDiv) desc.push(`Vlr NF: R$ ${xmlItem.vUnCom} vs Vlr PC: R$ ${precoPc}`);

                    auditResult.push({
                        item_xml: String(i + 1),
                        cprod_xml: xmlItem.cProd,
                        qtd_xml: xmlItem.qCom,
                        vlr_xml: xmlItem.vUnCom,
                        cprod_protheus: protheusCode,
                        qtd_protheus: saldoPc,
                        vlr_protheus: precoPc,
                        status: isQtyDiv ? '❌ Divergência de Quantidade' : '❌ Divergência de Valor',
                        detalhe_divergencia: desc.join(' | ')
                    });
                } else {
                    auditResult.push({
                        item_xml: String(i + 1),
                        cprod_xml: xmlItem.cProd,
                        qtd_xml: xmlItem.qCom,
                        vlr_xml: xmlItem.vUnCom,
                        cprod_protheus: protheusCode,
                        qtd_protheus: saldoPc,
                        vlr_protheus: precoPc,
                        status: '✅ Conforme',
                        detalhe_divergencia: ''
                    });
                }
            }

            setResultado({ status: hasDivergence ? 'Com Divergências' : 'Conforme', itens: auditResult });
            toast.success('Auditoria concluída.');

        } catch (e) {
            toast.error(e.response?.data?.error || 'Erro ao auditar pedido.');
        }
    };

    const handleSalvar = async () => {
        if (!resultado) return;
        try {
            const payload = {
                pedido_compra: pcNumero,
                numero_nf: xmlData.numero_nf,
                chave_acesso: xmlData.chave_acesso,
                fornecedor_nome: xmlData.emitente_nome,
                fornecedor_cnpj: xmlData.emitente_cnpj,
                status: resultado.status,
                usuario: user?.login || 'Sistema',
                itens: resultado.itens
            };
            const res = await api.post('/auditoria-pc', payload);
            toast.success('Auditoria salva com sucesso!');
            setResultado({ ...resultado, id: res.data.id });
        } catch (e) {
            const msg = e.response?.data?.error || e.response?.data?.message || e.message || 'Erro desconhecido';
            console.error('[handleSalvar] erro:', e.response?.status, msg);
            toast.error(`Erro ao salvar: ${msg}`);
        }
    };

    const handleAbrirEmail = () => {
        if (!xmlData || !resultado) return;
        let corpoHtml = `<h2>Auditoria de Recebimento</h2><p>Resultado do confronto da NF <b>${xmlData.numero_nf}</b> com o Pedido de Compra <b>${pcNumero}</b>: <b>${resultado.status}</b>.</p>`;
        const divs = resultado.itens.filter(i => i.status.includes('X'));
        if (divs.length > 0) {
            corpoHtml += `<ul>${divs.map(i => `<li><b>Item ${i.item_xml} (${i.cprod_xml})</b>: ${i.status} — ${i.detalhe_divergencia}</li>`).join('')}</ul>`;
        }
        corpoHtml += `<p>Por favor, verificar para liberação ou rejeição.</p>`;
        setEmailData({
            destinatarios: '',
            assunto: `Auditoria NF ${xmlData.numero_nf} - ${xmlData.emitente_nome} - ${resultado.status}`,
            corpo: corpoHtml
        });
        setIsEmailModalOpen(true);
    };

    const handleSendEmail = async () => {
        try {
            await api.post('/email/send', {
                to: emailData.destinatarios,
                subject: emailData.assunto,
                html: emailData.corpo
            });
            toast.success('E-mail enviado com sucesso.');
            setIsEmailModalOpen(false);
            setView('list');
        } catch (e) {
            toast.error('Erro ao enviar e-mail.');
        }
    };


    return (
        <div className="flex flex-col h-full bg-slate-50 space-y-4">
            <div className="w-full max-w-[1920px] mx-auto space-y-4 px-2 sm:px-4">

                {/* HEADER */}
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                Auditoria 3-Way Match
                                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200 font-semibold">PC vs NF</span>
                            </h1>
                            <p className="text-sm text-slate-500">Confronte Pedidos de Compra com XMLs antes da entrada fiscal.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {view === 'list' && (<>
                            <button onClick={() => setView('kpi')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors"><BarChart2 className="w-4 h-4" /> KPIs</button>
                            <button onClick={() => { setView('new'); setResultado(null); setPcNumero(''); setXmlFile(null); setXmlData(null); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"><Upload className="w-4 h-4" /> Nova Auditoria</button>
                        </>)}
                        {view === 'kpi' && (<>
                            <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors"><List className="w-4 h-4" /> Lista</button>
                            <button onClick={() => { setView('new'); setResultado(null); setPcNumero(''); setXmlFile(null); setXmlData(null); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"><Upload className="w-4 h-4" /> Nova Auditoria</button>
                        </>)}
                        {view === 'new' && (
                            <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors">← Voltar à Lista</button>
                        )}
                    </div>
                </div>

                {/* LISTA */}
                {view === 'list' && (
                    <div className="space-y-4">
                        {dbOffline && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <div><strong>Historico temporariamente indisponivel.</strong> MySQL remoto fora do ar. Novas auditorias ainda funcionam.</div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full md:w-96">
                            <Search className="w-5 h-5 text-slate-400" />
                            <input type="text" placeholder="Buscar por pedido, NF ou fornecedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm text-slate-700" />
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 tracking-wider sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold uppercase">Data</th>
                                            <th className="px-4 py-3 font-semibold uppercase">Pedido</th>
                                            <th className="px-4 py-3 font-semibold uppercase">NF</th>
                                            <th className="px-4 py-3 font-semibold uppercase">Fornecedor</th>
                                            <th className="px-4 py-3 font-semibold uppercase">Usuario</th>
                                            <th className="px-4 py-3 font-semibold uppercase text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {auditorias.filter(a =>
                                            (a.fornecedor_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            (a.pedido_compra || '').includes(searchTerm) ||
                                            (a.numero_nf || '').includes(searchTerm)
                                        ).map(aud => (
                                            <tr key={aud.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-600 text-xs">{new Date(aud.created_at).toLocaleString('pt-BR')}</td>
                                                <td className="px-4 py-3 font-bold font-mono text-slate-800">{aud.pedido_compra}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-800">{aud.numero_nf}</td>
                                                <td className="px-4 py-3 text-slate-700 truncate max-w-[220px]">{aud.fornecedor_nome}</td>
                                                <td className="px-4 py-3 text-slate-600">{aud.usuario}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {aud.status === 'Conforme'
                                                        ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 font-bold text-xs px-2.5 py-1 rounded-full">Conforme</span>
                                                        : <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold text-xs px-2.5 py-1 rounded-full">Divergencia</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        {auditorias.length === 0 && (
                                            <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                                                <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                                <p className="font-medium">Nenhuma auditoria registrada.</p>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* NOVA AUDITORIA */}
                {view === 'new' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider"><Search className="w-4 h-4 text-indigo-600" /> 1. Pedido de Compra</h3>
                                <input type="text" value={pcNumero} onChange={(e) => setPcNumero(e.target.value)} placeholder="Ex: 004675" className="w-full px-4 py-3 border border-slate-300 rounded-lg font-mono text-center text-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider"><Upload className="w-4 h-4 text-indigo-600" /> 2. XML do Fornecedor</h3>
                                <input type="file" accept=".xml" onChange={handleFileUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
                                {xmlData && (<div className="mt-3 text-xs bg-green-50 text-green-800 p-2.5 rounded-lg font-bold border border-green-200">NF {xmlData.numero_nf} carregada</div>)}
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button onClick={runAuditoria} className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold text-base hover:bg-indigo-700 shadow-md transition-colors"><RefreshCw className="w-5 h-5" /> Cruzar Dados Agora</button>
                        </div>
                        {resultado && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className={`px-5 py-3 flex items-center justify-between border-b ${resultado.status === 'Conforme' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className={`flex items-center gap-2 font-bold text-base ${resultado.status === 'Conforme' ? 'text-green-700' : 'text-red-700'}`}>
                                        {resultado.status === 'Conforme' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                        RESULTADO: {resultado.status.toUpperCase()}
                                        <span className="text-xs font-normal text-slate-500 ml-2">{resultado.itens.length} itens</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleAbrirEmail}
                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            <Mail className="w-4 h-4" /> Enviar por E-mail
                                        </button>
                                        {resultado.id
                                            ? <span className="text-green-700 font-semibold text-sm flex items-center gap-1 px-4 py-2 bg-green-50 border border-green-200 rounded-lg"><CheckCircle className="w-4 h-4" /> Salvo</span>
                                            : <button onClick={handleSalvar} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors">
                                                <Save className="w-4 h-4" /> Salvar no Banco
                                              </button>
                                        }
                                    </div>
                                </div>
                                <div className="max-h-[50vh] overflow-y-auto">
                                    <table className="w-full text-left" style={{ fontSize: '11px' }}>
                                        <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-2 border-r border-slate-200 text-center w-10">Item</th>
                                                <th className="p-2 border-r border-slate-200 w-24">Cod Forn.</th>
                                                <th className="p-2 border-r border-slate-200 w-28 text-indigo-700">Cod Lynx</th>
                                                <th className="p-2 border-r border-slate-200 text-right w-20">Qtd NF</th>
                                                <th className="p-2 border-r border-slate-200 text-right w-24 bg-amber-50">Qtd PC</th>
                                                {canViewValues && <th className="p-2 border-r border-slate-200 text-right w-24">Vlr NF</th>}
                                                {canViewValues && <th className="p-2 border-r border-slate-200 text-right w-24 bg-amber-50">Vlr PC</th>}
                                                <th className="p-2 border-r border-slate-200 w-44">Status</th>
                                                <th className="p-2">Detalhes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultado.itens.map((it, idx) => (
                                                <tr key={idx} className={`border-b border-slate-100 ${it.status.includes('X') ? 'bg-red-50/30' : ''}`}>
                                                    <td className="p-2 border-r border-slate-200 font-bold text-center">{it.item_xml}</td>
                                                    <td className="p-2 border-r border-slate-200 font-mono">{it.cprod_xml}</td>
                                                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-indigo-700">{it.cprod_protheus || '-'}</td>
                                                    <td className="p-2 border-r border-slate-200 text-right font-bold">{it.qtd_xml}</td>
                                                    <td className="p-2 border-r border-slate-200 text-right bg-amber-50/30">{it.qtd_protheus ?? '-'}</td>
                                                    {canViewValues && <td className="p-2 border-r border-slate-200 text-right">{formatMoney(it.vlr_xml)}</td>}
                                                    {canViewValues && <td className="p-2 border-r border-slate-200 text-right bg-amber-50/30">{it.vlr_protheus ? formatMoney(it.vlr_protheus) : '-'}</td>}
                                                    <td className="p-2 border-r border-slate-200 font-bold">
                                                        <span className={it.status.includes('X') ? 'text-red-600' : 'text-green-600'}>{it.status}</span>
                                                    </td>
                                                    <td className="p-2 text-xs font-mono text-slate-600">{it.detalhe_divergencia}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* KPIS */}
                {view === 'kpi' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedores Auditados</p>
                                <p className="text-3xl font-black text-slate-800 mt-2">{kpiData.length}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">NFs Com Divergencia</p>
                                <p className="text-3xl font-black text-red-600 mt-2">{kpiData.reduce((a, c) => a + c.divergentes, 0)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Media de Conformidade</p>
                                <p className="text-3xl font-black text-indigo-600 mt-2">
                                    {kpiData.length > 0 ? Math.round((kpiData.reduce((a, c) => a + c.conformes, 0) / kpiData.reduce((a, c) => a + c.total, 0)) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 tracking-wider sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold uppercase w-10 text-center">#</th>
                                            <th className="px-4 py-3 font-semibold uppercase">Fornecedor</th>
                                            <th className="px-4 py-3 font-semibold uppercase text-center w-32">Total</th>
                                            <th className="px-4 py-3 font-semibold uppercase text-center w-32">Conformes</th>
                                            <th className="px-4 py-3 font-semibold uppercase text-center w-32">Divergentes</th>
                                            <th className="px-4 py-3 font-semibold uppercase text-center w-40">Taxa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {kpiData.map((kpi, idx) => (
                                            <tr key={idx} className={kpi.divergentes > 0 ? 'bg-red-50/20' : 'bg-green-50/20'}>
                                                <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                <td className="px-4 py-3 font-bold truncate max-w-[250px]">{kpi.nome}</td>
                                                <td className="px-4 py-3 text-center font-bold">{kpi.total}</td>
                                                <td className="px-4 py-3 text-center text-green-600 font-bold">{kpi.conformes}</td>
                                                <td className="px-4 py-3 text-center text-red-600 font-bold">{kpi.divergentes}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-20 bg-gray-200 rounded-full h-2">
                                                            <div className={`h-2 rounded-full ${kpi.percentConforme > 80 ? 'bg-green-500' : kpi.percentConforme > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${kpi.percentConforme}%` }} />
                                                        </div>
                                                        <span className="font-bold text-xs">{kpi.percentConforme}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {kpiData.length === 0 && (
                                            <tr><td colSpan="6" className="text-center py-10 text-slate-500">Nenhum dado para analisar.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* EMAIL MODAL */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Mail className="w-5 h-5" /> Enviar Relatorio de Divergencia</h3>
                            <button onClick={() => setIsEmailModalOpen(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Destinatarios</label>
                                <input type="text" value={emailData.destinatarios} onChange={(e) => setEmailData({ ...emailData, destinatarios: e.target.value })} placeholder="ex: compras@lynxems.com.br" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Assunto</label>
                                <input type="text" value={emailData.assunto} onChange={(e) => setEmailData({ ...emailData, assunto: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Corpo</label>
                                <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 h-48 overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: emailData.corpo }} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-2 rounded font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
                                <button onClick={handleSendEmail} className="flex-1 py-2 rounded font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2"><Mail className="w-4 h-4" /> Enviar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
