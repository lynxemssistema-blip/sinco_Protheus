const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/sinco/SINCOFormularioPrincipal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace standard alerts
content = content.replace(/alert\('Erro(.*?)\)/g, "showToast('Erro$1, 'error')");
content = content.replace(/alert\('Nenhuma(.*?)\)/g, "showToast('Nenhuma$1, 'warning')");
content = content.replace(/alert\('Roteiro(.*?)\)/g, "showToast('Roteiro$1, 'success')");
content = content.replace(/alert\('Estrutura(.*?)\)/g, "showToast('Estrutura$1, 'success')");
content = content.replace(/alert\(`Aten(.*?)`\)/g, "showToast(`Aten$1`, 'warning')");
content = content.replace(/alert\(`O componente(.*?)\)/g, "showToast(`O componente$1, 'warning')");
content = content.replace(/alert\(`Componente(.*?)\)/g, "showToast(`Componente$1, 'warning')");
content = content.replace(/alert\("Erro(.*?)\)/g, "showToast(\"Erro$1, 'error')");
content = content.replace(/alert\('Agente(.*?)'\)\)/g, "showToast('Agente$1', 'error'))");


// Also we need to inject the toast HTML block at the very end.
// Let's find the final closing div tag `</div>` before `);`
const toastHtml = `

            {/* Toast Notification */}
            {toast && (
                <div className={\`fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white shadow-xl rounded-lg pointer-events-auto flex ring-1 \${toast.type === 'error' ? 'ring-red-500/30' : toast.type === 'warning' ? 'ring-amber-500/30' : 'ring-green-500/30'} overflow-hidden transform transition-all duration-300 ease-in-out\`}>
                    <div className="flex p-4 w-full">
                        <div className="flex-shrink-0">
                            {toast.type === 'error' ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                            ) : toast.type === 'warning' ? (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            ) : (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                        </div>
                        <div className="ml-3 w-0 flex-1 pt-0.5">
                            <p className="text-sm font-medium text-slate-900">{toast.message}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            <button
                                onClick={() => setToast(null)}
                                className="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none"
                            >
                                <span className="sr-only">Close</span>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
`;

content = content.replace(/\{showSearchRecursoModal && \(/g, `${toastHtml}\n\n            {showSearchRecursoModal && (`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done replacing alerts and injecting toast.');
