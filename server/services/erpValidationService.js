/**
 * erpValidationService.js
 * Motor central de regras de negócio e validação de dados do SINCO_Protheus.
 * 100% autônomo e desacoplado do TOTVS Protheus, operando sobre o MySQL u494795077_SINCO.
 */

const mysql = require('./mysqlService');

// Helper para validação de CPF
function validarCPF(cpf) {
    cpf = String(cpf).replace(/\D/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

// Helper para validação de CNPJ
function validarCNPJ(cnpj) {
    cnpj = String(cnpj).replace(/\D/g, '');
    if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
}

// BUGFIX (IA): Helper robusto para validação de datas (rejeita strings corrompidas que o V8 erroneamente interpreta como anos antigos)
function validarData(valor) {
    if (!valor) return false;
    const str = String(valor).trim();
    if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str) && !/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
        return false;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return false;
    const year = d.getFullYear();
    return year >= 1970 && year <= 2100;
}

const ErpValidator = {
    // 1. Validação de Cliente
    validarCliente(dados, isUpdate = false) {
        const erros = [];
        // BUGFIX (IA): Previne quebra por objeto dados nulo ou indefinido
        if (!dados || typeof dados !== 'object') {
            return { valido: false, erros: ['Dados do cliente não informados ou formato inválido'] };
        }

        // BUGFIX (IA): Coerção segura para string em código e razão social, suportando valores numéricos
        const codigoLimpo = String(dados.codigo || '').trim();
        const razaoLimpa = String(dados.razao_social || '').trim();

        if (isUpdate) {
            if (codigoLimpo.length < 2) {
                erros.push('Código do cliente inválido ou não informado');
            }
        } else {
            // Se fornecido manualmente na criação, precisa ter ao menos 2 caracteres
            if (codigoLimpo.length > 0 && codigoLimpo.length < 2) {
                erros.push('Se informado manualmente, o código do cliente deve ter pelo menos 2 caracteres');
            }
        }

        if (razaoLimpa.length < 3) {
            erros.push('Razão Social obrigatória (mínimo 3 caracteres)');
        }

        if (dados.cnpj_cpf) {
            const limpo = String(dados.cnpj_cpf).replace(/\D/g, '');
            if (limpo.length === 11 && !validarCPF(limpo)) {
                erros.push('CPF inválido');
            } else if (limpo.length === 14 && !validarCNPJ(limpo)) {
                erros.push('CNPJ inválido');
            } else if (limpo.length !== 11 && limpo.length !== 14 && limpo.length > 0) {
                erros.push('Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)');
            }
        }

        // Validação estrita de formato de E-mail
        // BUGFIX (IA): Coerção segura de e-mail para string antes de trim
        const emailLimpo = String(dados.email || '').trim();
        if (emailLimpo !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailLimpo)) {
                erros.push('E-mail informado possui formato inválido (ex: contato@empresa.com.br)');
            }
        }

        return { valido: erros.length === 0, erros };
    },

    // 2. Validação de Produto
    validarProduto(dados) {
        const erros = [];
        // BUGFIX (IA): Previne quebra por objeto dados nulo ou indefinido
        if (!dados || typeof dados !== 'object') {
            return { valido: false, erros: ['Dados do produto não informados ou formato inválido'] };
        }

        // BUGFIX (IA): Coerção segura para string evitando erro com dados numéricos
        const codigoLimpo = String(dados.codigo || '').trim();
        const descLimpa = String(dados.descricao || '').trim();

        if (codigoLimpo.length < 2) erros.push('Código do produto obrigatório');
        if (descLimpa.length < 2) erros.push('Descrição do produto obrigatória');

        // BUGFIX (IA): Validação estrita de peso líquido contra NaN, Infinity e valores negativos
        if (dados.peso_liquido !== undefined && dados.peso_liquido !== null && dados.peso_liquido !== '') {
            const peso = parseFloat(dados.peso_liquido);
            if (!Number.isFinite(peso) || peso < 0) {
                erros.push('Peso líquido não pode ser negativo ou número inválido');
            }
        }
        return { valido: erros.length === 0, erros };
    },

    // 3. Validação de Ordem de Produção (MATA650 / SC2)
    async validarOrdemProducao(dados, conn, tenantId = null) {
        const erros = [];
        // BUGFIX (IA): Proteção contra payload nulo na abertura de OP
        if (!dados || typeof dados !== 'object') {
            return { valido: false, erros: ['Dados da ordem de produção não informados ou formato inválido'] };
        }

        const clientConn = conn || mysql;
        const codProd = String(dados.produto_codigo || '').trim();

        if (codProd === '') {
            erros.push('Código do produto obrigatório para abertura da OP');
        } else {
            let sql = 'SELECT codigo, descricao, tipo, status FROM erp_produtos WHERE codigo = ?';
            let params = [codProd];
            if (tenantId) {
                sql = 'SELECT codigo, descricao, tipo, status FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ?';
                params = [tenantId, codProd];
            }
            const [prodRows] = await clientConn.query(sql, params);
            if (prodRows.length === 0) {
                erros.push(`Produto "${codProd}" não existe no catálogo de produtos desta empresa`);
            } else {
                const prod = prodRows[0];
                if (prod.status === 'inativo') {
                    erros.push(`Produto "${codProd} - ${prod.descricao}" está inativo`);
                }
                if (prod.tipo === 'MP') {
                    erros.push(`Produto "${codProd}" é matéria-prima (tipo MP) e não pode ser fabricado diretamente`);
                }
            }
        }

        // BUGFIX (IA): Proteção estrita contra Infinity, NaN e valores <= 0 em quantidade planejada
        const qtd = parseFloat(dados.quantidade_planejada);
        if (!Number.isFinite(qtd) || qtd <= 0) {
            erros.push(`Quantidade planejada deve ser maior que zero (informado: ${dados.quantidade_planejada})`);
        }

        // BUGFIX (IA): Validação rigorosa de data de emissão e conclusão da OP com validarData
        if (!dados.data_emissao) {
            erros.push('Data de emissão da OP é obrigatória');
        } else if (!validarData(dados.data_emissao)) {
            erros.push('Data de emissão informada possui formato inválido');
        } else if (dados.data_fim_prevista) {
            if (!validarData(dados.data_fim_prevista)) {
                erros.push('Data prevista de conclusão informada possui formato inválido');
            } else {
                const dtFim = new Date(dados.data_fim_prevista);
                const dtEmissao = new Date(dados.data_emissao);
                if (dtFim < dtEmissao) {
                    erros.push('Data prevista de conclusão não pode ser anterior à data de emissão');
                }
            }
        }

        return { valido: erros.length === 0, erros };
    },

    // 3. Validação Protheus-Grade de Pedido de Venda (AllOk & LineOk)
    async validarPedidoVenda(cabecalho, itens, conn, tenantId = null) {
        const erros = [];
        // BUGFIX (IA): Proteção contra cabeçalho nulo no pedido de venda
        if (!cabecalho || typeof cabecalho !== 'object') {
            return { valido: false, erros: ['Cabeçalho do pedido não informado ou formato inválido'] };
        }

        const clientConn = conn || mysql;
        const cliCod = String(cabecalho.cliente_codigo || '').trim();

        // A. Validação de Cabeçalho
        if (cliCod === '') {
            erros.push('Código do cliente não informado no cabeçalho do pedido');
        } else {
            let cliSql = 'SELECT codigo, razao_social, status FROM erp_clientes WHERE codigo = ?';
            let cliParams = [cliCod];
            if (tenantId) {
                cliSql = 'SELECT codigo, razao_social, status FROM erp_clientes WHERE IdEmpresa = ? AND codigo = ?';
                cliParams = [tenantId, cliCod];
            }
            const [cliRows] = await clientConn.query(cliSql, cliParams);
            if (cliRows.length === 0) {
                erros.push(`Cliente com código "${cliCod}" não existe no cadastro desta empresa`);
            } else if (cliRows[0].status === 'inativo' || cliRows[0].status === 'bloqueado') {
                erros.push(`Cliente "${cliRows[0].razao_social}" está bloqueado para novas vendas`);
            }
        }

        // BUGFIX (IA): Validação rigorosa de data de emissão do pedido com validarData
        if (!cabecalho.data_emissao) {
            erros.push('Data de emissão do pedido obrigatória');
        } else if (!validarData(cabecalho.data_emissao)) {
            erros.push('Data de emissão do pedido possui formato de data inválido');
        }

        // B. Validação de Grid de Itens (LineOk)
        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            erros.push('O pedido de venda deve conter ao menos 1 item');
            return { valido: false, erros };
        }

        const emissaoValida = validarData(cabecalho.data_emissao);
        const dtEmissao = emissaoValida ? new Date(cabecalho.data_emissao) : null;

        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            const numLinha = i + 1;

            if (!item || typeof item !== 'object') {
                erros.push(`Linha ${numLinha}: Dados do item inválidos`);
                continue;
            }

            const codProd = String(item.produto_codigo || '').trim();
            if (codProd === '') {
                erros.push(`Linha ${numLinha}: Produto não informado`);
                continue;
            }

            // Validar existência do produto no MySQL
            let prodSql = 'SELECT codigo, descricao, status FROM erp_produtos WHERE codigo = ?';
            let prodParams = [codProd];
            if (tenantId) {
                prodSql = 'SELECT codigo, descricao, status FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ?';
                prodParams = [tenantId, codProd];
            }
            const [prodRows] = await clientConn.query(prodSql, prodParams);
            if (prodRows.length === 0) {
                erros.push(`Linha ${numLinha}: Produto "${codProd}" não encontrado no catálogo desta empresa`);
            } else if (prodRows[0].status === 'inativo') {
                erros.push(`Linha ${numLinha}: Produto "${codProd} - ${prodRows[0].descricao}" está inativo`);
            }

            // BUGFIX (IA): Quantidade com checagem estrita Number.isFinite contra NaN e Infinity
            const qtd = parseFloat(item.quantidade);
            if (!Number.isFinite(qtd) || qtd <= 0) {
                erros.push(`Linha ${numLinha}: Quantidade deve ser maior que zero (informado: ${item.quantidade})`);
            }

            // BUGFIX (IA): Preço Unitário com checagem estrita Number.isFinite
            const preco = parseFloat(item.preco_unitario);
            if (!Number.isFinite(preco) || preco < 0) {
                erros.push(`Linha ${numLinha}: Preço unitário inválido (informado: ${item.preco_unitario})`);
            }

            // Data de entrega
            // BUGFIX (IA): Validação rigorosa de formato de data de entrega do item com validarData
            if (item.data_entrega_prevista) {
                if (!validarData(item.data_entrega_prevista)) {
                    erros.push(`Linha ${numLinha}: Data de entrega prevista com formato inválido`);
                } else if (dtEmissao) {
                    const dtEntrega = new Date(item.data_entrega_prevista);
                    if (dtEntrega < dtEmissao) {
                        erros.push(`Linha ${numLinha}: Data de entrega prevista não pode ser anterior à data de emissão`);
                    }
                }
            }
        }

        return {
            valido: erros.length === 0,
            erros
        };
    }
};

module.exports = ErpValidator;
