const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const pool = require('../services/mysqlService');
const propostaAiService = require('../services/propostaAiService');

// Template inicial da proposta da Irricom (Rev 00)
const IRRICOM_PROPOSTA_INICIAL = {
    id: 'irricom-2026-rev00',
    codigo: 'PROP-2026-001',
    revisao: 'Rev 00',
    notas_revisao: 'Emissão inicial para implantação do Ecossistema SINCO (compatível com qualquer ERP: Protheus, Omie, Sankhya, etc.)',
    cliente_nome: 'Irricom',
    cliente_razao_social: 'Irricom Comércio e Serviços Ltda',
    cliente_site: 'https://irricom.com.br/',
    cliente_instagram: '@irricom_',
    cliente_contato: 'Diretoria / Engenharia',
    cliente_telefone: '(31) 3378-8020',
    cliente_email: 'irricom@irricom.com.br',
    setor: 'Engenharia, Mineração, Montagem Eletromecânica & Irrigação',
    titulo: 'Implementação do Ecossistema SINCO',
    data_proposta: '2026-09-23',
    status: 'enviada', // 'rascunho', 'em_analise', 'enviada', 'revisada', 'aprovada', 'recusada'
    versao: '1.0',
    autor: 'LYNX Soluções Corporativas',
    url_ambiente: 'https://irricom.lynxems.com.br',
    pptx_filename: 'Proposta_Comercial_SINCO_Irricom_Rev00.pptx',
    word_filename: 'Proposta_Comercial_SINCO_Irricom_Rev00.docx',
    
    // Fornecedor e Empresa Parceira (Consórcio de Entrega)
    fornecedor: {
        empresa: 'LYNX EMS SISTEMA & CONSULTORIA',
        razao_social: 'Lynx EMS Soluções em Tecnologia Ltda',
        papel: 'Desenvolvimento e Arquitetura do Software SINCO',
        site: 'https://lynxems.com.br',
        logo_url: '/logos/lynx-ems-logo.jpg'
    },
    empresa_parceira: {
        habilitada: true,
        nome: 'SIM Consultoria',
        razao_social: 'SIM Consultoria & Gestão Empresarial',
        papel: 'Consultoria Especializada em Implantação, Integração de ERPs & Governança de Processos',
        site: 'https://simconsultoria.com.br',
        logo_url: '/logos/sim-consultoria-logo.png',
        contato: 'contato@simconsultoria.com.br',
        responsavel: 'Equipe de Implantação e Governança de Sistemas'
    },
    
    // Cláusula 1: Contexto e Objetivo
    contexto: `A Irricom possui uma operação robusta, unindo engenharia de precisão, manufatura de equipamentos e atendimento a frentes de trabalho rigorosas (como mineração e indústria). Para suportar esse nível de exigência, o cumprimento das normas de segurança e a certificação ISO 9001, a comunicação entre a matriz, a fábrica e as obras precisa ser ágil e integrada.

Neste cenário, a LYNX propõe a implementação do Ecossistema SINCO. O SINCO é uma plataforma de mobilidade operacional, chão de fábrica e gestão de canteiros concebida para operar de forma autônoma ou integrada a qualquer ERP do mercado (com conectores prontos para TOTVS Protheus, Omie, Sankhya, entre outros). O objetivo é digitalizar a gestão de ponta a ponta, entregando mobilidade real à operação de campo e rastreabilidade total à gestão, sem dependência de um único fornecedor de ERP.`,

    // Cláusula 2: Escopo do Projeto (Módulos Detalhados do Ecossistema SINCO)
    escopo_fase1: [
        { 
            id: 'sst', 
            nome: 'Módulo SST (Saúde e Segurança do Trabalho)', 
            descricao: 'Gestão digital de compliance para ambientes de alto risco (mineração, montagem pesada e indústrias), garantindo proteção jurídica e física às equipes.', 
            status: 'Contemplado (Imediato)',
            tag: 'Segurança & Compliance',
            recursos: [
                'DDS Digital (Diálogo Diário de Segurança): Lista de presença com assinatura na tela do celular e registro fotográfico da equipe reunida.',
                'APR (Análise Preliminar de Risco) & PT (Permissão de Trabalho): Liberação digital para trabalho em altura (NR-35), eletricidade (NR-10) e espaço confinado (NR-33).',
                'Checklists Dinâmicos de EPIs/EPCs e Equipamentos: Vistorias com fotos obrigatórias para caminhões munck, guindastes, compressores e ferramentas elétricas.',
                'Controle de Treinamentos e ASOs: Alertas automáticos 30 dias antes do vencimento de exames periódicos e reciclagens normativas.',
                'Gestão de Quase-Acidentes & Indicadores HHT: Registro instantâneo de condições inseguras e cálculo automático de Taxa de Frequência, Gravidade e Homens-Hora Trabalhados.'
            ]
        },
        { 
            id: 'sgq', 
            nome: 'Módulo SGQ (Sistema de Gestão da Qualidade - ISO 9001)', 
            descricao: 'Digitalização completa dos procedimentos de qualidade, rastreabilidade ponta a ponta e geração de Data Books automatizados para clientes exigentes.', 
            status: 'Contemplado (Imediato)',
            tag: 'Qualidade & Auditoria',
            recursos: [
                'FIP e FIQ Digitais (Inspeção de Processo e Qualidade): Critérios de aceitação com tolerâncias dimensionais, ensaios visuais e testes de estanqueidade.',
                'Gestão Completa de RNCs: Abertura imediata na fábrica ou campo, análise de causa-raiz (Ishikawa) e plano de ação estruturado em metodologia 5W2H.',
                'Rastreabilidade por QR Code / Lote: Identificação unitária de conjuntos soldados, rastreio de certificados de matéria-prima e vínculo com o soldador qualificado.',
                'Controle Metrológico de Calibração: Histórico e calibração de paquímetros, micrômetros, torquímetros e manômetros com alertas de expiração.',
                'Emissão Automatizada de Data Book: Compilação de certificados, FIPs, relatórios de ensaios e evidências da obra em 1 clique para entrega aos clientes contratantes.'
            ]
        },
        { 
            id: 'gestao_fabril', 
            nome: 'Módulo Gestão Fabril & Chão de Fábrica', 
            descricao: 'Digitalização da manufatura com apontamento em terminais industriais touch e sincronização nativa com as Ordens de Produção de qualquer ERP (Protheus, Omie, Sankhya, etc.).', 
            status: 'Contemplado (Imediato)',
            tag: 'Manufatura & PCP',
            recursos: [
                'Apontamento Operacional Touch: Telas industriais simplificadas nos postos de corte, conformação, usinagem, caldeiraria, solda, pintura e montagem final.',
                'Tempo Padrão vs. Tempo Real: Aferição automática de produtividade por operador, equipe e máquina, comparando tempos de engenharia com a realidade fabril.',
                'Esteira Produtiva Visual (Kanban Fabril): Painel de status das OPs (Aguardando Matéria-Prima, Em Fabricação, Inspeção SGQ e Liberado para Embarque).',
                'Gestão de Refugo, Sucata e Retrabalho: Quantificação de perdas metálicas e apontamento de motivos para apuração de custos industriais precisos.',
                'Romaneio Eletrônico de Carga: Emissão digital com conferência cega na expedição, garantindo que nenhum item saia para a obra sem inspeção e liberação.'
            ]
        },
        { 
            id: 'gestao_campo', 
            nome: 'Módulo Gestão de Campo & Obras (Canteiros Remotos)', 
            descricao: 'Controle de canteiros remotos com acompanhamento de avanço físico em tempo real e blindagem jurídica contratual.', 
            status: 'Contemplado (Imediato)',
            tag: 'Obras & Engenharia',
            recursos: [
                'Diário de Obra (RDO) 100% Digital: Preenchimento diário pelo encarregado com registro automático de clima (sol/chuva), efetivo presente e frentes ativas.',
                'Avanço Físico Ponderado (% Executado): Acompanhamento por marco contratual com upload de fotos georreferenciadas e carimbo de data/hora.',
                'Relatório Formal de Paralisações e Ocorrências: Registro de chuvas, paralisações por terceiros ou falta de frentes liberadas (essencial para pleitos/claims).',
                'Modo Offline Híbrido: Apontamento normal mesmo em canteiros sem sinal 3G/4G, sincronizando os dados automaticamente quando a conexão retornar.',
                'Painel Geográfico de Canteiros: Mapa interativo para diretores e gerentes monitorarem o status de todas as frentes de serviço ativas no país.'
            ]
        },
        { 
            id: 'solicitacoes_campo', 
            nome: 'Módulo Solicitações de Campo (Canteiro ↔ Matriz)', 
            descricao: 'Canal formal e auditável para requisições de insumos, equipamentos e peças, eliminando o uso de mensagens informais de WhatsApp.', 
            status: 'Contemplado (Imediato)',
            tag: 'Logística & Suprimentos',
            recursos: [
                'Requisição Mobile Instantânea: Encarregados solicitam consumíveis, EPIs complementares, peças e ferramentas pelo celular diretamente na obra.',
                'Alçadas Inteligentes de Aprovação: Roteamento automático de alçadas (Encarregado -> Engenheiro Coordenador -> Suprimentos Matriz).',
                'Rastreabilidade Logística do Pedido: Timeline visual informando Solicitado, Em Cotação, Em Separação, Despachado e Entregue no Canteiro.',
                'Eliminação de Compras em Duplicidade: Centralização de pedidos evitando compras emergenciais repetidas e reduzindo custos operacionais.',
                'Comprovante Eletrônico de Recebimento: Confirmação de entrega no canteiro com foto e assinatura digital de quem recebeu o material.'
            ]
        }
    ],

    escopo_fase2: [
        { 
            id: 'almoxarifado', 
            nome: 'Módulo Almoxarifado & Custódia de Ativos', 
            status: 'Roadmap Futuro (Fora do escopo atual)',
            descricao: 'Gestão de estoques descentralizados, inventários por código de barras e rastreabilidade patrimonial de ferramentas.',
            recursos: [
                'Controle de saldos físicos em tempo real por canteiro e almoxarifado central.',
                'Rastreamento e custódia de caixas de ferramentas e instrumentos patrimoniados.',
                'Transferência entre obras com romaneio de remessa e aceite digital de destino.',
                'Inventário rotativo facilitado por leitor de código de barras e QR Code.'
            ]
        },
        { 
            id: 'compras', 
            nome: 'Módulo Compras & Auditoria de Suprimentos', 
            status: 'Roadmap Futuro (Fora do escopo atual)',
            descricao: 'Portal de cotações, qualificação de fornecedores industriais e auditoria automática de pedidos versus notas fiscais.',
            recursos: [
                'Quadro comparativo de cotações de fornecedores integrado às requisições.',
                'Auditoria automática de Pedidos de Compra versus XML da Nota Fiscal Eletrônica.',
                'Homologação e qualificação de fornecedores de insumos críticos.',
                'Gestão de prazos de entrega (SLA) e penalidades por atraso de fornecedor.'
            ]
        },
        { 
            id: 'financeiro', 
            nome: 'Módulo Gestão Financeira & Medições', 
            status: 'Roadmap Futuro (Fora do escopo atual)',
            descricao: 'Integração de medições contratuais com faturamento e controle de custos por canteiro.',
            recursos: [
                'Faturamento e emissão de medições vinculados ao avanço físico comprovado no RDO.',
                'Fluxo de caixa projetado versus realizado por canteiro de obras.',
                'Centro de custos individualizado para apuração de margem real de cada contrato.',
                'DRE gerencial consolidado e balancete operacional em tempo real.'
            ]
        }
    ],

    // Cláusula 3: Metodologia Ágil (MVP)
    metodologia: {
        titulo: 'Inovação Ágil (MVP - Produto Mínimo Viável)',
        descricao: 'A LYNX não utiliza o modelo tradicional e "engessado" de desenvolvimento de software. Compreendemos o dinamismo das obras da Irricom e, por isso, aplicamos a Metodologia Ágil baseada no conceito de MVP.',
        pilares: [
            { titulo: 'Imersão de 60 Dias', descricao: 'A LYNX dedicará os 2 primeiros meses a um desenvolvimento profundo e exclusivo para adaptar o sistema à realidade operacional da Irricom.' },
            { titulo: 'Aceleração de Valor e Uso Imediato', descricao: 'O aplicativo não precisa estar 100% finalizado para começar a rodar. O sistema será liberado em ciclos. Isso significa que as equipes da Irricom testarão as funcionalidades no dia a dia real da obra, e a LYNX ajustará a plataforma com base nesses feedbacks práticos.' },
            { titulo: 'Foco na Assertividade', descricao: 'Entendemos que a realidade no campo muda. Por isso, não limitamos o projeto com um "escopo fechado e inflexível" nesta fase. Essa evolução orgânica garante que a ferramenta resolva os gargalos reais sem burocracia, gerando eficiência ágil e implantação assertiva.' }
        ]
    },

    // Cláusula 4: Checkpoint de Avaliação e Continuidade
    checkpoint: {
        prazo_dias: 60,
        descricao: `Após o período inicial de 60 dias de imersão e desenvolvimento, a LYNX emitirá um Relatório Técnico de Entrega detalhando o status das funcionalidades, acompanhado de uma Pesquisa de Satisfação.

Com base nesses resultados, a Irricom poderá validar a aderência do sistema à sua rotina e confirmar a continuidade da adoção do ecossistema.`
    },

    // Cláusula 5: Infraestrutura Tecnológica Inclusa
    infraestrutura: [
        'Acesso exclusivo via ambiente web próprio: https://irricom.lynxems.com.br.',
        'Infraestrutura completa de Servidor Web e Banco de Dados em nuvem de alta disponibilidade.',
        'Rotinas automáticas de Backup de segurança de todos os dados operacionais.',
        'Todo o custo de desenvolvimento contínuo, manutenção preventiva e atualizações do App inclusos.'
    ],

    // Cláusula 6: Investimento e Condições Comerciais
    investimento: {
        setup_fase_agil: {
            mes1_valor: 16520.60,
            mes2_valor: 16520.60,
            descricao: 'Referente à dedicação intensiva de desenvolvimento nos primeiros 60 dias de projeto (Impostos inclusos).'
        },
        sustentacao_mensal: {
            vigor: 'A partir do 3º mês (caso a Irricom opte pela continuidade após a avaliação dos 60 dias)',
            valor_base_salarios_minimos: 6,
            franquia_canteiros: 15,
            acrescimo_por_canteiro_extra_sm: 0.5,
            descricao_escalabilidade: 'O sistema cresce de forma justa, acompanhando o volume de negócios da Irricom: para cada canteiro de obra ativo no sistema que ultrapasse o limite da franquia (15), haverá um acréscimo de 0,5 (meio) salário mínimo por canteiro extra na mensalidade daquele mês.',
            autonomia_gestao: 'Autonomia e Transparência Total: O gerenciamento (abertura, inativação ou encerramento) dos canteiros é de controle único e exclusivo da Irricom. Assim que um canteiro é encerrado no sistema, a cobrança adicional atrelada a ele cessa imediatamente, garantindo que vocês paguem apenas pelo volume que estão operando.'
        },
        regras_faturamento: {
            emissao_nf: 'Todo dia 28 de cada mês',
            vencimento: 'Previsto para o dia 10 do mês subsequente'
        },
        cronograma_pagamento: {
            data_aceite: '2026-10-05',
            carencia_dias: 60,
            carencia_descricao: 'Carência Comercial de 60 Dias: Pagamento Inicial somente após 60 dias a partir do aceite formal da proposta.',
            parcelas_setup: [
                {
                    id: 'p1',
                    nome: '1ª Fração - Implantação Piloto & MVP',
                    dias_apos_aceite: 60,
                    valor: 16520.60,
                    dias_vencimento: 10
                },
                {
                    id: 'p2',
                    nome: '2ª Fração - Homologação & Quitação Setup',
                    dias_apos_aceite: 90,
                    valor: 16520.60,
                    dias_vencimento: 10
                }
            ],
            fracao1_dias: 60,
            fracao1_valor: 16520.60,
            fracao1_dias_vencimento: 10,
            fracao2_dias: 90,
            fracao2_valor: 16520.60,
            fracao2_dias_vencimento: 10,
            mensalidade_dia_emissao: 28,
            mensalidade_dia_vencimento: 10,
            incluir_tabela_pdf: true,
            incluir_tabela_word: true,
            incluir_tabela_pptx: true
        }
    }
};

