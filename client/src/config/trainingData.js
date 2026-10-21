// ─── BASE DE DADOS COMPLETA DO PLANO DE TREINAMENTO PÁGINA A PÁGINA ───────────
// Cada página do sistema possui no mínimo 1h dedicada com teoria e prática.

export const ALL_TRAINING_SCREENS = [
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. COMERCIAL & FATURAMENTO
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'comercial_pedidos',
        name: 'Pedidos de Venda (Visão Geral)',
        path: '/visao-geral',
        badge: 'Carteira de Pedidos',
        category: 'Comercial',
        targetAudience: 'Vendedores, Faturamento, PCP e Diretoria Comercial',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Conceitos de Carteira + 1h Filtros e Gestão de Prazos',
        summary: 'Visão consolidada de todos os pedidos de venda do Protheus, saldo a faturar, evolução de OPs e datas de entrega.',
        objective: 'Acompanhar a carteira ativa, identificar pedidos com pendência de faturamento e monitorar o status produtivo de cada item.',
        prerequisites: ['Pedidos de venda integrados via ERP Protheus (SC5/SC6)'],
        workflowSteps: [
            {
                step: 1,
                title: 'Pesquisa e Filtragem',
                action: 'Utilize os filtros superiores por Cliente, Número do Pedido, Pedido do Cliente (PC) ou Código do Produto.'
            },
            {
                step: 2,
                title: 'Análise de Saldo e Evolução',
                action: 'Verifique a coluna "Saldo Fat." e a barra de "Evolução OP" para saber a porcentagem de conclusão na fábrica.'
            },
            {
                step: 3,
                title: 'Conferência de Datas',
                action: 'Compare a "Data PCP" com a "Prev. Fat." para verificar se a fábrica conseguirá atender o faturamento no prazo.'
            },
            {
                step: 4,
                title: 'Ações e Exportações',
                action: 'Gere relatórios da carteira ou acione a IA Hermes para diagnóstico de risco de atraso de pedidos.'
            }
        ],
        criticalAlerts: [
            'Pedidos em vermelho possuem alertas de vencimento iminente ou divergência de quantidade.',
            'Nunca altere datas de faturamento sem alinhamento prévio com o PCP.'
        ],
        verificationChecklist: [
            'Sei filtrar pedidos por cliente e período de entrega',
            'Sei interpretar o indicador de evolução da OP vinculada',
            'Sei exportar a planilha de pedidos pendentes'
        ]
    },
    {
        id: 'comercial_itens_faturar',
        name: 'Itens a Faturar',
        path: '/vendas/itens-faturar',
        badge: 'Liberação de Faturamento',
        category: 'Comercial',
        targetAudience: 'Faturamento, Comercial e Expedição',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Regras Fiscais + 40min Simulação de Liberação de NF',
        summary: 'Lista dos itens que já foram produzidos e inspecionados pela qualidade, prontos para emissão de Nota Fiscal.',
        objective: 'Garantir que nenhum item expedido saia sem emissão fiscal e acompanhar a meta diária de faturamento.',
        prerequisites: ['Peças apontadas como 100% concluídas na fábrica / romaneio'],
        workflowSteps: [
            {
                step: 1,
                title: 'Identificar Lotes Disponíveis',
                action: 'Consulte a lista de itens com saldo liberado pelo controle de produção.'
            },
            {
                step: 2,
                title: 'Validação de Dados Cadastrais',
                action: 'Confira preço unitário, condição de pagamento e cliente de destino.'
            },
            {
                step: 3,
                title: 'Agrupamento para Faturamento',
                action: 'Selecione os itens do mesmo cliente e encaminhe para o processo de geração da NF no Protheus.'
            }
        ],
        criticalAlerts: [
            'Não faturar pedidos que possuam bloqueio de crédito ou pendência de amostra no SGQ.'
        ],
        verificationChecklist: [
            'Sei consultar itens liberados para emissão',
            'Sei identificar pedidos com saldo parcial'
        ]
    },
    {
        id: 'comercial_dashboard_fat',
        name: 'Dashboard de Faturamento',
        path: '/comercial/dashboard-faturamento',
        badge: 'Metas & Realizado',
        category: 'Comercial',
        targetAudience: 'Gerência Comercial, Diretoria e Controladoria',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '25min Métricas Financeiras + 35min Análise de Tendência de Meta',
        summary: 'Gráficos e KPIs de faturamento diário, acumulado do mês, faturamento projetado e curva ABC de clientes.',
        objective: 'Monitorar o atingimento da meta de faturamento mensal e projetar o encerramento do mês com base na carteira.',
        prerequisites: ['Permissão de visualização financeira/comercial'],
        workflowSteps: [
            {
                step: 1,
                title: 'Selecionar o Mês/Ano',
                action: 'Ajuste o período para comparar o realizado contra a meta estipulada.'
            },
            {
                step: 2,
                title: 'Analisar Curva de Clientes',
                action: 'Verifique quais clientes representam a maior fatia do faturamento no período.'
            },
            {
                step: 3,
                title: 'Projeção de Faturamento',
                action: 'Avalie a barra de faturamento projetado com base nas OPs com previsão de entrega no mês.'
            }
        ],
        criticalAlerts: [
            'Fique atento aos desvios negativos no meio do mês para replanejar entregas críticas junto ao PCP.'
        ],
        verificationChecklist: [
            'Sei ler o faturamento diário e acumulado',
            'Sei interpretar a projeção de fechamento do mês'
        ]
    },
    {
        id: 'comercial_gestao_ops',
        name: 'Gestão de OPs Comercial',
        path: '/visao-geral',
        badge: 'Rastreio Comercial',
        category: 'Comercial',
        targetAudience: 'Vendedores, SAC e Representantes Comerciais',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Fluxo de Atendimento ao Cliente + 40min Rastreio de OPs',
        summary: 'Visão simplificada do status de fabricação de cada pedido para atendimento rápido a clientes sobre prazos.',
        objective: 'Permitir ao time comercial responder a clientes sobre o status exato do pedido em segundos sem sobrecarregar o PCP.',
        prerequisites: ['Código do pedido do cliente ou número do PV'],
        workflowSteps: [
            {
                step: 1,
                title: 'Localização Imediata',
                action: 'Digite o pedido do cliente na busca rápida.'
            },
            {
                step: 2,
                title: 'Leitura do Status Operacional',
                action: 'Veja se o item está em: "Aguardando Matéria-Prima", "Em Corte", "Solda/Usinagem", "Pintura/Tratamento" ou "Pronto".'
            },
            {
                step: 3,
                title: 'Resposta ao Cliente',
                action: 'Informe a previsão de conclusão calculada pelo sistema.'
            }
        ],
        criticalAlerts: [
            'Sempre confira a data prevista calculada pelo PCP antes de prometer antecipações ao cliente.'
        ],
        verificationChecklist: [
            'Sei consultar a fase atual do pedido de um cliente',
            'Sei identificar se há atraso reportado na fabricação'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. ENGENHARIA, BOM & MODELAGEM 3D / SINCO
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'eng_bom_generator',
        name: 'Gerador de BOM (Estruturas)',
        path: '/bom-generator',
        badge: 'Engenharia de Produto',
        category: 'Engenharia',
        targetAudience: 'Projetistas, Engenheiros de Produto e Métodos',
        durationHours: 2.0,
        durationLabel: '2h 00min',
        structure: '45min Conceito de Árvore de Produto + 1h15min Cadastro e Explosão',
        summary: 'Criação, edição e importação de listas de materiais (Bill of Materials) com cálculo de matéria-prima e componentes.',
        objective: 'Cadastrar a estrutura técnica do produto com precisão para abastecer as compras e o planejamento do PCP.',
        prerequisites: ['Código do produto pai e desenhos técnicos aprovados'],
        workflowSteps: [
            {
                step: 1,
                title: 'Seleção do Produto Pai',
                action: 'Informe o código do conjunto ou subconjunto que será estruturado.'
            },
            {
                step: 2,
                title: 'Inclusão de Componentes Filhos',
                action: 'Adicione os códigos dos itens filhos, quantidade por conjunto, perda técnica (%) e unidade de medida.'
            },
            {
                step: 3,
                title: 'Vinculação de Roteiro',
                action: 'Associe a sequência de operações fabris necessárias para transformar os insumos no produto final.'
            },
            {
                step: 4,
                title: 'Validação e Liberação',
                action: 'Valide a consistência matemática da estrutura e grave a versão ativa no banco.'
            }
        ],
        criticalAlerts: [
            'Erros no fator de consumo multiplicam desvios de compra para centenas de peças!',
            'Sempre confira se não há dependência circular (produto filho contendo ele mesmo como pai).'
        ],
        verificationChecklist: [
            'Sei criar uma nova estrutura BOM do zero',
            'Sei importar listas de materiais vindas do CAD/SolidEdge',
            'Sei validar o consumo de chapas e parafusos'
        ]
    },
    {
        id: 'eng_produtos',
        name: 'Catálogo de Produtos',
        path: '/produtos',
        badge: 'Cadastro Mestre',
        category: 'Engenharia',
        targetAudience: 'Engenharia, Custos e Almoxarifado',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Classificação Fiscal/Tipos + 40min Consultas e Anexos',
        summary: 'Consulta mestre de todos os itens cadastrados: matérias-primas, produtos acabados, semiacabados e consumíveis.',
        objective: 'Consultar fichas técnicas, pesos, tipos de material, desenhos em PDF e histórico de revisões.',
        prerequisites: ['Permissão de consulta técnica'],
        workflowSteps: [
            {
                step: 1,
                title: 'Pesquisa Global',
                action: 'Busque por código Lynx, descrição técnica ou tipo de item (PA, PI, MP, MC).'
            },
            {
                step: 2,
                title: 'Visualização de Desenhos Técnicos',
                action: 'Clique no ícone de PDF para abrir a última revisão homologada do desenho em tela cheia.'
            },
            {
                step: 3,
                title: 'Verificação de Onde é Usado',
                action: 'Consulte em quais estruturas de produtos acabados essa peça é utilizada.'
            }
        ],
        criticalAlerts: [
            'Nunca utilize arquivos de desenho antigos salvos na máquina local; sempre consulte a versão atualizada do sistema.'
        ],
        verificationChecklist: [
            'Sei consultar a ficha técnica e peso do produto',
            'Sei abrir o PDF do desenho homologado'
        ]
    },
    {
        id: 'eng_analise_3d',
        name: 'Visualizador de Modelos 3D',
        path: '/analise-3d',
        badge: 'Modelagem 3D Web',
        category: 'Engenharia',
        targetAudience: 'Projetistas, Programadores CNC e Líderes de Montagem',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Ferramentas 3D + 1h Inspeção de Cotas e Montagens',
        summary: 'Visualização 3D interativa de peças e conjuntos diretamente no navegador, com ferramentas de rotação, corte e medidas.',
        objective: 'Permitir a inspeção tridimensional de montagens complexas no chão de fábrica sem necessidade de licença de CAD pesado.',
        prerequisites: ['Arquivo 3D (STEP, OBJ ou GLTF) sincronizado pelo SolidEdge/SolidWorks'],
        workflowSteps: [
            {
                step: 1,
                title: 'Carregar o Modelo 3D',
                action: 'Busque a peça pelo código ou arraste o arquivo do modelo.'
            },
            {
                step: 2,
                title: 'Navegação e Órbita',
                action: 'Utilize o botão esquerdo para rotacionar, botão direito para transladar e scroll para zoom.'
            },
            {
                step: 3,
                title: 'Explosão e Corte em Seção',
                action: 'Ative o controle de vista explodida para entender como os componentes internos se encaixam.'
            }
        ],
        criticalAlerts: [
            'Use a ferramenta 3D na bancada de montagem para tirar dúvidas antes de soldar peças em posições incorretas.'
        ],
        verificationChecklist: [
            'Sei navegar e rotacionar modelos 3D',
            'Sei usar a ferramenta de corte em seção'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PCP & CHÃO DE FÁBRICA
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'pcp_controle_execucao',
        name: 'Controle de Execução em Tempo Real',
        path: '/pcp/controle-execucao',
        badge: 'Operação Principal',
        category: 'Chão de Fábrica',
        targetAudience: 'Operadores, Líderes de Setor e Apontadores',
        durationHours: 2.0,
        durationLabel: '2h 00min',
        structure: '30min Teoria & Regras + 1h30min Prática no Posto',
        summary: 'Interface de alta frequência onde o operador dá Play, Pause e Stop nos postos de trabalho, registra refugos e paradas de máquina.',
        objective: 'Permitir o apontamento cronometrado em tempo real de cada etapa do roteiro de fabricação, gerando o tempo padrão real vs previsto.',
        prerequisites: [
            'Ordem de Produção (OP) já liberada pelo PCP',
            'Setor produtivo e máquina/recurso selecionados',
            'Operador autenticado com seu crachá/usuário'
        ],
        workflowSteps: [
            {
                step: 1,
                title: 'Seleção do Posto e da OP',
                action: 'No topo da página, filtre pelo Setor (ex: Solda, Usinagem, Dobra) ou digite o número da OP / Código do Produto.'
            },
            {
                step: 2,
                title: 'Início do Trabalho (Botão Play)',
                action: 'Clique no botão verde Play ao lado da operação. O cronômetro entrará em contagem e o status ficará "Em Execução".'
            },
            {
                step: 3,
                title: 'Registro de Pausa ou Setup',
                action: 'Se a máquina parar para ajuste, manutenção ou descanso, clique em Pausar e selecione o Motivo de Parada da lista.'
            },
            {
                step: 4,
                title: 'Finalização do Lote / Peças Produzidas',
                action: 'Ao concluir o lote, clique em Concluir (Check Verde), digite a Quantidade Boa e, se houver, o Refugo com motivo.'
            }
        ],
        criticalAlerts: [
            'Nunca deixe um apontamento rodando durante o horário de almoço ou troca de turno sem pausar!',
            'Se houver refugo, sempre descreva o motivo para alimentar o SGQ automaticamente.'
        ],
        verificationChecklist: [
            'Sei iniciar uma OP no posto correto e acompanhar o cronômetro',
            'Sei registrar uma parada selecionando o motivo correspondente',
            'Sei apontar a quantidade final e validar o encerramento do lote'
        ]
    },
    {
        id: 'pcp_apontamento_vertical',
        name: 'Apontamento Vertical Rápido',
        path: '/pcp/apontamento-vertical',
        badge: 'Apontamento em Lote',
        category: 'Chão de Fábrica',
        targetAudience: 'Apontadores de Linha, Supervisores de Célula',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Conceitos + 40min Lançamentos Práticos',
        summary: 'Visão em lista vertical desenhada para visualização rápida e apontamentos em lote de múltiplas operações de uma mesma OP.',
        objective: 'Facilitar a visão da árvore sequencial da OP de cima para baixo, mostrando visualmente quais etapas anteriores já foram concluídas.',
        prerequisites: ['Número da OP ou Código do Conjunto'],
        workflowSteps: [
            {
                step: 1,
                title: 'Localizar a OP',
                action: 'Digite o número da OP na barra de busca superior para carregar todos os subitens e roteiros.'
            },
            {
                step: 2,
                title: 'Verificar Dependências Anteriores',
                action: 'Confira as tags coloridas. Não inicie operações marcadas com "Aguardando Etapa Anterior".'
            },
            {
                step: 3,
                title: 'Apontamento Rápido',
                action: 'Utilize o modal de apontamento simplificado para lançar horas retroativas ou apontamentos diretos.'
            }
        ],
        criticalAlerts: [
            'Verifique se a quantidade apontada não ultrapassa o saldo em aberto da OP.'
        ],
        verificationChecklist: [
            'Entendi como ler a sequência de etapas de cima para baixo',
            'Sei identificar se a etapa anterior foi concluída antes de liberar a próxima'
        ]
    },
    {
        id: 'pcp_programas_ncn',
        name: 'Programas CNC & NCN',
        path: '/pcp/programas-ncn',
        badge: 'Corte & Usinagem',
        category: 'Chão de Fábrica',
        targetAudience: 'Programadores CNC, Operadores de Laser, Plasma e Puncionadeira',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Conceitos e Versões + 1h Carga e Validação',
        summary: 'Repositório e controle de versões dos arquivos de comando numérico (CNC/NCN) vinculados a cada peça e chapa.',
        objective: 'Garantir que a máquina utilize sempre o programa CNC homologado pela engenharia, prevenindo peças cortadas com desenho obsoleto.',
        prerequisites: ['Código do produto e especificação da máquina'],
        workflowSteps: [
            {
                step: 1,
                title: 'Busca por Código da Peça ou Chapa',
                action: 'Informe o código do produto para listar todos os programas NCN vinculados.'
            },
            {
                step: 2,
                title: 'Conferência da Versão Homologada',
                action: 'Verifique a tag "Homologado" e a data da última revisão antes de enviar para a máquina.'
            },
            {
                step: 3,
                title: 'Download ou Envio Direto',
                action: 'Baixe o arquivo de código G ou envie via rede para o terminal CNC da máquina.'
            }
        ],
        criticalAlerts: [
            'Nunca execute programas marcados como "Em Revisão" ou sem validação técnica.'
        ],
        verificationChecklist: [
            'Sei consultar a versão ativa do programa da peça',
            'Sei baixar o arquivo correto para a máquina correspondente'
        ]
    },
    {
        id: 'pcp_fila_dependencias',
        name: 'Fila e Dependências (WIP / Gargalos)',
        path: '/pcp/fila-dependencias',
        badge: 'Gargalos & WIP',
        category: 'PCP Geral',
        targetAudience: 'PCP, Supervisores de Produção, Abastecedores de Linha',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Diagnóstico de Gargalos + 1h Priorização Prática',
        summary: 'Mapeamento das ordens em processo (WIP), identificando peças que estão paradas aguardando corte, dobras ou solda anterior.',
        objective: 'Evitar que postos posteriores fiquem ociosos por falta de peças semiacabadas dos postos anteriores.',
        prerequisites: ['Acesso ao módulo PCP Geral'],
        workflowSteps: [
            {
                step: 1,
                title: 'Filtrar por Setor Destino',
                action: 'Selecione o setor que está aguardando peças (ex: Montagem Final).'
            },
            {
                step: 2,
                title: 'Identificar a Linha de Gargalo',
                action: 'A tabela exibirá a OP travada e indicará em vermelho qual é a operação gargalo e em qual máquina ela se encontra.'
            },
            {
                step: 3,
                title: 'Ação de Priorização',
                action: 'Clique em "Priorizar no Posto" para elevar a urgência da peça no terminal do operador da máquina anterior.'
            }
        ],
        criticalAlerts: [
            'Fique atento aos itens com tag "Risco de Atraso de Entrega do Pedido".'
        ],
        verificationChecklist: [
            'Sei identificar onde a peça está travada na fábrica',
            'Sei priorizar a fila de um posto com sobrecarga'
        ]
    },
    {
        id: 'planejamento_estrutura_routing',
        name: 'Explosão BOM + Roteiro (Puxada Pull)',
        path: '/pcp/planejamento-estrutura-routing',
        badge: 'Estratégico PCP',
        category: 'PCP Geral',
        targetAudience: 'Engenheiros de Produção e Analistas de PCP',
        durationHours: 2.0,
        durationLabel: '2h 00min',
        structure: '45min Engenharia Reversa + 1h15min Cálculo e Validação',
        summary: 'Ferramenta de cálculo que gera a explosão da árvore do produto (BOM) e calcula o lead time cumulativo reverso (Pull).',
        objective: 'Calcular a data exata em que cada subconjunto, corte de chapa e compra de insumo deve começar para atender a data de entrega final.',
        prerequisites: ['Estrutura do produto cadastrada e roteiro de operações preenchido'],
        workflowSteps: [
            {
                step: 1,
                title: 'Carregar a Estrutura do Pedido/OP',
                action: 'Informe a OP ou Pedido de Venda para montar a árvore de subconjuntos.'
            },
            {
                step: 2,
                title: 'Verificar Tempos Padrão de Roteiro',
                action: 'Confira os tempos em horas de cada posto (Corte, Dobra, Solda, Usinagem, Pintura).'
            },
            {
                step: 3,
                title: 'Executar Cálculo de Datas (Puxada Reversa)',
                action: 'Clique em "Calcular Puxada". O sistema gera o cronograma sugerido para cada nível.'
            },
            {
                step: 4,
                title: 'Exportar para o Gantt da Fábrica',
                action: 'Valide os prazos e envie o plano para alocação de capacidade.'
            }
        ],
        criticalAlerts: [
            'Itens sem tempo padrão cadastrado no roteiro serão marcados em amarelo e devem ser corrigidos.'
        ],
        verificationChecklist: [
            'Compreendi o conceito de lead time reverso (Pull)',
            'Sei auditar a árvore de componentes antes de liberar a produção'
        ]
    },
    {
        id: 'planejamento_gantt',
        name: 'Planejamento Gantt da Produção',
        path: '/planejamento-gantt',
        badge: 'Cronograma Visual',
        category: 'PCP Geral',
        targetAudience: 'Analistas de PCP e Gerentes de Fábrica',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Leitura do Gráfico + 1h Reprogramações Drag&Drop',
        summary: 'Gráfico de Gantt interativo com linhas do tempo de cada OP, permitindo reprogramação por arrastar e soltar (drag & drop).',
        objective: 'Visualizar a ocupação temporal de todas as ordens e ajustar datas de início e fim com visão de impacto.',
        prerequisites: ['Ordens de Produção cadastradas'],
        workflowSteps: [
            {
                step: 1,
                title: 'Navegação pela Linha do Tempo',
                action: 'Utilize os botões de zoom (Dia, Semana, Mês) e navegue pelas datas de entrega.'
            },
            {
                step: 2,
                title: 'Ajuste de Cronograma',
                action: 'Arraste a barra da OP para a nova data desejada caso haja alteração de prioridade.'
            },
            {
                step: 3,
                title: 'Salvar Reprogramação',
                action: 'Confirme a nova data. O sistema recalcula automaticamente as dependências filhas.'
            }
        ],
        criticalAlerts: [
            'Avisar o comercial sempre que uma OP com impacto de faturamento for postergada no Gantt.'
        ],
        verificationChecklist: [
            'Sei navegar no Gantt por período',
            'Sei reprogramar uma OP respeitando a data de entrega'
        ]
    },
    {
        id: 'curva_s_pedido',
        name: 'Curva S por Pedido de Venda',
        path: '/pcp/curva-s',
        badge: 'Avanço Físico',
        category: 'PCP Geral',
        targetAudience: 'PCP, Gerência e Diretoria',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '30min Métricas de Avanço + 30min Planos de Recuperação',
        summary: 'Gráfico da Curva S comparando o Avanço Físico Real (%) versus o Planejado (%) acumulado ao longo dos dias.',
        objective: 'Identificar precocemente tendências de atraso antes do vencimento do prazo de entrega do projeto.',
        prerequisites: ['Pedido de Venda com OPs associadas e apontamentos realizados'],
        workflowSteps: [
            {
                step: 1,
                title: 'Selecionar o Pedido de Venda / Cliente',
                action: 'Escolha o número do pedido no filtro superior.'
            },
            {
                step: 2,
                title: 'Análise do Desvio (Gap)',
                action: 'Compare a curva Azul (Planejado) com a curva Verde (Realizado). Se a curva verde estiver abaixo, há atraso.'
            },
            {
                step: 3,
                title: 'Projeção de Término',
                action: 'Observe a linha pontilhada de projeção calculada pelo ritmo médio de apontamentos da fábrica.'
            }
        ],
        criticalAlerts: [
            'Um desvio superior a 10% exige reunião de alinhamento com a supervisão de fábrica para horas extras.'
        ],
        verificationChecklist: [
            'Sei ler a diferença entre a curva planejada e real',
            'Sei interpretar o ritmo de avanço físico do projeto'
        ]
    },
    {
        id: 'visao_fabrica',
        name: 'Visão Global da Fábrica',
        path: '/pcp/visao-fabrica',
        badge: 'Cockpit Geral',
        category: 'PCP Geral',
        targetAudience: 'Supervisores, Gerentes de Fábrica e Diretoria',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '30min Interpretação de Status + 30min Gestão à Vista',
        summary: 'Painel em tempo real estilo sala de controle que exibe o status de todos os postos, máquinas ligadas, paradas e OPs em risco.',
        objective: 'Proporcionar visão panorâmica instantânea do chão de fábrica para tomada de decisão ágil.',
        prerequisites: ['Conexão ativa com o servidor'],
        workflowSteps: [
            {
                step: 1,
                title: 'Monitoramento dos Cards de Posto',
                action: 'Verifique as cores: Verde (Em produção), Amarelo (Setup/Pausa), Vermelho (Parada) e Cinza (Ocioso).'
            },
            {
                step: 2,
                title: 'Inspeção Rápida de Detalhes',
                action: 'Passe o mouse ou clique no posto para ver a OP atual, operador logado e previsão de término.'
            }
        ],
        criticalAlerts: [
            'Postos com mais de 30 minutos em parada sem justificativa devem ser verificados imediatamente pelo líder.'
        ],
        verificationChecklist: [
            'Sei interpretar as cores dos postos de trabalho',
            'Sei consultar quem está operando cada máquina no momento'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. LOGÍSTICA, EXPEDIÇÃO & ESTOQUE
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'logistica_romaneios',
        name: 'Expedição & Romaneios Externos',
        path: '/romaneios',
        badge: 'Controle de Saídas',
        category: 'Logística',
        targetAudience: 'Expedição, Logística, Inspetores e Motoristas',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Regras de Transporte + 1h Geração e Conferência de Romaneio',
        summary: 'Emissão, rastreabilidade e impressão de romaneios de envio de peças para terceiros (Pintura, Zincagem, Tratamento Térmico) ou entrega final.',
        objective: 'Controlar rigorosamente a quantidade de peças enviadas, peso total, transportador e canhoto de entrega.',
        prerequisites: ['Peças produzidas com saldo disponível para remessa'],
        workflowSteps: [
            {
                step: 1,
                title: 'Criar Novo Romaneio',
                action: 'Clique em "Novo Romaneio", selecione o Fornecedor/Cliente e o tipo de serviço (ex: Pintura a Pó).'
            },
            {
                step: 2,
                title: 'Adicionar Itens e OPs',
                action: 'Bipe o código de barras ou digite a OP para carregar a quantidade e peso das peças.'
            },
            {
                step: 3,
                title: 'Conferência Física de Carga',
                action: 'Confira as caixas e paletes antes do embarque no veículo de transporte.'
            },
            {
                step: 4,
                title: 'Impressão e Assinatura',
                action: 'Imprima as vias do romaneio e colete a assinatura do motorista.'
            }
        ],
        criticalAlerts: [
            'Nenhuma peça pode sair da fábrica sem o romaneio devidamente aprovado e impresso.',
            'Sempre confira o peso informado com a pesagem real da balança.'
        ],
        verificationChecklist: [
            'Sei gerar um romaneio de envio para terceiros',
            'Sei imprimir as vias e protocolar a saída de carga'
        ]
    },
    {
        id: 'logistica_recebimentos',
        name: 'Recebimento de Retornos (Terceiros)',
        path: '/recebimentos',
        badge: 'Entrada de Beneficiamento',
        category: 'Logística',
        targetAudience: 'Almoxarifado, Inspetores de Entrada e PCP',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Critérios de Recebimento + 1h Baixa e Inspeção de Entrada',
        summary: 'Registro do retorno de peças que estavam em beneficiamento externo, confrontando quantidade enviada vs recebida.',
        objective: 'Dar baixa no romaneio original, registrar notas fiscais de retorno e acionar a inspeção da qualidade.',
        prerequisites: ['Romaneio de envio em aberto e NF do prestador de serviço'],
        workflowSteps: [
            {
                step: 1,
                title: 'Localizar Romaneio de Envio',
                action: 'Digite o número do romaneio ou o CNPJ do fornecedor que está entregando as peças.'
            },
            {
                step: 2,
                title: 'Conferência Quantitativa',
                action: 'Digite a quantidade física recebida. O sistema alerta caso haja falta de peças em relação ao envio.'
            },
            {
                step: 3,
                title: 'Inspeção Visual e Qualidade',
                action: 'Verifique se há avarias na pintura ou zincagem. Se houver, acione abertura de RNC imediata.'
            },
            {
                step: 4,
                title: 'Finalizar Entrada no Estoque',
                action: 'Confirme o recebimento para liberar as peças para a etapa seguinte (Montagem ou Expedição).'
            }
        ],
        criticalAlerts: [
            'Retornos parciais devem ser registrados mantendo o saldo restante em aberto no romaneio original.'
        ],
        verificationChecklist: [
            'Sei conferir o retorno de um romaneio',
            'Sei registrar divergência de peças faltantes'
        ]
    },
    {
        id: 'logistica_estoque',
        name: 'Estoque & Saldos de Materiais',
        path: '/saldo-materiais',
        badge: 'Almoxarifado & Saldos',
        category: 'Logística',
        targetAudience: 'Almoxarifes, Compras e PCP',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Estrutura de Armazéns + 40min Consultas e Rastreabilidade',
        summary: 'Consulta de saldos em estoque por armazém (Chapas, Tubos, Parafusos, Tintas e Produtos Acabados).',
        objective: 'Garantir acuracidade do saldo físico vs sistema e acompanhar lotes e validades.',
        prerequisites: ['Acesso ao módulo de materiais'],
        workflowSteps: [
            {
                step: 1,
                title: 'Consulta por Código ou Família',
                action: 'Filtre por código da matéria-prima para visualizar o saldo disponível e saldo reservado para OPs.'
            },
            {
                step: 2,
                title: 'Verificação de Estoque de Segurança',
                action: 'Observe se o saldo atual está abaixo do ponto de pedido (marcado em amarelo/vermelho).'
            }
        ],
        criticalAlerts: [
            'Divergências entre físico e sistema devem ser reportadas imediatamente para inventário rotativo.'
        ],
        verificationChecklist: [
            'Sei consultar saldo disponível vs reservado',
            'Sei verificar a localização física no armazém'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. SUPRIMENTOS & COMPRAS
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'suprimentos_solicitacoes',
        name: 'Solicitações de Compra (SC)',
        path: '/solicitacoes-compras',
        badge: 'Necessidade de Compras',
        category: 'Suprimentos',
        targetAudience: 'Compradores, Solicitantes e PCP',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Fluxo de Aprovação + 40min Criação e Cotação de SCs',
        summary: 'Central de solicitações de compras geradas automaticamente por explosão de OPs ou criadas manualmente por setores.',
        objective: 'Acompanhar cotações, aprovações de alçada e prazos de entrega negociados com fornecedores.',
        prerequisites: ['Necessidade de compra cadastrada'],
        workflowSteps: [
            {
                step: 1,
                title: 'Triagem de Solicitações Pendentes',
                action: 'Filtre por urgência, tipo de material (Aço, Componentes, EPIs) ou centro de custo.'
            },
            {
                step: 2,
                title: 'Transformação em Pedido de Compra (PC)',
                action: 'Após aprovação da cotação, gere o PC no Protheus vinculando o fornecedor vencedor.'
            }
        ],
        criticalAlerts: [
            'SCs geradas por OPs possuem prazo crítico de entrega para não parar a linha de produção.'
        ],
        verificationChecklist: [
            'Sei acompanhar o status de uma solicitação de compra',
            'Sei identificar o vínculo da SC com o Pedido de Venda'
        ]
    },
    {
        id: 'suprimentos_auditoria_pc',
        name: 'Auditoria de Compras x XML (NF-e)',
        path: '/auditoria-pc',
        badge: 'Conformidade Fiscal',
        category: 'Suprimentos',
        targetAudience: 'Compradores, Recebimento Fiscal e Almoxarifado',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '25min Regras de Validação + 35min Cruzamento de XML vs Pedido',
        summary: 'Cruzamento automático entre o XML da Nota Fiscal do fornecedor e o Pedido de Compra (PC) cadastrado.',
        objective: 'Evitar divergências de preço, alíquota de imposto, quantidade faturada e código de produto antes do descarregamento.',
        prerequisites: ['Arquivo XML da NF-e e número do Pedido de Compra'],
        workflowSteps: [
            {
                step: 1,
                title: 'Importar XML da Nota Fiscal',
                action: 'Arraste o arquivo XML da NF do fornecedor para a área de análise.'
            },
            {
                step: 2,
                title: 'Análise de Divergências',
                action: 'O sistema confronta item a item. Diferenças de valor acima da tolerância são destacadas em vermelho.'
            },
            {
                step: 3,
                title: 'Aprovação para Entrada',
                action: 'Valide a entrada para liberar o caminhão para descarregamento no pátio.'
            }
        ],
        criticalAlerts: [
            'Nunca autorize o descarregamento com divergência de preço sem validação expressa do comprador responsável.'
        ],
        verificationChecklist: [
            'Sei cruzar um XML com o Pedido de Compra',
            'Sei identificar inconsistências de preço ou quantidade'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. QUALIDADE (SGQ & RNCS)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'sgq_rncs',
        name: 'Gestão de RNCs (Não-Conformidades)',
        path: '/sgq/gestao-rncs',
        badge: 'Melhoria Contínua',
        category: 'Qualidade',
        targetAudience: 'Inspetores de Qualidade, Engenharia e Supervisores',
        durationHours: 1.5,
        durationLabel: '1h 30min',
        structure: '30min Metodologia 8D/Ishikawa + 1h Registro e Plano de Ação',
        summary: 'Abertura, investigação de causa raiz, plano de ação corretiva e eficácia de Não-Conformidades internas ou de clientes.',
        objective: 'Garantir a rastreabilidade total de falhas, segregar peças defeituosas e prevenir reincidências.',
        prerequisites: ['Registro de refugo, devolução de cliente ou desvio dimensional'],
        workflowSteps: [
            {
                step: 1,
                title: 'Abertura da RNC',
                action: 'Informe a OP, código da peça, quantidade reprovada e anexe fotos da não-conformidade.'
            },
            {
                step: 2,
                title: 'Disposição Imediata do Lote',
                action: 'Defina se o material será: "Sucateado/Refugo", "Retrabalhado na Fábrica" ou "Aprovado sob Concessão".'
            },
            {
                step: 3,
                title: 'Análise de Causa Raiz (5 Porquês)',
                action: 'Reúna os envolvidos para identificar se a causa foi método, máquina, matéria-prima ou mão de obra.'
            },
            {
                step: 4,
                title: 'Plano de Ação e Verificação de Eficácia',
                action: 'Cadastre as ações preventivas com responsáveis e prazos e audite o próximo lote produzido.'
            }
        ],
        criticalAlerts: [
            'Peças com RNC aberta devem ser identificadas fisicamente com etiqueta vermelha e segregadas na área de quarentena!'
        ],
        verificationChecklist: [
            'Sei abrir uma RNC completa com fotos e detalhes',
            'Sei cadastrar um plano de ação corretiva e acompanhar prazos'
        ]
    },
    {
        id: 'sgq_ativos_calibracao',
        name: 'Gestão de Ativos & Calibração',
        path: '/sgq/ativos',
        badge: 'Metrologia & Ferramentas',
        category: 'Qualidade',
        targetAudience: 'Metrologistas, Inspetores e Encarregados',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Normas ISO/Inmetro + 40min Gestão de Certificados',
        summary: 'Controle de validade de calibração de instrumentos de medição (Paquímetros, Micrômetros, Balanças, Manômetros).',
        objective: 'Garantir que nenhum operador utilize instrumentos de medição vencidos ou descalibrados no chão de fábrica.',
        prerequisites: ['Código patrimonial do instrumento e certificado de calibração'],
        workflowSteps: [
            {
                step: 1,
                title: 'Consulta por Status de Validade',
                action: 'Filtre por "Vencidos", "A Vencer em 30 Dias" e "Calibrados".'
            },
            {
                step: 2,
                title: 'Anexo de Certificado',
                action: 'Anexe o laudo do laboratório credenciado e atualize a data da próxima calibração.'
            }
        ],
        criticalAlerts: [
            'Instrumentos com calibração vencida devem ser recolhidos imediatamente da bancada de produção.'
        ],
        verificationChecklist: [
            'Sei consultar a validade de calibração de um instrumento',
            'Sei anexar o certificado do laboratório'
        ]
    },



    // ═══════════════════════════════════════════════════════════════════════════
    // 8. MANUTENÇÃO DE EQUIPAMENTOS
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'manutencao_dashboard',
        name: 'Gestão de Manutenção de Máquinas',
        path: '/manutencao/dashboard',
        badge: 'TPM & Confiabilidade',
        category: 'Manutenção',
        targetAudience: 'Equipe de Manutenção, Líderes de Setor e PCP',
        durationHours: 1.0,
        durationLabel: '1h 00min',
        structure: '20min Indicadores MTBF/MTTR + 40min Abertura de Ordens de Serviço',
        summary: 'Controle de paradas de máquina, abertura de Ordens de Manutenção Preventiva/Corretiva e indicadores de disponibilidade (MTBF/MTTR).',
        objective: 'Reduzir o tempo de máquina parada e garantir a execução rigorosa dos planos de manutenção preventiva.',
        prerequisites: ['Parque fabril cadastrado com identificação de máquinas'],
        workflowSteps: [
            {
                step: 1,
                title: 'Abertura de Chamado Corretivo',
                action: 'Ao identificar falha em máquina, abra a ordem de serviço informando o equipamento e o sintoma.'
            },
            {
                step: 2,
                title: 'Atendimento e Troca de Peças',
                action: 'O técnico registra o início do atendimento, peças substituídas e tempo de reparo.'
            },
            {
                step: 3,
                title: 'Checklists Diários de Operador',
                action: 'Acompanhe se os operadores estão preenchendo o checklist diário de lubrificação e limpeza.'
            }
        ],
        criticalAlerts: [
            'Máquinas sob manutenção devem ser bloqueadas com cadeado e cartão de segurança (Lockout/Tagout).'
        ],
        verificationChecklist: [
            'Sei abrir um chamado de manutenção urgente',
            'Sei consultar o histórico de manutenções de um equipamento'
        ]
    }
];

// Trilhas agrupadas atualizadas contemplando todo o ecossistema
export const ALL_TRAINING_TRACKS = [
    {
        id: 'trilha-operador',
        title: 'Operador de Chão de Fábrica & Apontador',
        subtitle: 'Para operadores de máquinas, bancada e apontadores de linha',
        icon: 'Factory',
        badge: 'bg-blue-100 text-blue-800',
        estimatedTime: '6h 30min',
        moduleCount: 4,
        description: 'Capacitação prática no registro de tempo real, início e término de operações, pausas, apontamentos parciais e conferência de lote.',
        modules: ['pcp_controle_execucao', 'pcp_apontamento_vertical', 'pcp_programas_ncn', 'manutencao_dashboard'],
        keySkills: [
            'Iniciar e pausar tempos de fabricação com precisão',
            'Registrar motivos de parada e refugos com exatidão',
            'Consultar desenhos e roteiros no terminal de bancada'
        ]
    },
    {
        id: 'trilha-pcp-analista',
        title: 'Planejador & Programador de PCP',
        subtitle: 'Para analistas de planejamento, controle de produção e sequenciamento',
        icon: 'Layers',
        badge: 'bg-indigo-100 text-indigo-800',
        estimatedTime: '8h 30min',
        moduleCount: 5,
        description: 'Explosão de estruturas BOM, roteamento pull, sequenciamento no Gantt, Curva S de avanço físico e gestão de gargalos.',
        modules: ['planejamento_estrutura_routing', 'planejamento_gantt', 'curva_s_pedido', 'pcp_fila_dependencias', 'visao_fabrica'],
        keySkills: [
            'Executar explosão de BOM com lead time reverso (Pull)',
            'Sequenciar OPs no Gantt considerando restrições de máquina'
        ]
    },
    {
        id: 'trilha-engenharia',
        title: 'Engenharia de Produto & Métodos',
        subtitle: 'Para engenheiros, projetistas e analistas de processos',
        icon: 'Cpu',
        badge: 'bg-teal-100 text-teal-800',
        estimatedTime: '4h 30min',
        moduleCount: 3,
        description: 'Criação de estruturas BOM, padronização de cadastros, vinculação de roteiros e inspeção 3D de montagens.',
        modules: ['eng_bom_generator', 'eng_produtos', 'eng_analise_3d'],
        keySkills: [
            'Cadastrar e auditar listas de materiais (BOM)',
            'Gerenciar revisões de desenhos técnicos em PDF',
            'Inspecionar modelos tridimensionais no visualizador 3D'
        ]
    },
    {
        id: 'trilha-comercial-fat',
        title: 'Comercial, Vendas & Faturamento',
        subtitle: 'Para analistas de vendas, faturamento e atendimento a clientes',
        icon: 'BarChart2',
        badge: 'bg-amber-100 text-amber-800',
        estimatedTime: '4h 30min',
        moduleCount: 4,
        description: 'Acompanhamento da carteira de pedidos, liberação de itens para faturamento, metas financeiras e resposta a clientes.',
        modules: ['comercial_pedidos', 'comercial_itens_faturar', 'comercial_dashboard_fat', 'comercial_gestao_ops'],
        keySkills: [
            'Monitorar o cumprimento de prazos da carteira de vendas',
            'Liberar itens para emissão fiscal após conclusão fabril',
            'Fornecer status imediato aos clientes sobre pedidos'
        ]
    },
    {
        id: 'trilha-logistica-suprimentos',
        title: 'Logística, Suprimentos & Qualidade',
        subtitle: 'Para almoxarifes, expedidores, compradores e inspetores SGQ',
        icon: 'Wrench',
        badge: 'bg-emerald-100 text-emerald-800',
        estimatedTime: '6h 30min',
        moduleCount: 5,
        description: 'Emissão de romaneios, recebimento de beneficiamento externo, auditoria de XMLs, estoque e gestão de RNCs.',
        modules: ['logistica_romaneios', 'logistica_recebimentos', 'logistica_estoque', 'suprimentos_auditoria_pc', 'sgq_rncs'],
        keySkills: [
            'Emitir e conferir romaneios de expedição de cargas',
            'Cruzar XMLs de notas fiscais com pedidos de compras',
            'Registrar e conduzir investigações de causa raiz (RNCs)'
        ]
    }
];
