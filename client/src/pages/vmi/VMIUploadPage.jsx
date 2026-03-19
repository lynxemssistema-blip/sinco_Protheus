import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import {
    FileUp, CheckCircle2, AlertCircle, Upload, X,
    Calendar, Package, Loader2, ChevronRight,
    FileSpreadsheet, BarChart2, Users, Save, Box
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const MESES_PT = {
    'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
};
const MESES_LABEL = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

// Palavras reservadas que NÃO são nomes de equipamento
const SKIP_EQUIP = [
    'ordem', 'compra', 'codigo', 'codigo', 'descri', 'follow',
    'faltan', 'entra', 'estq', "oc's", 'ocs', 'metalfisa',
    'data', 'semana', 'wk', 'total'
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const parseNum = (v) => {
    if (v === null || v === undefined || v === '' || v === '-') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
};

function extractMesReferencia(sheetName, fileName, rows) {
    const texto = norm(sheetName + ' ' + fileName);
    let mes = null;
    for (const [nome, num] of Object.entries(MESES_PT)) {
        if (texto.includes(nome)) { mes = num; break; }
    }
    let ano = new Date().getFullYear();
    const dateCell = rows[1]?.[2];
    if (dateCell instanceof Date && !isNaN(dateCell)) {
        ano = dateCell.getFullYear();
        if (!mes) mes = String(dateCell.getMonth() + 1).padStart(2, '0');
    }
    return {
        codigo: mes ? `${ano}-${mes}` : `${ano}-??`,
        label: mes ? `${MESES_LABEL[mes]} / ${ano}` : `${ano}`
    };
}

function parseVMIFile(arrayBuffer, fileName) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    if (rows.length < 4) throw new Error('Planilha inválida: poucas linhas de dados.');

    const mesRef = extractMesReferencia(sheetName, fileName, rows);
    const row2 = rows[1] || [];    // linha 2 (0-based índice 1) — datas, ORDEM DE COMPRA, nomes de equipamentos
    const headerRow = rows[2] || []; // linha 3 (0-based índice 2) — labels e números de pedidos

    // ── Semanas (cols C-G = índices 2-6) ───────────────────────────────────
    const semanas = [2, 3, 4, 5, 6].map((col, i) => {
        const label = String(headerRow[col] || `WK 0${i + 1}`).trim();
        const dateVal = row2[col];
        const data = dateVal instanceof Date && !isNaN(dateVal)
            ? dateVal.toLocaleDateString('pt-BR') : null;
        return { label, data };
    });

    // ── Pedidos de cliente — números na linha 3 (headerRow), col M+ ─────────
    const pedidosMap = [];
    for (let col = 12; col < headerRow.length; col++) {
        const val = headerRow[col];
        if (val === null || val === undefined) continue;
        const cleaned = String(val).replace(/[\s.\-\/]/g, '').replace(/[^0-9]/g, '');
        if (cleaned.length >= 4 && cleaned.length <= 10) {
            const numero = cleaned.padStart(6, '0');
            if (!pedidosMap.find(p => p.col === col)) {
                pedidosMap.push({ col, numero });
            }
        }
    }

    // ── Equipamentos — nomes na linha 2 (row2), a partir de onde "ORDEM DE
    //    COMPRA" termina e aparecem strings de equipamentos ──────────────────
    const equipamentosMap = [];
    const maxCol = Math.max(row2.length, headerRow.length);

    for (let col = 12; col < maxCol; col++) {
        // Prefere o valor da linha 2; se vazio tenta linha 3
        const valRow2 = row2[col];
        const valRow3 = headerRow[col];

        // Ignora células que já são pedidos de cliente
        if (pedidosMap.find(p => p.col === col)) continue;

        // Candidato a nome de equipamento
        const candidato = valRow2 !== null && valRow2 !== undefined && !(valRow2 instanceof Date)
            ? String(valRow2).trim()
            : valRow3 !== null && valRow3 !== undefined
                ? String(valRow3).trim()
                : '';

        if (!candidato || candidato.length < 2) continue;

        // Descarta palavras reservadas
        const nc = norm(candidato);
        if (SKIP_EQUIP.some(s => nc.includes(s))) continue;

        // Descarta puramente numérico
        if (/^\d+$/.test(candidato)) continue;

        equipamentosMap.push({ col, nome: candidato });
    }

    // ── Linhas de dados (row 4+ = índice 3+) ─────────────────────────────
    const itens = [];
    for (let r = 3; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const codigo = String(row[0] || '').trim();
        if (!codigo || norm(codigo) === 'codigo') continue;

        const item = {
            codigo_produto: codigo,
            descricao: String(row[1] || '').trim(),
            qtd_wk01: parseNum(row[2]),
            qtd_wk02: parseNum(row[3]),
            qtd_wk03: parseNum(row[4]),
            qtd_wk04: parseNum(row[5]),
            qtd_wk05: parseNum(row[6]),
            faltantes_firmes: parseNum(row[7]),
            entradas: parseNum(row[8]),
            estoque_soc: parseNum(row[9]),
            pedidos: {},
            equipamentos: {}
        };

        // Quantidades por pedido de cliente
        const totalSem = item.qtd_wk01 + item.qtd_wk02 + item.qtd_wk03 + item.qtd_wk04 + item.qtd_wk05;
        let temPedido = false;
        for (const { col, numero } of pedidosMap) {
            const qty = parseNum(row[col]);
            if (qty > 0) { item.pedidos[numero] = qty; temPedido = true; }
        }

        // Quantidades por equipamento
        let temEquip = false;
        for (const { col, nome } of equipamentosMap) {
            const qty = parseNum(row[col]);
            if (qty > 0) { item.equipamentos[nome] = qty; temEquip = true; }
        }

        if (totalSem > 0 || temPedido || temEquip) itens.push(item);
    }

    // ── Estrutura final de equipamentos → lista de peças ──────────────────
    const equipamentos = equipamentosMap
        .map(({ nome }) => {
            const pecas = itens
                .filter(i => (i.equipamentos?.[nome] || 0) > 0)
                .map(i => ({
                    codigo: i.codigo_produto,
                    descricao: i.descricao,
                    quantidade: i.equipamentos[nome]
                }))
                .sort((a, b) => b.quantidade - a.quantidade);
            const totalPecas = pecas.reduce((s, p) => s + p.quantidade, 0);
            return { nome, pecas, totalPecas };
        })
        .filter(e => e.pecas.length > 0);

    const pedidosUnicos = [...new Set(pedidosMap.map(p => p.numero))];
    return { sheetName, mesRef, semanas, pedidos: pedidosUnicos, itens, equipamentos };
}

// ── componente principal ──────────────────────────────────────────────────────
export default function VMIUploadPage() {
    const [step, setStep] = useState('upload');
    const [dragOver, setDragOver] = useState(false);
    const [arquivo, setArquivo] = useState(null);
    const [parsed, setParsed] = useState(null);
    const [error, setError] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const inputRef = useRef(null);

    const processFile = useCallback((file) => {
        if (!file) return;
        if (!file.name.match(/\.xlsx?$/i)) {
            setError('Arquivo inválido. Envie um arquivo .xlsx ou .xls');
            return;
        }
        setError(null);
        setArquivo(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const result = parseVMIFile(data, file.name);
                setParsed(result);
                setStep('preview');
            } catch (err) {
                setError(`Erro ao processar planilha: ${err.message}`);
                setArquivo(null);
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        processFile(e.dataTransfer.files[0]);
    }, [processFile]);

    const handleSave = async () => {
        if (!parsed || !arquivo) return;
        setStep('saving');
        try {
            const payload = {
                nome_arquivo: arquivo.name,
                mes_referencia: parsed.mesRef.codigo,
                mes_label: parsed.mesRef.label,
                sheet_name: parsed.sheetName,
                itens: parsed.itens,
                pedidos_identificados: parsed.pedidos
            };
            const { data } = await api.post('/vmi/leituras', payload);
            setSavedId(data.id);
            setStep('saved');
        } catch {
            setError('Erro ao salvar leitura. Tente novamente.');
            setStep('preview');
        }
    };

    const resetar = () => {
        setStep('upload');
        setArquivo(null);
        setParsed(null);
        setError(null);
        setSavedId(null);
    };

    const totalDemanda = parsed?.itens.reduce(
        (s, i) => s + i.qtd_wk01 + i.qtd_wk02 + i.qtd_wk03 + i.qtd_wk04 + i.qtd_wk05, 0
    ) ?? 0;
    const totalFaltantes = parsed?.itens.reduce((s, i) => s + i.faltantes_firmes, 0) ?? 0;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <FileUp className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Leitura de Planilha VMI</h1>
                    <p className="text-sm text-slate-500">Upload e análise da planilha de demanda do cliente</p>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ── STEP: UPLOAD ── */}
            {step === 'upload' && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`
                        relative border-2 border-dashed rounded-2xl cursor-pointer transition-all
                        flex flex-col items-center justify-center gap-4 py-20 px-8 text-center
                        ${dragOver
                            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'}
                    `}
                >
                    <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                        aria-label="Selecionar planilha VMI (.xlsx ou .xls)"
                        onChange={(e) => processFile(e.target.files[0])} />
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
                        ${dragOver ? 'bg-blue-100' : 'bg-white shadow-sm border border-slate-200'}`}>
                        <Upload className={`w-8 h-8 ${dragOver ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-slate-700">
                            {dragOver ? 'Solte o arquivo aqui' : 'Arraste a planilha ou clique para selecionar'}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">Formatos aceitos: .xlsx · .xls</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Planilha padrão VMI — FALTANTES FEVEREIRO-METALFISA.xlsx</span>
                    </div>
                </div>
            )}

            {/* ── STEP: PREVIEW ── */}
            {step === 'preview' && parsed && (
                <div className="space-y-4">

                    {/* File info bar */}
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{arquivo?.name}</p>
                            <p className="text-xs text-slate-400">Aba: {parsed.sheetName}</p>
                        </div>
                        <button onClick={resetar} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <StatCard icon={<Calendar className="w-5 h-5 text-blue-600" />}
                            label="Referência" value={parsed.mesRef.label} bg="bg-blue-50" />
                        <StatCard icon={<Package className="w-5 h-5 text-teal-600" />}
                            label="Itens com demanda" value={parsed.itens.length} bg="bg-teal-50" />
                        <StatCard icon={<Users className="w-5 h-5 text-green-600" />}
                            label="Pedidos de clientes" value={parsed.pedidos.length} bg="bg-green-50" />
                        <StatCard icon={<Box className="w-5 h-5 text-cyan-600" />}
                            label="Equipamentos" value={parsed.equipamentos.length} bg="bg-cyan-50" />
                        <StatCard icon={<BarChart2 className="w-5 h-5 text-orange-600" />}
                            label="Total demanda" value={totalDemanda.toLocaleString('pt-BR')} bg="bg-orange-50" />
                    </div>

                    {/* Weeks */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3">Semanas detectadas</h3>
                        <div className="flex flex-wrap gap-2">
                            {parsed.semanas.map((s, i) => (
                                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-center">
                                    <p className="text-xs font-bold text-slate-700">{s.label}</p>
                                    {s.data && <p className="text-xs text-slate-400">{s.data}</p>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Client orders */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3">
                            Pedidos de clientes identificados ({parsed.pedidos.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {parsed.pedidos.map((pc) => (
                                <span key={pc}
                                    className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-semibold px-2.5 py-1 rounded-full">
                                    {pc}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* ── Equipamentos → Peças ────────────────────────────────── */}
                    {parsed.equipamentos.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                                <Box className="w-4 h-4 text-cyan-600" />
                                <h3 className="text-sm font-semibold text-slate-700">
                                    Peças por Equipamento ({parsed.equipamentos.length} equipamentos)
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {parsed.equipamentos.map((equip, i) => (
                                    <EquipamentoRow key={i} equip={equip} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Items table — all rows */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-600">
                                Todos os itens ({parsed.itens.length})
                            </h3>
                            {totalFaltantes > 0 && (
                                <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                                    {totalFaltantes.toLocaleString('pt-BR')} faltantes firmes
                                </span>
                            )}
                        </div>
                        <div className="overflow-auto" style={{ maxHeight: '520px' }}>
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-100 border-b border-slate-200">
                                        <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Código</th>
                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Descrição</th>
                                        {parsed.semanas.map((s, i) => (
                                            <th key={i} className="text-right px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{s.label}</th>
                                        ))}
                                        <th className="text-right px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">Total</th>
                                        <th className="text-right px-3 py-2 font-semibold text-red-500 whitespace-nowrap">Faltantes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {parsed.itens.map((item, i) => {
                                        const total = item.qtd_wk01 + item.qtd_wk02 + item.qtd_wk03 + item.qtd_wk04 + item.qtd_wk05;
                                        return (
                                            <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap">{item.codigo_produto}</td>
                                                <td className="px-3 py-1.5 text-slate-500 max-w-[220px] truncate" title={item.descricao}>{item.descricao || '—'}</td>
                                                {[item.qtd_wk01, item.qtd_wk02, item.qtd_wk03, item.qtd_wk04, item.qtd_wk05].map((q, j) => (
                                                    <td key={j} className={`px-3 py-1.5 text-right tabular-nums ${q > 0 ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                                        {q > 0 ? q : '—'}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-1.5 text-right font-bold text-slate-800 tabular-nums">{total || '—'}</td>
                                                <td className={`px-3 py-1.5 text-right tabular-nums font-medium
                                                    ${item.faltantes_firmes > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                                    {item.faltantes_firmes > 0 ? item.faltantes_firmes : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button onClick={resetar}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button onClick={handleSave}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold transition-colors shadow-sm">
                            <Save className="w-4 h-4" /> Salvar Leitura
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: SAVING ── */}
            {step === 'saving' && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-slate-600 font-medium">Salvando {parsed?.itens.length} itens...</p>
                </div>
            )}

            {/* ── STEP: SAVED ── */}
            {step === 'saved' && (
                <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-9 h-9 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Leitura salva com sucesso!</h2>
                        <p className="text-slate-500 mt-1 text-sm">
                            {parsed?.itens.length} itens · {parsed?.pedidos.length} pedidos · {parsed?.equipamentos.length} equipamentos · {parsed?.mesRef.label}
                        </p>
                        {savedId && <p className="text-xs text-slate-400 mt-1">ID da leitura: #{savedId}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={resetar}
                            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
                            <FileUp className="w-4 h-4" /> Nova Leitura
                        </button>
                        <a href="/vmi/historico"
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 text-sm font-semibold transition-colors">
                            Ver Histórico <ChevronRight className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Equipamento accordion row ────────────────────────────────────────────────
function EquipamentoRow({ equip }) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center justify-center shrink-0">
                        <Box className="w-3.5 h-3.5 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-semibold text-slate-800 text-sm">{equip.nome}</span>
                        <span className="ml-2 text-xs text-slate-400">
                            {equip.pecas.length} {equip.pecas.length === 1 ? 'peça' : 'peças'} · {equip.totalPecas.toLocaleString('pt-BR')} unid. total
                        </span>
                    </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100">
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">Código</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500">Descrição</th>
                                <th className="text-right px-4 py-2 font-semibold text-slate-800 whitespace-nowrap">Qtd / Equip.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {equip.pecas.map((p, j) => (
                                <tr key={j} className="hover:bg-white transition-colors">
                                    <td className="px-4 py-1.5 font-mono text-slate-700 whitespace-nowrap">{p.codigo}</td>
                                    <td className="px-4 py-1.5 text-slate-500 max-w-[300px] truncate" title={p.descricao}>{p.descricao || '—'}</td>
                                    <td className="px-4 py-1.5 text-right font-bold text-slate-800 tabular-nums">{p.quantidade}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, bg }) {
    return (
        <div className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
            <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500 font-medium">{label}</span></div>
            <p className="text-lg font-bold text-slate-800">{value}</p>
        </div>
    );
}
