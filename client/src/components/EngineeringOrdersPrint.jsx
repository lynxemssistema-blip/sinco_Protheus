import React from 'react';
import metalfisaLogo from '../assets/metalfisa-logo.png';

const formatDate = (val) => {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const EngineeringOrdersPrint = React.forwardRef(({ orders, visibleCols, generatedAt, filters }, ref) => {
    if (!orders || orders.length === 0) return null;

    // Column groups for header banding
    const engKeys = new Set([
        'engineering_start_date', 'designer_name', 'designer_start_forecast',
        'designer_end_forecast', 'designer_start_real', 'designer_end_real',
        'designer_production_release_date', 'designer_notes'
    ]);
    const pcpKeys = new Set([
        'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date'
    ]);
    const skipKeys = new Set(['acoes']);

    const printCols = visibleCols.filter(c => !skipKeys.has(c.key));

    const engCols = printCols.filter(c => engKeys.has(c.key));
    const pcpCols = printCols.filter(c => pcpKeys.has(c.key));
    const genCols = printCols.filter(c => !engKeys.has(c.key) && !pcpKeys.has(c.key));

    const renderCell = (col, item) => {
        const dateKeys = [
            'emissao', 'engineering_start_date', 'designer_start_forecast', 'designer_end_forecast',
            'designer_start_real', 'designer_end_real', 'designer_production_release_date',
            'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date', 'entrega', 'data_pcp'
        ];
        const val = item[col.key];

        if (col.key === 'emissao') {
            if (!val) return '-';
            const [y, m, d] = val.toString().split('');
            // Protheus format YYYYMMDD
            if (val && val.length === 8) {
                return `${val.slice(6, 8)}/${val.slice(4, 6)}/${val.slice(0, 4)}`;
            }
            return formatDate(val);
        }
        if (dateKeys.includes(col.key)) return formatDate(val);
        if (col.key === 'tipo') return item.status_tipo_item || '-';
        if (col.key === 'cliente') return item.nome_cliente || '-';
        if (col.key === 'op') return item.op_num || '-';
        if (col.key === 'c6_xrevm') return item.rev_codigo || '-';
        if (col.key === 'lib_producao') return formatDate(item.lib_producao);
        if (col.key === 'status') return item.status_item || '-';
        if (col.key === 'quantidade') return item.quantidade ?? '-';
        if (col.key === 'qtd_entregue') return item.qtd_entregue ?? '-';
        if (col.key === 'saldo') return item.saldo ?? '-';
        if (col.key === 'valor_unitario') return item.valor_unitario != null ? `R$ ${Number(item.valor_unitario).toFixed(2)}` : '-';
        if (col.key === 'valor_total') return item.valor_total != null ? `R$ ${Number(item.valor_total).toFixed(2)}` : '-';
        return val != null && val !== '' ? val : '-';
    };

    const activeFilters = filters
        ? Object.entries(filters).filter(([, v]) => v && v !== '').map(([k, v]) => `${k}: ${v}`)
        : [];

    return (
        <div ref={ref} className="print-eng-orders" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', backgroundColor: '#fff', padding: '8mm', color: '#111' }}>
            <style>{`
                @page { size: landscape; margin: 6mm; }
                @media print {
                    body { margin: 0; }
                    .print-eng-orders { font-size: 8px !important; }
                    .no-break { page-break-inside: avoid; }
                }
                .print-eng-orders table { border-collapse: collapse; width: 100%; }
                .print-eng-orders th, .print-eng-orders td {
                    border: 1px solid #bbb;
                    padding: 2px 4px;
                    white-space: nowrap;
                    max-width: 160px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .print-eng-orders thead th { font-weight: bold; font-size: 8px; text-transform: uppercase; }
                .print-eng-orders tr:nth-child(even) td { background-color: #f9f9f9; }
                .print-eng-orders .band-eng th { background-color: #dbeafe; color: #1e3a8a; border-color: #93c5fd; }
                .print-eng-orders .band-pcp th { background-color: #ffedd5; color: #7c2d12; border-color: #fdba74; }
                .print-eng-orders .band-gen th { background-color: #f3f4f6; color: #374151; }
                .print-eng-orders .group-header th { font-size: 9px; text-align: center; }
                .print-eng-orders .group-header .gh-eng { background-color: #1d4ed8; color: #fff; border-color: #1d4ed8; }
                .print-eng-orders .group-header .gh-pcp { background-color: #c2410c; color: #fff; border-color: #c2410c; }
                .print-eng-orders .group-header .gh-gen { background-color: #374151; color: #fff; border-color: #374151; }
                .print-eng-orders .td-eng { background-color: #eff6ff !important; }
                .print-eng-orders .td-pcp { background-color: #fff7ed !important; }
            `}</style>

            {/* ── Header ── */}
            <table style={{ marginBottom: '6px', borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                    <tr>
                        <td style={{ border: '2px solid #111', padding: '4px 8px', width: '16%', verticalAlign: 'middle' }}>
                            <img src={metalfisaLogo} alt="Lynx" style={{ maxHeight: '32px', display: 'block' }} />
                        </td>
                        <td style={{ border: '2px solid #111', borderLeft: 'none', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', width: '60%', verticalAlign: 'middle' }}>
                            Relatório — Pedidos de Engenharia
                        </td>
                        <td style={{ border: '2px solid #111', borderLeft: 'none', padding: '4px 8px', width: '24%', fontSize: '8px', verticalAlign: 'top' }}>
                            <div><strong>Emitido em:</strong> {generatedAt || new Date().toLocaleString('pt-BR')}</div>
                            <div><strong>Total de itens:</strong> {orders.length}</div>
                            {activeFilters.length > 0 && (
                                <div style={{ marginTop: '2px' }}><strong>Filtros:</strong> {activeFilters.join(' · ')}</div>
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* ── Data Table ── */}
            <table>
                <thead>
                    {/* Group row */}
                    <tr className="group-header">
                        {genCols.length > 0 && <th colSpan={genCols.length} className="gh-gen">{genCols.length > 1 ? 'Informações Gerais' : genCols[0].label}</th>}
                        {engCols.length > 0 && <th colSpan={engCols.length} className="gh-eng">Controle de Engenharia</th>}
                        {pcpCols.length > 0 && <th colSpan={pcpCols.length} className="gh-pcp">Controle PCP</th>}
                    </tr>
                    {/* Column labels */}
                    <tr>
                        {genCols.map(c => <th key={c.key} className="band-gen">{c.label}</th>)}
                        {engCols.map(c => <th key={c.key} className="band-eng">{c.label}</th>)}
                        {pcpCols.map(c => <th key={c.key} className="band-pcp">{c.label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {orders.map((item, idx) => (
                        <tr key={`${item.pedido}-${item.item}-${idx}`} className="no-break">
                            {genCols.map(c => (
                                <td key={c.key} style={{ textAlign: ['quantidade', 'qtd_entregue', 'saldo', 'valor_unitario', 'valor_total', 'qtd_pcp'].includes(c.key) ? 'right' : 'left' }}>
                                    {renderCell(c, item)}
                                </td>
                            ))}
                            {engCols.map(c => (
                                <td key={c.key} className="td-eng">
                                    {renderCell(c, item)}
                                </td>
                            ))}
                            {pcpCols.map(c => (
                                <td key={c.key} className="td-pcp">
                                    {renderCell(c, item)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Footer ── */}
            <div style={{ marginTop: '10px', borderTop: '1px solid #bbb', paddingTop: '4px', fontSize: '8px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span>Lynx Indústria e Comércio Ltda — Uso Interno</span>
                <span>Sistema LYNX — Controle de Engenharia</span>
            </div>
        </div>
    );
});

EngineeringOrdersPrint.displayName = 'EngineeringOrdersPrint';
export default EngineeringOrdersPrint;