// Template inicial da proposta da Delta (Rev 00)
const DELTA_PROPOSTA_INICIAL = {
    id: 'delta-2026-rev00',
    codigo: 'PROP-2026-002',
    revisao: 'Rev 00',
    notas_revisao: 'Emissão inicial para implantação do Ecossistema SINCO: Fabricação de Fixadores Especiais & SGQ (Condição Comercial: Entrada no Aceite e Parcelas Vinculadas a Entregas, Sem Carência)',
    cliente_nome: 'Delta',
    cliente_razao_social: 'Delta Indústria e Comércio de Parafusos Ltda',
    cliente_site: 'https://parafusosdelta.com.br',
    cliente_instagram: '@parafusosdelta',
    cliente_contato: 'Diretoria Executiva, PCP & Gestão da Qualidade',
    cliente_telefone: '(31) 3393-2466',
    cliente_email: 'deltaparafusos@parafusosdelta.com.br',
    setor: 'Indústria Metalmecânica • Fabricação de Fixadores & Parafusos Especiais',
    titulo: 'Implementação do Ecossistema SINCO: Fabricação de Fixadores & Sistema de Gestão da Qualidade (SGQ)',
    data_proposta: '2026-10-05',
    status: 'enviada',
    versao: '1.0',
    autor: 'LYNX Soluções Corporativas',
    url_ambiente: 'https://delta.lynxems.com.br',
    pptx_filename: 'Proposta_Comercial_SINCO_Delta_Rev00.pptx',
    word_filename: 'Proposta_Comercial_SINCO_Delta_Rev00.docx',

    fornecedor: {
        empresa: 'LYNX EMS SISTEMA & CONSULTORIA',
        razao_social: 'Lynx EMS Soluções em Tecnologia Ltda',
        papel: 'Desenvolvimento e Arquitetura do Software SINCO',
        site: 'https://lynxems.com.br',
        logo_url: '/logos/lynx-ems-logo.jpg'
    },
    empresa_parceira: {
        habilitada: true,
        nome: 'SIM Consultoria',
        razao_social: 'SIM Consultoria & Gestão Empresarial',
        papel: 'Consultoria Especializada em Implantação, Integração de ERPs & Governança de Processos',
        site: 'https://simconsultoria.com.br',
        logo_url: '/logos/sim-consultoria-logo.png',
        contato: 'contato@simconsultoria.com.br',
        responsavel: 'Equipe de Implantação e Governança de Sistemas'
    },

    contexto: `A Delta Indústria e Comércio de Parafusos destaca-se na fabricação de fixadores especiais, parafusos sob medida, tirantes, porcas e peças usinadas para indústrias pesadas como mineração, siderurgia, ferrovia e construção civil. Essa atuação requer rigor dimensional micrométrico, conformidade contínua com normas técnicas (DIN, ISO, ASTM, SAE) e rastreabilidade total de cada lote produzido.

Neste cenário de manufatura de alta exigência, a LYNX propõe a implementação do Ecossistema SINCO como plataforma integrada de Chão de Fábrica (MES) e Sistema de Gestão da Qualidade (SGQ). O SINCO opera com mobilidade touch nos postos de trabalho e arquitetura aberta (autônomo ou integrado a qualquer ERP), digitalizando todo o fluxo produtivo: desde a entrada e conferência do arame/aço na portaria, conformação a frio, laminação de rosca e tratamentos térmicos/superficiais, até a emissão de laudos de qualidade, PPAPs e expedição com romaneio eletrônico.`,

    escopo_fase1: [
        {
            id: 'gestao_fabril_fixadores',
            nome: 'Módulo Fabricação de Fixadores & Chão de Fábrica Touch (MES & PCP)',
            descricao: 'Controle em tempo real de todas as etapas de fabricação de parafusos via terminais industriais touch, integrando tempos padrão, OPs e ritmo de batelada.',
            status: 'Contemplado (Imediato)',
            tag: 'Manufatura & Chão de Fábrica',
            recursos: [
                'Apontamento Touch nos Postos de Fixadores: Telas simplificadas para operadores nas cabeceadoras automáticas, prensas de conformação a frio, laminadoras de rosca (pentes planos/rolos circulares) e tornos mecânicos.',
                'Tempo Padrão vs. Tempo Real: Aferição automática da cadência produtiva (peças/minuto), tempo de setup de ferramental/matrizes e produtividade real por máquina e operador.',
                'Esteira Produtiva Visual (Kanban Fabril de Fixadores): Painel de status das OPs (Aguardando Matéria-Prima, Conformação a Frio, Laminação de Rosca, Tratamento Térmico, Tratamento Superficial, SGQ e Embalagem).',
                'Gestão de Refugo, Quebra de Punção e Sucata Metálica: Quantificação de perdas de aço e apontamento de causas de parada para cálculo de custo real da batelada.',
                'OP Fracionada & Liberação por Lotes: Fracionamento de ordens volumosas em caixas e paletes com etiquetas de código de barras para movimentação interna rastreada.'
            ]
        },
        {
            id: 'sgq_metalmecanico',
            nome: 'Módulo SGQ & Laboratório da Qualidade (ISO 9001 & PPAP)',
            descricao: 'Digitalização rigorosa dos procedimentos de qualidade, controle dimensional de rosca, ensaios metalúrgicos e emissão automatizada de laudos de entrega.',
            status: 'Contemplado (Imediato)',
            tag: 'Qualidade & Rastreabilidade',
            recursos: [
                'FIP e FIQ Digitais (Inspeção de Processo e Qualidade): Critérios com tolerâncias dimensionais para rosca (calibradores passa/não-passa 6g/6H), diâmetro de corpo, altura e chave de cabeça.',
                'Registro de Ensaios Mecânicos por Lote: Lançamento de ensaios de dureza (HRC/HRB), carga de ruptura, torque de aperto e tração para fixadores de alta resistência (Classes 8.8, 10.9 e 12.9).',
                'Rastreabilidade Lote ↔ Corrida do Aço: Vínculo inquebrável entre o lote de parafusos faturado, a Ordem de Produção e o certificado químico da usina siderúrgica fornecedora do aço.',
                'Gestão Completa de RNCs com Metodologia 5W2H e Ishikawa: Abertura imediata na fábrica com registro fotográfico, análise de causa raiz de trincas de forjamento e planos de ação corretiva.',
                'Controle Metrológico de Calibração: Histórico e calibração periódica de paquímetros, micrômetros, torquímetros e projetores de perfil com alertas de expiração.',
                'Emissão de Certificado de Qualidade e Data Book em 1 Clique: Geração de laudos técnicos completos em PDF para acompanhar o romaneio de entrega de clientes corporativos.'
            ]
        },
        {
            id: 'suprimentos_materia_prima',
            nome: 'Módulo Suprimentos, Matéria-Prima & Auditoria 3-Way Matching',
            descricao: 'Recebimento inteligente de matéria-prima (bobinas de arame e barras de aço), confronto com pedidos e rastreio de insumos industriais críticos.',
            status: 'Contemplado (Imediato)',
            tag: 'Suprimentos & Matéria-Prima',
            recursos: [
                'Confronto Triplo Automático (3-Way Matching): Cruzamento automático do XML da NF do fornecedor de aço com o Pedido de Compra e conferência física de peso e lote de corrida.',
                'Gestão de Insumos Críticos de Fabricação: Controle de matrizes de metal duro, punções de cabeceamento, pentes de rosca, fluidos de corte e óleos de estampagem.',
                'Requisição Digital de Almoxarifado: Solicitação rápida de ferramentas e reposição pelos operadores de linha sem tramitação de fichas manuais.'
            ]
        },
        {
            id: 'logistica_beneficiamento',
            nome: 'Módulo Logística, Romaneios & Beneficiamento Externo',
            descricao: 'Controle de envio e retorno de peças para etapas externas (têmpera/revenimento ou galvanoplastia/zincagem/Delta Protekt) e romaneios de expedição.',
            status: 'Contemplado (Imediato)',
            tag: 'Logística & Expedição',
            recursos: [
                'Romaneio de Remessa para Beneficiamento Externo: Controle de lotes enviados para tratamento térmico ou revestimento superficial terceirizado, com saldo em poder de terceiros.',
                'Recebimento de Retorno de Beneficiamento: Conferência de peso, laudo de camada do banho e reincorporação do lote na esteira fabril.',
                'Romaneio Eletrônico de Carga e Expedição: Separação de caixas e embalagens por cliente, conferência de peso líquido/bruto e trava automática para itens sem liberação do SGQ.'
            ]
        },
        {
            id: 'sst_operacional',
            nome: 'Módulo SST (Saúde e Segurança do Trabalho Industrial - NR-06 & NR-12)',
            descricao: 'Proteção jurídica e gestão de segurança no ambiente fabril, com controle digital de EPIs e checklists de máquinas pesadas.',
            status: 'Contemplado (Imediato)',
            tag: 'Segurança & Compliance',
            recursos: [
                'Ficha Digital de Entrega de EPI (NR-06): Assinatura digital na tela do tablet, consulta de C.A. válido e alertas de substituição preventiva para operadores de prensas e tornos.',
                'Checklist Pré-Operacional de Máquinas (NR-12): Vistoria diária obrigatória das travas de proteção mecânica, sensores óticos e botões de emergência de cabeceadoras.',
                'Controle de ASOs e Treinamentos Periódicos: Matriz de capacitação para prensistas e operadores industriais com alertas com 30 dias de antecedência do vencimento.'
            ]
        }
    ],

    escopo_fase2: [
        {
            id: 'engenharia_parametrica',
            nome: 'Catálogo Paramétrico de Parafusos & BOM Automatizado',
            status: 'Roadmap Futuro (Fase 2)',
            descricao: 'Geração rápida de estrutura de produto (BOM) e cálculo automático de consumo de arame por milheiro de parafusos segundo normas DIN/ISO.',
            recursos: [
                'Cálculo de peso linear e consumo de aço por milheiro com base no diâmetro e comprimento do fixador.',
                'Biblioteca paramétrica de cabeças (sextavada, allen, chata, lentilha, francesa, etc.) e passos de rosca (MA, MB, UNC, UNF, BSW).',
                'Geração automática do roteiro padrão de fabricação a partir do desenho técnico da peça.'
            ]
        },
        {
            id: 'portal_b2b_cliente',
            nome: 'Portal B2B do Cliente Delta & Autoatendimento',
            status: 'Roadmap Futuro (Fase 2)',
            descricao: 'Acesso seguro para clientes da Delta consultarem status de OPs em fabricação e emitirem cópias de Certificados da Qualidade e Notas Fiscais.',
            recursos: [
                'Acompanhamento em tempo real do avanço dos pedidos encomendados.',
                'Download instantâneo de certificados de qualidade e ensaios metalúrgicos.',
                'Canal direto para solicitações de cotações e repetição de pedidos anteriores.'
            ]
        },
        {
            id: 'custos_avancados_milheiro',
            nome: 'Custo Industrial Real por Milheiro / Batelada',
            status: 'Roadmap Futuro (Fase 2)',
            descricao: 'Apuração do custo fabril real apurado confrontando consumo de aço, tempo de máquina, energia e desgaste de matrizes.',
            recursos: [
                'Margem de contribuição e lucratividade real por tipo de fixador e cliente.',
                'DRE gerencial industrial integrado ao volume faturado.'
            ]
        }
    ],

    metodologia: {
        titulo: 'Metodologia Ágil de Implantação e Homologação Contínua',
        descricao: 'A LYNX adota metodologia ágil voltada à manufatura real, iniciando pelos gargalos mais urgentes do chão de fábrica e da qualidade, garantindo retorno rápido sobre o investimento.',
        pilares: [
            { titulo: 'Imersão Inicial & Diagnóstico Fabril', descricao: 'Mapeamento detalhado dos postos de conformação, laminação e bancadas de inspeção da Delta nos primeiros dias de projeto.' },
            { titulo: 'Liberação em Ciclos Curtos (Uso Imediato)', descricao: 'Os operadores começam a usar os terminais touch e o SGQ já nas primeiras semanas, refinando as telas com a prática da fábrica.' },
            { titulo: 'Homologação Assistida sem Interrupção Fabril', descricao: 'Transição suave sem paralisar a produção corrente, com treinamento de multiplicadores e suporte contínuo.' }
        ]
    },

    checkpoint: {
        prazo_dias: 60,
        descricao: `Aos 60 dias de implantação e operação piloto (acompanhando o marco da 1ª parcela de setup), a LYNX emitirá um Relatório Técnico de Entrega demonstrando os lotes de fixadores controlados, inspeções de SGQ registradas e indicadores de chão de fábrica apurados.
        
A Delta validará a aderência do sistema ao seu fluxo produtivo fabril e ratificará a homologação assistida para encerramento do setup aos 90 dias e sustentação contínua.`
    },

    infraestrutura: [
        'Acesso exclusivo via ambiente web próprio: https://delta.lynxems.com.br.',
        'Servidor em nuvem de alta disponibilidade, processamento rápido e tolerância a falhas.',
        'Rotinas automáticas diárias de backup de dados operacionais e laudos de qualidade.',
        'Licenciamento para Usuários e Terminais Ilimitados em toda a fábrica e escritórios.',
        'Suporte técnico especializado LYNX nível 2 e 3 e evolução tecnológica contínua inclusas.'
    ],

    investimento: {
        setup_fase_agil: {
            mes1_valor: 9562.30,
            mes2_valor: 8520.00,
            mes3_valor: 12636.00,
            total: 30718.30,
            descricao: 'Investimento total de Implantação e Parametrização dos Módulos Fabris e SGQ: R$ 30.718,30 distribuído em Entrada no aceite e 2 parcelas vinculadas aos marcos de entrega dos módulos (sem carência comercial).'
        },
        sustentacao_mensal: {
            valor_mensal: 4692.30,
            valor_base_salarios_minimos: 3.09,
            base_salario_minimo: 3.09,
            salario_minimo_vigente: 1518.00,
            franquia_canteiros: 1,
            vigencia_meses: 24,
            descricao_escalabilidade: 'Mensalidade de sustentação de R$ 4.692,30/mês com vigência contratual de 24 meses. Reajuste anual a cada 12 meses atrelado à variação oficial do Salário Mínimo Nacional, sem indexação por índices inflacionários voláteis.',
            autonomia_gestao: 'Usuários Ilimitados: Sem cobrança adicional por quantidade de operadores, terminais touch no chão de fábrica ou estações administrativas.'
        },
        regras_faturamento: {
            emissao_nf: 'Todo dia 28 de cada mês',
            vencimento: 'Dia 10 do mês subsequente'
        },
        cronograma_pagamento: {
            data_aceite: '2026-10-05',
            carencia_dias: 0,
            carencia_descricao: 'Condição Comercial: Entrada Facilitada na Assinatura e Parcelamento Vinculado aos Marcos de Entrega (Sem Carência Comercial)',
            parcelas_setup: [
                {
                    id: 'p_entrada',
                    nome: 'Entrada — Assinatura Contratual',
                    dias_apos_aceite: 0,
                    valor: 9562.30,
                    dias_vencimento: 5
                },
                {
                    id: 'p_60d',
                    nome: '1ª Parcela — Implantação Piloto & Chão de Fábrica',
                    dias_apos_aceite: 60,
                    valor: 8520.00,
                    dias_vencimento: 10
                },
                {
                    id: 'p_90d',
                    nome: '2ª Parcela — Homologação & Quitação do Setup',
                    dias_apos_aceite: 90,
                    valor: 12636.00,
                    dias_vencimento: 10
                }
            ],
            fracao1_dias: 0,
            fracao1_valor: 9562.30,
            fracao1_dias_vencimento: 5,
            fracao2_dias: 60,
            fracao2_valor: 8520.00,
            fracao2_dias_vencimento: 10,
            mensalidade_dia_emissao: 28,
            mensalidade_dia_vencimento: 10,
            incluir_tabela_pdf: true,
            incluir_tabela_word: true,
            incluir_tabela_pptx: true
        }
    }
};

