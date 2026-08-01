const fs = require('fs');
let content = fs.readFileSync('client/src/components/MasterSheetTab.jsx', 'utf8');

// 1. Update cleanParams
const cpOld = `                const cleanParams = {
                    client: filterParams?.cliente,
                    order: filterParams?.pedido,
                    product: filterParams?.produto,
                    active_only: filterParams?.only_active,
                    status: filterParams?.op_status,
                    _simulateFCS: simulate
                };`;
const cpNew = `                const cleanParams = {
                    client: filterParams?.cliente,
                    order: filterParams?.pedido,
                    product: filterParams?.produto,
                    active_only: filterParams?.only_active,
                    status: filterParams?.op_status,
                    pedcli: filterParams?.pedcli,
                    refCliente: filterParams?.refCliente,
                    somente_prioridades: filterParams?.somente_prioridades,
                    prioridade: filterParams?.prioridade,
                    _simulateFCS: simulate
                };`;
content = content.replace(cpOld, cpNew);
content = content.replace(cpOld.replace(/\n/g, '\r\n'), cpNew.replace(/\n/g, '\r\n'));

// 2. Add 'estruturas' tab
const tabsOld = `        { id: 'itens', label: 'Itens Detalhados', icon: <List className="w-4 h-4" /> },`;
const tabsNew = `        { id: 'itens', label: 'Itens Detalhados', icon: <List className="w-4 h-4" /> },
        { id: 'estruturas', label: 'Estrutura dos Produtos', icon: <List className="w-4 h-4" /> },`;
content = content.replace(tabsOld, tabsNew);
content = content.replace(tabsOld.replace(/\n/g, '\r\n'), tabsNew.replace(/\n/g, '\r\n'));

// 3. Render 'estruturas' tab
const renderOld = `                {activeTab === 'itens' && <ItensTab data={data} />}`;
const renderNew = `                {activeTab === 'itens' && <ItensTab data={data} />}
                {activeTab === 'estruturas' && <EstruturasTab data={data} />}`;
content = content.replace(renderOld, renderNew);
content = content.replace(renderOld.replace(/\n/g, '\r\n'), renderNew.replace(/\n/g, '\r\n'));

// 4. Update ItensTab headers to include Prioridade
const itensHeadOld = `{['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'Qtd Faturada', 'Qtd Faturar (Produzir)', 'Entrega (Prio)', 'Data PCP (Inicial)', 'Nova Data PCP (Simulada)', 'Status do Prazo'].map(h => (`;
const itensHeadNew = `{['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'Prioridade', 'Qtd Faturada', 'Qtd Faturar (Produzir)', 'Entrega (Prio)', 'Data PCP (Inicial)', 'Nova Data PCP (Simulada)', 'Status do Prazo'].map(h => (`;
content = content.replace(itensHeadOld, itensHeadNew);
content = content.replace(itensHeadOld.replace(/\n/g, '\r\n'), itensHeadNew.replace(/\n/g, '\r\n'));

// 5. Update ItensTab body to include Prioridade
const itensBodyOld = `<td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[200px]">{it.descricao}</td>`;
const itensBodyNew = `<td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[200px]">{it.descricao}</td>
                          <td className="px-3 py-2 border-b border-slate-200 border-r font-bold text-orange-600">
                              {it.op_prioridade ? \`Grupo \${it.op_prioridade}\` : '-'}
                          </td>`;
content = content.replace(itensBodyOld, itensBodyNew);
content = content.replace(itensBodyOld.replace(/\n/g, '\r\n'), itensBodyNew.replace(/\n/g, '\r\n'));

// 6. Define EstruturasTab component
const estruturasTabComponent = `
const EstruturasTab = ({ data }) => {
    if (!data.estruturas || data.estruturas.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                Nenhuma estrutura de produto (BOM) encontrada para os itens filtrados.
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="bg-[#1E3A5F] text-white sticky top-0 z-10 shadow">
                    <tr>
                        <th className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap">Produto Pai (Raiz)</th>
                        <th className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap">Componente</th>
                        <th className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap">Descrição Componente</th>
                        <th className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap">Tipo</th>
                        <th className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap text-right">Qtd Necessária</th>
                    </tr>
                </thead>
                <tbody>
                    {data.estruturas.map((est, idx) => (
                        <tr key={idx} className={\`hover:bg-blue-50 \${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}\`}>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-semibold text-[#1E3A5F]">
                                {est.raiz}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-medium">
                                {est.comp}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-slate-700">
                                {est.desc}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-slate-600">
                                {est.tipo}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-bold">
                                {formatNum(est.quant)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
`;

const insertTarget = `const ItensTab = ({ data }) => (`;
content = content.replace(insertTarget, estruturasTabComponent + '\n' + insertTarget);

fs.writeFileSync('client/src/components/MasterSheetTab.jsx', content);
console.log('Replaced successfully');
