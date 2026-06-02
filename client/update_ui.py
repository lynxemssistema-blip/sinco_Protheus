import sys
import re

filename = r"c:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\pcp-refinado\RastreabilidadePCP.jsx"

with open(filename, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace import
content = content.replace("import React, { useState } from 'react';", "import React, { useState, useEffect } from 'react';")

# Remove mockData block (from const mockData = [ to ]; before const [expandedPedidos)
mock_pattern = re.compile(r"const mockData = \[.*?\];", re.DOTALL)
content = mock_pattern.sub("", content)

# Inject state and effect
state_injection = """
    const [dados, setDados] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/pcp-refinado/rastreabilidade');
                if (!response.ok) throw new Error('Erro ao buscar dados');
                const data = await response.json();
                setDados(data);
                if (data.length > 0) {
                    setExpandedPedidos({ [data[0].pedido]: true });
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredDados = dados.filter(p => 
        p.pedido.includes(searchQuery) || 
        p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.itens.some(i => i.produto.includes(searchQuery.toUpperCase()))
    );
"""
content = content.replace("const [expandedPedidos, setExpandedPedidos] = useState({ '100450': true });", state_injection + "\n    const [expandedPedidos, setExpandedPedidos] = useState({});")

# Update search input onChange
content = content.replace(
    """<input 
                            type="text" 
                            placeholder="Buscar Pedido ou Produto..." 
                            className="pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-64"
                        />""",
    """<input 
                            type="text" 
                            placeholder="Buscar Pedido ou Produto..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-64"
                        />"""
)

# Replace map
content = content.replace("{mockData.map(pedido => (", "{isLoading ? (<div className=\"p-8 text-center text-slate-500 flex flex-col items-center\"><Loader2 className=\"w-8 h-8 animate-spin mb-4 text-indigo-500\" />Carregando Rastreabilidade...</div>) : filteredDados.map(pedido => (")

with open(filename, 'w', encoding='utf-8') as f:
    f.write(content)