// Template inicial da proposta da Marp Painéis (Rev 00)
const MARP_PROPOSTA_INICIAL = {
    id: 'marp-2026-rev00',
    codigo: 'PROP-2026-003',
    revisao: 'Rev 00',
    notas_revisao: 'Emissão inicial para implantação do Ecossistema SINCO: Fabricação de Estruturas para Montagens Elétricas, Chaparia Industrial & Integração Contínua (Entrada + 30d + 6 Mensalidades de Desenvolvimento + Sustentação Contínua)',
    cliente_nome: 'Marp',
    cliente_razao_social: 'Marp Painéis Indústria e Comércio Ltda',
    cliente_site: 'https://marppaineis.com.br/',
    cliente_instagram: '@marppaineis',
    cliente_contato: 'Diretoria Executiva, Engenharia Mecânica & PCP',
    cliente_telefone: '(31) 3396-3036',
    cliente_email: 'comercial@marppaineis.com.br',
    setor: 'Indústria Metalmecânica • Estruturas para Montagens Elétricas & Eletroeletrônicas',
    titulo: 'Implementação do Ecossistema SINCO: Gestão Fabril de Painéis Elétricos, Chaparia & Integração de Processos',
    data_proposta: '2026-10-12',
    status: 'enviada',
    versao: '1.0',
    autor: 'LYNX Soluções Corporativas',
    url_ambiente: 'https://marp.lynxems.com.br',
    pptx_filename: 'Proposta_Comercial_SINCO_Marp_Rev00.pptx',
    word_filename: 'Proposta_Comercial_SINCO_Marp_Rev00.docx',

    fornecedor: {
        empresa: 'LYNX EMS SISTEMA & CONSULTORIA',
        razao_social: 'Lynx EMS Soluções em Tecnologia Ltda',
        papel: 'Desenvolvimento e Arquitetura do Software SINCO',
        site: 'https://lynxems.com.br',
        logo_url: '/logos/lynx-ems-logo.jpg'
    },
    empresa_parceira: {
        habilitada: true,
        nome: 'SIM Consultoria',
        razao_social: 'SIM Consultoria & Gestão Empresarial',
        papel: 'Consultoria Especializada em Implantação, Integração de ERPs & Governança de Processos',
        site: 'https://simconsultoria.com.br',
        logo_url: '/logos/sim-consultoria-logo.png',
        contato: 'contato@simconsultoria.com.br',
        responsavel: 'Equipe de Implantação e Governança de Sistemas'
    },

    contexto: `A Marp Painéis é referência no mercado de fabricação e montagem de estruturas para montagens elétricas e eletroeletrônicas, desenvolvendo soluções integradas como cubículos de média tensão, armários industriais modulares, caixas de passagem e painéis de automação e comando. Sua excelência técnica baseia-se na precisão de corte térmico e puncionamento CNC, conformação rigorosa em dobradeiras CNC, caldeiraria e solda especial, tratamento de superfície e pintura eletrostática a pó com alto grau de proteção mecânica (IP54 a IP65).

Para sustentar o ritmo de crescimento e a alta variabilidade de projetos sob medida, a LYNX propõe a implantação do Ecossistema SINCO. A solução opera como suíte integrada de Engenharia de Chaparia (BOM Multinível), Chão de Fábrica Touch (MES & PCP) e Sistema de Gestão da Qualidade (SGQ). Além disso, esta proposta contempla o desenvolvimento contínuo e a criação de barramentos de integração com os softwares legados da Marp Painéis (ERPs, softwares CAD 3D como SolidEdge e softwares de Nesting/CAM de corte e dobra), digitalizando todo o ciclo operacional com rastreabilidade total de ponta a ponta.`,

    escopo_fase1: [
        {
            id: 'gestao_fabril_paineis',
            nome: 'Módulo Chão de Fábrica Touch (MES & PCP Industrial de Painéis)',
            descricao: 'Controle em tempo real de todas as etapas produtivas via terminais touch nas ilhas fabris, integrando OPs, ritmos de corte/dobra e montagem.',
            status: 'Contemplado (Imediato)',
            tag: 'Manufatura & Chão de Fábrica',
            recursos: [
                'Apontamento Touch nos Postos Produtivos: Telas intuitivas e simplificadas para operadores em Corte Laser CNC, Puncionadeiras, Dobradeiras CNC, Caldeiraria/Solda (MIG/TIG/Ponto), Linha de Pintura a Pó e Montagem Mecânica.',
                'Painel Visual Kanban Fabril de Painéis: Esteira visual das Ordens de Produção em tempo real por setor (Aguardando Matéria-Prima, Corte de Chapas, Conformação/Dobra, Caldeiraria, Pintura, Montagem Mecânica, SGQ e Expedição).',
                'Controle de Sobras e Retalhos de Chapas: Registro de dimensões e bitolas de retalhos reaproveitáveis de corte para reincorporação imediata ao estoque, reduzindo descarte e perda de matéria-prima.',
                'Tempos Padrão vs. Tempos Reais: Aferição automática de cadência, tempo de setup de ferramentas/matrizes de dobra e produtividade real por máquina e equipe.',
                'Fracionamento de OPs & Rastreabilidade de Peças: Emissão de etiquetas de código de barras e QR Code para identificação de portas, laterais, tetos e placas de montagem durante a movimentação interna.'
            ]
        },
        {
            id: 'engenharia_chaparia_bom',
            nome: 'Módulo Engenharia de Chaparia, Estruturas de Painéis & BOM Multinível',
            descricao: 'Gestão de estruturas de produtos multinível, cadastro técnico de bitolas de chaparia e cálculo automatizado de área e peso.',
            status: 'Contemplado (Imediato)',
            tag: 'Engenharia & Estrutura de Produto',
            recursos: [
                'BOM Multinível de Painéis Modulares: Estrutura em árvore detalhada separando perfis estruturais, placas de montagem, fechamentos laterais, portas, tetos, bases soleiras e suportes de barramento.',
                'Tabela de Chaparias & Bitolas Parametrizadas: Classificação por espessura/bitola (Chapa 12, 14, 16, 18, etc.) e material (Aço Carbono SAE 1010/1020, Galvanizado e Aço Inox).',
                'Cálculo Automático de Área de Pintura e Peso Real: Cálculo de área superficial (m²) de cada componente para estimativa precisa de consumo de tinta poliéster/epóxi a pó e pesagem de fardos.',
                'Roteiro Operacional Padrão por Família: Padronização das etapas de fabricação (Corte → Dobra → Solda → Fosfatização/Pintura → Montagem) com instruções de trabalho digitais.'
            ]
        },
        {
            id: 'integracao_softwares_processos',
            nome: 'Módulo Conectores de Integração Aberta & Adequação de Processos',
            descricao: 'Desenvolvimento e parametrização sob medida para adequar o app aos processos da Marp Painéis e conectar com softwares periféricos.',
            status: 'Contemplado (Imediato)',
            tag: 'Integração & Desenvolvimento Customizado',
            recursos: [
                'Desenvolvimento Contínuo de Customizações: Ajuste das telas, regras de negócio e fluxos operacionais da plataforma às práticas da Marp durante os 6 meses de implantação.',
                'Conector para Softwares CAD 3D: Importação de estruturas e metadados de projetos mecânicos oriundos de softwares como SolidEdge, Inventor ou AutoCAD.',
                'Conector para Softwares de Nesting/CAM: Recepção de ordens de corte e relatórios de aproveitamento de chapas gerados por softwares como Lantek, Sigmanest ou Radan.',
                'Integração com ERP / Gestão Corporativa: Comunicação bidirecional com sistemas legados (Protheus, Omie, Sankhya ou banco SQL existente) para pedidos de venda, estoque de chapas e faturamento.'
            ]
        },
        {
            id: 'sgq_paineis_eletricos',
            nome: 'Módulo SGQ & Inspeção de Qualidade (Grau de Proteção IP & Pintura)',
            descricao: 'Digitalização rigorosa das inspeções dimensionais, controle de espessura de camada de tinta e conformidade com normas técnicas.',
            status: 'Contemplado (Imediato)',
            tag: 'Qualidade & Rastreabilidade',
            recursos: [
                'FIP e FIQ Digitais para Chaparia: Inspeção de tolerâncias dimensionais, diagonais e esquadro de portas e armários, furações de botões e barramentos.',
                'Controle de Camada de Pintura Eletrostática: Lançamento e controle de medições de espessura de película seca (micras) e teste de aderência da tinta para proteção anticorrosiva.',
                'Verificação de Vedação & Grau de Proteção IP: Checklist de montagem de perfil de borracha de vedação para conformidade com normas de estanqueidade (IP54 a IP65 conforme NBR IEC 60529).',
                'Gestão de RNCs com Metodologia 5W2H e Fotos: Abertura imediata de Não-Conformidades com foto no posto fabril, identificação de causa raiz (solda, rebarba ou pintura) e planos de ação.'
            ]
        },
        {
            id: 'suprimentos_logistica_expedicao',
            nome: 'Módulo Suprimentos de Chapas, Romaneios & Expedição de Painéis',
            descricao: 'Recebimento de matéria-prima pesada, controle de insumos industriais e romaneio de expedição com rastreamento eletrônico.',
            status: 'Contemplado (Imediato)',
            tag: 'Suprimentos & Expedição',
            recursos: [
                'Confronto Triplo de Matéria-Prima (3-Way Matching): Importação de XML da NFe de chapas de aço e fardos, confrontando peso teórico vs peso balança e pedido de compra.',
                'Controle de Insumos Críticos de Montagem: Fechos, dobradiças, calhas de vedação, parafusos de aterramento, tintas em pó e perfis estruturais.',
                'Romaneio Eletrônico de Expedição por Painel: Separação de armários montados ou desmontados em caixas/paletes com etiquetagem QR Code e trava para itens sem liberação do SGQ.'
            ]
        }
    ],

    escopo_fase2: [
        {
            id: 'portal_cliente_marp',
            nome: 'Portal B2B do Cliente Marp & Acompanhamento de Painéis',
            status: 'Roadmap Futuro (Fase 2)',
            descricao: 'Acesso seguro para clientes e integradores elétricos acompanharem o status de fabricação dos seus painéis com fotos do processo.',
            recursos: [
                'Painel web para cliente consultar o avanço real do seu projeto de armários elétricos.',
                'Acesso a laudos de inspeção dimensional, teste de pintura e certificados de qualidade.',
                'Canal ágil para homologação de alterações de projetos e repetição de pedidos.'
            ]
        },
        {
            id: 'custo_industrial_paineis',
            nome: 'Custo Industrial Real por Painel & Rentabilidade por Projeto',
            status: 'Roadmap Futuro (Fase 2)',
            descricao: 'Apuração do custo fabril real apurado confrontando consumo real de chapas, tempo de corte/dobra, tinta e montagem.',
            recursos: [
                'Margem de contribuição e lucratividade real por tipo de painel, projeto e cliente.',
                'DRE gerencial industrial integrado ao volume faturado.'
            ]
        }
    ],

    metodologia: {
        titulo: 'Metodologia Ágil de Desenvolvimento, Integração e Homologação Contínua',
        descricao: 'A LYNX adota metodologia ágil voltada à manufatura real, iniciando pelas etapas de corte, dobra e qualidade, garantindo que o chão de fábrica passe a operar com agilidade enquanto as integrações são construídas e refinadas.',
        pilares: [
            { titulo: 'Imersão Inicial & Mapeamento de Processos', descricao: 'Mapeamento minucioso dos postos de corte laser, puncionamento, dobra CNC, caldeiraria e pintura da Marp Painéis nas primeiras semanas de projeto.' },
            { titulo: 'Ciclos Contínuos de Entrega (Uso Imediato)', descricao: 'Os operadores começam a usar os terminais touch e o SGQ já nas primeiras semanas, refinando as telas com a prática da fábrica.' },
            { titulo: 'Barramento de Integrações Assistido', descricao: 'Construção paralela dos conectores com softwares de corte/nesting e sistemas de gestão sem interrupção da rotina operacional.' }
        ]
    },

    checkpoint: {
        prazo_dias: 90,
        descricao: `Aos 90 dias de projeto, a LYNX emitirá um Relatório Técnico de Entrega de Meio de Projeto demonstrando as ordens de produção apontadas, retalhos de chaparia controlados, integrações em funcionamento e indicadores apurados.
        
A Marp Painéis validará a aderência do sistema ao seu fluxo produtivo e ratificará o avanço para a conclusão das integrações e homologação final do setup aos 180 dias (6 meses).`
    },

    infraestrutura: [
        'Acesso exclusivo via ambiente web próprio: https://marp.lynxems.com.br.',
        'Servidor em nuvem de alta disponibilidade, processamento rápido e tolerância a falhas.',
        'Rotinas automáticas diárias de backup de dados operacionais e laudos de qualidade.',
        'Licenciamento para Usuários, Terminais Touch e Estações de Engenharia Ilimitados.',
        'Suporte técnico especializado LYNX nível 2 e 3 e evolução tecnológica contínua inclusas.'
    ],

    investimento: {
        setup_fase_agil: {
            entrada_valor: 16532.30,
            parcela30d_valor: 12635.30,
            mensalidade_dev_valor: 17635.32,
            qtd_meses_dev: 6,
            total_mensalidades_dev: 105811.92,
            total: 134979.52,
            descricao: 'Investimento total da Fase de Desenvolvimento, Customização e Integração Contínua: R$ 134.979,52 distribuído em Entrada de R$ 16.532,30 (paga em até 5 dias após assinatura), 2ª parcela de R$ 12.635,30 (em 30 dias) e 6 mensalidades consecutivas de R$ 17.635,32. Incluso todo o desenvolvimento necessário para adequação do app aos processos da Marp Painéis e integrações com todos os softwares possíveis de fazer integrações de processo.'
        },
        sustentacao_mensal: {
            valor_mensal: 9108.00,
            valor_base_salarios_minimos: 6.0,
            base_salario_minimo: 6.0,
            salario_minimo_vigente: 1518.00,
            franquia_canteiros: 1,
            vigencia_meses: 24,
            descricao_escalabilidade: 'Após a fase de desenvolvimento e implantação de 6 meses, mensalidade de sustentação de R$ 9.108,00/mês com base em 6 (seis) Salários Mínimos Nacionais vigentes (com base no piso de R$ 1.518,00 em 2026). Reajustes anuais vinculados unicamente à mesma regra de atualização oficial do Salário Mínimo Nacional, sem indexação por índices inflacionários voláteis.',
            autonomia_gestao: 'Licenciamento Corporativo Completo: Usuários ilimitados, terminais touch no chão de fábrica e estações administrativas sem qualquer cobrança por licença de acesso.'
        },
        regras_faturamento: {
            emissao_nf: 'Todo dia 28 de cada mês',
            vencimento: 'Dia 10 do mês subsequente'
        },
        cronograma_pagamento: {
            data_aceite: '2026-10-12',
            carencia_dias: 0,
            carencia_descricao: 'Condição Especial: Entrada de R$ 16.532,30 em até 5 dias após assinatura, 2ª parcela de R$ 12.635,30 aos 30 dias e 6 mensalidades de R$ 17.635,32 durante o desenvolvimento e integrações.',
            parcelas_setup: [
                {
                    id: 'p_entrada',
                    nome: 'Entrada — Assinatura Contratual & Diagnóstico Inicial',
                    dias_apos_aceite: 0,
                    valor: 16532.30,
                    dias_vencimento: 5
                },
                {
                    id: 'p_30d',
                    nome: '2ª Parcela — Homologação da Arquitetura & Mapeamento de Softwares',
                    dias_apos_aceite: 30,
                    valor: 12635.30,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m1',
                    nome: 'Mensalidade de Desenvolvimento 1/6 — Chaparia, Bitolas & BOM',
                    dias_apos_aceite: 60,
                    valor: 17635.32,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m2',
                    nome: 'Mensalidade de Desenvolvimento 2/6 — Conectores Softwares & Nesting',
                    dias_apos_aceite: 90,
                    valor: 17635.32,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m3',
                    nome: 'Mensalidade de Desenvolvimento 3/6 — Chão de Fábrica Touch & PCP',
                    dias_apos_aceite: 120,
                    valor: 17635.32,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m4',
                    nome: 'Mensalidade de Desenvolvimento 4/6 — Módulo SGQ & Inspeção de Pintura/IP',
                    dias_apos_aceite: 150,
                    valor: 17635.32,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m5',
                    nome: 'Mensalidade de Desenvolvimento 5/6 — Expedição, Romaneio & Piloto Fabril',
                    dias_apos_aceite: 180,
                    valor: 17635.32,
                    dias_vencimento: 10
                },
                {
                    id: 'p_dev_m6',
                    nome: 'Mensalidade de Desenvolvimento 6/6 — Go-Live Assistido & Encerramento do Setup',
                    dias_apos_aceite: 210,
                    valor: 17635.32,
                    dias_vencimento: 10
                }
            ],
            fracao1_dias: 0,
            fracao1_valor: 16532.30,
            fracao1_dias_vencimento: 5,
            fracao2_dias: 30,
            fracao2_valor: 12635.30,
            fracao2_dias_vencimento: 10,
            mensalidade_dia_emissao: 28,
            mensalidade_dia_vencimento: 10,
            incluir_tabela_pdf: true,
            incluir_tabela_word: true,
            incluir_tabela_pptx: true
        }
    }
};

