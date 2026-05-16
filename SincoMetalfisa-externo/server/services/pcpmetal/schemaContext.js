/**
 * PCPMetal - Schema Context (Default Training Data)
 * Defines tables and their business meaning for both PostgreSQL (Protheus) and MySQL (App).
 * This is seeded into `pcpmetal_schema_context` on first run.
 */

const SCHEMA_CONTEXT = [
    // ======= POSTGRESQL (PROTHEUS ERP) =======
    {
        banco: 'postgresql',
        tabela: 'sc5010',
        descricao: 'Cabeçalho dos Pedidos de Venda do Protheus. Contém número do pedido (c5_num), código do cliente (c5_cliente), filial (c5_filial), data de emissão (c5_emissao), nota fiscal (c5_nota), tipo de pedido (c5_tipo). Registros deletados têm d_e_l_e_t_ preenchido.',
        colunas_chave: JSON.stringify({
            c5_num: 'Número do pedido (6 chars)',
            c5_filial: 'Filial do pedido',
            c5_cliente: 'Código do cliente (Ref: SA1010.a1_cod)',
            c5_emissao: 'Data emissão formato YYYYMMDD',
            c5_nota: 'Nota fiscal (preenchida = faturado)',
            c5_tipo: 'Tipo: B=Bonificação (ignorar)',
            d_e_l_e_t_: 'Registro deletado quando preenchido'
        })
    },
    {
        banco: 'postgresql',
        tabela: 'sc6010',
        descricao: 'Itens dos Pedidos de Venda do Protheus. Contém código do produto (c6_produto), quantidade vendida (c6_qtdven), quantidade entregue (c6_qtdent), saldo a entregar (c6_qtdven - c6_qtdent), data de entrega prevista (c6_entreg), OP vinculada (c6_op), item do pedido (c6_item).',
        colunas_chave: JSON.stringify({
            c6_num: 'Número do pedido (FK SC5010)',
            c6_filial: 'Filial',
            c6_item: 'Número do item (ex: 01, 02)',
            c6_produto: 'Código do produto (FK SB1010)',
            c6_qtdven: 'Quantidade vendida',
            c6_qtdent: 'Quantidade já entregue/faturada',
            c6_qtdlib: 'Quantidade liberada para faturamento',
            c6_entreg: 'Data de entrega prevista formato YYYYMMDD',
            c6_op: 'Ordem de Produção vinculada',
            d_e_l_e_t_: 'Registro deletado quando preenchido'
        })
    },
    {
        banco: 'postgresql',
        tabela: 'sc9010',
        descricao: 'Ordens de Produção (OP) do Protheus. Contém número da OP (c9_op), produto (c9_produto), quantidade (c9_qty), data prevista (c9_datprf), apontamentos, operações. Liga com SC6 pelo número da OP.',
        colunas_chave: JSON.stringify({
            c9_op: 'Número da OP',
            c9_filial: 'Filial',
            c9_produto: 'Código do produto',
            c9_datprf: 'Data previsão término formato YYYYMMDD',
            c9_qty: 'Quantidade da OP',
            c9_quje: 'Quantidade já executada/apontada',
            c9_obs: 'Observações da OP',
            d_e_l_e_t_: 'Registro deletado quando preenchido'
        })
    },
    {
        banco: 'postgresql',
        tabela: 'sh6010',
        descricao: 'Apontamentos de produção do Protheus (chão de fábrica). Registra cada apontamento por operação, recurso, data e quantidade aprovada/refugada.',
        colunas_chave: JSON.stringify({
            h6_op: 'Número da OP apontada',
            h6_dtini: 'Data início apontamento YYYYMMDD',
            h6_dtfim: 'Data fim apontamento YYYYMMDD',
            h6_qtprod: 'Quantidade produzida/aprovada',
            h6_qtrefu: 'Quantidade refugada',
            h6_codoper: 'Código da operação',
            h6_maquina: 'Recurso/Máquina utilizado'
        })
    },
    {
        banco: 'postgresql',
        tabela: 'sa1010',
        descricao: 'Cadastro de Clientes do Protheus.',
        colunas_chave: JSON.stringify({
            a1_cod: 'Código do cliente (FK SC5010.c5_cliente)',
            a1_nome: 'Nome/Razão Social',
            a1_tel: 'Telefone',
            a1_email: 'E-mail',
            a1_end: 'Endereço',
            d_e_l_e_t_: 'Registro deletado quando preenchido'
        })
    },
    {
        banco: 'postgresql',
        tabela: 'sb1010',
        descricao: 'Cadastro de Produtos do Protheus.',
        colunas_chave: JSON.stringify({
            b1_cod: 'Código do produto',
            b1_desc: 'Descrição do produto',
            b1_um: 'Unidade de medida',
            b1_tipo: 'Tipo: PA=Produção, MP=Matéria Prima, etc',
            d_e_l_e_t_: 'Registro deletado quando preenchido'
        })
    },

    // ======= MYSQL (APP INTERNO MetalFisa) =======
    {
        banco: 'mysql',
        tabela: 'producao_apontamentos',
        descricao: 'Apontamentos de produção internos do App MetalFisa. Registra progresso das operações por pedido, produto e sequência de processo.',
        colunas_chave: JSON.stringify({
            id: 'ID do apontamento',
            pedido: 'Número do pedido (Ref SC5010)',
            item: 'Item do pedido',
            op: 'Número da OP',
            sequencia: 'Sequência da operação',
            produto: 'Código do produto',
            qtd_apontada: 'Quantidade apontada nesta operação',
            data_apontamento: 'Data/hora do apontamento',
            usuario: 'Usuário que realizou o apontamento'
        })
    },
    {
        banco: 'mysql',
        tabela: 'material_processo',
        descricao: 'Processos de fabricação definidos por material/produto. Define a sequência de operações necessárias para fabricar cada peça.',
        colunas_chave: JSON.stringify({
            id: 'ID',
            codigo_material: 'Código do material/produto',
            sequencia: 'Sequência do processo (ordem de execução)',
            operacao: 'Nome da operação',
            recurso: 'Máquina ou centro de trabalho',
            tempo_padrao: 'Tempo padrão de execução (horas)',
            descricao: 'Descrição do processo'
        })
    },
    {
        banco: 'mysql',
        tabela: 'app_sales_order_item_notes',
        descricao: 'Notas e planejamento interno de cada item de pedido no App. Contém dados de engenharia, PCP, datas planejadas e reais de cada fase.',
        colunas_chave: JSON.stringify({
            pedido: 'Número do pedido',
            item: 'Item do pedido',
            project_type: 'Tipo de projeto',
            engineering_start_date: 'Início da engenharia',
            bom_released_at: 'Data de liberação da BOM',
            designer_start_real: 'Início real do desenho',
            designer_end_real: 'Fim real do desenho',
            pcp_mat_req_date: 'Data requisição de materiais PCP',
            pcp_mech_start_date: 'Data início mecânica PCP',
            pcp_cut_rel_date: 'Data liberação de corte PCP',
            pcp_notes: 'Observações do PCP',
            nota: 'Nota geral do item'
        })
    },
    {
        banco: 'mysql',
        tabela: 'sinco_os',
        descricao: 'Ordens de Serviço do sistema SINCO de engenharia. Vincula projetos de engenharia com a produção.',
        colunas_chave: JSON.stringify({
            IdOrdemServico: 'ID da OS',
            Projeto: 'Nome/número do projeto',
            Cliente: 'Cliente',
            Descricao: 'Descrição da OS',
            DataAbertura: 'Data de abertura',
            DataEntrega: 'Data prevista de entrega',
            Status: 'Status atual da OS'
        })
    },
    {
        banco: 'mysql',
        tabela: 'app_pcp_delivery_forecasts',
        descricao: 'Previsões de entrega atualizadas pelo PCP. Histórico de revisões das datas de entrega prometidas ao cliente.',
        colunas_chave: JSON.stringify({
            id: 'ID do registro',
            pedido: 'Número do pedido',
            item: 'Item do pedido',
            data_entrega_pcp: 'Data de entrega atualizada pelo PCP',
            quantidade_pcp: 'Quantidade prevista para entrega',
            usuario: 'Usuário que atualizou',
            created_at: 'Data da atualização'
        })
    },
    {
        banco: 'mysql',
        tabela: 'usuario',
        descricao: 'Cadastro de usuários do sistema MetalFisa.',
        colunas_chave: JSON.stringify({
            idUsuario: 'ID do usuário',
            NomeCompleto: 'Nome completo',
            Login: 'Login de acesso',
            TipoUsuario: 'Tipo: admin, PCP, engenharia, etc',
            Setor: 'Setor que o usuário pertence',
            Funcao: 'Função/cargo'
        })
    }
];

module.exports = SCHEMA_CONTEXT;
