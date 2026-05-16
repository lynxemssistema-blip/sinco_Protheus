const fs = require('fs');

const path = 'client/src/pages/VerticalAppointmentPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1
content = content.replace(
    /const \[wasSearched, setWasSearched\] = useState\(false\);.*?/g,
    `const [wasSearched, setWasSearched] = useState(false);\n    const [page, setPage] = useState(1);\n    const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 100 });`
);

// 2
content = content.replace(
    'const loadData = async (showLoader = true) => {',
    'const loadData = async (showLoader = true, targetPage = page) => {'
);

// 3
const oldLoadDataBlock = `const params = { ...filters };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await getVerticalProduction(selectedOp, params);
            setData(Array.isArray(result) ? result : (result?.data || []));`;

const newLoadDataBlock = `const params = { ...filters, page: targetPage, limit: 100 };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await getVerticalProduction(selectedOp, params);
            if (result && result.pagination) {
                setData(result.data || []);
                setPagination(result.pagination);
            } else {
                setData(Array.isArray(result) ? result : (result?.data || []));
            }`;

content = content.replace(oldLoadDataBlock, newLoadDataBlock);

// 4
const oldSearchBlock = `        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            toast.warning('Por favor, informe ao menos um filtro (ex: OP, Pedido, Cliente, Produto ou Período de Planejamento) para buscar.');
            return;
        }
        loadData();`;

const newSearchBlock = `        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            toast.warning('Por favor, informe ao menos um filtro (ex: OP, Pedido, Cliente, Produto ou Período de Planejamento) para buscar.');
            return;
        }
        setPage(1);
        loadData(true, 1);`;

content = content.replace(oldSearchBlock, newSearchBlock);

// 5
const oldTableEnd = `                        </table>
                    </div>
                </div>`;

const newTableEnd = `                        </table>
                    </div>
                    {/* Controles de Paginação */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 px-2 py-2 border-t border-slate-200">
                            <span className="text-sm text-slate-500">
                                Mostrando de {(page - 1) * pagination.limit + 1} até {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} registros
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setPage(p => Math.max(1, p - 1)); loadData(true, page - 1); }}
                                    disabled={page === 1}
                                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-all font-medium text-slate-700"
                                >
                                    Anterior
                                </button>
                                <span className="px-3 py-1 font-bold text-blue-700 bg-blue-50 rounded">
                                    Página {page} de {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => { setPage(p => Math.min(pagination.totalPages, p + 1)); loadData(true, page + 1); }}
                                    disabled={page === pagination.totalPages}
                                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-all font-medium text-slate-700"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>`;

content = content.replace(oldTableEnd, newTableEnd);

fs.writeFileSync(path, content, 'utf8');
console.log('Update success');