// Armazenamento em memória com fallback resiliente
let memoryPropostas = [MARP_PROPOSTA_INICIAL, DELTA_PROPOSTA_INICIAL, IRRICOM_PROPOSTA_INICIAL];

let memoryClientesLynx = [
    {
        id: 1,
        nome: 'Delta',
        razao_social: 'Delta Indústria e Comércio de Parafusos Ltda',
        cnpj: '00.000.000/0001-00',
        site: 'https://parafusosdelta.com.br',
        instagram: '@parafusosdelta',
        telefone: '(31) 3393-2466',
        email: 'deltaparafusos@parafusosdelta.com.br',
        cidade: 'Contagem',
        uf: 'MG',
        status: 'proposta_ativa',
        contato_principal: 'Diretoria Executiva / Operações'
    },
    {
        id: 2,
        nome: 'Irricom',
        razao_social: 'Irricom Comércio e Serviços Ltda',
        cnpj: '00.000.000/0001-00',
        site: 'https://irricom.com.br/',
        instagram: '@irricom_',
        telefone: '(31) 3378-8020',
        email: 'irricom@irricom.com.br',
        cidade: 'Belo Horizonte',
        uf: 'MG',
        status: 'proposta_ativa',
        contato_principal: 'Diretoria / Engenharia'
    },
    {
        id: 3,
        nome: 'Marp',
        razao_social: 'Marp Painéis Indústria e Comércio Ltda',
        cnpj: '00.000.000/0001-00',
        site: 'https://marppaineis.com.br/',
        instagram: '@marppaineis',
        telefone: '(31) 3396-3036',
        email: 'comercial@marppaineis.com.br',
        cidade: 'Betim',
        uf: 'MG',
        status: 'proposta_ativa',
        contato_principal: 'Diretoria Executiva, Engenharia & PCP'
    }
];

