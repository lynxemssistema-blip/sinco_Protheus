import React, { useState, useEffect } from 'react';
import { Upload, Search, CheckCircle, XCircle, Mail, Info, ChevronRight, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function AuditoriaPC() {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // list or new
    const [auditorias, setAuditorias] = useState([]);
    
    // Form state
    const [pcNumero, setPcNumero] = useState('');
    const [xmlFile, setXmlFile] = useState(null);
    const [xmlData, setXmlData] = useState(null);
    const [pcItens, setPcItens] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailData, setEmailData] = useState({ destinatarios: '', assunto: '', corpo: '' });

    const fetchAuditorias = async () => {
        try {
            const res = await api.get('/auditoria-pc');
            setAuditorias(res.data);
        } catch (e) {
            toast.error('Erro ao listar auditorias.');
        }
    };

    useEffect(() => {
        if (view === 'list') fetchAuditorias();
    }, [view]);

    const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                let isValDiv = Math.abs(xmlItem.vUnCom - precoPc) > 0.05; // 5 centavos de tolerancia

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
            
            // Prepara template de email caso haja divergencia
            if (resultado.status === 'Com Divergências') {
                let corpoHtml = `<h2>Auditoria de Recebimento</h2><p>Foram encontradas divergências entre o XML da NF <b>${xmlData.numero_nf}</b> e o Pedido de Compra <b>${pcNumero}</b>.</p><ul>`;
                resultado.itens.filter(i => i.status.includes('❌')).forEach(i => {
                    corpoHtml += `<li><b>Item NF ${i.item_xml} (Cód. Fornecedor: ${i.cprod_xml})</b>: ${i.status} - ${i.detalhe_divergencia}</li>`;
                });
                corpoHtml += `</ul><p>Por favor, verificar para liberação ou rejeição.</p>`;
                
                setEmailData({
                    destinatarios: '',
                    assunto: `Divergência NF ${xmlData.numero_nf} - Fornecedor ${xmlData.emitente_nome}`,
                    corpo: corpoHtml
                });
                setResultado({...resultado, id: res.data.id});
                setIsEmailModalOpen(true);
            } else {
                setView('list');
            }
        } catch (e) {
            toast.error('Erro ao salvar auditoria.');
        }
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
        <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Auditoria 3-Way Match
                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full border border-indigo-200">PC vs NF</span>
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Confronte Pedidos de Compra com XMLs antes da entrada fiscal.</p>
                    </div>
                    {view === 'list' ? (
                        <button onClick={() => { setView('new'); setResultado(null); setPcNumero(''); setXmlFile(null); setXmlData(null); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700">Nova Auditoria</button>
                    ) : (
                        <button onClick={() => setView('list')} className="text-slate-600 font-bold hover:text-slate-900">Voltar à Lista</button>
                    )}
                </div>

                {view === 'list' && (
                    <div className="bg-white rounded border border-black overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-white border-b border-black">
                                <tr>
                                    <th className="px-4 py-2 border-r border-black w-32">Data</th>
                                    <th className="px-4 py-2 border-r border-black w-24">Pedido</th>
                                    <th className="px-4 py-2 border-r border-black w-32">NF</th>
                                    <th className="px-4 py-2 border-r border-black">Fornecedor</th>
                                    <th className="px-4 py-2 border-r border-black w-32">Usuário</th>
                                    <th className="px-4 py-2 w-40 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditorias.map(aud => (
                                    <tr key={aud.id} className="border-b border-slate-200 hover:bg-slate-50">
                                        <td className="px-4 py-2 border-r border-slate-200">{new Date(aud.created_at).toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-2 border-r border-slate-200 font-bold font-mono">{aud.pedido_compra}</td>
                                        <td className="px-4 py-2 border-r border-slate-200 font-bold">{aud.numero_nf}</td>
                                        <td className="px-4 py-2 border-r border-slate-200 truncate max-w-[200px]">{aud.fornecedor_nome}</td>
                                        <td className="px-4 py-2 border-r border-slate-200">{aud.usuario}</td>
                                        <td className="px-4 py-2 text-center">
                                            {aud.status === 'Conforme' ? (
                                                <span className="bg-green-100 text-green-800 font-bold text-xs px-2 py-1 rounded">✅ Conforme</span>
                                            ) : (
                                                <span className="bg-red-100 text-red-800 font-bold text-xs px-2 py-1 rounded">❌ Divergência</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {auditorias.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-500">Nenhuma auditoria registrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {view === 'new' && (
                    <div className="space-y-6">
                        {/* Passo 1: Configuração */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-lg border border-black shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-indigo-600"/> 1. Informar Pedido (Protheus)</h3>
                                <input 
                                    type="text" 
                                    value={pcNumero}
                                    onChange={(e) => setPcNumero(e.target.value)}
                                    placeholder="Digite o número do PC..."
                                    className="w-full p-2 border border-slate-300 rounded font-mono text-center text-lg"
                                />
                            </div>
                            
                            <div className="bg-white p-5 rounded-lg border border-black shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-indigo-600"/> 2. Anexar XML Fornecedor</h3>
                                <input 
                                    type="file" 
                                    accept=".xml" 
                                    onChange={handleFileUpload}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                                {xmlData && (
                                    <div className="mt-2 text-xs bg-green-50 text-green-800 p-2 rounded font-bold border border-green-200">
                                        XML LIDO: NF {xmlData.numero_nf} - {xmlData.emitente_nome}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Passo 2: Executar */}
                        <div className="flex justify-center">
                            <button onClick={runAuditoria} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-black text-lg hover:bg-indigo-700 shadow-md flex items-center gap-2">
                                CRUZAR DADOS AGORA <ChevronRight className="w-6 h-6"/>
                            </button>
                        </div>

                        {/* Resultado da Auditoria */}
                        {resultado && (
                            <div className="bg-white rounded-lg border border-black shadow-sm overflow-hidden">
                                <div className={`p-4 text-white font-black text-lg flex items-center justify-between ${resultado.status === 'Conforme' ? 'bg-green-600' : 'bg-red-600'}`}>
                                    <div className="flex items-center gap-2">
                                        {resultado.status === 'Conforme' ? <CheckCircle className="w-6 h-6"/> : <XCircle className="w-6 h-6"/>}
                                        RESULTADO: {resultado.status.toUpperCase()}
                                    </div>
                                    <button onClick={handleSalvar} className="bg-white text-black px-4 py-1 text-sm rounded shadow hover:bg-slate-100">
                                        Salvar Auditoria no Banco
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm" style={{ fontSize: '11px' }}>
                                        <thead className="bg-slate-100 border-b border-black text-slate-700">
                                            <tr>
                                                <th className="p-2 border-r border-black text-center w-10">Item XML</th>
                                                <th className="p-2 border-r border-black w-20">Cód Fornecedor</th>
                                                <th className="p-2 border-r border-black w-24 text-indigo-700 bg-indigo-50/50">Cód MetalFisa (De/Para)</th>
                                                <th className="p-2 border-r border-black text-right w-20">Qtd NF</th>
                                                <th className="p-2 border-r border-black text-right w-20 bg-amber-50">Qtd Pedido (Saldo)</th>
                                                <th className="p-2 border-r border-black text-right w-20">Vlr NF (R$)</th>
                                                <th className="p-2 border-r border-black text-right w-20 bg-amber-50">Vlr Pedido (R$)</th>
                                                <th className="p-2 border-r border-black w-40">Status do Item</th>
                                                <th className="p-2">Detalhes da Divergência</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultado.itens.map((it, idx) => (
                                                <tr key={idx} className={`border-b border-slate-200 ${it.status.includes('❌') ? 'bg-red-50/30' : ''}`}>
                                                    <td className="p-2 border-r border-black font-bold text-center">{it.item_xml}</td>
                                                    <td className="p-2 border-r border-black font-mono">{it.cprod_xml}</td>
                                                    <td className="p-2 border-r border-black font-mono font-bold text-indigo-700 bg-indigo-50/20">{it.cprod_protheus || '-'}</td>
                                                    <td className="p-2 border-r border-black text-right font-bold">{it.qtd_xml}</td>
                                                    <td className="p-2 border-r border-black text-right bg-amber-50/30">{it.qtd_protheus || '-'}</td>
                                                    <td className="p-2 border-r border-black text-right">{formatMoney(it.vlr_xml)}</td>
                                                    <td className="p-2 border-r border-black text-right bg-amber-50/30">{it.vlr_protheus ? formatMoney(it.vlr_protheus) : '-'}</td>
                                                    <td className="p-2 border-r border-black font-bold">
                                                        {it.status.includes('✅') ? <span className="text-green-600">{it.status}</span> : <span className="text-red-600">{it.status}</span>}
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
            </div>

            {/* Email Modal */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-black">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Mail className="w-5 h-5"/> Enviar Relatório de Divergência</h3>
                            <button onClick={() => setIsEmailModalOpen(false)}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Destinatários (separar por vírgula)</label>
                                <input 
                                    type="text" 
                                    value={emailData.destinatarios}
                                    onChange={(e) => setEmailData({...emailData, destinatarios: e.target.value})}
                                    placeholder="ex: compras@metalfisa.com.br, pcp@metalfisa.com.br"
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Assunto</label>
                                <input 
                                    type="text" 
                                    value={emailData.assunto}
                                    onChange={(e) => setEmailData({...emailData, assunto: e.target.value})}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Corpo do E-mail</label>
                                <div 
                                    className="w-full p-3 border border-gray-300 rounded bg-gray-50 h-48 overflow-y-auto text-sm html-content-preview"
                                    dangerouslySetInnerHTML={{ __html: emailData.corpo }}
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-2 rounded font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
                                <button onClick={handleSendEmail} className="flex-1 py-2 rounded font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2">
                                    <Mail className="w-4 h-4"/> Enviar E-mail
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