// Helper: inicializa tabela MySQL de forma resiliente
async function initPropostasTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_propostas_comerciais (
                id VARCHAR(64) PRIMARY KEY,
                codigo VARCHAR(32) NOT NULL,
                revisao VARCHAR(16) NOT NULL DEFAULT 'Rev 00',
                cliente_nome VARCHAR(255) NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'rascunho',
                dados_json LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Tenta buscar registros existentes
        const [rows] = await pool.query('SELECT id, codigo, revisao, cliente_nome, titulo, status, dados_json FROM app_propostas_comerciais ORDER BY updated_at DESC');
        if (rows && rows.length > 0) {
            memoryPropostas = rows.map(r => {
                try {
                    const parsed = typeof r.dados_json === 'string' ? JSON.parse(r.dados_json) : r.dados_json;
                    return {
                        ...parsed,
                        id: r.id,
                        codigo: r.codigo,
                        revisao: r.revisao || parsed.revisao || 'Rev 00',
                        cliente_nome: r.cliente_nome,
                        titulo: r.titulo,
                        status: r.status
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);
            
            // Garante que a proposta da Marp esteja em memoryPropostas e no banco
            const hasMarp = memoryPropostas.some(p => p.id === MARP_PROPOSTA_INICIAL.id || (p.cliente_nome && p.cliente_nome.toLowerCase().includes('marp')));
            if (!hasMarp) {
                memoryPropostas.unshift(MARP_PROPOSTA_INICIAL);
                try {
                    await pool.query(
                        'INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE dados_json = VALUES(dados_json)',
                        [MARP_PROPOSTA_INICIAL.id, MARP_PROPOSTA_INICIAL.codigo, MARP_PROPOSTA_INICIAL.revisao, MARP_PROPOSTA_INICIAL.cliente_nome, MARP_PROPOSTA_INICIAL.titulo, MARP_PROPOSTA_INICIAL.status, JSON.stringify(MARP_PROPOSTA_INICIAL)]
                    );
                } catch (e) {}
            }

            // Garante que a proposta da Delta esteja em memoryPropostas e no banco
            const hasDelta = memoryPropostas.some(p => p.id === DELTA_PROPOSTA_INICIAL.id || (p.cliente_nome && p.cliente_nome.toLowerCase() === 'delta'));
            if (!hasDelta) {
                memoryPropostas.unshift(DELTA_PROPOSTA_INICIAL);
                try {
                    await pool.query(
                        'INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE dados_json = VALUES(dados_json)',
                        [DELTA_PROPOSTA_INICIAL.id, DELTA_PROPOSTA_INICIAL.codigo, DELTA_PROPOSTA_INICIAL.revisao, DELTA_PROPOSTA_INICIAL.cliente_nome, DELTA_PROPOSTA_INICIAL.titulo, DELTA_PROPOSTA_INICIAL.status, JSON.stringify(DELTA_PROPOSTA_INICIAL)]
                    );
                } catch (e) {}
            }
            if (memoryPropostas.length === 0) memoryPropostas = [MARP_PROPOSTA_INICIAL, DELTA_PROPOSTA_INICIAL, IRRICOM_PROPOSTA_INICIAL];
        } else {
            // Insere propostas iniciais no MySQL
            await pool.query(
                'INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    MARP_PROPOSTA_INICIAL.id,
                    MARP_PROPOSTA_INICIAL.codigo,
                    MARP_PROPOSTA_INICIAL.revisao,
                    MARP_PROPOSTA_INICIAL.cliente_nome,
                    MARP_PROPOSTA_INICIAL.titulo,
                    MARP_PROPOSTA_INICIAL.status,
                    JSON.stringify(MARP_PROPOSTA_INICIAL)
                ]
            );
            await pool.query(
                'INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    DELTA_PROPOSTA_INICIAL.id,
                    DELTA_PROPOSTA_INICIAL.codigo,
                    DELTA_PROPOSTA_INICIAL.revisao,
                    DELTA_PROPOSTA_INICIAL.cliente_nome,
                    DELTA_PROPOSTA_INICIAL.titulo,
                    DELTA_PROPOSTA_INICIAL.status,
                    JSON.stringify(DELTA_PROPOSTA_INICIAL)
                ]
            );
            await pool.query(
                'INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    IRRICOM_PROPOSTA_INICIAL.id,
                    IRRICOM_PROPOSTA_INICIAL.codigo,
                    IRRICOM_PROPOSTA_INICIAL.revisao,
                    IRRICOM_PROPOSTA_INICIAL.cliente_nome,
                    IRRICOM_PROPOSTA_INICIAL.titulo,
                    IRRICOM_PROPOSTA_INICIAL.status,
                    JSON.stringify(IRRICOM_PROPOSTA_INICIAL)
                ]
            );
        }
    } catch (err) {
        console.warn('⚠️ [PROPOSTAS MYSQL INIT WARN]:', err.message);
    }
}

initPropostasTable();

// GET /api/propostas - Listar todas as propostas emitidas com resumo completo para a tabela
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, codigo, revisao, cliente_nome, titulo, status, dados_json, updated_at, created_at FROM app_propostas_comerciais ORDER BY updated_at DESC');
        if (rows && rows.length > 0) {
            const list = rows.map(r => {
                try {
                    const parsed = typeof r.dados_json === 'string' ? JSON.parse(r.dados_json) : r.dados_json;
                    const setup = parsed?.investimento?.setup_fase_agil;
                    const sustentacao = parsed?.investimento?.sustentacao_mensal;
                    const crono = parsed?.investimento?.cronograma_pagamento;
                    const setupTotal = Array.isArray(crono?.parcelas_setup) && crono.parcelas_setup.length > 0
                        ? crono.parcelas_setup.reduce((sum, p) => sum + (Number(p.valor) || 0), 0)
                        : (parsed?.setup_total || (setup?.mes1_valor || 0) + (setup?.mes2_valor || 0));

                    return {
                        id: r.id,
                        codigo: r.codigo,
                        revisao: r.revisao || parsed?.revisao || 'Rev 00',
                        notas_revisao: parsed?.notas_revisao || '',
                        cliente_nome: r.cliente_nome,
                        cliente_site: parsed?.cliente_site || '',
                        cliente_email: parsed?.cliente_email || '',
                        cliente_telefone: parsed?.cliente_telefone || '',
                        setor: parsed?.setor || '',
                        titulo: r.titulo,
                        status: r.status,
                        data_proposta: parsed?.data_proposta || r.created_at,
                        updated_at: r.updated_at,
                        url_ambiente: parsed?.url_ambiente,
                        versao: parsed?.versao || '1.0',
                        setup_total: setupTotal,
                        sustentacao_sm: sustentacao?.valor_base_salarios_minimos || 6,
                        franquia_canteiros: sustentacao?.franquia_canteiros || 15
                    };
                } catch {
                    return { id: r.id, codigo: r.codigo, revisao: r.revisao || 'Rev 00', cliente_nome: r.cliente_nome, titulo: r.titulo, status: r.status };
                }
            });
            return res.json(list);
        }
    } catch (err) {
        console.warn('⚠️ [GET PROPOSTAS FALLBACK]:', err.message);
    }
    
    // Fallback memória
    res.json(memoryPropostas.map(p => {
        const setup = p.investimento?.setup_fase_agil;
        const sustentacao = p.investimento?.sustentacao_mensal;
        const crono = p.investimento?.cronograma_pagamento;
        const setupTotal = Array.isArray(crono?.parcelas_setup) && crono.parcelas_setup.length > 0
            ? crono.parcelas_setup.reduce((sum, p) => sum + (Number(p.valor) || 0), 0)
            : (p.setup_total || (setup?.mes1_valor || 0) + (setup?.mes2_valor || 0));

        return {
            id: p.id,
            codigo: p.codigo,
            revisao: p.revisao || 'Rev 00',
            notas_revisao: p.notas_revisao || '',
            cliente_nome: p.cliente_nome,
            cliente_site: p.cliente_site || '',
            cliente_email: p.cliente_email || '',
            cliente_telefone: p.cliente_telefone || '',
            setor: p.setor || '',
            titulo: p.titulo,
            status: p.status,
            data_proposta: p.data_proposta,
            url_ambiente: p.url_ambiente,
            versao: p.versao,
            setup_total: setupTotal,
            sustentacao_sm: sustentacao?.valor_base_salarios_minimos || 6,
            franquia_canteiros: sustentacao?.franquia_canteiros || 15
        };
    }));
});

// Helper: enriquece proposta existente com os recursos funcionais detalhados do SINCO
function enrichPropostaWithSincoFeatures(prop) {
    if (!prop) return prop;
    const enriched = { ...prop };

    // Se for a proposta da Delta ou da Marp, preserva o escopo fabril e SGQ próprio sem mesclar com Irricom
    if (enriched.cliente_nome?.toLowerCase().includes('delta') || enriched.id?.includes('delta') ||
        enriched.cliente_nome?.toLowerCase().includes('marp') || enriched.id?.includes('marp')) {
        return enriched;
    }
    
    const masterMapFase1 = {};
    IRRICOM_PROPOSTA_INICIAL.escopo_fase1.forEach(m => { masterMapFase1[m.id] = m; });
    
    const masterMapFase2 = {};
    IRRICOM_PROPOSTA_INICIAL.escopo_fase2.forEach(m => { masterMapFase2[m.id] = m; });

    if (Array.isArray(enriched.escopo_fase1) && enriched.escopo_fase1.length > 0) {
        enriched.escopo_fase1 = enriched.escopo_fase1.map(m => {
            const master = masterMapFase1[m.id] || Object.values(masterMapFase1).find(item => item.id.includes(m.id) || (m.id && m.id.includes(item.id)));
            if (master) {
                return {
                    ...master,
                    ...m,
                    recursos: (m.recursos && m.recursos.length > 0) ? m.recursos : master.recursos,
                    tag: m.tag || master.tag,
                    descricao: (m.descricao && m.descricao.length > 60) ? m.descricao : master.descricao
                };
            }
            return m;
        });
    } else {
        enriched.escopo_fase1 = IRRICOM_PROPOSTA_INICIAL.escopo_fase1;
    }

    if (Array.isArray(enriched.escopo_fase2) && enriched.escopo_fase2.length > 0) {
        enriched.escopo_fase2 = enriched.escopo_fase2.map(m => {
            const master = masterMapFase2[m.id] || Object.values(masterMapFase2).find(item => item.id.includes(m.id) || (m.id && m.id.includes(item.id)));
            if (master) {
                return {
                    ...master,
                    ...m,
                    recursos: (m.recursos && m.recursos.length > 0) ? m.recursos : master.recursos,
                    descricao: m.descricao || master.descricao
                };
            }
            return m;
        });
    } else {
        enriched.escopo_fase2 = IRRICOM_PROPOSTA_INICIAL.escopo_fase2;
    }

    if (!enriched.investimento) {
        enriched.investimento = { ...IRRICOM_PROPOSTA_INICIAL.investimento };
    }
    if (!enriched.investimento.cronograma_pagamento) {
        enriched.investimento.cronograma_pagamento = {
            data_aceite: enriched.data_proposta || '2026-10-05',
            carencia_dias: 60,
            carencia_descricao: 'Carência Comercial de 60 Dias: Pagamento Inicial somente após 60 dias a partir do aceite formal da proposta.',
            fracao1_dias: 60,
            fracao1_valor: enriched.investimento?.setup_fase_agil?.mes1_valor || 16520.60,
            fracao1_dias_vencimento: 10,
            fracao2_dias: 90,
            fracao2_valor: enriched.investimento?.setup_fase_agil?.mes2_valor || 16520.60,
            fracao2_dias_vencimento: 10,
            mensalidade_dia_emissao: 28,
            mensalidade_dia_vencimento: 10,
            incluir_tabela_pdf: true,
            incluir_tabela_word: true,
            incluir_tabela_pptx: true
        };
    } else {
        const c = enriched.investimento.cronograma_pagamento;
        if (c.incluir_tabela_pdf === undefined) c.incluir_tabela_pdf = true;
        if (c.incluir_tabela_word === undefined) c.incluir_tabela_word = true;
        if (c.incluir_tabela_pptx === undefined) c.incluir_tabela_pptx = true;
    }

    if (!Array.isArray(enriched.investimento.cronograma_pagamento.parcelas_setup) || enriched.investimento.cronograma_pagamento.parcelas_setup.length === 0) {
        const crono = enriched.investimento.cronograma_pagamento;
        enriched.investimento.cronograma_pagamento.parcelas_setup = [
            {
                id: 'p1',
                nome: '1ª Fração - Implantação Piloto & MVP',
                dias_apos_aceite: Number(crono.carencia_dias || crono.fracao1_dias || 60),
                valor: Number(crono.fracao1_valor || enriched.investimento?.setup_fase_agil?.mes1_valor || 16520.60),
                dias_vencimento: Number(crono.fracao1_dias_vencimento || 10)
            },
            {
                id: 'p2',
                nome: '2ª Fração - Homologação & Quitação Setup',
                dias_apos_aceite: Number(crono.fracao2_dias || 90),
                valor: Number(crono.fracao2_valor || enriched.investimento?.setup_fase_agil?.mes2_valor || 16520.60),
                dias_vencimento: Number(crono.fracao2_dias_vencimento || 10)
            }
        ];
    }

    if (!enriched.fornecedor) {
        enriched.fornecedor = {
            empresa: 'LYNX EMS SISTEMA & CONSULTORIA',
            razao_social: 'Lynx EMS Soluções em Tecnologia Ltda',
            papel: 'Desenvolvimento e Arquitetura do Software SINCO',
            site: 'https://lynxems.com.br',
            logo_url: '/logos/lynx-ems-logo.jpg'
        };
    }

    if (!enriched.empresa_parceira) {
        enriched.empresa_parceira = {
            habilitada: true,
            nome: 'SIM Consultoria',
            razao_social: 'SIM Consultoria & Gestão Empresarial',
            papel: 'Consultoria Especializada em Implantação, Integração de ERPs & Governança de Processos',
            site: 'https://simconsultoria.com.br',
            logo_url: '/logos/sim-consultoria-logo.png',
            contato: 'contato@simconsultoria.com.br',
            responsavel: 'Equipe de Implantação e Governança de Sistemas'
        };
    }

    if (enriched.titulo && typeof enriched.titulo === 'string') {
        enriched.titulo = enriched.titulo.replace(/Sinco-Protheus/gi, 'Ecossistema SINCO');
    }
    if (enriched.notas_revisao && typeof enriched.notas_revisao === 'string') {
        enriched.notas_revisao = enriched.notas_revisao.replace(/Sinco-Protheus/gi, 'Ecossistema SINCO');
    }

    return enriched;
}

// GET /api/propostas/:id - Detalhes completos da proposta
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT dados_json FROM app_propostas_comerciais WHERE id = ?', [id]);
        if (rows && rows.length > 0) {
            const data = typeof rows[0].dados_json === 'string' ? JSON.parse(rows[0].dados_json) : rows[0].dados_json;
            return res.json(enrichPropostaWithSincoFeatures(data));
        }
    } catch (err) {
        console.warn('⚠️ [GET PROPOSTA ID FALLBACK]:', err.message);
    }

    const found = memoryPropostas.find(p => p.id === id);
    if (found) {
        return res.json(enrichPropostaWithSincoFeatures(found));
    }

    // Se for 'delta' ou 'delta-2026'
    if (id === 'delta' || id === 'delta-2026' || id === 'delta-2026-rev00') {
        return res.json(DELTA_PROPOSTA_INICIAL);
    }

    // Se for 'irricom' ou 'irricom-2026'
    if (id === 'irricom' || id === 'irricom-2026' || id === 'irricom-2026-rev00') {
        return res.json(IRRICOM_PROPOSTA_INICIAL);
    }

    res.status(404).json({ error: 'Proposta comercial não encontrada' });
});

// POST /api/propostas/gerar-com-ia - Gerar proposta a partir do site e Instagram via Gemini
router.post('/gerar-com-ia', async (req, res) => {
    try {
        const { nomeCliente, site, instagram, setor, focoOperacional } = req.body;
        if (!nomeCliente && !site) {
            return res.status(400).json({ error: 'Informe ao menos o Nome da Empresa ou a URL do Site.' });
        }

        console.log(`🤖 [IA] Gerando proposta comercial para ${nomeCliente || site}...`);
        const dadosGerados = await propostaAiService.gerarPropostaComIA({
            nomeCliente,
            site,
            instagram,
            setor,
            focoOperacional
        });

        // Adiciona identificadores
        const timestamp = Date.now();
        const cleanName = (dadosGerados.cliente_nome || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '');
        const id = `${cleanName}-${timestamp}-rev00`;
        const nextNum = memoryPropostas.length + 1;
        const codigo = `PROP-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

        const propostaCompleta = {
            ...IRRICOM_PROPOSTA_INICIAL,
            ...dadosGerados,
            id,
            codigo,
            revisao: 'Rev 00',
            notas_revisao: 'Proposta estruturada e personalizada via IA (Copiloto Lynx)',
            data_proposta: new Date().toISOString().split('T')[0],
            status: 'rascunho',
            versao: '1.0',
            autor: 'LYNX Soluções Corporativas',
            pptx_filename: `Proposta_Comercial_SINCO_${dadosGerados.cliente_nome.replace(/\s+/g, '_')}_Rev00.pptx`
        };

        // Salva na memória e no MySQL
        memoryPropostas.unshift(propostaCompleta);

        try {
            await pool.query(
                `INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, codigo, propostaCompleta.revisao, propostaCompleta.cliente_nome, propostaCompleta.titulo, propostaCompleta.status, JSON.stringify(propostaCompleta)]
            );
        } catch (dbErr) {
            console.warn('⚠️ [SALVAR PROPOSTA IA DB WARN]:', dbErr.message);
        }

        // Cadastra cliente na lista de clientes se não existir
        const clienteExiste = memoryClientesLynx.some(c => c.nome.toLowerCase() === propostaCompleta.cliente_nome.toLowerCase());
        if (!clienteExiste) {
            memoryClientesLynx.push({
                id: memoryClientesLynx.length + 1,
                nome: propostaCompleta.cliente_nome,
                razao_social: propostaCompleta.cliente_razao_social || propostaCompleta.cliente_nome,
                site: propostaCompleta.cliente_site || '',
                instagram: propostaCompleta.cliente_instagram || '',
                telefone: propostaCompleta.cliente_telefone || '',
                email: propostaCompleta.cliente_email || '',
                setor: propostaCompleta.setor || '',
                cidade: '',
                uf: '',
                status: 'proposta_ativa'
            });
        }

        res.status(201).json(propostaCompleta);
    } catch (err) {
        console.error('❌ Erro na geração com IA:', err);
        res.status(500).json({ error: err.message || 'Falha ao processar análise com IA.' });
    }
});

// POST /api/propostas/:id/criar-revisao - Criar nova revisão de uma proposta
router.post('/:id/criar-revisao', async (req, res) => {
    const { id } = req.params;
    const { notas_revisao } = req.body;

    try {
        const baseProposta = memoryPropostas.find(p => p.id === id) || IRRICOM_PROPOSTA_INICIAL;
        
        // Determina próxima revisão (ex: Rev 00 -> Rev 01 -> Rev 02)
        const matchRev = (baseProposta.revisao || 'Rev 00').match(/Rev\s*(\d+)/i);
        const currentRevNum = matchRev ? parseInt(matchRev[1], 10) : 0;
        const nextRevNum = currentRevNum + 1;
        const nextRevStr = `Rev ${String(nextRevNum).padStart(2, '0')}`;

        const cleanName = (baseProposta.cliente_nome || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '');
        const newId = `${cleanName}-${Date.now()}-rev${String(nextRevNum).padStart(2, '0')}`;

        // Atualiza a proposta anterior para 'revisada'
        baseProposta.status = 'revisada';

        const novaRevisao = {
            ...baseProposta,
            id: newId,
            revisao: nextRevStr,
            notas_revisao: notas_revisao || `Revisão ${nextRevStr} com atualizações comerciais e de escopo.`,
            status: 'em_analise',
            data_proposta: new Date().toISOString().split('T')[0],
            parent_id: id,
            pptx_filename: `Proposta_Comercial_SINCO_${baseProposta.cliente_nome.replace(/\s+/g, '_')}_${nextRevStr.replace(' ', '')}.pptx`
        };

        memoryPropostas.unshift(novaRevisao);

        try {
            // Atualiza status da anterior
            await pool.query('UPDATE app_propostas_comerciais SET status = ? WHERE id = ?', ['revisada', id]);
            // Insere nova revisão
            await pool.query(
                `INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newId, novaRevisao.codigo, novaRevisao.revisao, novaRevisao.cliente_nome, novaRevisao.titulo, novaRevisao.status, JSON.stringify(novaRevisao)]
            );
        } catch (dbErr) {
            console.warn('⚠️ [SALVAR REVISAO DB WARN]:', dbErr.message);
        }

        res.status(201).json(novaRevisao);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/propostas/modelo-padrao - Retorna o modelo de proposta mestre parametrizado
router.get('/modelo-padrao', (req, res) => {
    res.json(IRRICOM_PROPOSTA_INICIAL);
});

// POST /api/propostas/criar-de-template - Criar nova proposta a partir do modelo mestre parametrizado
router.post('/criar-de-template', async (req, res) => {
    try {
        const { cliente_nome, cliente_razao_social, cliente_site, cliente_instagram, setor } = req.body;
        if (!cliente_nome) {
            return res.status(400).json({ error: 'Nome do cliente é obrigatório para iniciar a proposta.' });
        }

        const timestamp = Date.now();
        const cleanName = cliente_nome.toLowerCase().replace(/[^a-z0-9]/g, '');
        const id = `${cleanName}-${timestamp}-rev00`;
        const nextNum = memoryPropostas.length + 1;
        const codigo = `PROP-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;
        const url_ambiente = `https://${cleanName}.lynxems.com.br`;

        const novaProposta = {
            ...IRRICOM_PROPOSTA_INICIAL,
            id,
            codigo,
            revisao: 'Rev 00',
            notas_revisao: `Emissão inicial personalizada para ${cliente_nome}`,
            cliente_nome,
            cliente_razao_social: cliente_razao_social || cliente_nome,
            cliente_site: cliente_site || '',
            cliente_instagram: cliente_instagram || '',
            setor: setor || 'Engenharia & Soluções Corporativas',
            url_ambiente,
            data_proposta: new Date().toISOString().split('T')[0],
            status: 'rascunho',
            versao: '1.0',
            pptx_filename: `Proposta_Comercial_SINCO_${cliente_nome.replace(/\s+/g, '_')}_Rev00.pptx`
        };

        memoryPropostas.unshift(novaProposta);

        try {
            await pool.query(
                `INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, codigo, novaProposta.revisao, novaProposta.cliente_nome, novaProposta.titulo, novaProposta.status, JSON.stringify(novaProposta)]
            );
        } catch (dbErr) {
            console.warn('⚠️ [INSERT TEMPLATE PROPOSTA DB WARN]:', dbErr.message);
        }

        res.status(201).json(novaProposta);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/propostas/:id - Atualizar todos os dados da proposta individualmente (parametrização total)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const novosDados = req.body;

    try {
        const index = memoryPropostas.findIndex(p => p.id === id);
        if (index !== -1) {
            memoryPropostas[index] = { ...memoryPropostas[index], ...novosDados };
        } else {
            memoryPropostas.unshift({ ...novosDados, id });
        }

        try {
            await pool.query(
                `INSERT INTO app_propostas_comerciais (id, codigo, revisao, cliente_nome, titulo, status, dados_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    codigo = VALUES(codigo),
                    revisao = VALUES(revisao),
                    cliente_nome = VALUES(cliente_nome),
                    titulo = VALUES(titulo),
                    status = VALUES(status),
                    dados_json = VALUES(dados_json),
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    id, 
                    novosDados.codigo || 'PROP-2026', 
                    novosDados.revisao || 'Rev 00', 
                    novosDados.cliente_nome || 'Cliente', 
                    novosDados.titulo || 'Proposta Comercial Sinco', 
                    novosDados.status || 'rascunho', 
                    JSON.stringify(novosDados)
                ]
            );
        } catch (dbErr) {
            console.warn('⚠️ [UPDATE PROPOSTA COMPLETA DB WARN]:', dbErr.message);
        }

        res.json({ message: 'Proposta comercial parametrizada e salva com sucesso!', proposta: novosDados });
    } catch (err) {
        console.error('❌ Erro ao salvar parametrizações:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar proposta comercial' });
    }
});

// PUT /api/propostas/:id/status - Atualizar rapidamente o status da proposta
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['rascunho', 'em_analise', 'enviada', 'revisada', 'aprovada', 'recusada'];

    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }

    try {
        const item = memoryPropostas.find(p => p.id === id);
        if (item) {
            item.status = status;
        }

        try {
            await pool.query('UPDATE app_propostas_comerciais SET status = ? WHERE id = ?', [status, id]);
        } catch (dbErr) {
            console.warn('⚠️ [UPDATE STATUS DB WARN]:', dbErr.message);
        }

        res.json({ message: 'Status atualizado com sucesso!', status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/propostas/:id/gerar-pptx - Gerar PowerPoint sob demanda para qualquer proposta
router.post('/:id/gerar-pptx', async (req, res) => {
    const { id } = req.params;
    let rawProposta = (req.body && Object.keys(req.body).length > 0)
        ? req.body
        : (memoryPropostas.find(p => p.id === id) || IRRICOM_PROPOSTA_INICIAL);
    if (req.body && Object.keys(req.body).length > 0) {
        const idx = memoryPropostas.findIndex(p => p.id === id);
        if (idx !== -1) memoryPropostas[idx] = { ...memoryPropostas[idx], ...req.body };
    }
    const proposta = enrichPropostaWithSincoFeatures(rawProposta);

    const scriptPath = path.join(__dirname, '..', 'scripts', 'gerar_proposta_pptx.py');
    const safeCliente = (proposta.cliente_nome || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRev = (proposta.revisao || 'Rev00').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Proposta_Comercial_SINCO_${safeCliente}_${safeRev}.pptx`;
    
    const outPublic = path.join(__dirname, '..', '..', 'client', 'public', 'propostas', filename);
    const outRoot = path.join(__dirname, '..', '..', filename);

    // Salva JSON temporário
    const tmpJson = path.join(__dirname, '..', '..', `tmp_${id}.json`);
    fs.writeFileSync(tmpJson, JSON.stringify(proposta, null, 2), 'utf-8');

    const cmd = `python "${scriptPath}" "${tmpJson}" "${outPublic}"`;
    exec(cmd, (error, stdout, stderr) => {
        // Limpa arquivo temporário
        try { fs.unlinkSync(tmpJson); } catch {}

        if (error) {
            console.error('❌ Erro ao regerar PPTX:', error);
            return res.status(500).json({ error: 'Erro ao gerar PowerPoint', details: stderr || error.message });
        }
        
        try {
            fs.copyFileSync(outPublic, outRoot);
        } catch (copyErr) {
            console.warn('Aviso: cópia na raiz não completou:', copyErr.message);
        }

        res.json({
            message: 'Apresentação PowerPoint gerada com sucesso!',
            filename,
            download_url: `/propostas/${filename}`
        });
    });
});

// GET /api/propostas/:id/download-pptx - Baixar arquivo PPTX de qualquer proposta
router.get('/:id/download-pptx', (req, res) => {
    const { id } = req.params;
    const proposta = memoryPropostas.find(p => p.id === id) || IRRICOM_PROPOSTA_INICIAL;

    const safeCliente = proposta.cliente_nome.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRev = (proposta.revisao || 'Rev00').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Proposta_Comercial_SINCO_${safeCliente}_${safeRev}.pptx`;

    const filePath = path.join(__dirname, '..', '..', 'client', 'public', 'propostas', filename);
    const fallbackPath = path.join(__dirname, '..', '..', 'client', 'public', 'propostas', 'Proposta_Comercial_SINCO_Irricom_2026.pptx');

    if (fs.existsSync(filePath)) {
        return res.download(filePath, filename);
    } else if (fs.existsSync(fallbackPath)) {
        return res.download(fallbackPath, filename);
    } else {
        return res.status(404).json({ error: 'Arquivo PowerPoint não encontrado.' });
    }
});

// POST /api/propostas/:id/gerar-word - Gerar documento Word (.docx) sob demanda para qualquer proposta
router.post('/:id/gerar-word', async (req, res) => {
    const { id } = req.params;
    let rawProposta = (req.body && Object.keys(req.body).length > 0)
        ? req.body
        : (memoryPropostas.find(p => p.id === id) || IRRICOM_PROPOSTA_INICIAL);
    if (req.body && Object.keys(req.body).length > 0) {
        const idx = memoryPropostas.findIndex(p => p.id === id);
        if (idx !== -1) memoryPropostas[idx] = { ...memoryPropostas[idx], ...req.body };
    }
    const proposta = enrichPropostaWithSincoFeatures(rawProposta);

    const scriptPath = path.join(__dirname, '..', 'scripts', 'gerar_proposta_word.py');
    const safeCliente = (proposta.cliente_nome || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRev = (proposta.revisao || 'Rev00').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Proposta_Comercial_SINCO_${safeCliente}_${safeRev}.docx`;
    
    const outPublic = path.join(__dirname, '..', '..', 'client', 'public', 'propostas', filename);
    const outRoot = path.join(__dirname, '..', '..', filename);

    // Salva JSON temporário
    const tmpJson = path.join(__dirname, '..', '..', `tmp_word_${id}.json`);
    fs.writeFileSync(tmpJson, JSON.stringify(proposta, null, 2), 'utf-8');

    const cmd = `python "${scriptPath}" "${tmpJson}" "${outPublic}"`;
    exec(cmd, (error, stdout, stderr) => {
        // Limpa arquivo temporário
        try { fs.unlinkSync(tmpJson); } catch {}

        if (error) {
            console.error('❌ Erro ao regerar Word:', error);
            return res.status(500).json({ error: 'Erro ao gerar Word (.docx)', details: stderr || error.message });
        }
        
        try {
            fs.copyFileSync(outPublic, outRoot);
        } catch (copyErr) {
            console.warn('Aviso: cópia do Word na raiz não completou:', copyErr.message);
        }

        res.json({
            message: 'Documento Word gerado com sucesso com logotipo Lynx e SIM Consultoria!',
            filename,
            download_url: `/propostas/${filename}`
        });
    });
});

// GET /api/propostas/:id/download-word - Baixar arquivo Word de qualquer proposta
router.get('/:id/download-word', (req, res) => {
    const { id } = req.params;
    const proposta = memoryPropostas.find(p => p.id === id) || IRRICOM_PROPOSTA_INICIAL;

    const safeCliente = (proposta.cliente_nome || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRev = (proposta.revisao || 'Rev00').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Proposta_Comercial_SINCO_${safeCliente}_${safeRev}.docx`;

    const filePath = path.join(__dirname, '..', '..', 'client', 'public', 'propostas', filename);

    if (fs.existsSync(filePath)) {
        return res.download(filePath, filename);
    } else {
        return res.status(404).json({ error: 'Arquivo Word não encontrado. Por favor, gere-o primeiro.' });
    }
});

// Clientes Lynx (Prospectos/Contratantes)
router.get('/clientes/lynx', (req, res) => {
    res.json(memoryClientesLynx);
});

router.post('/clientes/lynx', (req, res) => {
    const { nome, razao_social, site, instagram, telefone, email, setor, cidade, uf } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do cliente é obrigatório' });

    const novoCliente = {
        id: memoryClientesLynx.length + 1,
        nome,
        razao_social: razao_social || nome,
        site: site || '',
        instagram: instagram || '',
        telefone: telefone || '',
        email: email || '',
        setor: setor || '',
        cidade: cidade || '',
        uf: uf || '',
        status: 'prospect'
    };

    memoryClientesLynx.push(novoCliente);
    res.status(201).json(novoCliente);
});

module.exports = router;
