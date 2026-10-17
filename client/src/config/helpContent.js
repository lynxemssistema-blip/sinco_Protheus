// ─────────────────────────────────────────────────────────────────────────────
// helpContent.js  â€“  Conteúdo de Ajuda Contextual por rota
// Fonte para o script de migração: server/scripts/migrateHelpToDb.js
// ─────────────────────────────────────────────────────────────────────────────
export const HELP_CONTENT = {

  '/novas-funcionalidades': {
    category: 'Sistema',
    categoryColor: '#425750',
    title: 'Novas Funcionalidades (A partir de 09/09/2026)',
    icon: 'Sparkles',
    description: 'Linha do tempo oficial e registro detalhado de todas as novas ferramentas, correções e melhorias entregues após o marco de entrega do sistema.',
    tabs: [
      {
        id: 'visao_geral',
        label: 'Visão Geral & Filtros',
        description: 'Como explorar as entregas e novidades do sistema.',
        steps: [
          'Marco Inicial: Todas as implementações cadastradas nesta tela foram entregues a partir de 09/09/2026.',
          'Filtros por Módulo: Utilize os botões superiores para filtrar entregas por área (Sistema, WabTec, PCP, SGQ, etc.).',
          'Busca Textual: Digite termos no campo de pesquisa para encontrar recursos específicos ou palavras-chave.',
          'Acesso Rápido: Cada card conta com atalho direto ("Acessar no Sistema") para levar você até a tela implementada.'
        ]
      }
    ],
    tips: [
      'Esta tela é mantida continuamente para auditoria e acompanhamento das evoluções do Portal Lynx.',
      'Novas funcionalidades são marcadas com tags visuais destacando o tipo de entrega (Nova Funcionalidade, Resiliência, Melhoria).'
    ],
    links: [
      { path: '/dashboard', label: 'Dashboard Principal' },
      { path: '/ajuda', label: 'Central de Ajuda' }
    ]
  },

  '/login': {
    category: 'Segurança e Acesso',
    categoryColor: '#425750',
    title: 'Portal de Acesso e Auto-Recuperação',
    icon: 'Lock',
    description: 'Guia de autenticação no sistema, recuperação de acesso e utilização do recurso inteligente de auto-recuperação do servidor.',
    tabs: [
      {
        id: 'autenticacao',
        label: 'Acesso e Login',
        description: 'Como entrar no sistema e o que fazer em caso de problemas de senha.',
        steps: [
          'Credenciais: Digite seu usuário/login e senha corporativa cadastrada para acessar o sistema.',
          'Esqueceu a Senha?: Caso não lembre ou sua senha tenha sido redefinida pelo administrador, clique no link "Esqueceu a senha?" para receber um novo acesso provisório via WhatsApp ou E-mail.',
          'Criar Conta: Novos colaboradores podem solicitar cadastro inicial clicando no botão "Criar Conta".'
        ]
      },
      {
        id: 'acordar_servidor',
        label: '⚡ Acordar o Servidor',
        description: 'Como resolver lentidões ou indisponibilidade sem depender de suporte técnico.',
        steps: [
          'Exibição Inteligente: Em condições normais, o botão fica invisível. Ele surge automaticamente em um card amarelo caso a tentativa de login demore mais de 3,5 segundos ou retorne erro de rede/servidor.',
          'Como Acionar: Basta clicar no botão "⚡ Acordar o Servidor". O comando é enviado diretamente ao serviço Watchdog de segurança, que reinicia a aplicação de forma limpa e automática.',
          'Contagem Regressiva (15s): Uma barra de progresso de 15 segundos será exibida enquanto o sistema testa a volta do servidor. Assim que restabelecido, o aviso verde libera você para entrar.',
          'Intervalo de Segurança (30 minutos): Para proteger a integridade dos dados e evitar abusos, essa função possui um cooldown de 30 minutos. Se já tiver sido acionada recentemente, a tela mostrará os minutos restantes.'
        ]
      }
    ],
    tips: [
      'Se o botão "Acordar o Servidor" aparecer na tela, você pode clicar com segurança. Ele resolve travamentos de processos e libera o sistema para todos os usuários.',
      'Após o reinício do servidor, seus dados não são perdidos e a tela liberará você para digitar sua senha e entrar imediatamente.'
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda' }
    ]
  },



  '/calendario-atividades': {
    category: 'Planejamento / PCP',
    categoryColor: '#f59e0b',
    title: 'Calendário de Atividades & Monitoramento',
    icon: 'Calendar',
    description: 'Interface unificada para agendamento de tarefas customizadas, integração com o cronograma de entregas do PCP Protheus e painel de monitoramento de grupos de WhatsApp via Evolution API com suporte de Inteligência Artificial.',
    tabs: [
      {
        id: 'atividades',
        label: 'Atividades & PCP',
        description: 'Visualização do calendário mensal de compromissos integrando tarefas customizadas e cronograma de PCP.',
        steps: [
          'Calendário Mensal: Navegue entre os meses e clique em qualquer dia para ver a lista de atividades e entregas agendadas à direita.',
          'Criar Atividade: Clique em "Criar Atividade" no cabeçalho para agendar uma nova tarefa personalizada, selecionando um ou mais responsáveis/destinatários.',
          'Tarefas da Ata Viva: O calendário exibe tarefas geradas a partir do módulo Ata Viva (identificadas pela tag verde). Você pode marcar como concluídas/pendentes diretamente.',
          'Edição e Exclusão: Itens da Ata Viva no painel direito podem ser editados (alterando o texto) ou excluídos permanentemente usando os botões de ação rápidos.',
          'Tabela de Entregas PCP: A seção inferior direita exibe as previsões do PCP Protheus em formato de tabela compacto contendo o pedido, cliente, código do produto, descrição, OP e quantidade (formatada com até 2 casas decimais).'
        ]
      },
      {
        id: 'whatsapp',
        label: 'Monitoramento WhatsApp',
        description: 'Interface para gerenciamento e acompanhamento de conversas de grupos monitorados pelo sistema.',
        steps: [
          'Cadastro de Grupos: Registre novos grupos informando o nome exato da conversa no WhatsApp (via Evolution API).',
          'Sincronização de Histórico: Selecione um grupo e clique em "Sincronizar API" para carregar as mensagens recentes enviadas para o grupo.',
          'Agente de IA (Gemini): Ative o painel "Agente IA" no topo do chat para visualizar o resumo executivo das conversas de hoje e a lista de pendências não atendidas identificadas de forma automatizada.',
          'Mídias e Imagens: O feed de mensagens exibe imagens enviadas ao grupo. Clique nelas para visualizar em modo ampliado (lightbox).'
        ]
      }
    ],
    tips: [
      'Use a checkbox ao lado das tarefas customizadas ou da Ata Viva para concluir os itens. Se for uma atividade em lote, o sistema perguntará se deseja concluir para todos os usuários do grupo.',
      'O indicador verde "PCP" no calendário mensal sinaliza que existem programações de faturamento agendadas para aquele dia.',
      'O resumo de IA é atualizado dinamicamente. Caso sinta falta de mensagens recentes, force uma atualização clicando em "Atualizar Análise" dentro do painel IA.'
    ],
    links: [
      { path: '/painel-producao', label: 'Painel de Produção' },
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' }
    ]
  },

  '/painel-producao': {
    category: 'PCP / Chão de Fábrica',
    categoryColor: '#8b5cf6',
    title: 'Painel de TV (Produção & Corte)',
    icon: 'Tv',
    description: 'Painel de monitoramento contínuo em tempo real, projetado para exibição em TVs na fábrica. Apresenta o carrossel rotativo de prioridades e o detalhamento de carga de corte por máquina.',
    tabs: [
      {
        id: 'prioridades',
        label: 'Prioridades de Pedidos',
        description: 'Painel esquerdo de monitoramento das prioridades comerciais e de produção.',
        steps: [
          'Exibição de Prioridades: Mostra as tarefas prioritárias ativas configuradas no painel Ata Viva.',
          'Carrossel Automático: Caso haja mais de 3 itens, o painel alterna as páginas a cada ciclo do timer global.',
          'Página Estática/Única: Projetado para exibir os dados de forma compacta e sem barras de rolagem, garantindo leitura perfeita a distância.'
        ]
      },
      {
        id: 'fila-corte',
        label: 'Carga de Corte (Opção 1)',
        description: 'Painel direito rotativo focado em um posto de corte (laser) por vez.',
        steps: [
          'Exibição 1 por 1: O carrossel mostra todos os detalhes da fila de uma única máquina ativa por vez, alternando a cada ciclo do timer.',
          'Limite de Linhas: Exibe no máximo 5 programas por página. Fila maior que 5 gera sub-páginas rotativas para evitar barras de rolagem.',
          'Cálculo de Tempo Acumulado: O tempo restante de fila para cada programa é acumulado (ex: o 3º programa mostra o tempo dele somado aos anteriores), dando visibilidade real de quando cada chapa iniciará.',
          'Progresso Geral: A barra de progresso no cabeçalho indica a porcentagem de chapas concluídas de toda a fila ativa do equipamento.'
        ]
      },
      {
        id: 'alertas-parada',
        label: 'Equipamentos Parados',
        description: 'Monitoramento de ordens de serviço de manutenção ativas.',
        steps: [
          'Banner de Parada: Se a máquina estiver em manutenção (EM_MANUTENCAO ou AGUARDANDO_MANUTENCAO), um banner vermelho destacado é renderizado no topo.',
          'Motivo em Tempo Real: O banner exibe o sintoma/motivo cadastrado na Ordem de Serviço aberta no módulo de manutenção.',
          'Manutenção de Fila: Mesmo paradas ou sem programas pendentes, as máquinas continuam na rotação para manter a equipe ciente de seu status operacional.'
        ]
      }
    ],
    tips: [
      'Modo Tela Cheia: Pressione F11 no navegador para maximizar o painel e remover as barras de endereços na TV da fábrica.',
      'Ajuste da Rotação: Clique no ícone de engrenagem para abrir as opções de rotação e configure o tempo ideal para leitura da equipe.',
      'Legenda de Cores: Linhas azuis indicam programas em execução (corte ativo); linhas laranja indicam programas em preparação ou montagem.'
    ],
    links: [
      { path: '/pcp/programas-ncn', label: 'Programas CNC' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  },

  '/pcp/programas-ncn': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Programas CNC (NCN)',
    icon: 'Cpu',
    description: 'Interface de cadastro e sequenciamento de programas CNC para as máquinas de corte e conformação. Permite planejar a utilização de chapas e a ordem de execução.',
    tabs: [
      {
        id: 'cadastro',
        label: 'Cadastro de Programas',
        description: 'Registro de novos programas de corte na plataforma.',
        steps: [
          'Código e Nome: Cadastre o identificador único do programa CNC (geralmente gerado pelo software de nesting).',
          'Vínculo de Máquina: Associe o programa ao recurso/máquina onde ele será executado (ex: Laser 01).',
          'Parâmetros Físicos: Defina a matéria-prima (chapa), espessura, dimensões e o tempo previsto por chapa.',
          'Quantidade de Chapas: Informe a quantidade total de repetições/chapas planejadas para aquele programa.'
        ]
      },
      {
        id: 'sequenciamento',
        label: 'Sequenciamento da Fila',
        description: 'Definição da ordem de execução das máquinas.',
        steps: [
          'Ordem de Execução: Atribua números sequenciais para definir quais programas devem ser rodados primeiro.',
          'Status Operacional: Acompanhe o status (FILA, EM_EXECUCAO, CONCLUIDO) conforme os operadores apontam a produção.',
          'Vínculo de Operador: Visualize qual operador está responsável pelo programa que está em andamento.'
        ]
      },
      {
        id: 'nesting-otimizacao',
        label: 'Otimização de Nesting',
        description: 'Maximização do aproveitamento das matérias-primas.',
        steps: [
          'Tempo por Peça: Avalie o tempo previsto por ciclo para monitorar eventuais desvios de produtividade.',
          'Retalho e Perdas: Registre a eficiência de aproveitamento da chapa para monitorar os níveis de refugo metálico.'
        ]
      }
    ],
    tips: [
      'Importação em Lote: Utilize a ferramenta de upload se disponível para carregar planos de nesting gerados externamente.',
      'Sincronização com a TV: Qualquer alteração na ordem de execução atualiza instantaneamente a fila exibida no painel de monitoramento da fábrica.'
    ],
    links: [
      { path: '/painel-producao', label: 'Painel da TV' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  },

  '/pcp/controle-execucao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Controle de Execução',
    icon: 'Activity',
    description: 'Interface de acompanhamento operacional detalhado em tempo real. Permite monitorar ordens de produção ativas, operadores logados, tempos de setup e eficácia de execução.',
    tabs: [
      {
        id: 'realtime-log',
        label: 'Log em Tempo Real',
        description: 'Fluxo contínuo de eventos do chão de fábrica.',
        steps: [
          'Visualização de Apontamentos: Monitore cada peça registrada pelos operadores nos terminais fracionados.',
          'Operadores Ativos: Identifique quem está logado em cada centro de trabalho e qual OP está executando.',
          'Status dos Postos: Veja a lista completa de postos ativos com cronômetros de tempo de máquina ligada.'
        ]
      },
      {
        id: 'setup-tempos',
        label: 'Tempos de Setup & Carga',
        description: 'Auditoria de tempos improdutivos e preparação.',
        steps: [
          'Tempo de Setup: Monitore os desvios entre o tempo de setup planejado pela engenharia e o realizado na troca de ferramentas.',
          'Pausas e Paradas: Acompanhe os registros de interrupções por falta de material, ajuste de máquina ou troca de turno.'
        ]
      },
      {
        id: 'integridade-erp',
        label: 'Sincronização Protheus',
        description: 'Garantia de conformidade entre o sistema local e o ERP.',
        steps: [
          'Apontamentos Pendentes: Verifique se existem registros locais aguardando envio para o Totvs Protheus.',
          'Erros de Integração: Identifique e trate rejeições de apontamento no ERP (como divergência de saldo ou operador não cadastrado).'
        ]
      }
    ],
    tips: [
      'Auditoria de Desvios: Use a aba de desvios para identificar gargalos onde o tempo de fabricação real superou em mais de 20% o tempo padrão cadastrado pela engenharia.',
      'Passagem de Turno: Gere o relatório resumido de fechamento de turno para apoiar a transição de equipes na troca de horários.'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  // ── ðŸ¤– Diretrizes e Persona do Agente de IA (Lynx - Suporte Lynx) ───────
  '_AI_SYSTEM_INSTRUCTIONS_': {
    category: 'Inteligência Artificial',
    categoryColor: '#8b5cf6',
    title: 'Instruções Mestre - Suporte Lynx',
    icon: 'Bot',
    description: 'Bloco de sistema dedicado a alinhar o comportamento do agente de WhatsApp integrado à plataforma.',
    steps: [
      'PERSONA: Você é a IA de "Suporte do Grupo Lynx". Seja prestativo, sempre use um tom educado, cordial e corporativo.',
      'RESTRIÇÃO DE GRUPO: Você atende exclusivamente o grupo "Lynx - Suporte Lynx". Se acionado fora dele, deve se recusar a interagir.',
      'DOMÍNIO DE CONHECIMENTO: Você domina todos os módulos deste arquivo. Quando um usuário perguntar "Como eu aponto uma O.P.?" ou "Para que serve a curva S?", busque nestas chaves a resposta exata.',
      'TRATATIVA DE ERROS: Ao identificar que o usuário encontrou um erro no sistema, oriente de forma prática usando as dicas cadastradas neste documento (ex: erros de 401, falta de estrutura, erro na integração do Protheus).',
      'FORMATAÇÃO: Envie respostas bonitas para o WhatsApp, utilizando *negrito* para botões e menus, listas com emojis adequados e evite respostas extremamente longas se puder resumir.'
    ],
    tips: [
      'Inicie os atendimentos com "Olá! Aqui é o Suporte do Grupo Lynx..." e encerre colocando-se à disposição.'
    ],
    links: []
  },

  // ── Dashboard / Home ────────────────────────────────────────────────────────
  '/': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Dashboard Principal',
    icon: 'LayoutDashboard',
    description: 'Visão geral de todas as operações do sistema Lynx PCP. Acompanhe indicadores de produção, pedidos em aberto e alertas em tempo real.',
    steps: [
      'Consulte os cards de resumo no topo para ver ordens abertas, itens a faturar e alertas.',
      'Clique em qualquer card para navegar diretamente ao módulo correspondente.',
      'Use o menu lateral para acessar qualquer módulo do sistema.',
      'O painel atualiza automaticamente a cada poucos minutos.',
    ],
    tips: [
      'Fixe a barra de ajuda para ter acesso rápido sem fechar o painel.',
      'Use os atalhos de teclado para navegar entre módulos rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'Produção' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Manutenção ──────────────────────────────────────────────────────────────
  '/manutencao/execucao-modal': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Painel de Execução de Manutenção',
    icon: 'Play',
    description: 'Este modal centraliza todas as ações necessárias para executar e registrar uma manutenção na fábrica.',
    tabs: [
      {
        id: 'execucao',
        label: 'Aba de Execução',
        description: 'Registre tempo, técnicos e detalhes da execução.',
        steps: [
          'Cronômetro: Permite medir exatamente o tempo gasto na manutenção. Pressione Play ao iniciar e Pause ao interromper.',
          'Técnicos: É obrigatório selecionar ao menos um técnico envolvido na atividade.',
          'Atividades: Descreva os reparos, peças ajustadas e testes realizados.',
          'Fotos Pós-Manutenção: Anexe evidências do reparo concluído ou das peças substituídas.',
          'Problema Resolvido: Define se a máquina pode voltar a operar ou se a ordem continuará pendente.'
        ]
      },
      {
        id: 'materiais',
        label: 'Solicitação de Materiais',
        description: 'Solicite peças necessárias para o reparo.',
        steps: [
          'Caso precise de peças, solicite por aqui. O almoxarifado (ou compras) será notificado e o item entrará no fluxo de Gestão de Materiais.'
        ]
      },
      {
        id: 'historico',
        label: 'Histórico',
        description: 'Acompanhe a rastreabilidade da ordem.',
        steps: [
          'Registra todas as interações da Ordem (abertura, solicitações, pausas, finalizações) com usuário e horário exatos, garantindo a rastreabilidade (Log de Auditoria).'
        ]
      }
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' },
      { path: '/manutencao/atividades', label: 'Gestão de Atividades' }
    ]
  },

  // ── Faturamento e Comercial ──────────────────────────────────────────────────
  // Nota: entrada principal detalhada definida abaixo (linha ~1139). Esta é uma referência simplificada.
  '/vendas/itens-faturar-ref': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar (Referência)',
    icon: 'ListOrdered',
    description: 'Consulte a entrada principal desta página para documentação completa das regras de saldo, programações PCP e fluxo de solicitação de faturamento.',
    steps: [],
    tips: [],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver documentação completa' },
    ],
  },

  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Controle de Faturamento',
    icon: 'FileText',
    description: 'Painel operacional para expedidores e faturistas tratarem as solicitações criadas pela equipe comercial.',
    steps: [
      'No painel esquerdo, navegue entre as abas "Pendente" (aguardando emissão da Nota) e "Faturado".',
      'Selecione uma solicitação para carregar os detalhes (itens, quantidades, valores e desenhos) no painel principal.',
      'Preencha o campo "Nota Fiscal (Macro / Cabeçalho)" e clique em "Salvar NF". Sem este campo, o sistema bloqueia a transição para Faturado.',
      'Faça o Check (✅) em cada item da lista (obrigatório) para confirmar a separação física.',
      'Clique no botão "Faturado" no cabeçalho para finalizar e travar a edição da remessa.',
      'Use a aba "Diário de Auditoria" no rodapé para visualizar a rastreabilidade completa (quem criou, alterou quantidades ou vinculou NF).'
    ],
    tips: [
      'Para exportar uma romaneio, utilize os botões "Excel" ou "PDF" no canto superior direito do painel da solicitação.',
      'Você pode despachar os XMLs/PDFs técnicos automaticamente marcando as faturas e clicando no botão flutuante "E-mail em Lote".',
      'Somente o usuário que faturou a nota (ou um Administrador) pode reverter o status ou editar quantidades após o faturamento.'
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'BarChart2',
    description: 'Visão executiva (Analytics) do faturamento da empresa, consolidando as notas emitidas e as metas financeiras mensais.',
    steps: [
      'Acompanhe o velocímetro de "Meta Atingida" e os KPIs principais: Faturamento do Mês, Ticket Médio e Comparativo com mês anterior.',
      'O gráfico "Evolução do Faturamento" plota o faturamento diário contra a Linha de Meta Diária.',
      'O gráfico "Top Clientes" ajuda a identificar concentração de receita (Pareto).',
      'Use o filtro de "Mês/Ano" no topo para analisar o histórico passado do sistema.'
    ],
    tips: [
      'A meta mensal é configurável. Clique no botão de engrenagem próximo ao velocímetro para ajustá-la.',
      'A tabela de "Últimos Faturamentos" na parte inferior permite auditar quais OPs/Pedidos geraram a receita do dia.'
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  '/comercial/atrasos': {
    category: 'Comercial / PCP',
    categoryColor: '#ef4444',
    title: 'Visão Gerencial (Atrasos)',
    icon: 'Target',
    description: 'Espelho dinâmico da fábrica, focado 100% em itens pendentes com data de entrega inferior a hoje.',
    steps: [
      'Escolha a perspectiva no topo: "Logística & Qtds" (foco em peças físicas) ou "Dashboard Financeiro" (foco no Risco em R$).',
      'O painel resume o Total de Itens Atrasados, Quantidade Física Pendente, e a Média de Atraso em dias.',
      'Os gráficos (Top 5 Clientes e Atrasos por Mês) refletem dinamicamente a perspectiva escolhida (Volume vs. Dinheiro).',
      'A tabela "Espelho Dinâmico" agrupa os gargalos em uma hierarquia de: Cliente > Mês de Atraso > Itens Individuais.'
    ],
    tips: [
      'O botão "Gerar PDF (Resumo)" exporta um snapshot da tela para ser usado em reuniões de diretoria.',
      'Você pode abrir e fechar as "pastas" na tabela clicando nas setas (Chevron) ao lado dos clientes e meses para detalhar pedidos e operações paradas.',
      'A visualização "Dashboard Financeiro" é restrita apenas a usuários com permissão "valores_financeiros".'
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  '/visao-geral': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Pedidos de Venda (Visão Geral)',
    icon: 'ShoppingCart',
    image: '/help-images/visao_geral.png',
    description: 'Central de acompanhamento dos Pedidos de Venda. Reúne filtros avançados, 6 modos de visualização, ações em lote, exportações, planejamento PCP, geração de Lotes de O.P./Corte, Cronograma Gantt, MRP de Materiais e Planilha Mestra — tudo em um único lugar.',
    tabs: [
      {
        id: 'geral',
        label: 'Aba: Evolução da Carteira',
        description: 'Tabela principal com todos os pedidos de venda. Dois modos: "Agrupado" (pedidos expansíveis com itens aninhados) e "Lista Plana" (cada item em uma linha, com seleção múltipla).',
        steps: [
          '🔄 COMPORTAMENTO INICIAL: Os dados NÃO carregam automaticamente. Preencha os filtros e clique em "Filtrar" (ou pressione Enter).',
          '👁️ MODOS DE VISUALIZAÇÃO: Alterne entre "Agrupado" (pedidos como pais expansíveis) e "Lista Plana" (cada item em linha separada) no canto superior direito.',
          '🔍 FILTROS DISPONÍVEIS: Cliente (parcial), Nº Pedido, Pedido de Compra (PC), Produto (parcial), Tipo de Item e Status OP.',
          '📅 FILTROS DE DATA: Selecione o tipo — "Emissão Pedido", "Data de Entrega" ou "Emissão NF". Atalhos rápidos ("Atrasados/Hoje" e "Hoje/Futuro") aparecem ao selecionar Entrega.',
          '⚖️ APENAS PENDENTES: Toggle que exclui itens totalmente faturados. Desative para buscas muito mais rápidas.',
          '🔄 ORDENAÇÃO: Ordene por Pedido/Item, Data do Pedido, Entrega, Data PCP ou Prev. Faturamento (ASC/DESC). Também clique nos cabeçalhos com seta.',
          '⚙️ COLUNAS CONFIGURÁVEIS (Lista Plana): Clique no botão ⚙️ para escolher e reordenar as colunas. A configuração é salva no servidor por usuário e persiste entre sessões.',
          '☑️ AÇÕES EM LOTE (Lista Plana): Selecione itens com checkbox e use os botões na barra acima da tabela: 🔴 Prioridade · 📝 Ata · 📅 Planejamento PCP · 📦 Gerar Lote de O.P. · ✂️ Gerar Lote de Corte.',
          '📝 MENU DE AÇÕES (⋮): Por linha — Fotos, Documentos, Classificação, Controle de Engenharia, Notas (Ata Viva), Impressão Espelho OP, Espelho por Operação, Excel por Operação, Previsão de Faturamento, Prioridade e Detalhes NF.',
          '💰 PREV. FATURAMENTO: Clique diretamente na coluna "Prev. Fat." para editar e salvar inline (sem abrir menu).',
          '📥 IMPORTAÇÃO PCP: Carregue planilha Excel com datas PCP (formato Protheus) para atualizar múltiplos itens de uma vez.',
          '🤖 HERMES AI: Assistente de IA contextualizado com a Visão Geral — acione a qualquer momento pelo botão azul.',
        ]
      },
      {
        id: 'pcp-export',
        label: 'Aba: Exportação Materiais',
        description: 'Geração de lista de materiais para PCP. Selecione pedidos e gere um Excel com 4 abas: Materiais SOLDA, Materiais Outros, Detalhado por produto e Sem Estrutura.',
        steps: [
          'Filtre os itens desejados (data, cliente, pedido, produto, estrutura, pendentes).',
          'Clique nas linhas para selecionar (ou use "Selecionar todos").',
          'A barra flutuante azul aparece na parte inferior. Clique em "Gerar Lista de Materiais".',
          '📊 ABA "Materiais - Solda": Todos os materiais cujos componentes ancestrais passam por MO0020 (Solda) em QUALQUER nível da estrutura de produto (BOM). A verificação percorre recursivamente até o nível 10 — se um sub-componente interno tem MO0020 no roteiro, TODOS os seus materiais filhos aparecem aqui.',
          '📊 ABA "Materiais - Outros": Materiais de componentes que NÃO passam por MO0020 em nenhum nível.',
          '📊 ABA "Detalhado": Linhas por produto pai com pedido, cliente, componente, recurso e quantidade — sem aglutinar.',
          '📊 ABA "Sem Estrutura": Produtos selecionados sem BOM cadastrada no Protheus.',
        ]
      },
      {
        id: 'cronograma',
        label: 'Aba: Cronograma / Gantt',
        description: 'Visualização gráfica Gantt dos pedidos por cliente e produto com linha do tempo horizontal.',
        steps: [
          'Cada item é exibido como barra horizontal entre a data de emissão e data de entrega.',
          '🟢 Verde = Entregue | 🟠 Laranja = Pendente no prazo | 🔴 Vermelho = Atrasado.',
          'Passe o mouse para ver tooltip com detalhes completos (pedido, cliente, produto, datas).',
          '🖨️ EXPORTAR PDF: Gera o cronograma em A4 Paisagem no padrão Lynx com cabeçalho corporativo repetido em todas as páginas.',
        ]
      },
      {
        id: 'mrp-bulk',
        label: 'Aba: Necessidades MP',
        description: 'MRP rápido para os pedidos da tela atual — verificação de Matéria-Prima (Almoxarifados 01 e 03).',
        steps: [
          'Fornece visão compilada de matéria-prima necessária (Almox 01 e 03) para os pedidos filtrados.',
          'Ideal para consultas prévias e planejamento de compras antes de liberar produção.',
        ]
      },
      {
        id: 'programacao-entregas',
        label: 'Aba: Prog. de Entregas',
        description: 'Calendário e listagem de entregas programadas — confirme e ajuste datas com integração a Prev. Faturamento e Data PCP.',
        steps: [
          'Exibe os compromissos de entrega dos pedidos filtrados em formato de calendário ou lista.',
          'Permite confirmar e ajustar datas programadas pelo PCP.',
          'Integrado com os campos Data PCP e Previsão de Faturamento.',
        ]
      },
      {
        id: 'planilha-mestra',
        label: 'Aba: Planilha Mestra',
        description: 'Visão consolidada gerencial integrando dados de pedidos, produção e datas em formato tabular avançado — exportável para reuniões e relatórios executivos.',
        steps: [
          'Consolida dados de múltiplas fontes (pedidos, OPs, datas) em uma visão única.',
          'Ideal para análises gerenciais e apresentações executivas.',
          'Exportável para uso em reuniões de follow-up.',
        ]
      },
    ],
    steps: [
      '1. Acesse a Visão Geral — a tela estará inicialmente em branco.',
      '2. Defina o tipo de data (Emissão, Entrega ou NF) e os filtros desejados.',
      '3. Pressione Enter ou clique em "Filtrar".',
      '4. Use os botões superiores: 📊 Excel · 📄 PDF · 📝 Ata · 🤖 Hermes AI.',
      '5. No modo Lista Plana, selecione itens e use as ações em lote (Lote O.P., Corte, Prioridade).',
      '6. Use o menu ⋮ da linha para ações individuais (impressão, classificação, engenharia, etc.).',
      '7. Navegue pelas abas para Cronograma, Materiais, MRP, Entregas ou Planilha Mestra.',
    ],
    tips: [
      '⚡ **Performance**: O filtro "Apenas Pendentes" é pesado. Desative para buscas muito mais rápidas.',
      '⚙️ **Colunas**: As configurações são salvas no servidor — persistem entre sessões e dispositivos.',
      '📋 **Lista Plana**: É a única visão que ativa a seleção múltipla para Lotes de O.P., Corte e Prioridade em lote.',
      '💰 **Prev. Faturamento**: Clique direto na célula da coluna — salva automaticamente sem abrir menus.',
      '⚠️ **Prioridades**: Notificam a equipe PCP/Produção em tempo real via Ata Viva e Hermes.',
      '🔵 **Lógica Solda (MO0020)**: A aba "Materiais - Solda" na Exportação detecta MO0020 em TODOS os níveis da BOM (até nível 10) — não apenas no produto raiz.',
      '📥 **Importação PCP**: Linhas ocultas por filtros no Excel são ignoradas automaticamente.',
      '🖨️ **Impressões OP**: Use o menu ⋮ para 3 tipos de impressão — simples, por operação (PDF) ou por operação (Excel com 3 abas).',
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
      { path: '/pcp/exportacao-materiais', label: 'Exportação de Materiais PCP' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  '/pcp-refinado/capacidade': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Cadastro de Capacidade e Tempos (PCP Refinado)',
    icon: 'Layers',
    description: 'Definição do tempo padrão de operação e a capacidade diária por recurso (máquina ou centro de trabalho). Estes valores são a base matemática para o cálculo de carga do CRP.',
    steps: [
      '1. Visão Geral: A tabela lista todos os recursos disponíveis carregados do ERP Protheus.',
      '2. Tempo Padrão: Define quantos minutos (ou fração) a máquina gasta para processar 1 peça/batida.',
      '3. Capacidade Diária: Quantos minutos por dia a máquina está disponível (Ex: 8 horas = 480 minutos).',
    ],
    tips: [
      'Lembre-se de salvar suas alterações: a linha ficará com borda amarela enquanto não for salva.',
      'Recursos com Capacidade = 0 ou Tempo = 0 não vão constar adequadamente nos cálculos de ocupação!',
    ],
    links: [
      { path: '/pcp-refinado/ocupacao', label: 'Ver Taxa de Ocupação' }
    ],
  },

  '/pcp-refinado/ocupacao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Taxa de Ocupação Diária (CRP)',
    icon: 'Activity',
    description: 'Painel visual de análise de carga versus capacidade dos recursos de fábrica (CRP). Ele permite visualizar gargalos de produção dia a dia baseados nas OPs planejadas.',
    steps: [
      '1. Modos de Visualização: Alterne entre Tabela (Detalhado), Mapa de Calor (Visão estendida) ou Gráfico (Gantt) usando os botões superiores.',
      '2. Filtro Pesado: Desative a chave "Apenas Pendentes" para incluir ordens já executadas e faturadas nos dias anteriores.',
      '3. Detalhamento e Ajustes: Clique em "Detalhar OPs" na tabela ou na barra do gráfico para abrir as ordens que compõem a carga do dia. Você pode re-planejar datas individualmente ou em lote.',
      '4. Relatório em PDF: É possível imprimir qualquer uma das visões formatadas para A4.',
    ],
    tips: [
      'Dias em vermelho escuro no Mapa de Calor ou barras que passam de 100% indicam que o recurso está sendo planejado acima da sua capacidade configurada.',
      'Qualquer alteração de data dentro do Detalhamento da OP afeta o planejamento global de imediato.',
    ],
    links: [
      { path: '/pcp-refinado/capacidade', label: 'Ajustar Capacidade (Recursos)' }
    ],
  },

  '/pcp/analytics': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Analytics da Fábrica',
    icon: 'BarChart',
    description: 'Painel gerencial de indicadores de produção, OEE (Overall Equipment Effectiveness) e capacidade instalada.',
    steps: [
      'Acompanhe o painel superior para ver o OEE consolidado da fábrica no período selecionado.',
      'O gráfico de carga máquina mostra os recursos que estão sobrecarregados (gargalos) ou ociosos.',
      'Utilize os filtros de Setor e Data para refinar os gráficos.',
      'Acompanhe a tabela de "Top Rejeições" para entender onde ocorrem as maiores perdas de qualidade.'
    ],
    tips: [
      'O Analytics é atualizado a cada 1 hora com base nos apontamentos de produção e encerramentos de OPs.'
    ],
    links: [
      { path: '/pcp/visao-fabrica', label: 'Visão Global (Fábrica)' },
      { path: '/pcp/evolucao-apontamento', label: 'Evolução dos Apontamentos' },
    ],
  },

  '/ind-apontamento': {
    category: 'Chão de Fábrica',
    categoryColor: '#8b5cf6',
    title: 'Apontamento Fracionado',
    icon: 'CheckSquare',
    description: 'Tela simplificada e otimizada para operadores de máquina realizarem apontamentos de produção em terminais (tablets/monitores).',
    steps: [
      'O operador deve digitar ou bipar o código de barras da OP Fracionada.',
      'O sistema exibirá apenas a operação em que a peça se encontra atualmente.',
      'Informe a Quantidade Produzida, Quantidade Rejeitada (se houver, com motivo), e clique em Registrar.',
      'O registro é imediato e atualiza o saldo da OP na matriz.'
    ],
    tips: [
      'Esta interface tem fontes maiores e botões expandidos para facilitar o uso com luvas ou telas touch.',
      'O sistema impede que o operador aponte uma quantidade superior ao saldo liberado pela operação anterior.'
    ],
    links: [
      { path: '/ind-pcp-release', label: 'Liberação PCP' },
      { path: '/ind-factory-floor', label: 'Painel da Fábrica (Local)' },
    ],
  },

  '/ppaps/buscar-produto': {
    category: 'Qualidade',
    categoryColor: '#ec4899',
    title: 'Buscar Produto (PPAPs)',
    icon: 'Database',
    description: 'Central de busca de Processos de Aprovação de Peças de Produção (PPAP) associados aos produtos.',
    steps: [
      'Digite o código do produto ou referência do cliente.',
      'O sistema retornará o histórico de submissões de PPAP para aquele item.',
      'Visualize o status de aprovação (Aprovado, Reprovado, Aprovado com Desvio) e acesse os documentos atrelados.',
      'Caso não exista um PPAP ativo, inicie uma nova submissão a partir do botão Novo PPAP.'
    ],
    tips: [
      'Produtos que possuem PPAPs expirados ou com desvios vencidos aparecerão com um alerta em vermelho.'
    ],
    links: [
      { path: '/sgq', label: 'Gestão SGQ' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // ————————————————— Gestão de OPs / Pedidos de Venda ———————————————————————————————————————————
  '/comercial/gestao-ops': {
    category: 'Comercial / PCP',
    categoryColor: '#3b82f6',
    title: 'Pedidos de Venda e Gestão de OPs',
    icon: 'List',
    description: 'Interface principal que conecta as vendas (PVs) ao PCP (OPs). Visualize pedidos de clientes, libere ordens de produção, e tenha acesso a todas as opções avançadas de impressão e planejamento de fábrica.',
    steps: [
      'Visão de Tabela: Explore os pedidos abertos usando os filtros no topo (Pesquisa por Número, Cliente, ou Status).',
      'Filtros de Data: Selecione a chave de filtro de data (Emissão, Previsão de OP, ou Entrega) para focar na métrica que importa para o seu departamento.',
      'Menu de Ações (3 Pontinhos): Clique no menu "Mais Ações" na última coluna da tabela para acessar as ferramentas de gestão e impressão.',
      'Aba de Impressões (OPs): Dentro do Menu de Ações, o botão "Imprimir OP..." abre opções ricas: "OP Espelho" (apenas capa simples), "Opção A: OP + Desenhos Agrupados" (folhas de desenho juntas no final), e "Opção B: OP + Desenhos Misturados/Roteirizados" (desenhos intercalados por etapa produtiva).',
      'Impressão do PV (Pedido de Venda): Utilize o botão "Imprimir PV" no Menu de Ações para gerar um PDF com todas as informações do pedido focado na visão comercial.',
      'Ata Viva (Engenharia): O botão "Engenharia / Restrições" abre a trilha de controle de projetos e desenha pendências diretamente ligadas ao item.',
      'Planejamento Sequencial: Clique no ícone de "Planejamento Sequencial" para abrir o Gantt onde você gerencia as datas e durações produtivas do lote.',
    ],
    tips: [
      'O Menu de Ações agora é inteligente e não fica mais cortado pelo fundo da tabela; se o item estiver muito embaixo, o menu abre para cima automaticamente.',
      'O ícone da prancheta laranja sinaliza se o pedido já foi recebido no Totvs / PCP, exibindo o status atual do processamento ao passar o mouse.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Monitor de Faturamento' },
      { path: '/planejamento-gantt', label: 'Planejamento Gantt' },
    ],
  },

  // ————————————————— Catálogo de Produtos ——————————————————————————————————————————————————————
  '/produtos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Catálogo de Produtos',
    icon: 'Package',
    description: 'Gerencie todos os produtos e matérias-primas cadastrados. Visualize estruturas, associe documentos e referências de clientes.',
    steps: [
      'Use a barra de pesquisa para filtrar por descrição ou código do produto.',
      'Selecione o tipo (MP, PI, PA) e a unidade de medida nos filtros de topo.',
      'Clique no ícone de estrutura (camadas) para visualizar a BOM do produto.',
      'Clique no ícone de documento para abrir os documentos associados.',
      'Use o botão EXCEL para exportar a lista filtrada para planilha.',
      'O botão XLSX importa produtos em lote a partir de uma planilha.',
      'O botão IA auxilia na geração de descrições e classificações automáticas.',
    ],
    tips: [
      'Produtos com a badge laranja no ícone de documento possuem arquivos não visualizados.',
      'A coluna REF. CLIENTE exibe a referência do cliente associada ao produto — passe o mouse para ver detalhes.',
      'Use o filtro "Todos (Estoque)" para ver apenas itens com saldo disponível.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/bom-generator', label: 'Gerador de BOM' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ————————————————— Estrutura do Produto ——————————————————————————————————————————————————————
  '/estrutura/:codigo': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Estrutura do Produto (BOM)',
    icon: 'GitBranch',
    description: 'Visualize a lista de materiais (BOM) exportada do ERP. Exporte relatórios em PDF, consulte desenhos e elabore as liberações da engenharia.',
    steps: [
      'A árvore exibe todos os componentes e subconjuntos do produto selecionado.',
      'Clique em uma linha na tabela para expandir o Roteiro de Fabricação (operações, tempos padrão e de setup).',
      'O bloco "Relatórios" agrupa a exportação em PDF: clique em "Relatório Completo" para imprimir a árvore industrial de todos os níveis organizadamente.',
      'Use a função "Nível 1" para gerar um relatório de produção compacto focado nas metas primárias da montagem.',
      'Marque a caixa "Restrições (Nv.01+)" junto ao "Nível 1" para imprimir os alertas e restrições subjacentes vitais de montagem que não estariam visíveis.',
      'O botão verde "Desenhos" consolida todos os PDFs técnicos cadastrados num único arquivo, permitindo impressão em massa ágil ao chão de fábrica.',
      'A função "Liberação" permite conferir a revisão aplicável com o PCP.'
    ],
    tips: [
      'Qualquer produto filho (do nível 1 em diante) que possua arquivo de desenho técnico aparecerá com o ícone em vermelho. Basta clicar para visualizar a planta no navegador.',
      'A coluna laranja com botões de engrenagem e setas no módulo indica a expansão do processo fabril.',
    ],
    links: [
      { path: '/produtos', label: 'Catálogo de Produtos' },
      { path: '/bom-generator', label: 'Gerador de BOM' },
    ],
  },

  // ————————————————— Gerador de BOM ————————————————————————————————————————————————————————————
  '/bom-generator': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Gerador de BOM',
    icon: 'FileSpreadsheet',
    description: 'Gere listas de materiais (BOM) a partir de modelos ou estruturas existentes. Exporte para Excel ou envie direto ao ERP.',
    steps: [
      'Selecione o produto base pelo campo de busca no topo.',
      'Defina a quantidade desejada e o tipo de explosão (1 nível ou completa).',
      'Clique em "Gerar BOM" para calcular os materiais necessários.',
      'Revise a lista gerada e ajuste quantidades se necessário.',
      'Exporte para Excel ou confirme o envio ao ERP.',
    ],
    tips: [
      'A explosão completa calcula o saldo líquido considerando o estoque atual.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ————————————————— Produção ——————————————————————————————————————————————————————————————————
  '/producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Ordens de Produção',
    icon: 'Factory',
    description: 'Gerencie todas as ordens de produção abertas e em andamento. Acompanhe status, datas e apontamentos.',
    steps: [
      'Filtre as ordens por status (Abertas, Em andamento, Encerradas) nos filtros de topo.',
      'Clique no número da OP para ver detalhes e componentes da ordem.',
      'Use o botão "Apontar" para registrar produção parcial ou total.',
      'Altere a data de entrega prevista clicando no campo de data.',
      'Exporte a lista de OPs para Excel pelo ícone no canto superior.',
    ],
    tips: [
      'OPs em vermelho estão atrasadas em relação à data prevista.',
      'Use o filtro por cliente para visualizar apenas ordens de um determinado cliente.',
      'Modos de Apontamento (Livre, Sequência ou Saldo): Observe o indicador no topo. "Livre" permite apontar qualquer etapa sem amarras; "Sequência" trava o início até que a operação anterior acabe; "Saldo" limita a quantidade máxima ao saldo disponível da operação anterior.',
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' },
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
    ],
  },

  // ————————————————— OP Detalhes ————————————————————————————————————————————————————————————————
  '/producao/op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Detalhes da Ordem de Produção',
    icon: 'ClipboardList',
    description: 'Visualize os detalhes completos de uma ordem de produção, incluindo operações, componentes e histórico de apontamentos.',
    steps: [
      'Pesquise pelo número da OP no campo de busca.',
      'Consulte as operações e o status de cada etapa produtiva.',
      'Verifique os componentes necessários e o saldo disponível.',
      'Registre apontamentos parciais ou finais diretamente nesta tela.',
    ],
    tips: [
      'O histórico de apontamentos fica disponível na aba "Histórico".',
      'Modos de Apontamento: O indicador no topo dita a regra da fábrica. "Livre" = Sem amarras. "Sequência" = Obriga concluir a anterior. "Saldo" = Não deixa apontar peças que ainda não passaram pela operação anterior.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ————————————————— Controle de Produção e Lote de Planejamento ——————————————————————————————
  '/controle-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Controle de Produção',
    icon: 'LayoutDashboard',
    image: '/help-images/controle_producao.png',
    description: 'Dashboard principal de PCP para acompanhamento e programação das Ordens de Produção (OPs). Permite filtrar, visualizar o status de cada operação e sequenciar planejamentos em lote com Gantt interativo. Inclui geração de Relatório de Impressão no Padrão Corporativo Lynx (PDF A4 Paisagem) com sub-paginação por recurso/máquina.',
    imageCaption: 'Interface principal do Controle de Produção com filtros avançados e listagem detalhada de OPs e operações pendentes.',
    steps: [
      '— FILTROS —',
      'OP: Filtra pelo número EXATO da Ordem de Produção (ex: 005473). Para pesquisar várias OPs de uma vez, separe-as por vírgula.',
      'Item: Filtra pelo número do item dentro da OP (ex: 01). Útil quando uma OP possui múltiplos itens de produto.',
      'Seq: Filtra pelo número de sequência da operação dentro do roteiro da OP (ex: 001, 002). Cada passo do processo de fabricação tem uma sequência.',
      'Produto: Filtra pelo código EXATO do produto (ex: MT2-1783). Para garantir o máximo de performance na pesquisa, não são mais permitidos trechos de descrição.',
      'Pedido: Filtra pelo número EXATO do Pedido de Venda (PV) do cliente no Protheus (ex: 003752).',
      'Cliente: Filtra pelo nome do cliente vinculado ao pedido de venda.',
      'Selecione múltiplas OPs usando os checkboxes. Geralmente selecione OPs do mesmo Recurso/Máquina para criar um pacote de trabalho coeso.',
      'Com OPs selecionadas, clique em "Sequenciar Planejamento". O modal Gantt abrirá com todas as operações agrupadas por recurso.',
      'No Gantt, defina datas, arraste barras, edite durações e escolha entre cálculo progressivo (frente) ou regressivo (trás). Ao salvar, todas as operações recebem datas planejadas de uma só vez.',
      'Clique em "Limpar" para desmarcar todas as OPs selecionadas sem precisar percorrer a lista.',
    ],
    tips: [
      'Estratégia de uso: Filtre por Recurso específico (ex: MO0012) + status "Não Iniciados" para ver a fila de trabalho daquela máquina e planejar em sequência.',
      'Linhas com fundo azul representam a sequência 001 (operação raiz do roteiro) â€” em geral é a primeira etapa da fabricação daquele item.',
      'A coluna "Produção" (ex: 6/6) mostra apontamentos já registrados no chão de fábrica. Quando chega em 100%, o status vira "Concluída" automaticamente.',
      'Operações "Atrasadas" (vermelho) indicam que o prazo de entrega ao cliente já venceu â€” priorize essas no planejamento.',
      'O filtro "Com saldo pendente" é o padrão recomendado: mantém a lista limpa, mostrando apenas o que ainda precisa de atenção do PCP.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/relatorios', label: 'Relatórios de Produção' },
    ],
  },

  // ── Exportação de Lista de Materiais (PCP) ───────────────────────────────────
  '/pcp/exportacao-materiais': {
    category: 'PCP / Engenharia',
    categoryColor: '#6366f1',
    title: 'Exportação de Lista de Materiais',
    icon: 'FileSpreadsheet',
    description: 'Esta ferramenta permite compilar todas as matérias-primas necessárias para produzir uma determinada seleção de itens de pedido, agrupando itens idênticos e somando quantidades para enviar a compras e ao almoxarifado.',
    steps: [
      'Filtrar Pedidos Pendentes: Utilize a barra de filtros no topo para buscar os pedidos. Por padrão, ele lista apenas os pedidos com saldo pendente (chave Pendentes). Ao preencher os filtros, clique no botão Buscar.',
      'Selecionar Itens na Tabela: Marque as caixas de seleção na primeira coluna para os produtos que você deseja produzir. Você pode selecionar um por um, ou usar o botão Selecionar todos no cabeçalho da tabela.',
      'Processar e Exportar: Assim que selecionar pelo menos 1 item, uma barra flutuante azul aparecerá na parte inferior da tela. Clique em Gerar Lista de Materiais.',
      'O Resultado Automático (Excel): O sistema fará a "explosão" de toda a árvore de produtos em segundo plano, até o último nível (matéria-prima final). Então fará a multiplicação pela quantidade a faturar do pedido e consolidará todas as matérias-primas unificando pela descrição e código. Um arquivo Excel pronto será baixado automaticamente!',
    ],
    tips: [
      'Atenção aos itens destacados em vermelho e com a marcação "Sem estrutura". Itens sem estrutura não gerarão consumo de matéria-prima na exportação, pois a engenharia não cadastrou seus componentes no sistema.',
      'Exemplo Prático de Agrupamento: Se você selecionou Item A (Qtd: 10) que possui 4 Un de Parafuso e Item B (Qtd: 5) que possui 2 Un do mesmo Parafuso, a planilha listará apenas uma linha para o "Parafuso" com a quantidade total igual a 50 (10x4 + 5x2).',
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Pedidos de Engenharia ────────────────────────────────────────────────────
  '/engenharia/pedidos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Ata Viva (Pedidos de Engenharia)',
    icon: 'Ruler',
    description: 'Interface de Ata Viva departamental (PCP/Produção e Engenharia). Esta janela quebra a barreira entre as áreas, mantendo um log rigoroso do que está em desenvolvimento, pausado ou reprovado pelo PCP.',
    steps: [
      'Apontamento Inteligente (Cronômetro): Na coluna de Ações, o botão Play â–¶ï¸ dispara o cronômetro do seu usuário para esta tarefa. O sistema fecha/pausa todos os seus outros apontamentos automaticamente. Nada de "esquecer ligado".',
      'Coluna Dupla de Entrega: A tabela exibe sempre lado a lado a "Data Prazo Acordada" e a "Data Real Entregue". Esta matemática alimenta os painéis de diretoria evidenciando gargalos sistêmicos de atraso.',
      'Persistência de Visão (Customização): Arraste as colunas da tabela pelo Header para reordenar. Esconda colunas que você não quer ler no botão de engrenagem. Tudo isso fica salvo no cache da sua máquina e nunca mais se perde.',
      'Adição Rápida Multi-Filtros: Os botões pílulas coloridos (Amarelo = Em Processo, Verde = Aprovado) no cabeçalho filtram instantaneamente a pilha.',
    ],
    tips: [
      'Sanitização Automática: Evite digitar aspas ou caracteres especiais pesados no campo "Resumo/Restrição". O motor que sobe os dados pro Totvs os transforma obrigatoriamente para UPPERCASE e os higieniza pra salvar a tabela SZ0 de corrupção.',
      'Para apontar horas do passado ou reverter um esquecimento, clique no modal de detalhes engrenagem => aba "Apontamentos â±ï¸" e inclua carga manual fracionária.',
    ],
    links: [
      { path: '/engenharia/relatorio-controle', label: 'Relatórios Nível 1' },
      { path: '/estrutura/:codigo', label: 'Verificar Escopo (Estrutura)' },
    ],
  },

  // ── Formulário SINCO (Integração Totvs) ──────────────────────────────────
  '/engenharia/sinco/formulario': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Formulário SINCO',
    icon: 'FileCode',
    description: 'Interface unificada para construção e manipulação da engenharia do produto diretamente conectada ao ERP Protheus. A partir desta tela, você edita a Estrutura (BOM), o Roteiro de Fabricação e as amarrações de Produto x Cliente (SZ1).',
    steps: [
      '1. Consulta Mestra: No cabeçalho, digite o código do produto (Ex: MT2-1234) e clique em "Buscar" para carregar as informações em tempo real do banco.',
      '2. Árvore do Produto (SG1): Lista de materiais/componentes (BOM). Em modo de Edição, é possível modificar a estrutura, o tipo e a quantidade dos itens, impactando os consumos e empenhos da fábrica.',
      '3. Operações (Roteiro - SG2): Roteirização fabril. Ao editar, ajuste a descrição, mude o tempo de Setup/Padrão (importante para o PCP) e direcione para um novo Recurso (setor/máquina).',
      '4. Produto Lynx/Cliente (SZ1): Relaciona o código e nome comercial usados pelo Cliente com o nosso código interno, com controle de Revisão. A busca inteligente de cliente (botão lupa) garante exatidão de cadastro e exibe os principais parceiros por padrão.',
    ],
    tips: [
      'Atenção ao Salvar: Suas modificações nos grids (como incluir linhas ou apagar) só serão validadas e enviadas ao Protheus após o clique no botão "Salvar" referente a cada bloco.',
      'Lupa de Consultas: Os ícones de lupa nas células de Componente, Recurso e Cliente são atalhos super eficientes para pesquisar e carregar dados do banco diretamente na sua célula ativa.',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Ata Viva' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // ── Relatório de Controle de Engenharia ──────────────────────────────────────
  '/engenharia/relatorio-controle': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Relatório Nível 1 (Controle Engenharia)',
    icon: 'FileText',
    description: 'Geração do formato tradicional "Relatório Nível 1" adaptado. Consumo cru, apenas visualizando requisições (SZ0) em status sólido e Aprovadas para auditoria de entrega.',
    steps: [
      'Filtro Rígido de Aprovados: A tabela traz internamente um hook embutido que descarta O.S reprovadas ou em andamento. Só aparecem cargas sólidas prontas.',
      'Consumo Financeiro de HH: Observe as engrenagens de Apontamento - as "Horas Totais" não vêm secas. Elas agregam a soma do cronômetro automatizado mais todas injeções manuais feitas pela equipe em dias passados.',
      'Exportação para XLS: Uma vez com a malha filtrada em tela, clique no botão para vazar o dado pro Excel que a diretoria usa p/ fechar folha ou precificar OP.',
    ],
    tips: [
      'Para os cálculos de HH no Totvs, 0.5h equivale a 30 minutos na vida real. A exportação mantém o formato de engenharia para multiplicar pelo custo da hora/homem sem erro.',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Corrigir Lançamento no Pedido' }
    ],
  },

  // ── Romaneios ────────────────────────────────────────────────────────────────
  '/romaneios': {
    category: 'Logística',
    categoryColor: '#ef4444',
    title: 'Romaneios de Expedição',
    icon: 'Truck',
    description: 'Crie e gerencie romaneios de expedição de produtos acabados. Controle o que foi enviado, para qual cliente e quando.',
    steps: [
      'Clique em "+ Novo Romaneio" para iniciar uma expedição.',
      'Selecione o cliente e o endereço de entrega.',
      'Adicione os itens a expedir, informando quantidade e lote.',
      'Confirme e imprima o romaneio para acompanhar a carga.',
      'Após expedição, altere o status para "Enviado".',
    ],
    tips: [
      'Romaneios podem ser exportados em PDF para envio por e-mail ao cliente.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // ── Recebimentos ────────────────────────────────────────────────────────────
  '/recebimentos': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Recebimentos de Materiais',
    icon: 'PackageCheck',
    description: 'Registre e acompanhe o recebimento de materiais e componentes. Faça a conferência física e libere para o estoque.',
    steps: [
      'Consulte os pedidos de compra pendentes de recebimento.',
      'Selecione o pedido e informe as quantidades recebidas.',
      'Confira os dados da nota fiscal com o que foi pedido.',
      'Confirme o recebimento para dar entrada no estoque.',
    ],
    tips: [
      'Recebimentos parciais são permitidos â€” o saldo restante continua em aberto.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
    ],
  },

  // ── Saldo de Materiais ───────────────────────────────────────────────────────
  '/saldo-materiais': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Saldo de Materiais',
    icon: 'BarChart3',
    description: 'Consulte o saldo de estoque de todos os materiais e componentes. Visualize posição atual, reservas e disponibilidade.',
    steps: [
      'Pesquise pelo código ou descrição do material.',
      'Veja o saldo atual, quantidade reservada e saldo disponível.',
      'Filtre por tipo de material (MP, PI, PA) para facilitar a análise.',
      'Exporte o saldo para Excel para análise externa.',
    ],
    tips: [
      'Saldo disponível = Saldo atual âˆ’ Reservas em OPs abertas.',
      'Itens com saldo negativo indicam necessidade urgente de compra ou recebimento.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Solicitações de Compra ───────────────────────────────────────────────────
  '/solicitacoes-compras': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Solicitações de Compra',
    icon: 'ShoppingCart',
    description: 'Crie e gerencie solicitações de compra de materiais. Controle o fluxo de aprovação até a emissão do pedido de compra.',
    steps: [
      'Clique em "+ Nova Solicitação" para criar uma SC.',
      'Informe o material, quantidade e justificativa.',
      'Submeta para aprovação do responsável.',
      'Acompanhe o status até a conversão em Pedido de Compra.',
    ],
    tips: [
      'Solicitações aprovadas são automaticamente vinculadas ao pedido de compra.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Pedidos de Compra ────────────────────────────────────────────────────────
  '/pedidos-compras-pv': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Pedidos de Compra',
    icon: 'FileText',
    description: 'Gerencie pedidos de compra emitidos para fornecedores. Acompanhe status de entrega e confirme recebimentos.',
    steps: [
      'Pesquise pedidos por número, fornecedor ou material.',
      'Clique no pedido para ver todos os itens e condições.',
      'Atualize o status conforme recebimento parcial ou total.',
      'Emita o PDF do pedido para enviar ao fornecedor.',
    ],
    tips: [
      'Pedidos vencidos são destacados em vermelho â€” entre em contato com o fornecedor.',
    ],
    links: [
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/fluxo-compras-nf', label: 'Fluxo Compras / NF' },
    ],
  },

  // ── Fluxo Compras / NF ───────────────────────────────────────────────────────
  '/fluxo-compras-nf': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Fluxo Compras / Nota Fiscal',
    icon: 'Receipt',
    description: 'Visualize o fluxo completo de compras desde a solicitação até a entrada da nota fiscal e recebimento físico.',
    steps: [
      'Acompanhe o status de cada etapa: SC â†’ PC â†’ NF â†’ Recebimento.',
      'Filtre por período para análise mensal.',
      'Clique em qualquer etapa para abrir os detalhes.',
    ],
    tips: [
      'Use este módulo para identificar gargalos no processo de compras.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
    ],
  },

  // ── Suprimentos / Requisições ────────────────────────────────────────────────
  '/suprimentos/requisicoes': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Requisições de Suprimentos',
    icon: 'ClipboardCheck',
    description: 'Gerencie as requisições internas de materiais e suprimentos para o chão de fábrica.',
    steps: [
      'Crie requisições informando o material, quantidade e destino.',
      'Acompanhe o status de atendimento pela equipe de almoxarifado.',
      'Confirme a entrega física após recebimento.',
    ],
    tips: [
      'Requisições urgentes podem ser marcadas com prioridade alta.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Controle de Produção (entrada duplicada removida â€” mantida acima) ────────

  // ── Planejamento Sequencial ──────────────────────────────────────────────────
  '/planejamento-sequencial': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Sequencial de OPs',
    icon: 'GanttChart',
    description: 'Interface de planejamento refinado e sequencial. Permite agendar as operações de uma Ordem de Produção considerando a duração inclusiva de cada etapa, saltando dias não úteis (ou forçando sábados) e criando um encadeamento progressivo ou regressivo.',
    steps: [
      'Escolha a Direção do Cálculo: No topo, defina se o cálculo será "Progressivo" (A partir de uma data inicial) ou "Regressivo" (De trás para frente, garantindo a data de entrega).',
      'Ajuste o Calendário: Alterne entre "Corridos" (considera todos os dias da semana) ou "Úteis" (ignora Sábado e Domingo). No modo "Úteis", você pode forçar a inclusão do Sábado marcando a caixa "Incluir Sábado".',
      'Arraste e Solte (Drag & Drop): Clique sobre a faixa colorida de uma operação e arraste para os lados para deslocar livremente aquela etapa.',
      'Edição de Duração: A primeira célula de cada barra contém um pequeno campo numérico (ex: 3 d). Clique ali para digitar os dias estimados; o gráfico recalculará o encadeamento das próximas etapas automaticamente.',
      'Incluir Serviços de Terceiro (ST): Marque "Incluir ST" se desejar que serviços externos travem o fluxo do Gantt, alongando a entrega.',
    ],
    tips: [
      'A linha base em tons acinzentados fica visível por trás das barras principais, mostrando o planejamento anterior, permitindo comparar a sua simulação atual com o que já estava salvo no banco.',
      'Ao alterar a data de entrega (Cálculo Regressivo), todas as operações são empurradas para trás respeitando os dias informados de trás pra frente.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Carga Máquina Total' },
      { path: '/planejamento-gantt', label: 'Gantt Master' },
    ],
  },

  // ── Matriz de Produção ───────────────────────────────────────────────────────
  '/producao-matrix': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Matriz de Produção',
    icon: 'Grid',
    image: '/help-images/producao_matrix.png',
    description: 'Visualize a carga de trabalho por máquina/centro de custo em formato de matriz. Identifique sobrecarga e capacidade ociosa.',
    imageCaption: 'Visão matricial distribuindo a carga de OPs ao longo do tempo por recurso produtivo.',
    steps: [
      'Selecione o período desejado.',
      'Analise as células da matriz: cores indicam % de ocupação.',
      'Clique numa célula para ver as OPs alocadas naquele centro/período.',
      'Redistribua cargas arrastando OPs entre períodos, se necessário.',
    ],
    tips: [
      'Células vermelhas indicam sobrecarga â€” revise o planejamento.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/planejamento-gantt', label: 'Planejamento Gantt' },
    ],
  },

  // ── Apontamento por Estrutura de Produto ──────────────────────────────────────
  '/pcp/apontamento-estrutura': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por Estrutura de Produto',
    icon: 'GitFork',
    description: 'Visualize a árvore matricial completa de OPs de um pedido (produto pai, sub-OPs/PI e matérias-primas) e faça apontamentos por operação diretamente na estrutura, em três formatos de visualização diferentes.',
    steps: [
      'Busca: informe pelo menos um filtro (OP, Pedido, Cliente ou Produto) e clique em "Buscar". Use "Mais Filtros" para refinar por data de entrega, recurso, status ou tipo de produto (PI/PA/MP).',
      'Tabela de Estrutura: lista hierárquica com clique para expandir/recolher cada OP, mostrando roteiro (operações), materiais consumidos e sub-OPs filhas indentadas por nível.',
      'Organograma Interativo: mesma estrutura em formato de árvore visual com cards conectados. Arraste para navegar (pan) e use a roda do mouse ou os botões +/− para zoom. Clique num card para abrir o painel de detalhes lateral.',
      'Referência A4 Vertical: no Organograma, o botão com ícone de retângulo (canto inferior direito) ativa uma guia tracejada nas proporções de uma folha A4 vertical, só como referência visual para ajudar a enquadrar a árvore — não altera os dados nem gera impressão.',
      'Fluxograma de Processos: visualização alternativa focada na sequência de operações/recursos por onde a peça passa.',
      'Apontar: clique nos círculos de operação (organograma) ou no botão "Apontar" (tabela) para registrar produção diretamente naquela etapa do roteiro.',
      'Desenhos técnicos: o ícone de documento (fica vermelho quando há PDF cadastrado) abre o desenho técnico do produto ou componente em nova aba.',
      'Foco em múltiplas OPs: quando o pedido tem mais de uma OP raiz, use o painel "Foco na OP" (organograma) para buscar e alternar entre elas.',
    ],
    tips: [
      'A etiqueta "Modo" no topo (Livre, Sequência ou Saldo) indica a regra de apontamento configurada pela fábrica — controla se é preciso seguir a ordem do roteiro ou respeitar saldos.',
      'Marque "Exibir Concluídos / Sem Saldo" (em Mais Filtros) para não esconder itens já finalizados.',
      'Componentes tipo PI/PA (produto intermediário) aparecem com roteiro próprio expansível; matérias-primas (MP) não têm roteiro, só quantidade consumida.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/conferencia', label: 'Conferência de Apontamentos' },
      { path: '/pcp/fila-dependencias', label: 'Fila e Dependências por Recurso' },
    ],
  },

  // ── Apontamento Vertical e Multi-Operação ─────────────────────────────────────
  '/pcp/apontamento-vertical': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento Vertical & Multi-Operação',
    icon: 'ListChecks',
    description: 'Central ágil para registro de produção. O novo recurso de Apontamento Multi-Operação permite dar baixa sistêmica em várias etapas do roteiro de uma só vez, ideal para fechar saldos de processos que ocorreram em sequência.',
    steps: [
      'Busca Rápida: Utilize os filtros no topo (Pedido, OP, Código do Produto ou Máquina) para localizar exatamente a operação que você vai apontar.',
      'Abrindo o Modal: Clique no ícone verde de "Apontar" (CheckSquare) na última coluna da operação desejada.',
      'Apontamento Multi-Operação: Ao abrir o modal, o sistema não exibirá apenas a etapa atual. Ele listará todas as operações ANTERIORES do roteiro daquele produto, informando o Saldo (peças pendentes de apontamento) de cada uma.',
      'Auto-Preenchimento Inteligente (A Mágica): Quando você digita uma quantidade na "Operação Atual", o sistema automaticamente preenche as operações anteriores. Ele limita o valor copiado ao máximo permitido pelo Saldo de cada etapa anterior.',
      'Exemplo de Auto-Preenchimento: Se a Operação 10 tem 50 de saldo, a 20 tem 20 de saldo, e a 30 (Atual) tem 50 de saldo. Ao digitar "50" na atual, a etapa 20 será preenchida com "20" (limite dela) e a 10 com "50".',
      'Auditoria de Operador: O seu usuário logado ficará gravado no Histórico de todas as operações apontadas. Porém, para as etapas anteriores que foram auto-preenchidas, o sistema gravará seu nome com a tag "(Baixa Auto)", garantindo total transparência de quem operou a máquina versus quem fez a baixa sistêmica.',
      'Tempos (Cronômetro): Você pode usar o "Cronômetro de Operação" no topo para marcar o tempo exato (Início e Fim). O mesmo tempo será replicado para as baixas automáticas anteriores que ocorrem no mesmo lote.',
    ],
    tips: [
      'Se o valor preenchido automaticamente na etapa anterior ficar com erro (vermelho), é porque ultrapassou o Saldo. O botão de salvar será bloqueado até a correção.',
      'Para apontar apenas a operação atual sem mexer nas anteriores, basta zerar manualmente os campos das operações anteriores antes de clicar em Confirmar.',
      'Regra de Apontamento: Observe a etiqueta no topo do Modal (Livre, Sequência ou Saldo) para entender as restrições impostas pela fábrica.',
      'Configuração das Regras: O recurso de baixar operações em lote pode ser habilitado/desabilitado pelos Administradores no menu "Configurações" > aba "Geral", ativando ou não o "Apontamento Multi-Operação".',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/pcp/conferencia', label: 'Conferência de Apontamentos' },
    ],
  },

  // ── Fila e Dependências por Recurso ──────────────────────────────────────────
  '/pcp/fila-dependencias': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Fila e Dependências por Recurso',
    icon: 'ListOrdered',
    description: 'Interface gerencial para acompanhamento dinâmico das Ordens de Produção alocadas em um recurso (máquina/setor). Permite entender rapidamente não só o que precisa ser feito, mas de onde a peça vem (origem) e para onde vai (destino).',
    steps: [
      'Escolha do Recurso: Utilize o seletor no topo para definir qual máquina ou setor você quer analisar (ex: Embalagem, Solda).',
      'Aba "Depende de (Inbound)": Foca no que precisa CHEGAR na sua máquina. A última coluna mostra qual é a operação anterior que está segurando ou fornecendo o material.',
      'Aba "Próxima Fila (Outbound)": Foca no que vai SAIR da sua máquina. A última coluna mostra qual é a próxima etapa que está aguardando o seu trabalho.',
      'Acompanhamento de Progresso: A barra de apontamentos mostra o quanto já foi produzido. Quando a quantidade pendente chega a zero (após arredondamento), o status muda automaticamente para "Concluída".',
      'Ações: Você pode visualizar PDFs técnicos clicando no ícone do documento (quando em vermelho).',
      'Impressão: A página possui formatação otimizada para impressão em paisagem (A4) utilizando o atalho do navegador (Ctrl+P).'
    ],
    tips: [
      'Pedidos de venda com saldo já finalizado e entregue são bloqueados pelo sistema, garantindo que a fila contenha apenas o que é estritamente necessário.',
      'Itens sem pedido de venda associado são indicados pela tag "OP de Estoque".'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' }
    ]
  },

  // ── Conferência de Apontamentos ──────────────────────────────────────────────
  '/pcp/conferencia': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Conferência de Apontamentos',
    icon: 'CheckSquare',
    description: 'Revise e valide os apontamentos de produção registrados. Corrija inconsistências antes do fechamento do período.',
    steps: [
      'Filtre os apontamentos por data e operador.',
      'Revise cada linha e clique em "Aprovar" ou "Rejeitar".',
      'Apontamentos rejeitados retornam para correção pelo operador.',
      'Exporte o relatório consolidado ao final do período.',
    ],
    tips: [
      'Apontamentos com tempo muito acima da média são destacados para revisão.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/evolucao-apontamento', label: 'Evolução dos Apontamentos' },
    ],
  },

  // ── Evolução de Apontamentos ─────────────────────────────────────────────────
  '/pcp/evolucao-apontamento': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Evolução dos Apontamentos',
    icon: 'TrendingUp',
    description: 'Gráficos e tabelas de evolução histórica dos apontamentos de produção por período, operador e operação.',
    steps: [
      'Selecione o período para análise (semana, mês, trimestre).',
      'Filtre por operador ou operação para análises específicas.',
      'Analise os gráficos de tendência e volume de produção.',
      'Exporte os dados para Excel.',
    ],
    tips: [
      'Compare períodos diferentes usando o filtro de comparação.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Onde é Usado (Where-Used) ────────────────────────────────────────────────
  '/pcp/onde-usado': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Onde é Usado (Where-Used)',
    icon: 'Network',
    description: 'Ferramenta de busca reversa para descobrir em quais produtos um determinado componente ou matéria-prima é utilizado. Essencial para análises de impacto de substituição, engenharia reversa e estudos de custo.',
    steps: [
      'Insira o código do produto ou componente no campo de busca e pressione Enter (ou clique em Buscar).',
      'O sistema varrerá a árvore de estruturas (BOM) e apresentará o total de usos encontrados.',
      'Os resultados são organizados em blocos por Nível, permitindo que você veja quão profundo na estrutura o seu componente está inserido (Nível 1, 2, etc).',
      'Para cada produto pai listado nos resultados, você tem a opção de acessar diretamente a estrutura daquele produto clicando no botão azul.',
      'Se o produto pai possuir um desenho técnico (PDF) cadastrado, o botão vermelho de PDF estará disponível para visualização imediata.',
    ],
    tips: [
      'Esta tela é vital antes de descontinuar ou alterar um componente: você saberá exatamente quais produtos finais serão afetados pela mudança técnica.',
      'Utilize os botões de atalho em cada card para acessar rapidamente os Desenhos ou a Visão de Estrutura (BOM) do produto pai.',
    ],
    links: [
      { path: '/produtos', label: 'Catálogo de Produtos' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Visão de Produção ────────────────────────────────────────────────────────
  '/visao-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Visão Geral de Produção',
    icon: 'Eye',
    description: 'Dashboard executivo de produção com KPIs, OEE e indicadores de desempenho do chão de fábrica.',
    steps: [
      'Visualize os KPIs principais: eficiência, disponibilidade e qualidade.',
      'Clique em qualquer indicador para ver o detalhamento.',
      'Selecione o período de análise no filtro superior.',
    ],
    tips: [
      'Configure metas para cada KPI nas configurações do módulo.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  '/analytics/evolucao': {
    category: 'Analytics',
    categoryColor: '#0ea5e9',
    title: 'Analytics â€“ Evolução',
    icon: 'LineChart',
    description: 'Análises avançadas e gráficos de evolução de produção, compras, estoque e faturamento.',
    steps: [
      'Selecione o módulo de análise desejado (Produção, Compras, Estoque).',
      'Defina o período e a granularidade (diário, semanal, mensal).',
      'Use os filtros para segmentar por produto, cliente ou centro de custo.',
      'Exporte gráficos em PNG ou dados em Excel.',
    ],
    tips: [
      'Combine múltiplas séries para análise comparativa.',
    ],
    links: [
      { path: '/visao-producao', label: 'Visão de Produção' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Planejamento Gantt ───────────────────────────────────────────────────────
  '/planejamento-gantt': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Gantt',
    icon: 'GanttChart',
    description: 'Visualize e planeje a sequência de produção em formato Gantt. Ajuste datas e prioridades de forma visual e interativa.',
    steps: [
      'As barras representam cada OP com início e fim planejados.',
      'Arraste as barras para reprogramar datas.',
      'Redimensione as barras para ajustar a duração prevista.',
      'Cores indicam status: azul (planejado), verde (em andamento), vermelho (atrasado).',
      'Salve o planejamento clicando em "Confirmar Programação".',
    ],
    tips: [
      'Use a visão por semana para planejamento de curto prazo.',
      'O Gantt respeita as restrições de capacidade configuradas.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Matriz de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ── Relatórios PCP ───────────────────────────────────────────────────────────
  '/relatorios': {
    category: 'Relatórios / PCP',
    categoryColor: '#6366f1',
    title: 'Relatórios de Produção e PCP',
    icon: 'FileBarChart',
    description: 'Central de relatórios gerenciais e operacionais do PCP. Reúne três análises estratégicas em abas: (1) Espelho de Produção â€” visão operacional detalhada de cada OP; (2) Evolução por Recurso â€” matriz de progresso produtivo por centro de trabalho e pedido/produto; e (3) Saldo de Estoque â€” posição atual de materiais. Os filtros superiores são compartilhados entre as abas e persistem durante a sessão de navegação.',
    steps: [
      '── ABA: ESPELHO DE PRODUÇÃO ──',
      'Esta aba exibe, linha a linha, todas as Ordens de Produção (OPs) que se enquadram nos filtros selecionados. Cada linha representa uma OP individual com seus dados completos.',
      'Coluna "OP / Item": Código da Ordem de Produção gerada no ERP Protheus (campo C2_NUM + C2_ITEM). Identifica unicamente cada lote de produção dentro de um pedido.',
      'Coluna "Produto / Descrição": Código do produto (C2_PRODUTO) e sua descrição comercial registrada no cadastro do item (SB1). Permite identificar o que está sendo produzido.',
      'Coluna "Pedido de Venda (PV)": Número do pedido de venda (C2_PEDIDO) ao qual esta OP está vinculada. Um PV pode conter múltiplas OPs para diferentes itens ou lotes.',
      'Coluna "Cliente": Nome do cliente final (SA1) para quem o produto será entregue, extraído automaticamente através do PV vinculado.',
      'Coluna "Qtd Planejada": Quantidade total de peças a produzir nesta OP conforme planejamento original do ERP (C2_QUANT). É a meta de produção do lote.',
      'Coluna "Data Início Planejada": Data prevista para início da produção desta OP no ERP Protheus (C2_DATPRI, formato YYYYMMDD convertido). Representa quando o PCP programou o início do trabalho.',
      '── ABA: EVOLUÇÃO POR RECURSO ──',
      'Esta é a análise mais estratégica: uma matriz cruzada onde as LINHAS representam pedidos ou produtos, e as COLUNAS representam cada RECURSO/MÁQUINA/CENTRO DE TRABALHO da fábrica.',
      'Como ler a matriz: Cada célula no cruzamento linha Ã— coluna mostra o progresso de produção daquele grupo (pedido/produto) naquele recurso específico.',
      'Barra de progresso (dentro de cada célula): Representa percentualmente quanto já foi produzido em relação ao total planejado para aquele recurso. Ex: 75% = 750 pçs apontadas de 1000 planejadas. A barra fica verde ao completar 100%.',
      'Rótulo "Plan. DD/MM a DD/MM" (azul): Intervalo de datas planejadas de início para as OPs deste grupo neste recurso, extraído do campo C2_DATPRI do Protheus. Quando todas as OPs têm a mesma data planejada, aparece data única; quando há OPs com datas diferentes (ex: lotes escalonados), aparece o intervalo "01/04 a 15/04", indicando a janela de produção prevista.',
      'Rótulo "Início DD/MM" (verde): Data real do primeiro apontamento de produção registrado no sistema para este recurso neste grupo. Representa quando a fábrica efetivamente começou a trabalhar neste lote. A diferença entre "Plan." e "Início" evidencia se a produção começou antes, na data ou após o planejamento.',
      'Cabeçalho da coluna (recurso): Exibe o código do recurso em negrito (ex: MO0002) e abaixo a descrição do centro de trabalho ou máquina (ex: PUNCIONADEIRA). Esses recursos são extraídos do roteiro de fabricação (SG2/SH1) cadastrado no Protheus.',
      'Células vazias (â€”): Indicam que aquele grupo (pedido/produto) não possui operações planejadas ou apontamentos para aquele recurso específico. Pode significar que o produto não passa por aquela máquina.',
      'Arrastar e reorganizar colunas: Clique e arraste o ícone de 6 pontos (â ¿) no cabeçalho de qualquer coluna para reordenar os recursos conforme a sequência do processo produtivo real da sua fábrica. A ordem é salva automaticamente por usuário.',
      'Botão "Salvar Ordem" (admin): Administradores podem salvar a ordem de colunas como padrão global para todos os usuários da empresa.',
      'Botão "Resetar Ordem": Retorna a ordem das colunas ao padrão original (ordenação alfabética por código de recurso).',
      'Agrupamento "Agrupar por": Defina se as LINHAS da matriz representarão Pedidos de Venda (visão comercial â€” cada linha = 1 cliente/pedido), Produtos (visão fabril â€” cada linha = 1 código de produto com total acumulado) ou OPs individuais (visão detalhada â€” cada linha = 1 lote específico).',
      '── FILTROS COMPARTILHADOS ──',
      'Data Início / Data Fim: Filtra as OPs pela data planejada de início (C2_DATPRI). Permite focar na programação de um período específico, como "ver apenas o que está planejado para abril".',
      'Cliente: Texto livre que filtra pelo nome do cliente. Útil para ver toda a carga de produção de um cliente específico.',
      'Pedido de Venda: Número exato ou parcial do PV para filtrar um pedido específico.',
      'Produto: Código ou descrição parcial do produto para análises por item.',
    ],
    tips: [
      'Interpretação estratégica da célula: Se "Plan. 01/04 a 15/04" mas "Início" está vazio, significa que a produção para aquele recurso ainda não começou â€” verificar se há atraso ou se o período ainda não chegou.',
      'Se "Início" for anterior ao "Plan.", a produção começou antes do planejado â€” positivo em termos de antecipação.',
      'A barra de progresso usa a quantidade planejada por recurso (baseada no roteiro SG2 Ã— quantidade da OP). Caso o produto não tenha roteiro cadastrado, o sistema usa a quantidade total da OP como base.',
      'Produtos sem roteiro de fabricação completo no Protheus (SG2) ainda aparecem na matriz quando possuem apontamentos registrados â€” a data planejada é extraída diretamente da OP.',
      'A persistência dos filtros usa sessionStorage: fechar o navegador limpa os filtros; navegar entre páginas dentro do sistema mantém os valores preenchidos.',
      'Para análises de capacidade de um recurso específico, ordene aquela coluna para a esquerda e use agrupamento por "Pedido" para ver todos os clientes aguardando aquela máquina.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/producao-matrix', label: 'Matriz de Produção (Carga Máquina)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  '/producao/relatorios': {
    category: 'Relatórios / PCP',
    categoryColor: '#6366f1',
    title: 'Relatórios de Produção e PCP',
    icon: 'FileBarChart',
    description: 'Acesso alternativo aos relatórios de produção. Consulte a entrada "/relatorios" para documentação completa de todas as abas e campos disponíveis.',
    steps: [
      'Esta rota exibe o mesmo painel da rota /relatorios.',
      'Consulte a ajuda de "/relatorios" para instruções detalhadas sobre cada aba, campo e indicador.',
    ],
    tips: [
      'Os filtros persistem ao navegar entre /relatorios e /producao/relatorios dentro da mesma sessão.',
    ],
    links: [
      { path: '/relatorios', label: 'Relatórios PCP (Principal)' },
      { path: '/producao-matrix', label: 'Matriz de Produção' },
    ],
  },


  // ── Configurações ─────────────────────────────────────────────────────────────
  '/configuracoes': {
    category: 'Administração Core',
    categoryColor: '#64748b', // slate-500
    title: 'Painel de Configurações Master',
    icon: 'Settings',
    description: 'Central de controle absoluto do Lynx PCP. Aqui o administrador gerencia desde a identidade visual da empresa até o monitoramento de desempenho dos servidores em tempo real, organizados em abas de fácil acesso.',
    steps: [
      '── GERAL ──',
      'Configura a identidade da empresa (Nome, CNPJ, Endereço, Telefones e Logo) que sairá nos cabeçalhos dos relatórios em PDF. Aqui também se define a numeração de base para criar os próximos Romaneios e o controle global de Apontamento Multi-Operação (permitir ou não baixas em lote no chão de fábrica).',
      '── VISIBILIDADE DE PEDIDOS ──',
      'Permite ligar ou desligar a visualização de status específicos de pedidos (ex: "Faturado", "Aguardando Produção"). O interruptor global Master pode ocultar instantaneamente lotes encerrados das tabelas de todo o sistema.',
      '── MENU & NAVEGAÇÃO ──',
      'Controle modular da plataforma. Ative ou oculte módulos e ferramentas do sistema (ex: VMI, Produção, Compras, Almoxarifado) no menu lateral para otimizar a visão de todos.',
      '── PERFIS DE ACESSO & USUÁRIOS ──',
      'Em "Perfis de Acesso", crie agrupamentos de cargos (Ex: Operador, Comercial, PCP). Na aba "Usuários", você cadastra novos funcionários, gera senhas de entrada, bloqueia contas e edita dados básicos.',
      '── APROVAÇÕES PENDENTES ──',
      'Lista de usuários que solicitaram cadastro via tela de login e estão bloqueados aguardando a liberação oficial do Administrador para acessar o chão de fábrica.',
      '── PERMISSÕES ──',
      'Matriz fina de segurança. Permite ligar chaves de acesso a nível microscópico ("Visualizar", "Editar", "Excluir") tela a tela, de acordo com cada perfil da empresa.',
      '── RELATÓRIOS ──',
      'Configura o motor de envio automático e regras do PCP. Defina os e-mails da diretoria que receberão o resumo de faturamentos e acompanhamentos da fábrica automaticamente no fim do dia.',
      '── INTELIGÊNCIA ARTIFICIAL ──',
      'Ajustes do agente autônomo e do orquestrador de automações sistêmicas integrados para suporte inteligente aos colaboradores.',
      '── E-MAIL CORPORATIVO & NOTIFICAÇÕES ──',
      'Na aba "E-mail Corporativo", configure a conta SMTP de envio. Na aba "Notificações", você ganha um log de auditoria detalhado de todos os alertas disparados no dia.',
      '── MONITORAMENTO ──',
      'Painel avançado de Observabilidade. Traz dados vitais do servidor como Usuários Conectados (Socket), carga de processador (CPU), Memória RAM, sobrecarga do Banco de Dados (Consultas Hora) e tráfego de Rede. O histórico retém a progressão e permite avaliar gargalos.'
    ],
    tips: [
      'As alterações de Permissões ou Menu de Navegação entram em vigor imediatamente na próxima requisição do funcionário afetado.',
      'A aba de "Monitoramento" acumula amostras a cada hora. Use-a ativamente para auditar se o seu servidor não está sendo sobrecarregado no horário de pico do PCP.'
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda Master' },
      { path: '/sgq/mapeamento-processos', label: 'Gerenciar Ajuda do Sistema' },
    ],
  },

  // ── SGQ ──────────────────────────────────────────────────────────────────────
  '/sgq': {
    category: 'Gestão de Qualidade',
    categoryColor: '#14b8a6', // teal-500
    title: 'ISO 9001 - Central de Qualidade',
    icon: 'Award',
    description: 'Suíte completa desenhada seguindo a métrica da ISO 9001 (Documentos, Não Conformidades (RNC), Ações Corretivas e Preventivas e Treinamentos). O Hub gerencial converte planilhas estáticas num PDCA dinâmico.',
    steps: [
      'Ouvidoria de Qualidade: Acompanhe os cards flutuantes. Se houver RNC não respondida por um departamento num prazo de SLA (ex: 5 dias para contenção), ela brilhará em vermelho.',
      'Convergência com Fabricação: Qualquer peça reportada como "Refugo" na tela Apontamentos V2 pelo Operador abre automaticamente trilha preenchida neste módulo.',
      'Monitoria de Treinamento: Avalie por Organograma (Setor > Gestor > Operador) quais matrizes de habilidade estão "vencendo" validade e exigem Re-Treinamento.',
    ],
    tips: [
      'A aba de documentos versiona com trava de revisão. Nunca é possível excluir uma matriz antiga, ela cai para o "Obsoleto".',
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'VPOP - Visualizar Fluxo' },
      { path: '/sgq/nao-conformidades', label: 'RNC (Aberturas)' },
    ],
  },

  // ── SGQ Mapeamento ───────────────────────────────────────────────────────────
  '/sgq/mapeamento-processos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Mapeamento de Processos SGQ',
    icon: 'Map',
    description: 'Visualize e edite os processos do sistema de qualidade. Configure a ajuda contextual de cada tela do sistema.',
    steps: [
      'Selecione uma tela do sistema na lista de processos.',
      'Edite o conteúdo de ajuda contextual: descrição, passos e dicas.',
      'Salve as alterações para que fiquem disponíveis na ajuda das telas.',
      'Use "Recarregar Ajuda" para ver as mudanças sem reiniciar o sistema.',
    ],
    tips: [
      'As alterações feitas aqui aparecem instantaneamente na Central de Ajuda.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // ── SGQ Documentos ───────────────────────────────────────────────────────────
  '/sgq/documentos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Documentos SGQ',
    icon: 'FolderOpen',
    description: 'Repositório de documentos do sistema de gestão da qualidade: procedimentos, instruções de trabalho, formulários e registros.',
    steps: [
      'Navegue pelas categorias de documentos no painel esquerdo.',
      'Use a busca para encontrar documentos por nome ou código.',
      'Clique em um documento para visualizar ou baixar.',
      'Faça upload de novos documentos pelo botão "+ Novo Documento".',
      'Controle revisões e histórico de versões na aba "Revisões".',
    ],
    tips: [
      'Documentos obsoletos são arquivados automaticamente ao aprovar nova versão.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
    ],
  },

  // ── SGQ Não Conformidades ────────────────────────────────────────────────────
  '/sgq/nao-conformidades': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Não Conformidades',
    icon: 'AlertTriangle',
    description: 'Registre, acompanhe e trate não conformidades internas e externas. Defina ações corretivas e preventivas.',
    steps: [
      'Clique em "+ Registrar NC" para abrir uma nova não conformidade.',
      'Descreva o problema, origem e impacto.',
      'Defina as ações corretivas e os responsáveis.',
      'Acompanhe o status até o fechamento da NC.',
      'Registre a eficácia da ação após implementação.',
    ],
    tips: [
      'NCs abertas há mais de 30 dias sem tratativa são destacadas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/indicadores', label: 'Indicadores SGQ' },
    ],
  },

  // ── SGQ Treinamento ──────────────────────────────────────────────────────────
  '/sgq/treinamento': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Treinamentos',
    icon: 'GraduationCap',
    description: 'Gerencie o programa de treinamento e desenvolvimento de colaboradores. Controle matrizes de competências e certificações.',
    steps: [
      'Visualize a matriz de treinamentos por colaborador e função.',
      'Registre a realização de treinamentos com data e participantes.',
      'Gere relatórios de conformidade de treinamentos.',
      'Configure alertas para treinamentos com prazo de revalidade.',
    ],
    tips: [
      'Treinamentos vencidos são destacados em vermelho na matriz.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Auditorias ───────────────────────────────────────────────────────────
  '/sgq/auditorias': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Auditorias',
    icon: 'Search',
    description: 'Planeje e gerencie auditorias internas e externas do sistema de qualidade. Registre achados e acompanhe o tratamento.',
    steps: [
      'Crie um plano de auditoria com datas, escopo e auditores.',
      'Registre os achados durante a auditoria.',
      'Classifique: Conformidade, Observação ou Não Conformidade.',
      'Defina ações de tratamento para cada achado.',
      'Acompanhe o fechamento de todas as pendências.',
    ],
    tips: [
      'Use o histórico de auditorias para identificar tendências de problemas.',
    ],
    links: [
      { path: '/sgq/nao-conformidades', label: 'Não Conformidades' },
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Calibrações ──────────────────────────────────────────────────────────
  '/sgq/calibracoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Calibrações de Instrumentos',
    icon: 'Wrench',
    description: 'Controle o plano de calibração de instrumentos de medição. Gerencie certificados e alertas de vencimento.',
    steps: [
      'Cadastre os instrumentos com código, descrição e periodicidade.',
      'Registre calibrações realizadas com data e resultado.',
      'Anexe os certificados de calibração.',
      'Receba alertas automáticos antes do vencimento.',
    ],
    tips: [
      'Instrumentos fora do prazo são bloqueados automaticamente para uso em medições críticas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Indicadores ──────────────────────────────────────────────────────────
  '/sgq/indicadores': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Indicadores SGQ',
    icon: 'BarChart2',
    description: 'Dashboard de indicadores do sistema de gestão da qualidade. Acompanhe metas e tendências dos principais KPIs de qualidade.',
    steps: [
      'Visualize os indicadores com metas e resultados atuais.',
      'Filtre por período para análise histórica.',
      'Clique em um indicador para ver o detalhamento.',
      'Configure metas e limites de alerta em "Editar Indicador".',
    ],
    tips: [
      'Indicadores abaixo da meta aparecem em vermelho com alerta.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/nao-conformidades', label: 'Não Conformidades' },
    ],
  },

  // ── Avisos ───────────────────────────────────────────────────────────────────
  '/avisos': {
    category: 'Comunicação',
    categoryColor: '#fbbf24',
    title: 'Avisos e Comunicados',
    icon: 'Bell',
    description: 'Central de comunicados internos da empresa. Publique e visualize avisos importantes para a equipe.',
    steps: [
      'Clique em "+ Novo Aviso" para criar um comunicado.',
      'Defina o título, conteúdo e destinatários (todos ou por setor).',
      'Publique imediatamente ou agende para uma data futura.',
      'Acompanhe quem visualizou o aviso na lista de leituras.',
    ],
    tips: [
      'Avisos urgentes podem ser marcados como "Prioritário" e aparecem em destaque.',
    ],
    links: [],
  },

  // ── Vendas / Itens a Faturar ─────────────────────────────────────────────────
  '/vendas/itens-faturar': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar',
    icon: 'DollarSign',
    description: 'Visão consolidada de todos os saldos pendentes de faturamento. Cada linha representa uma programação PCP vinculada a uma OP de produção â€” permitindo selecionar itens prontos, ajustar quantidades e gerar solicitações formais de faturamento com rastreabilidade completa.',
    steps: [
      'Entendendo o Saldo a Faturar: A coluna "Saldo" exibe o saldo real do ERP (SC6010: quantidade total do pedido menos o que já foi faturado/entregue). Apenas itens com Saldo > 0 podem ser selecionados. Por padrão a tela já filtra somente esses itens (toggle "Apenas Pendentes" ativo).',
      'Linhas por Programação PCP: Quando um item de pedido possui uma programação PCP registrada, ele aparece como uma linha individual com data de entrega, série do cliente, série Lynx, nº de série, lote e nº lote. Isso significa que um mesmo item pode gerar múltiplas linhas se tiver múltiplas programações â€” cada uma representando um lote ou série distinto a ser faturado.',
      'Filtro "Mostrar Apenas Prontos (Produzidos)": Filtra client-side, exibindo somente linhas onde o Saldo Produzido (quantidade já fabricada pela produção) seja maior que zero. Use esse filtro para identificar o que pode ser faturado IMEDIATAMENTE pois já saiu da fábrica.',
      'Filtro por Data PCP: Use os campos "De/Até" da seção roxa para filtrar por data de entrega programada pelo PCP, independente da data do pedido de venda.',
      'Selecionando Itens: Clique na linha ou no checkbox para selecionar. Uma barra flutuante aparecerá no rodapé mostrando quantos itens estão selecionados e o valor total acumulado. Clique em "Avançar e Revisar" para abrir o modal de confirmação.',
      'Revisando no Modal: No modal de revisão, cada item exibe seu Saldo Faturar (máximo permitido) e um campo "Qtd. Solicitada" editável. O sistema bloqueia quantidades maiores que o saldo disponível. Preencha uma observação opcional e clique em "Gerar Solicitação de Faturamento".',
      'Semaforização (Status): âšª A FATURAR = nenhuma entrega ainda. ðŸŸ  FAT. PARCIAL = já houve faturamento anterior mas ainda resta saldo. ðŸŸ¢ FATURADO 100% = saldo zerado no ERP (normalmente oculto pelo toggle "Apenas Pendentes").',
      'Coluna "Fat. Solicitados": Exibe as solicitações de faturamento já abertas para aquela linha. Use isso para evitar duplicidade: se outro setor já gerou uma solicitação para o mesmo item/programação, você verá o número aqui antes de criar uma nova.',
      'Coluna "NFs Anteriores": Mostra os números das Notas Fiscais já emitidas para esse item no ERP. Clique no botão da NF para ver os detalhes completos (série, chave, datas, valores).',
      'Visualização de Desenho Técnico: Se houver PDF cadastrado na nuvem para o produto, o ícone de documento (vermelho) na coluna PDF estará ativo. Clique para abrir o arquivo.',
    ],
    tips: [
      'O Saldo a Faturar vem direto do Protheus (SC6010): é a diferença entre c6_qtdven (qtd pedida) e c6_qtdent (qtd já entregue/faturada no ERP). Ele só cai após a emissão efetiva da Nota Fiscal no Protheus â€” gerar uma solicitação aqui NÃO reduz o saldo imediatamente.',
      'Um pedido com produção fracionada em várias OPs aparecerá em linhas separadas, uma por OP/programação. Cada linha tem seu próprio conjunto de dados PCP (série, lote, data de entrega), refletindo exatamente o que o PCP planejou para aquela fração.',
      'Use o filtro por Nº do Pedido com busca manual (botão "Buscar Dados") para carregar todos os itens de um pedido específico de uma vez â€” o sistema remove a paginação e traz até 5.000 registros quando o campo Pedido está preenchido.',
      'Para saber se um item já está pronto para faturar: ative "Mostrar Apenas Prontos" e filtre por data PCP. Isso cruza produção já executada com a programação comercial, mostrando o que pode sair hoje.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Monitor de NFs (Controle)' },
      { path: '/romaneios', label: 'Romaneios Embalagem' },
      { path: '/comercial/dashboard-faturamento', label: 'Dashboard Gerencial de Faturamento' },
      { path: '/vendas/faturamento-historico', label: 'Histórico de Solicitações' },
    ],
  },

  // ── Comercial / Dashboard Gerencial de Faturamento ───────────────────────────
  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'PieChart',
    description: 'Cockpit financeiro-operacional em tempo real. Lê todo o pool de faturamentos pendentes ou efetuados na data, cruza com as Metas de Carregamento da empresa e exibe gráficos analíticos gerenciais.',
    steps: [
      'Análise em Tempo Real (KPIs): No topo estão os Tickers principais. Eles apontam o Volume de Dinheiro Faturado nas notas VS o Financeiro parado nos caminhões ("Pendente").',
      'Matriz de Status de Solicitações: O gráfico de Pizza (Donut) à esquerda quebra as estatísticas, dizendo se o financeiro está travado em "Cancelamentos" ou aguardando "Atendimento".',
      'Ouvidoria de Dados Dinâmicos: Todo o teto de gastos da interface muda dinamicamente à medida que você altera as Datas de Competência ou Filtra Clientes na Sidebar de configurações à frente.',
      'Top Clusters: O painel bar graphic exibe o "Top 10" agressores de ranking (seja agrupando por Top 10 Clientes Faturados ou Top Produtos da Linha que renderam o financeiro no recorte).',
    ],
    tips: [
      'O gráfico de Top 10, quando virado "Por Cliente" no select principal, pode ajudar a diretoria a priorizar o carregamento de carretas na doca logística priorizando as OPs mais caras.',
      'Leva alguns milissegundos, mas a tela faz um bypass por todo o legado ERP para validar cancelamentos falsos. O número exibido é 100% Líquido e livre de estornos indevidos.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver Itens a Faturar (Base de Dados)' },
      { path: '/comercial/faturamento', label: 'Ir Gestão de NFs' },
    ],
  },


  // ── Comercial / Visão Gerencial Atrasos ──────────────────────────────────────
  '/comercial/atrasos': {
    category: 'Comercial',
    categoryColor: '#ef4444',
    title: 'Visão Gerencial (Atrasos)',
    icon: 'Target',
    description: 'Espelho da fábrica com foco em itens pendentes de produção e entrega, cuja data de faturamento já encontra-se atrasada em relação à data atual.',
    steps: [
      'Acompanhe o valor de Risco Financeiro pendente (requer permissão de visualização financeira).',
      'Use os gráficos de Top Clientes e Atrasos por Mês para identificar os maiores gargalos.',
      'Acesse a tabela interativa para navegar na hierarquia Cliente > Mês > Lista de Itens individuais.',
      'Analise a Data de Entrada versus Data de Entrega para entender o lead time atrasado.',
    ],
    tips: [
      'Use a barra de pesquisa na tabela de espelho dinâmico para encontrar um produto ou cliente específico rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // ── PCP Geral / Visão Global (Fábrica Inteira) ──────────────────────────────
  '/pcp/visao-fabrica': {
    category: 'PCP Geral',
    categoryColor: '#4f46e5', // indigo-600
    title: 'Visão Global (Fábrica Inteira)',
    icon: 'Factory',
    image: '/help-images/pcp_visao_fabrica.png',
    description: 'Painel completo de Business Intelligence reunindo toda a carga fabril agrupada por Quinzenas contendo o futuro (dentro do prazo) e os atrasos (fora do prazo) de produção.',
    imageCaption: 'Dashboard estratégico da fábrica agrupando carga em quinzenas para análise tática e priorização.',
    steps: [
      'Utilize as abas para separar a visão entre "Entregas Futuras" ou carregamento de "Atrasados".',
      'Abra a aba "Dashboard Financeiro" (se autorizado) para verificar o risco/valor bloqueado na fábrica.',
      'Clique gradualmente nas Quinzenas para expandí-las, exibindo todos os Produtos, e para cada Produto expanda os Pedidos e Clientes respectivos.',
      'Utilize o botão "Gerar PDF" para exportar a posição com o KPI do horário que antecede sua reunião tática de produção.',
      'Use o Snapshot BD para manter o registro perpétuo que construirá sua curva de evolução dos atrasos.',
    ],
    tips: [
      'Na aba de listagem (Tabela), a última coluna possui badges dinâmicos (Heatmap de prazo) exibindo exatamente as colorações críticas e os dias exatos remanescentes para entrega.',
      'Mesmo na barra expandida existe um filtro Rápido para você procurar um Part Number (Código) ou Cliente rapidamente.',
    ],
    links: [
      { path: '/comercial/atrasos', label: 'Visão Comercial de Atrasos' },
    ],
  },

  // ── Faturamento ──────────────────────────────────────────────────────────────
  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Controle de Faturamento',
    icon: 'FileInvoice',
    description: 'Central corporativa de liberação e controle de Faturas e Expedição. Realize a vinculação das NFs e o fechamento ou estorno final de solicitações abertas.',
    steps: [
      'Controle Visual: Utilize a aba de filtros para navegar entre cargas "Pendentes", "Faturadas" ou "Canceladas".',
      'Trava de Segurança: Lotes marcados como "Faturado" sofrem congelamento automático. Apenas o usuário que realizou e assinou o fechamento do lote tem permissão para editá-lo, remover itens ou estorná-lo.',
      'Auditoria de Alterações: O painel lateral monitora toda a linha do tempo (timeline) cronológica exibindo quem, o quê e quando alguma quantidade ou status de faturamento foi reescrito.',
      'O sistema inclui um Agendador Noturno que dispara um Relatório Gerencial consolidado via e-mail corporativo (para a equipe cadastrada) sempre às 18h01 com a carga pendente total.',
    ],
    tips: [
      'A automação diária das 18h01 de notificação pode ser desligada caso os e-mails na aba de configurações na tabela da grid sejam removidos.',
      'Caso necessite alterar a Nota Fiscal de um lote travado de outra pessoa, você precisará pedir que o dono do lote faça a mudança ou reset.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // ── Histórico de Faturamento ─────────────────────────────────────────────────
  '/vendas/faturamento-historico': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Histórico de Faturamento',
    icon: 'History',
    description: 'Consulte o histórico completo de faturamento por período, cliente e produto.',
    steps: [
      'Defina o período de análise nos filtros de data.',
      'Filtre por cliente, produto ou representante.',
      'Analise os gráficos de evolução de faturamento.',
      'Exporte para Excel para análise detalhada.',
    ],
    tips: [
      'Compare o faturamento de diferentes períodos usando a opção de comparação.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Financeiro / Faturamento ─────────────────────────────────────────────────
  '/financeiro/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Financeiro â€“ Faturamento',
    icon: 'Wallet',
    description: 'Controle financeiro do faturamento: contas a receber, títulos em aberto e fluxo de caixa das vendas.',
    steps: [
      'Visualize os títulos em aberto por cliente e vencimento.',
      'Registre baixas de pagamentos recebidos.',
      'Acompanhe o fluxo de caixa previsto e realizado.',
      'Gere relatórios de inadimplência e aging.',
    ],
    tips: [
      'Títulos vencidos há mais de 30 dias são destacados em vermelho.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Gestão de Materiais ──────────────────────────────────────────────────────
  '/pcp/gestao-materiais': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Gestão de Materiais',
    icon: 'Boxes',
    description: 'Planejamento e controle de necessidades de materiais (MRP simplificado). Identifique faltas e excesso de estoque.',
    steps: [
      'Execute o cálculo de necessidades para o período selecionado.',
      'Analise os materiais críticos (saldo abaixo do mínimo).',
      'Gere solicitações de compra automaticamente para os itens em falta.',
      'Ajuste os parâmetros de estoques mínimo e máximo.',
    ],
    tips: [
      'Execute o cálculo semanalmente para manter o planejamento atualizado.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Onde Usado ───────────────────────────────────────────────────────────────
  '/pcp/onde-usado': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Onde Usado',
    icon: 'Search',
    description: 'Pesquise em quais produtos e estruturas um componente ou material é utilizado.',
    steps: [
      'Informe o código ou descrição do componente.',
      'O sistema lista todos os produtos que utilizam este componente.',
      'Clique em um produto para abrir a estrutura correspondente.',
      'Exporte a lista para análise de impacto de mudanças.',
    ],
    tips: [
      'Útil para avaliar o impacto de alterações em componentes compartilhados.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // ── SINCO OS ─────────────────────────────────────────────────────────────────
  '/engenharia/sinco/os': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Ordens de Serviço',
    icon: 'FileText',
    description: 'Gerencie as ordens de serviço de engenharia integradas ao SINCO SolidEdge. Acompanhe desenhos, revisões e aprovações.',
    steps: [
      'Visualize todas as OS abertas e seus status.',
      'Clique em uma OS para ver detalhes e arquivos vinculados.',
      'Aprove ou rejeite desenhos diretamente nesta tela.',
      'Acompanhe o histórico de revisões de cada documento.',
    ],
    tips: [
      'OS aprovadas são automaticamente enviadas para o ERP Protheus.',
    ],
    links: [
      { path: '/engenharia/sinco/estrutura', label: 'SINCO â€“ Estrutura' },
      { path: '/sinco/desenho-ativo', label: 'Desenho Ativo' },
    ],
  },

  // ── SINCO Estrutura ──────────────────────────────────────────────────────────
  '/engenharia/sinco/estrutura': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Estrutura de Produtos',
    icon: 'GitBranch',
    description: 'Visualize e sincronize a estrutura de produtos originada do SolidEdge SINCO com o ERP.',
    steps: [
      'Selecione o produto para visualizar a estrutura sincronizada do SINCO.',
      'Compare com a estrutura atual do ERP para identificar divergências.',
      'Aprove a sincronização para atualizar o ERP.',
      'Registre os motivos de alterações para rastreabilidade.',
    ],
    tips: [
      'Sincronize após cada revisão de projeto para manter o ERP atualizado.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  // ── SINCO Apontamento ────────────────────────────────────────────────────────
  '/engenharia/sinco/apontamento': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Apontamento de Engenharia',
    icon: 'PenTool',
    description: 'Registre apontamentos de horas de engenharia por projeto e OS.',
    steps: [
      'Selecione a OS e a atividade de engenharia.',
      'Informe o engenheiro responsável e as horas trabalhadas.',
      'Confirme o apontamento para atualizar o custo da OS.',
    ],
    tips: [
      'Apontamentos são a base para o cálculo de custo de desenvolvimento.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/engenharia/sinco/apontamento-matrix', label: 'SINCO â€“ Matrix' },
    ],
  },

  // ── SINCO Apontamento Matrix ─────────────────────────────────────────────────
  '/engenharia/sinco/apontamento-matrix': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Matriz de Apontamentos',
    icon: 'Grid',
    description: 'Visualize a carga de trabalho da equipe de engenharia em formato de matriz.',
    steps: [
      'Selecione o período de análise.',
      'Visualize as horas apontadas por engenheiro e projeto.',
      'Identifique sobrecarga e capacidade disponível.',
    ],
    tips: [
      'Use para planejar a alocação de recursos de engenharia.',
    ],
    links: [
      { path: '/engenharia/sinco/apontamento', label: 'SINCO â€“ Apontamento' },
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  // ── SINCO Materiais ──────────────────────────────────────────────────────────
  '/engenharia/sinco/materiais': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Materiais de Engenharia',
    icon: 'Package',
    description: 'Gerencie os materiais e componentes utilizados nos projetos de engenharia.',
    steps: [
      'Consulte o consumo de materiais por projeto/OS.',
      'Registre requisições de materiais especiais para projetos.',
      'Acompanhe o status de compra de materiais especificados.',
    ],
    tips: [
      'Materiais especificados em projeto têm prioridade no processo de compras.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Desenho Ativo ────────────────────────────────────────────────────────────
  '/sinco/desenho-ativo': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'Desenho Ativo',
    icon: 'Layers',
    description: 'Consulte e gerencie os desenhos técnicos ativos do sistema SINCO SolidEdge.',
    steps: [
      'Pesquise o desenho por código ou descrição.',
      'Visualize a revisão atual e o histórico de alterações.',
      'Faça download do arquivo do desenho.',
      'Solicite revisão clicando em "Nova Revisão".',
    ],
    tips: [
      'Apenas a revisão mais recente aprovada é considerada "ativa".',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/engenharia/sinco/estrutura', label: 'SINCO â€“ Estrutura' },
    ],
  },

  // ── Apontamento por Usuário ──────────────────────────────────────────────────
  '/pcp/apontamento-por-usuario': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por Usuário',
    icon: 'User',
    description: 'Visualize e gerencie os apontamentos de produção consolidados por operador/usuário.',
    steps: [
      'Selecione o operador e o período de análise.',
      'Visualize todos os apontamentos do operador no período.',
      'Identifique inconsistências e corrija quando necessário.',
      'Exporte o relatório para folha de ponto ou RH.',
    ],
    tips: [
      'Compare a produtividade entre operadores do mesmo turno.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/conferencia', label: 'Conferência de Apontamentos' },
    ],
  },

  // ── Apontamento por Usuário OP ───────────────────────────────────────────────
  '/pcp/apontamento-por-usuario-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por Usuário / OP',
    icon: 'UserCheck',
    description: 'Visualize os apontamentos cruzados por usuário e ordem de produção.',
    steps: [
      'Selecione o período e os filtros desejados.',
      'Analise a contribuição de cada operador por OP.',
      'Exporte para análise de custo de mão de obra.',
    ],
    tips: [
      'Use para calcular o custo real de mão de obra por ordem.',
    ],
    links: [
      { path: '/pcp/apontamento-por-usuario', label: 'Apontamento por Usuário' },
      { path: '/producao', label: 'Ordens de Produção' },
    ],
  },

  // ── SWorks ───────────────────────────────────────────────────────────────────
  '/sworks': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'SWorks â€“ Shop Floor',
    icon: 'Monitor',
    description: 'Interface de chão de fábrica para operadores. Visualize e registre operações de forma simplificada.',
    steps: [
      'O operador faz login com seu código.',
      'Selecione a OP e a operação a executar.',
      'Inicie o timer ao começar a operação.',
      'Finalize registrando a quantidade produzida.',
    ],
    tips: [
      'Interface otimizada para touchscreen e tablets industriais.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },







  // ── Financeiro / Dashboard ───────────────────────────────────────────────────
  '/financeiro/dashboard': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Dashboard Financeiro',
    icon: 'PieChart',
    description: 'Visão consolidada da saúde financeira da empresa. Indicadores de faturamento, recebimentos, inadimplência e projeções.',
    steps: [
      'Selecione o limite de datas ou período (ex: Este Ano).',
      'Verifique os cards superiores com total faturado, saldo a receber e inadimplentes.',
      'Analise o fluxo de caixa consolidado SE1/SE2 nos gráficos.',
      'O dashboard possui filtros de competência que refletem imediatamente em todos os gráficos.'
    ],
    tips: [
      'Compare automaticamente o realizado com a previsão no gráfico de barras empilhadas.',
    ],
    links: [
      { path: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // ── Fluxo de Caixa ───────────────────────────────────────────────────────────
  '/financeiro/fluxo-caixa': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Fluxo de Caixa',
    icon: 'ArrowRightLeft',
    description: 'Gestão detalhada do fluxo de caixa e integração com contas a pagar e a receber (SE1/SE2).',
    steps: [
      'Filtre o fluxo pelo horizonte de planejamento desejado.',
      'Verifique as previsões de entrada baseadas em pedidos aprovados e faturamento.',
      'Identifique "furos" de caixa (saldo negativo) nas projeções diárias.',
      'Exportação da malha do fluxo para análises extras no Excel.'
    ],
    tips: [
      'Projeções são atualizadas em tempo real com base no faturamento do ERP.',
    ],
    links: [
      { path: '/financeiro/dashboard', label: 'Dashboard Financeiro' },
    ],
  },

  // ── Relatório de Liberações (Engenharia) ─────────────────────────────────────
  '/engenharia/relatorio-liberacao': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Relatório de Liberações',
    icon: 'FileCheck',
    tabs: [
      {
        id: 'engenharia',
        label: 'Engenharia (ZEN)',
        description: 'Histórico técnico detalhado de todas as liberações de engenharia realizadas pelo módulo Pedidos de Engenharia.',
        steps: [
          'Códigos LEN (Ex: LEN-2024-00001) identificam unicamente cada pacote técnico liberado.',
          'Analise a coluna "Modo": "FULL" indica que toda a estrutura e desenhos foram anexados; "NÍVEL 1" indica que apenas o nível superior foi liberado.',
          'Rastreabilidade de Destino: Veja para quais e-mails automáticos a notificação foi enviada na coluna Detalhes.',
          'Acesso Direto: Clique no ícone de documento à direita para abrir o PDF original salvo automaticamente na rede.'
        ],
        tips: [
          'O modo "Nível 1" é ideal para revisões rápidas onde a estrutura interna não sofreu alterações.',
          'Todo registro nesta aba possui um "Audit Trail" imutável, garantindo conformidade com a ISO 9001.'
        ]
      },
      {
        id: 'pcp',
        label: 'PCP / Lotes (LPF)',
        description: 'Relatório de agrupamento de Ordens de Produção (Aglutinação) para fabricação seriada ou por lotes.',
        steps: [
          'Códigos LPF identificam Liberações PCP de Fabricação (Pacotes Aglutinados).',
          'Expansão de Lote: Clique na seta lateral (chevron) para ver todas as OPs contidas naquele lote específico.',
          'Documentação Consolidada: O ícone de arquivo verde abre o PDF que contém o espelho de todas as OPs do lote com seus respectivos desenhos.',
          'Verificação de Datas: A coluna "Data PCP" mostra a data de entrega programada que foi definida no momento da aglutinação.'
        ],
        tips: [
          'Liberações LPF são salvas automaticamente na pasta de rede da Engenharia para facilitar o acesso do PCP.',
          'Se uma OP foi aglutinada por erro, o registro histórico permanecerá aqui para auditoria, mesmo que a OP seja cancelada.'
        ]
      },
      {
        id: 'romaneio',
        label: 'Controle Romaneio',
        description: 'Gestão e rastreabilidade de embarques (Packing Lists) vinculados às liberações de engenharia e PCP.',
        steps: [
          'Status em Tempo Real: Acompanhe se o romaneio está em "Aberto", "Conferido" ou "Enviado".',
          'Rastreabilidade (Audit Trail): Visualize o histórico de quem alterou o status e a data exata da mudança.',
          'Busca por Cliente: Utilize o campo de busca geral para localizar romaneios por ID (#) ou nome do cliente.',
          'Acesso ao PDF: Clique no ícone de documento azul na coluna PDF para abrir o romaneio oficial salvo na rede.'
        ],
        tips: [
          'Cada alteração de status gera uma nova revisão (Rev) automática para auditoria.',
          'O romaneio é o elo final entre a produção (PCP) e a entrega ao cliente.'
        ]
      },
      {
        id: 'auditoria',
        label: 'Auditoria & Filtros',
        description: 'Ferramentas avançadas para busca de registros históricos e conformidade técnica.',
        steps: [
          'Filtro por Produto: Digite o código de um componente para ver todas as vezes que ele foi liberado ao longo do ano.',
          'Busca por Usuário: Identifique quem foi o responsável técnico pela liberação de um determinado projeto.',
          'Limpeza de Filtros: Use o botão "Limpar" para resetar a visão e ver as liberações mais recentes no topo.',
          'Exportação: Utilize as ferramentas de sistema para gerar relatórios em Excel para reuniões de análise crítica.'
        ],
        tips: [
          'Use o filtro de "Data de" e "Data Até" para auditorias mensais de produtividade do departamento.',
          'O sistema mantém logs de quem visualizou ou baixou os arquivos através deste relatório.'
        ]
      }
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Pedidos de Engenharia' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
    ],
  },

  // ── Vagas de RH ──────────────────────────────────────────────────────────────
  '/rh/vagas': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'Gestão de Vagas',
    icon: 'Briefcase',
    description: 'Portal para abertura, divulgação e fechamento de vagas de emprego do setor de RH.',
    steps: [
      'Clique em "+ Nova Vaga" para criar o descritivo de abertura.',
      'Descreva os requisitos técnicos, salário e área de atuação.',
      'Gerencie o status da vaga (Aberta, Em Andamento, Fechada).',
      'Vincule requisições de currículos diretamente.'
    ],
    tips: [
      'Mantenha os status da vaga atualizados para facilitar o pipeline dos recrutadores.',
    ],
    links: [
      { path: '/rh/curriculos', label: 'Análise de Currículos' },
      { path: '/sgq/cargos-funcoes', label: 'Cargos e Funções' },
    ],
  },

  // ── Currículos ───────────────────────────────────────────────────────────────
  '/rh/curriculos': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'Análise de Currículos',
    icon: 'Users',
    description: 'Módulo inteligente para submissão, leitura automatizada (IA) e avaliação de currículos dos candidatos.',
    steps: [
      'Faça o upload dos currículos recebidos no sistema.',
      'Confirme se as informações tabuladas pela Inteligência Artificial estão coerentes com o arquivo original.',
      'Filtre os currículos baseados nas competências de uma vaga pré-cadastrada.',
      'Avalie o candidato com notas nos critérios e avance o funil.'
    ],
    tips: [
      'A análise de IA otimiza o tempo de leitura incrivelmente: dedique seu tempo com foco redobrado para a entrevista!',
    ],
    links: [
      { path: '/rh/vagas', label: 'Gestão de Vagas' },
    ],
  },

  // ── Cargos e Funções (SGQ/RH) ────────────────────────────────────────────────
  '/sgq/cargos-funcoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Cargos e Funções',
    icon: 'Contact',
    description: 'Base de conhecimento e normatização de descritivos de cargos, funções da CBO e organograma corporativo.',
    steps: [
      'Visualize a árvore do organograma na interface principal.',
      'Selecione um cargo para definir ou rever a sua "Descrição de Cargo".',
      'Vincule quais são as funções críticas do cargo, riscos (EPIs e ambientais) e requisitos.',
      'Aprove o descritivo em revisões rastreadas pelo SGQ.'
    ],
    tips: [
      'Descritivos consolidados frequentemente facilitam o compliance imediato em auditorias da Norma ISO 9001 e de Segurança no Trabalho.',
    ],
    links: [
      { path: '/sgq/treinamento', label: 'Treinamentos' },
      { path: '/rh/vagas', label: 'Gestão de Vagas' },
    ],
  },

  // ── SINCO - Formulário Principal ─────────────────────────────────────────────
  '/engenharia/sinco/formulario': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'Formulário SINCO',
    icon: 'FormInput',
    description: 'Visualização e edição avançada de estruturas (BOM), operações e restrições integradas ao Protheus.',
    steps: [
      'Edite a "Árvore do Produto" clicando em "Editar". O sistema permite alterar quantidades, remover peças e incluir novos materiais.',
      'Utilize a **Lupa de Busca** ao adicionar um novo componente para pesquisar materiais diretamente no Protheus por código ou descrição.',
      'Ao salvar a árvore, o sistema executa validações anti-duplicidade e anti-concorrência para garantir a integridade dos dados no Protheus.',
      'Adicione ou edite restrições técnicas e acompanhe as macros originadas no Solid Edge.'
    ],
    tips: [
      'A busca pela Lupa exibe até 50 resultados em tempo real. Digite sempre pelo menos 3 letras ou números.',
      'O sistema bloqueia salvar estruturas caso detecte materiais com quantidade zero ou códigos não cadastrados no Protheus.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  '/login': {
    category: 'Administração',
    categoryColor: '#64748b',
    title: 'Portal de Acesso',
    icon: 'LogIn',
    tabs: [
      {
        id: 'acesso',
        label: 'Acesso',
        description: 'Credenciais de acesso ao sistema Lynx PCP.',
        steps: [
          'Utilize seu nome de usuário (ex: pcp01) ou e-mail corporativo.',
          'Insira sua senha de segurança definida no primeiro acesso.',
          'Clique em "Entrar no Sistema".',
          'A sessão permanecerá ativa enquanto o navegador estiver aberto.'
        ],
        tips: [
          'Não compartilhe sua senha. Toda ação no sistema é rastreada pelo seu login.',
          'Caso erre a senha 5 vezes, sua conta será bloqueada temporariamente.'
        ]
      },
      {
        id: 'recuperacao',
        label: 'Recuperação',
        description: 'Esqueceu sua senha? Veja como recuperar o acesso.',
        steps: [
          'Clique em "Esqueceu a senha?" na tela de login.',
          'Informe seu e-mail corporativo cadastrado (@lynx.com.br).',
          'Clique em "Receber Senha por E-mail".',
          'Sua senha atual será enviada imediatamente para sua caixa de entrada.'
        ],
        tips: [
          'Caso não receba o e-mail em 2 minutos, verifique sua pasta de SPAM.',
          'Se o problema persistir, entre em contato com o suporte de TI.'
        ]
      },
      {
        id: 'cadastro',
        label: 'Novo Usuário',
        description: 'Solicitação de novo cadastro para colaboradores.',
        steps: [
          'Clique em "Criar Conta" na parte inferior.',
          'Preencha seu nome completo e e-mail corporativo.',
          'Escolha um login fácil de lembrar (ex: primeiro nome + sobrenome).',
          'Clique em "Solicitar Cadastro".'
        ],
        tips: [
          'Novos cadastros precisam ser aprovados manualmente pela administração.',
          'Você receberá uma notificação quando seu acesso for liberado.'
        ]
      }
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // ── Romaneios e Recebimento ────────────────────────────────────────────────────────────────
  '/romaneios': {
    category: 'Logística',
    categoryColor: '#8b5cf6',
    title: 'Gestão de Romaneios',
    icon: 'Package',
    description: 'Controle completo dos romaneios de saída de material: remessa para terceiros, entrega ao cliente, manutenção externa e outros tipos. Cada romaneio passa por duas etapas de montagem — Cabeçalho e Itens — antes de ser impresso e expedido.',
    tabs: [
      {
        id: 'cabecalho',
        label: 'Passo 1 — Cabeçalho',
        description: 'Dados gerais do envio: quem recebe, quando e com qual veículo.',
        steps: [
          'Clique em "+ Novo Romaneio" para iniciar. O formulário abre na Etapa 1.',
          'Fornecedor / Cliente: digite 3 ou mais letras no campo de busca. O sistema pesquisa o cadastro do ERP e preenche automaticamente endereço, bairro, cidade, UF, CEP e telefone ao selecionar o resultado.',
          'Tipo de Romaneio: selecione o tipo de movimentação (ex.: Remessa para Terceiros, Entrega, Manutenção etc.). O tipo define o cabeçalho que aparecerá no documento impresso.',
          'Data de Liberação: pré-preenchida com a data de hoje. Pode ser alterada para registros retroativos.',
          'Previsão de Retorno: data esperada para o material voltar ao estoque. Campo opcional, mas importante para o controle de pendências.',
          'Motorista e Veículo: preencha nome, CNH, validade da CNH, modelo e placa. Esses dados aparecem no PDF do romaneio.',
          'Observação Geral: campo de texto livre para instruções ao transportador ou ao fornecedor.',
          'Fotos: anexe até 5 fotografias (estado do material, embalagem, volumes). Elas ficam vinculadas ao romaneio.',
          'Clique em "Salvar e Avançar" — o romaneio é criado com status Rascunho e o sistema avança automaticamente para a Etapa 2 (Itens).'
        ],
        tips: [
          'Se o fornecedor não estiver cadastrado no ERP, você pode digitar o nome manualmente e continuar.',
          'O cabeçalho pode ser editado a qualquer momento pelo botão "Editar Dados Principais do Romaneio" na barra superior, mesmo depois de adicionar itens.'
        ]
      },
      {
        id: 'itens',
        label: 'Passo 2 — Itens',
        description: 'Adição dos produtos e quantidades que compõem o envio.',
        steps: [
          'A tela de itens tem duas abas: "Via OP" (busca em Ordens de Produção do ERP) e "Manual" (produto do catálogo).',
          'Aba Via OP: informe o número da OP, nome do cliente ou parte do código/produto e clique em "Buscar". O sistema retorna os itens disponíveis nessas OPs.',
          'Clique em "Selecionar" no resultado desejado. O sistema valida disponibilidade e exibe alerta amarelo se a quantidade supera o saldo em produção.',
          'Informe a quantidade a enviar e clique em "Adicionar Item". O sistema registra automaticamente: código do produto, descrição, peso (kg) e área de pintura (m²).',
          'Aba Manual: pesquise o produto por código ou nome, selecione, informe quantidade e observação. Use para itens sem OP vinculada (ferramentas, gabaritos, moldes etc.).',
          'Para corrigir um item já adicionado, clique no ícone de edição (lápis) na linha. Para remover, clique na lixeira.',
          'Notas Fiscais: clique em "Vincular NF de Saída" ou "NF de Retorno" para pesquisar e associar as NFs emitidas no ERP a este romaneio. As NFs aparecem impressas no documento.',
          'Revisões: para registrar alteração formal em romaneio já finalizado, clique em "Nova Revisão", informe o motivo. O histórico fica gravado com data e usuário responsável.'
        ],
        tips: [
          'Peso total e área de pintura são calculados automaticamente somando todos os itens — esses valores aparecem no cabeçalho do PDF.',
          'Use "Localizar Produto" (botão na listagem principal) para verificar em qual romaneio aberto um código específico está alocado.'
        ]
      },
      {
        id: 'status-acoes',
        label: 'Status e Ações',
        description: 'Ciclo de vida do romaneio e o que cada botão da barra superior faz.',
        steps: [
          'Rascunho: estado inicial após a criação. O romaneio pode ser editado livremente.',
          'Finalizado: confirma que todos os itens foram conferidos e o romaneio está pronto para sair. O sistema solicita a data e oferece envio de e-mail automático ao fornecedor.',
          'Enviado: registra a saída física do material. Também solicita a data do evento e oferece e-mail de notificação.',
          'Cancelado: anula o romaneio. O material retorna ao controle de saldo na OP.',
          'Imprimir Romaneio: gera um PDF em pacote (bundle) com o romaneio + desenhos técnicos dos produtos + lista de status atualizada. O arquivo abre em nova aba.',
          'Criar Pasta na Rede: cria a pasta do romaneio no servidor de arquivos (ex.: \\\\servidor\\Romaneios\\RO-123). Execute logo após criar o romaneio para já ter o local disponível.',
          'Acessar Pasta da Rede: copia o caminho UNC da pasta para a área de transferência e tenta abrir no Windows Explorer. Use para anexar documentos adicionais ao romaneio.'
        ],
        tips: [
          'A mudança de status pode ser feita diretamente na listagem pelo campo dropdown na coluna "Status" — sem precisar abrir o formulário completo.',
          'Romaneios com status "Enviado" e recebimento pendente aparecem na tela de Recebimentos, onde o operador registra o retorno físico das peças com possibilidade de baixa automática na OP.'
        ]
      }
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimento de Romaneios' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  '/recebimentos': {
    category: 'Logística e PCP',
    categoryColor: '#8b5cf6',
    title: 'Página de Recebimentos de Romaneio',
    icon: 'DownloadCloud',
    description: 'Controle detalhado e apontamento de recebimento dos itens físicos que retornaram dos serviços externos ou fornecedores.',
    tabs: [
      {
        id: 'recebimento-basico',
        label: 'Regras de Recebimento',
        description: 'Como funciona a entrada parcial ou total de peças.',
        steps: [
          'Na lista de itens do romaneio, localize o produto que acabou de chegar fisicamente.',
          'Clique no botão verde "Receber". O sistema pré-carrega automaticamente o "Saldo Pendente" daquele envio original.',
          'Você pode digitar uma quantidade menor (Recebimento Parcial) caso não tenha retornado tudo.',
          'Regra de Quantidade: O sistema bloqueia recebimentos onde a quantidade informada seja superior ao saldo pendente do envio. Não é possível receber mais peças do que o enviado.'
        ],
        tips: [
          'Se for um recebimento parcial, o item continuará com o status de Pendente até que todo o saldo seja zerado em recebimentos futuros.',
          'O preenchimento de "Data" vem com a data atual por padrão, mas pode ser retroativo.'
        ]
      },
      {
        id: 'baixa-automatica',
        label: 'Baixa Automática na Produção',
        description: 'Integração em tempo real com as Ordens de Produção do ERP.',
        steps: [
          'Ao abrir o modal de recebimento, você verá um campo opcional chamado "Baixa Automática na Produção".',
          'Esse campo pesquisa no ERP o roteiro (operações) atrelado a esse produto e a essa Ordem de Produção.',
          'Selecione a operação (ex: PINTURA, SOLDA) onde o item estava. Ao salvar, o sistema fará o recebimento físico do romaneio E também gravará a quantidade como "produzida" diretamente na OP.',
          'Regra de Saldo da OP: O sistema faz um cálculo de segurança. Se você tentar baixar uma quantidade que seja MAIOR do que o saldo que falta fabricar na OP para aquela operação específica, a ação será bloqueada com Erro 400.'
        ],
        tips: [
          'Se o campo de "Baixa Automática" não mostrar nenhuma operação para selecionar, significa que o item não tem um roteiro padrão cadastrado no ERP, ou a OP já foi finalizada/deletada.',
          'Essa função é opcional. Se deixar em branco, o sistema fará apenas o retorno físico do romaneio e não apontará na OP.',
          'Todos os apontamentos gerados desta forma ficam registrados com a observação "Baixa automática via Retorno de Romaneio".'
        ]
      }
    ],
    links: [
      { path: '/romaneios', label: 'Voltar aos Romaneios' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' }
    ]
  },

  // ── Central de Ajuda ─────────────────────────────────────────────────────────
  '/ajuda': {
    category: 'Comunicação',
    categoryColor: '#fbbf24',
    title: 'Central de Ajuda',
    icon: 'HelpCircle',
    description: 'Catálogo de manuais operacionais e centro de documentação virtual projetada para instruir a funcionalidade das telas.',
    steps: [
      'Pesquise as ferramentas por palavra-chave na tela principal para um acesso intuitivo.',
      'Revise atentamente "O que faz" (Passos e Dicas) para tirar potenciais dúvidas ou limitações da interface.',
      'Siga os links secundários para alternar entre relatórios correlacionados no mesmo departamento.'
    ],
    tips: [
      'Dica mestre: Em qualquer local de acesso, seja onde estiver na plataforma â€” o botão azul (?) flutuante no canto inferior acessa as mesmas explicações adaptadas contextualmente ao seu monitor focado atual!',
    ],
    links: [
      { path: '/avisos', label: 'Avisos e Comunicados' },
      { path: '/', label: 'Dashboard Principal' },
    ],
  },

  // ── Módulo PCP Independente ──────────────────────────────────────────────────
  '/ind-pcp-release': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Gestão de OP Fracionada',
    icon: 'PackagePlus',
    description: 'Interface exclusiva para a fragmentação e liberação isolada de Ordens de Produção (SC2) antes do carregamento industrial. Este módulo desvincula a restrição do SC2 oficial gravando o loteamento da fábrica diretamente na base segura local.',
    steps: [
      'Alternância de Visão Visual: O painel oferece dois formatos â€“ "Hierárquico (Árvore)", útil para entender amarrações de conjunto, e "Lista Plana", feito para leitura crua de matriz produtiva.',
      'Critério de Filtragem (Faturamento): Em ambas as visualizações, a tabela apenas lista e acusa OPs filhas em que o seu Pedido de Venda contiver Saldo Remanescente (Quantidade Faturada menor que Original).',
      'Informação Estratégica: Visualize a coluna "Previsão de Entrega" espelhada diretamente da carga SC6/SC5. Isso ajuda o chão de fábrica a processar os pacotes respeitando a viabilidade comercial.',
      'Liberação em Cotes: Utilize a aba de expansão e clique em "Liberar Qtd Personalizada" para descer uma O.P. de 1000 pçs para um Kanban fabril com apenas 200 pçs, por exemplo. O sistema deduzirá o saldo do ERP temporariamente.',
    ],
    tips: [
      'Não se preocupe em "estragar" o ERP. Esta tela escreve no histórico da tabela autônoma garantindo que a contagem do SC2 siga íntegra enquanto o chão de fábrica manipula uma O.P fantasma fracionada perfeitamente amarrada.',
      'Utilize os Filtros Multiseleção (bolhas acima da tabela) para focar sub-recursos.'
    ],
    links: [
      { path: '/ind-factory-floor', label: 'Kanban do Chão de Fábrica' },
      { path: '/producao', label: 'O.Ps Tradicionais' },
    ],
  },

  '/ind-factory-floor': {
    category: 'PCP / Fábrica',
    categoryColor: '#10b981', // green-500
    title: 'Apontamento Kanban (Chão de Fábrica)',
    icon: 'HammerFocus',
    description: 'Tela viva e dinâmica de apontamentos. Uma vez que as OPs fracionadas são geradas pela "Gestão de OP Fracionada", elas caem diretamente neste funil para consumo livre dos operadores em campo.',
    steps: [
      'As OPs abertas ficarão listadas em esteiras/cartões de acordo com o recurso/operação corrente.',
      'A tela exibirá as quantidades já apontadas via terminal e o progresso em relação à meta fracionada.',
      'Os operadores não enxergam gargalos do TOTVS; a interface isola as restrições logando num banco dinâmico (com baixa final sincronizada de forma limpa).',
    ],
    tips: [
      'A leitura de Cartões na aba Kanban serve para varrer Código de Barras dos lotes físicos impressos pelo almoxarifado.',
    ],
    links: [
      { path: '/ind-pcp-release', label: 'Gestão de OP Fracionada' },
    ],
  },

  // ── Explosão BOM + Roteiro (Pull) ────────────────────────────────────────────
  '/pcp/planejamento-estrutura-routing': {
    category: 'PCP / Engenharia',
    categoryColor: '#3b82f6',
    title: 'Explosão BOM + Roteiro (Pull System)',
    icon: 'GitMerge',
    description: 'Ferramenta de planejamento estrutural que combina dois dados vitais do Protheus em uma única tela: a Lista de Materiais (BOM â€“ SB1/SG1) e o Roteiro de Fabricação (SG2/SH1). A partir de qualquer Ordem de Produção, o sistema explode toda a árvore de componentes e mapeia quais operações cada peça exige em quais máquinas â€” respondendo de forma imediata à pergunta: "O que precisa ser fabricado primeiro e em qual recurso?"',
    steps: [
      '── ETAPA 1: BUSCA DA OP ──',
      'Nº da OP: Digite o número exato ou parcial da Ordem de Produção (campo C2_NUM do Protheus). A busca inicia automaticamente após 600ms sem digitar (debounce) â€” não é necessário pressionar Enter.',
      'Nº do Pedido: Filtra pelo Pedido de Venda (C2_PEDIDO) vinculado à OP. Útil quando se sabe o número do pedido do cliente mas não o número da OP.',
      'Cliente: Nome parcial ou completo do cliente para filtrar apenas as OPs de um cliente específico.',
      'Produto / Código: Código ou parte da descrição do produto (C2_PRODUTO / SB1). Permite encontrar OPs de um item específico mesmo sem saber o número da OP.',
      'Prazo De / Prazo Até: Intervalo de datas de entrega do pedido. Use para filtrar apenas OPs com vencimento em um determinado período â€” ex: "quero ver tudo que vence essa semana".',
      'Cor do Prazo nos resultados: A data de entrega no resultado é colorida automaticamente â€” VERDE = prazo > 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO em negrito = prazo vencido.',
      'Clique em um resultado para carregar a estrutura completa da OP.',
      '── ETAPA 2: CABEÇALHO DA OP (após seleção) ──',
      'Número da OP: Identificador único da ordem no Protheus (ex: 000123). Exibido em destaque no topo.',
      'PV (Pedido de Venda): Número do pedido comercial ao qual esta OP está vinculada. Clique em "Voltar" para pesquisar outra OP.',
      'Cliente: Razão social do cliente final extraída da tabela SA1 via SC5.',
      'Prazo: Data de entrega comprometida com o cliente (SC6 / C6_ENTREG). Colorida pelo mesmo critério de urgência descrito acima.',
      'Conjuntos: Quantos conjuntos/produtos pai a OP possui. OPs complexas com múltiplos itens terão N conjuntos listados na árvore.',
      '── ABA: POR MÁQUINA (Visão Padrão) ──',
      'Esta aba é a mais usada no chão de fábrica. Ela agrupa TODAS as operações de TODOS os componentes da OP por RECURSO (máquina/centro de custo), criando uma "fila de trabalho" por equipamento.',
      'Cabeçalho do card (fundo escuro): Nome do recurso/máquina em destaque. O contador à direita mostra quantas tarefas (linhas de operação) aquele equipamento tem nesta OP.',
      'Coluna "Seq": Sequência da operação no roteiro (SG2.G2_SEQUEN). Define a ordem em que as operações devem ser executadas dentro daquela peça. Importante: duas peças diferentes podem ter seq=10 na mesma máquina â€” elas são independentes.',
      'Coluna "Peça": Código e descrição do produto que precisa passar por esta máquina. O badge "Conj." (azul) indica que é o produto pai (conjunto final); sem badge indica que é um componente filho (peça pré-fabricada).',
      'Coluna "Operação": Descrição da operação a ser executada nesta máquina para esta peça (SG2.G2_DESCRI / operação do roteiro). Ex: "SOLDA MIG", "PUNCIONAMENTO", "PINTURA".',
      'Coluna "Qtd Total" (verde): Quantidade total de peças que precisam passar por esta operação. Para componentes filhos, o cálculo é automático: Qtd_por_pai Ã— Qtd_da_OP. Ex: se o conjunto precisa de 3 suportes e a OP tem 10 conjuntos, a máquina precisa processar 30 suportes.',
      'Coluna "Destino": Indica para onde vai a peça após esta operação. "FIM" (cinza) = produto final que vai direto para expedição. Código em laranja = esta peça vai ser incorporada ao conjunto identificado por aquele código.',
      '── ABA: ÁRVORE (Visão Hierárquica) ──',
      'Esta aba exibe a estrutura BOM da OP em formato de árvore hierárquica indentada, espelhando a lista de materiais do Protheus (SG1/SB1).',
      'Card "Conjunto Pai" (borda azul, ícone caixa): Representa o produto final que será entregue ao cliente. Mostra o código, descrição e a quantidade total a produzir nesta OP.',
      'Card "Componente Filho" (borda cinza, ícone camadas): Representa uma peça pré-fabricada que compõe o conjunto pai. Mostra a quantidade por unidade do pai (un/pai) â€” multiplicar pela qtd da OP dá a quantidade total a fabricar.',
      'Roteiro do card (dentro de cada card): Lista de chips mostrando, em sequência (01, 02, 03â€¦), quais operações e em qual recurso o produto deve passar. Cada chip tem o número de sequência, o código/nome do recurso e a descrição da operação.',
      'Badge laranja "Sem roteiro cadastrado": Aparece quando o produto não tem roteiro (SG2) cadastrado no Protheus. Isso pode indicar que a peça é comprada (não fabricada) ou que o cadastro está incompleto.',
      'Aviso "Pré-requisitos â€” fabricar antes de montar o PAI": Seção que lista todos os filhos que precisam estar concluídos ANTES que o roteiro do produto pai (ex: solda final, montagem) possa ser iniciado. Esta é a lógica pull do sistema.',
      'Lógica de dependência: A árvore evidencia a sequência de fabricação crítica. Exemplo: o conjunto "ESTRUTURA SOLDADA" (pai) só pode entrar na operação "SOLDA" depois que todos os seus filhos (chapas, cantoneiras, tubos) passaram por suas respectivas operações de corte, dobra e furação.',
    ],
    tips: [
      'Use a aba "Por Máquina" para responder "o que a PUNCIONADEIRA precisa fazer hoje?". Use a aba "Árvore" para entender "quais peças dependem de quais?".',
      'Se uma máquina não aparece na aba "Por Máquina", nenhum produto desta OP tem aquela operação no roteiro SG2 â€” verifique se o roteiro está completo no Protheus.',
      'A "Qtd Total" em verde na visão por máquina já considera a multiplicação de todos os níveis da BOM â€” não é necessário calcular manualmente.',
      'O botão de Recarregar (ícone circular) no canto superior direito busca os dados mais atualizados do Protheus sem precisar voltar à busca e selecionar a OP novamente.',
      'OPs com prazo VENCIDO (vermelho) devem ser priorizadas. Use o filtro "Prazo Até: [data de hoje]" para listar somente as atrasadas.',
      'Componentes marcados como "Sem roteiro" que são claramente matérias-primas compradas (ex: parafusos, chapas) são normais. Componentes usinados ou soldados sem roteiro indicam necessidade de cadastro no Protheus.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/planejamento-sequencial', label: 'Planejamento Sequencial de OPs' },
    ],
  },

  // ── Visão Gerencial por Setor ─────────────────────────────────────────────────
  '/pcp/visao-setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Visão Gerencial por Setor',
    icon: 'PieChart',
    description: 'Painel matricial de acompanhamento da evolução da produção organizado por setor fabril. Cada setor agrupa um conjunto de recursos (máquinas/centros de custo) cadastrados, e para cada setor é exibida a lista de Ordens de Produção ativas com seu progresso real â€” calculado cruzando o roteiro do Protheus (SC2/SG2) com os apontamentos registrados pelos operadores no sistema (app_production_appointments). Este painel responde de imediato: "Onde estamos com cada OP, setor a setor?"',
    steps: [
      '── FILTROS DE BUSCA ──',
      'Nº do Pedido: Filtra as OPs pelo número do Pedido de Venda (C2_PEDIDO) ou pelo número da OP (C2_NUM) no Protheus. Use para monitorar um pedido específico de cliente em todos os setores simultaneamente.',
      'Cliente: Nome parcial ou completo do cliente. Mostra apenas as OPs vinculadas ao cliente informado.',
      'Produto: Código ou descrição do produto fabricado (C2_PRODUTO). Permite focar em um item específico em toda a fábrica.',
      'Data Início / Data Fim: Filtra OPs pela data planejada de início (C2_DATPRI). Use para ver a carga de um período específico.',
      'Apenas Pendentes (chave): Quando ativado, oculta OPs onde a quantidade já produzida (C2_QUJE) atingiu a quantidade total (C2_QUANT). Mantém o foco somente no que ainda está em aberto.',
      'Clique em "Buscar" ou pressione Enter para aplicar os filtros.',
      '── CARDS DE SETOR ──',
      'Cada card representa um Setor Fabril cadastrado (ex: Preparação, Solda, Pintura). O cabeçalho do card exibe o nome do setor na cor configurada e os KPIs consolidados.',
      'KPI "Total": Quantidade total de OPs (itens únicos op + item) que possuem pelo menos uma operação naquele setor.',
      'KPI "Concluídas": OPs cujo progresso atingiu 100% em todas as operações do setor.',
      'KPI "Em Andamento": OPs com progresso entre 1% e 99% â€” produção iniciada mas não finalizada.',
      'KPI "Atrasadas": OPs em andamento cuja data de entrega do pedido (SC6/C6_ENTREG) já passou.',
      'Barra de progresso do setor: Média ponderada do progresso de todas as OPs do setor, calculada como (soma das peças apontadas) ÷ (soma das peças esperadas) Ã— 100.',
      '── TABELA DE OPs POR SETOR ──',
      'Coluna "OP / Item": Número da Ordem de Produção + número do item (ex: 004155/01). Identifica unicamente cada conjunto a ser fabricado.',
      'Coluna "Pedido": Número do Pedido de Venda (C2_PEDIDO) ao qual a OP está vinculada.',
      'Coluna "Produto": Código e descrição do produto a fabricar (C2_PRODUTO / SB1.B1_DESC).',
      'Coluna "Cliente": Razão social do cliente final (SA1/SC5).',
      'Coluna "Prazo": Data de entrega comprometida com o cliente (SC6.C6_ENTREG). Colorida por urgência: VERDE = mais de 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO = prazo vencido.',
      'Coluna "Qtd Total": Quantidade de peças a produzir nessa OP/item (C2_QUANT).',
      'Coluna "Esperado no Setor": Total de peças que devem passar pelas operações deste setor. Calculado como: Qtd_Total Ã— Número_de_Operações_no_Setor.',
      'Coluna "Apontado no Setor": Soma real das quantidades já apontadas pelos operadores para as operações deste setor, extraída da tabela app_production_appointments.',
      'Coluna "Progresso": Percentual de conclusão da OP neste setor específico = (Apontado ÷ Esperado) Ã— 100. A barra colorida facilita a leitura visual.',
      'Coluna "Status": Indicador visual do estado da OP â€” "Aguardando" (sem nenhum apontamento), "Em Andamento" (entre 1% e 99%), "Concluída" (100%) ou "Atrasada" (em andamento + prazo vencido).',
      '── CARD "SETOR NÃO DEFINIDO" ──',
      'Exibido ao final da lista quando existem recursos no Protheus (SG2) que ainda não foram vinculados a nenhum setor no cadastro de Setores. OPs que passam exclusivamente por esses recursos aparecem aqui.',
      'Identifique os recursos listados em "Recursos sem setor" e acesse "PCP â†’ Setores â†’ Recursos" para vinculá-los ao setor correto.',
      '── CÁLCULO DO PROGRESSO ──',
      'O progresso é calculado 100% a partir dos dados reais de apontamento do sistema â€” não usa dados do Protheus (SH6). Cada operação de cada OP tem sua quantidade apontada somada; o resultado é dividido pelo total esperado (Qtd_OP Ã— nº de operações do setor).',
      'Exemplo: OP 004155/01, Qtd=3, passando por 2 operações no setor Solda â†’ Esperado=6 peças. Se foram apontadas 3 â†’ Progresso=50%.',
    ],
    tips: [
      'Use o filtro "Apenas Pendentes" para focar a atenção somente no que ainda precisa ser feito â€” OPs 100% concluídas são ocultadas automaticamente.',
      'OPs com status "Atrasado" (vermelho) devem ser priorizadas. Acione o PCP para replanejamento imediato.',
      'Se uma OP não aparece em nenhum setor, verifique se o produto possui roteiro (SG2) cadastrado no Protheus â€” sem roteiro, não há operações para vincular a recursos/setores.',
      'O card "Setor Não Definido" é um sinal de ação: vincule os recursos listados ao setor correto em "PCP â†’ Setores â†’ Recursos" para que as OPs apareçam no painel correto.',
      'O progresso exibido aqui é calculado com dados reais do sistema (app_production_appointments) â€” não é uma estimativa. Ele reflete exatamente o que os operadores apontaram.',
      'Cada setor pode ter N recursos (máquinas). Uma OP aparece em um setor se ao menos um dos seus recursos estiver vinculado àquele setor. A barra mostra o progresso médio em todas as operações desse setor.',
      'Use este painel para identificar gargalos: um setor com progresso médio muito baixo enquanto os demais avançam indica acúmulo de trabalho â€” redistribua carga ou acione gestão.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/setores/recursos', label: 'Vinculação de Recursos aos Setores' },
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/producao/relatorios', label: 'Relatórios de Produção' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
    ],
  },

  // ── Cadastro de Setores ───────────────────────────────────────────────────────
  '/pcp/setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Cadastro de Setores Produtivos',
    icon: 'Landmark',
    description: 'Gerencie os Setores Fabris da fábrica Lynx. Um Setor agrupa máquinas e centros de custo (Recursos) do Protheus sob um rótulo visual e operacional â€” por exemplo: "Solda", "Corte a Laser", "Pintura", "Montagem Final". Esta classificação alimenta diretamente o painel "Visão Gerencial por Setor" e o relatório de progresso por setor. Sem Setores configurados, a Visão Gerencial não consegue agrupar as OPs corretamente.',
    steps: [
      '── COMO CRIAR UM NOVO SETOR ──',
      'Botão "Novo Setor" (azul, canto superior direito): Clique para abrir o modal de criação. Preencha os campos e confirme.',
      'Campo "Nome do Setor" (obrigatório): Digite o nome que identifica o setor na fábrica. Exemplos: "Solda MIG", "Corte a Laser", "Montagem". Este nome aparecerá nos cards do painel Visão por Setor e nas listagens de recursos. Máximo recomendado: 30 caracteres para não truncar nas telas menores.',
      'Campo "Descrição" (opcional): Texto livre descrevendo a função do setor, quais produtos passam por ele, turno de operação, etc. Aparece em itálico abaixo do nome do setor na listagem. Use para dar contexto ao PCP e gestores sobre o escopo do setor.',
      'Campo "Cor do Setor": Escolha entre as 10 cores pré-definidas (bolinhas coloridas) ou clique no seletor de cor personalizado (quadrinho com gradiente) para escolher qualquer cor em hexadecimal. A cor é usada como indicador visual em toda a plataforma â€” cards da Visão por Setor, barra lateral da listagem e indicadores na tela de Recursos. Use cores distintas para setores próximos na linha de produção para facilitar a leitura visual.',
      'Preview em tempo real: Abaixo dos seletores de cor, uma linha mostra exatamente como o setor aparecerá na interface â€” bolinha colorida + nome. Isso permite validar a legibilidade antes de salvar.',
      'Botão "Criar Setor" (azul): Confirma a criação. O sistema salva no banco e recarrega a lista automaticamente. Caso o nome já exista, um erro será exibido.',
      'Botão "Cancelar": Fecha o modal sem salvar nenhuma alteração.',
      '── LISTA DE SETORES ──',
      'Barra colorida vertical (lado esquerdo do card): Exibe a cor configurada para o setor. Permite identificar visualmente o setor de relance, mesmo em telas menores.',
      'Nome do Setor (negrito): Nome principal do setor. Setores inativos exibem a badge "INATIVO" em cinza ao lado do nome.',
      'Badge "N recursos" (azul): Indica quantas máquinas/centros de custo (Recursos do Protheus) estão atualmente vinculados a este setor. Um setor com "0 recursos" não aparecerá corretamente no painel Visão por Setor â€” vincule recursos imediatamente após criar o setor.',
      'Texto de descrição (cinza, abaixo do nome): Aparece quando a descrição foi preenchida. Truncado se muito longo â€” o texto completo pode ser visto ao editar o setor.',
      '── AÇÕES DE CADA SETOR ──',
      'Botão "Recursos â†’" (ícone corrente + seta): Navega diretamente para a tela "Recursos por Setor" com este setor já selecionado. Use para vincular ou remover máquinas/centros de custo sem precisar selecionar o setor manualmente na outra tela.',
      'Botão Editar (ícone lápis): Abre o modal de edição com os dados do setor preenchidos. Todos os campos (Nome, Descrição e Cor) podem ser alterados. Clique em "Atualizar" para confirmar ou "Cancelar" para descartar.',
      'Botão Ativar/Desativar (ícone power): Alterna o status do setor entre Ativo e Inativo. Setores inativos ficam esmaecidos na listagem e são ocultados de certas visões do painel. Útil quando um setor está em manutenção temporária ou foi incorporado a outro â€” desative em vez de excluir para preservar o histórico.',
      'Botão Excluir (ícone lixeira): Remove permanentemente o setor do banco. ATENÇÃO: A exclusão só é permitida se o setor não tiver nenhum recurso vinculado (badge "0 recursos"). Se o botão estiver esmaecido, é porque ainda há recursos associados â€” acesse "Recursos" e remova todos antes de excluir. Esta regra protege a integridade do histórico de apontamentos.',
      '── BANNER INFORMATIVO (azul) ──',
      'O sistema exibe um lembrete no topo: após criar os setores, acesse "Recursos por Setor" para associar as máquinas e centros de custo do Protheus (ex: MO0013, MO0003) a cada setor. Sem este vínculo, as OPs não aparecerão agrupadas corretamente no painel Visão por Setor.',
      '── FLUXO RECOMENDADO DE CONFIGURAÇÃO ──',
      'Passo 1 â€” Crie os setores aqui (nesta página) com nome, descrição e cor.',
      'Passo 2 â€” Acesse "PCP â†’ Setores â†’ Recursos" e vincule as máquinas/centros de custo do Protheus a cada setor criado.',
      'Passo 3 â€” Acesse "PCP â†’ Visão por Setores" para validar que as OPs aparecem agrupadas corretamente por setor.',
    ],
    tips: [
      'Use nomes curtos e objetivos para os setores â€” eles aparecem em cards e filtros em várias telas do sistema.',
      'Escolha cores com bom contraste entre si. Evite usar duas cores muito parecidas (ex: dois tons de azul) para setores diferentes â€” o objetivo é distingui-los à distância no monitor de fábrica.',
      'Um setor com "0 recursos" não gera nenhum dado na Visão por Setor. Sempre configure os recursos logo após criar o setor.',
      'Setor inativo â‰  setor excluído. Prefira sempre desativar em vez de excluir â€” isso preserva o histórico de produção associado ao setor.',
      'A lixeira fica bloqueada (esmaecida) enquanto houver recursos vinculados. Isso é uma trava de segurança â€” remova os recursos antes de excluir o setor.',
    ],
    links: [
      { path: '/pcp/setores/recursos', label: 'Vincular Recursos aos Setores' },
      { path: '/pcp/visao-setores', label: 'Visão Gerencial por Setor' },
    ],
  },

  // ── Cadastro de Recursos (Catálogo Centralizado Multi-Empresa) ───────────────
  '/pcp/recursos': {
    category: 'PCP',
    categoryColor: '#3b82f6',
    title: 'Cadastro de Recursos (Catálogo Centralizado)',
    icon: 'Cpu',
    description: 'Catálogo central de recursos de manufatura, máquinas, mão de obra e centros de trabalho. Os recursos cadastrados aqui pertencem à empresa ativa (Multi-Empresa) e podem ser associados flexivelmente a qualquer setor produtivo.',
    steps: [
      '── VISÃO GERAL DO CATÁLOGO ──',
      'Cadastro Centralizado: Cada recurso é cadastrado uma única vez no catálogo da empresa. Uma vez cadastrado, ele pode ser vinculado a um ou mais setores produtivos na tela "Recursos por Setor".',
      'Multi-Empresa: Os recursos são isolados por empresa ativa no sistema. Se você for Superadmin, pode alternar a empresa no topo para visualizar ou cadastrar recursos específicos daquela unidade.',
      '── AÇÕES DISPONÍVEIS ──',
      'Botão "+ Novo Recurso": Abre o modal para cadastro de uma nova máquina ou centro de trabalho. Informe o Código (ex: MO0013, MA0001), o Nome/Descrição, o Tipo (Máquina, Mão de Obra, Centro de Trabalho) e a capacidade diária.',
      'Filtros de Tipo e Status: Use os botões no topo para filtrar rapidamente apenas Máquinas, Mão de Obra, ou filtrar por status Ativo/Inativo.',
      'Busca Rápida: Digite qualquer termo para pesquisar por código, nome ou nome do setor onde o recurso já está alocado.',
      'Ações por Linha: Clique no ícone de lápis para editar as informações ou na lixeira para remover o recurso do catálogo.',
      'Botão "Vincular a Setores →": Atalho direto para a tela onde você associa os recursos cadastrados aos setores produtivos.',
    ],
    tips: [
      'Mantenha os códigos de recurso idênticos aos usados nos roteiros de produção para que o cruzamento de OPs seja 100% automático.',
      'Um mesmo recurso físico ou centro de trabalho pode ser alocado em mais de um setor produtivo se necessário.',
    ],
    links: [
      { path: '/pcp/setores/recursos', label: 'Vincular Recursos aos Setores' },
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/visao-setores', label: 'Visão Gerencial por Setor' },
    ],
  },

    // ── Recursos por Setor ───────────────────────────────────────────────────────
  '/pcp/setores/recursos': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Recursos por Setor (Vinculação)',
    icon: 'Link',
    description: 'Esta tela é o elo entre o Protheus e o sistema de Setores da Lynx. Aqui você define quais máquinas, centros de custo e recursos de fabricação (cadastrados no Protheus na tabela SH1) pertencem a cada setor produtivo. Esta vinculação é fundamental: o painel "Visão Gerencial por Setor" calcula o progresso das OPs usando exatamente essa associação â€” se um recurso não estiver vinculado a nenhum setor, as OPs que passam por ele aparecerão no card "Setor Não Definido".',
    steps: [
      '── PAINEL ESQUERDO â€” LISTA DE SETORES ──',
      'Lista de Setores (coluna esquerda): Exibe todos os setores produtivos cadastrados na tela "Cadastro de Setores". Cada item mostra a bolinha colorida do setor (cor configurada), o nome do setor em negrito e a contagem de recursos já vinculados ("N recursos").',
      'Selecionar um Setor: Clique em qualquer setor da lista para selecioná-lo. O item selecionado fica destacado em azul com um indicador "â€º" à direita. O painel direito carrega automaticamente os recursos já vinculados a esse setor.',
      'Contagem "N recursos": Atualizada em tempo real a cada adição ou remoção. Permite visualizar rapidamente quais setores ainda estão sem recursos configurados (mostram "0 recursos").',
      'Caso a lista de setores esteja vazia: Nenhum setor foi cadastrado ainda. Clique em "Criar setor â†’" (link azul) ou acesse "PCP â†’ Setores" para criar os setores antes de vincular recursos.',
      '── PAINEL DIREITO â€” CABEÇALHO DO SETOR ──',
      'Após selecionar um setor, o painel direito exibe no topo um card com a bolinha colorida do setor, o nome em negrito e a descrição (se preenchida). Confirme que o setor correto está selecionado antes de adicionar ou remover recursos.',
      '── PAINEL DIREITO â€” ADICIONAR RECURSO (Duas abas) ──',
      'Aba "Buscar no Protheus" (aba padrão, ícone lupa): Modo recomendado. Conecta-se ao Protheus em tempo real e busca recursos cadastrados na tabela SH1. Qualquer máquina ou centro de custo registrado no ERP aparecerá aqui.',
      'Campo de busca (aba Buscar no Protheus): Digite o código do recurso (ex: MO0013) ou parte do nome (ex: Solda, Laser, Punci...). A busca é feita automaticamente após 400ms de pausa na digitação (debounce) â€” não é preciso pressionar Enter. Busca por código exato ou correspondência parcial no nome.',
      'Resultados da busca: Uma lista aparece abaixo do campo com os recursos encontrados. Cada item mostra o código do recurso em fonte monospace (ex: MO0013), o tipo (badge cinza, ex: MO = Mão de Obra, MA = Máquina) e o nome/descrição do recurso no Protheus.',
      'Badge "Já vinculado a este setor" (verde, ícone âœ“): Indica que o recurso já foi adicionado ao setor selecionado. O botão "Adicionar" não aparece nesses casos â€” evita duplicatas.',
      'Botão "+ Adicionar" (azul): Clique para vincular o recurso ao setor. O sistema confirma com um toast de sucesso, o recurso some da lista de resultados e aparece imediatamente na lista "Recursos Vinculados" abaixo. A contagem do setor é atualizada instantaneamente.',
      'Mensagem "Nenhum recurso encontrado no Protheus": Aparece quando a busca não retorna resultados. Pode ocorrer quando o recurso existe no Protheus mas com nomenclatura diferente, ou quando o recurso ainda não foi cadastrado no SH1. Neste caso, use a aba "Digitar código".',
      'Botão "X" (limpar): Ao lado do campo de busca, limpa o texto digitado e os resultados. O ícone de spinner azul aparece enquanto a busca está em andamento.',
      'Aba "Digitar código" (ícone lápis): Modo manual para quando o recurso não é encontrado na busca do Protheus, ou quando você conhece exatamente o código e quer adicioná-lo diretamente.',
      'Campo "Código do Recurso" (obrigatório, aba manual): Digite o código exato como cadastrado no Protheus, por exemplo: MO0013, MO0003, MA0005. O campo converte automaticamente para MAIÚSCULAS. Este código é o que o sistema usa para cruzar com as operações do roteiro (SG2) â€” deve estar correto para que as OPs apareçam corretamente no painel.',
      'Campo "Descrição" (opcional, aba manual): Nome descritivo do recurso. Exemplos: "Solda MIG", "Puncionadeira", "Torno CNC". Se não preenchido, o sistema usa o código como descrição. A descrição serve apenas para identificação visual na listagem â€” não afeta o cruzamento de dados com o Protheus.',
      'Botão "Adicionar Recurso" (azul): Confirma o cadastro manual. Desabilitado enquanto o campo Código estiver vazio. O spinner aparece durante o envio. Em caso de erro (ex: recurso já vinculado a outro setor), a mensagem de erro é exibida em vermelho.',
      '── REGRA DE EXCLUSIVIDADE ──',
      'Um mesmo recurso (código) só pode estar vinculado a UM setor por vez. Se você tentar adicionar um recurso que já pertence a outro setor, o sistema recusará com um erro explicativo. Para mover um recurso de setor, primeiro remova-o do setor atual e depois adicione no novo setor.',
      '── PAINEL DIREITO â€” RECURSOS VINCULADOS ──',
      'Card "Recursos Vinculados": Exibe a lista completa de recursos já associados ao setor selecionado. O cabeçalho mostra o total de recursos vinculados ("N recursos").',
      'Cada linha de recurso: Mostra um ponto azul indicador, o código do recurso em fonte monospace negrito (ex: MO0013) e a descrição ao lado (ex: Solda MIG).',
      'Botão Remover (ícone lixeira, vermelho ao passar o mouse): Aparece ao passar o mouse sobre a linha do recurso (efeito hover). Clique para desvincular o recurso do setor imediatamente. A remoção é instantânea â€” não há confirmação adicional. O recurso pode ser vinculado a outro setor após removido.',
      'Estado vazio ("Nenhum recurso vinculado"): Exibido quando o setor ainda não tem recursos. As instruções "Use os campos acima para adicionar recursos" orientam o próximo passo.',
      '── ESTADO INICIAL (nenhum setor selecionado) ──',
      'Quando nenhum setor está selecionado, o painel direito exibe apenas o ícone de corrente e a instrução "Selecione um setor". Clique em qualquer setor na lista esquerda para ativar o painel de gerenciamento.',
    ],
    tips: [
      'Prefira sempre a aba "Buscar no Protheus" â€” ela garante que o código do recurso existe no SH1 e evita erros de digitação que causariam inconsistências nos painéis de produção.',
      'Use a aba "Digitar código" apenas quando o recurso não aparece na busca. Isso pode acontecer quando o recurso foi criado recentemente no Protheus e a sincronização ainda não ocorreu, ou quando o código segue uma nomenclatura diferente.',
      'O código do recurso deve corresponder exatamente ao campo SH1_CODIGO (ou equivalente) do Protheus â€” incluindo zeros à esquerda (ex: MO0013, não MO13). Um código incorreto não causará erro de tela, mas o recurso não aparecerá nas análises de progressão das OPs.',
      'Verifique sempre a contagem "N recursos" na lista de setores após configurar. Setores com "0 recursos" são invisíveis no painel Visão por Setor.',
      'Para reorganizar recursos entre setores (ex: a puncionadeira foi transferida do Setor Corte para o Setor Preparação): primeiro remova o recurso do setor atual, depois selecione o novo setor e adicione. A operação é reversível a qualquer momento.',
      'O card "Setor Não Definido" na Visão por Setor indica recursos usados em roteiros de OPs que não estão vinculados a nenhum setor aqui. Consulte quais recursos estão listados lá e adicione-os ao setor correto.',
      'Esta tela pode ser acessada diretamente pelo botão "Recursos â†’" em cada card da tela "Cadastro de Setores" â€” o setor correspondente já vem pré-selecionado, economizando tempo.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/visao-setores', label: 'Visão Gerencial por Setor' },
      { path: '/producao', label: 'Ordens de Produção' },
    ],
  },

  // ── BOM (Estrutura Alternativa) ────────────────────────────────────────────────
  '/bom/:codigo': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Visualização BOM / Estrutura',
    icon: 'Layers',
    description: 'Interface alternativa para visualizar a lista técnica de materiais de um produto (BOM). Focada em exportação e análise da explosão de componentes.',
    steps: [
      'Navegue pela estrutura em árvore do produto.',
      'Analise as quantidades necessárias para cada componente no nível filho.',
      'Exporte os dados ou consulte o estoque disponível.'
    ],
    tips: [
      'Utilize esta visão para conferências rápidas do cadastro técnico do ERP.'
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura Completa' }
    ]
  },

  // ── Curva S (PCP) ─────────────────────────────────────────────────────────────
  '/pcp/curva-s': {
    category: 'PCP / Analytics',
    categoryColor: '#0ea5e9',
    title: 'Curva S de Produção',
    icon: 'LineChart',
    description: 'Análise gráfica do andamento da produção: compara o volume de peças Planejadas contra o Realizado (apontado) ao longo do tempo. Essencial para controle físico e financeiro da OP.',
    steps: [
      'Utilize os filtros superiores para selecionar Operação, Cliente ou Pedido.',
      'A linha azul (Planejado) demonstra a velocidade ideal de entrega da produção dentro do prazo.',
      'A linha laranja (Realizado) mostra o apontamento real. Ficar abaixo da linha azul indica atraso de produção.'
    ],
    tips: [
      'Os dados são baseados nas quantidades diárias; a Curva S ideal começa suave, acelera no meio da execução e suaviza perto do fim.',
      'Ordens sem data de previsão correta no Protheus podem gerar distorções na curva planejada.'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  // ── Extrato OP ────────────────────────────────────────────────────────────────
  '/pcp/extrato-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Extrato da Ordem de Produção',
    icon: 'FileText',
    description: 'Visão microscópica do histórico de apontamentos, paradas e movimentações em uma OP específica.',
    steps: [
      'Informe a OP e Item desejados.',
      'O extrato exibirá toda a vida útil da OP, desde a liberação, movimentação por cada máquina e saldos residuais.'
    ],
    tips: [
      'Use o extrato para auditar perdas (refugos) e encontrar inconsistências de digitação por parte dos operadores.'
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' }
    ]
  },

  // ── Plano de Contas Financeiro ────────────────────────────────────────────────
  '/financeiro/plano-contas': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Plano de Contas',
    icon: 'Book',
    description: 'Estrutura hierárquica das contas contábeis e financeiras da empresa, definindo as naturezas de receita e despesa para alocação correta de resultados.',
    steps: [
      'Visualize a estrutura em árvore, navegando de contas sintéticas (pai) para analíticas (filhas).',
      'Analise a classificação de cada nível contábil e seus respectivos saldos no período.'
    ],
    tips: [
      'Contas de receita geralmente começam com prefixos específicos no padrão contábil; certifique-se de não misturar despesas operacionais com despesas fixas.'
    ],
    links: [
      { path: '/financeiro/balancete', label: 'Balancete' }
    ]
  },

  // ── Balancete Financeiro ──────────────────────────────────────────────────────
  '/financeiro/balancete': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Balancete Financeiro',
    icon: 'PieChart',
    description: 'Relatório sintético de DRE/Balancete que resume as receitas e despesas estruturadas pelo Plano de Contas no período escolhido.',
    steps: [
      'Filtre o período fiscal desejado.',
      'Acompanhe o Resultado Operacional bruto e líquido da fábrica.',
      'Expanda as contas para investigar onde o custo se concentrou.'
    ],
    tips: [
      'Resultados inconsistentes frequentemente provêm de OPs finalizadas sem apropriação de custo no módulo de PCP. Certifique-se de que a produção e o consumo de matéria-prima estão regulares.'
    ],
    links: [
      { path: '/financeiro/plano-contas', label: 'Plano de Contas' }
    ]
  },

  // ── Módulo de Manutenção ─────────────────────────────────────────────────────
  '/manutencao/ordens': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Gestão de Ordens de Manutenção (O.M.)',
    icon: 'PenTool',
    description: 'Central de comando da manutenção. Aqui você visualiza, cria e gerencia solicitações de intervenção em máquinas e equipamentos.',
    steps: [
      '1. Criar Ordem: Clique em "Nova Ordem", selecione a máquina, relate o sintoma e defina tipo/prioridade.',
      '2. Execução: Clique sobre a O.M. na tabela. O técnico deve preencher as atividades realizadas e fechar o status.',
      '3. Registro de Custos: Na aba Materiais do painel, adicione peças usadas (o custo será carregado via Protheus).',
      '4. Impressão de Relatório: No painel da O.M., clique em "Imprimir / PDF" para gerar a via oficial de assinaturas.'
    ],
    tips: [
      'Acompanhe no dashboard os KPIs de tempo de reparo (MTTR) e custo total das ordens concluídas.',
      'Ordens "CRÍTICAS" indicam máquina parada. Priorize-as no atendimento.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'Cadastro de Máquinas' },
      { path: '/manutencao/checklists', label: 'Checklists (Poka-Yoke)' }
    ]
  },

  '/manutencao/maquinas': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Cadastro de Máquinas e Equipamentos',
    icon: 'Database',
    description: 'Gestão de todo o parque fabril. É obrigatório que a máquina esteja cadastrada para receber Ordens de Manutenção.',
    steps: [
      'Use "Nova Máquina" para inserir tornos, injetoras, prensas ou ferramentas complexas.',
      'Preencha a Tag de Identificação correta, que será usada pelos operadores no chão de fábrica.',
      'Anexe Manuais Técnicos em PDF para que fiquem acessíveis a qualquer técnico durante a manutenção.'
    ],
    tips: [
      'Você pode inativar máquinas que foram vendidas para não poluírem a lista de O.M. O histórico permanece salvo.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' }
    ]
  },

  '/manutencao/checklists': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Checklists e Modelos (Poka-Yoke)',
    icon: 'CheckSquare',
    description: 'Criação de modelos de inspeção diária, setups ou manutenção preventiva.',
    steps: [
      'Crie um "Novo Modelo" e defina o Tipo (Diário, Setup, Preventiva).',
      'Adicione perguntas com tipos de resposta (Sim/Não, Texto, Foto Obrigatória).',
      'Vincule os modelos criados às máquinas no painel de "Máquinas e Equipamentos".'
    ],
    tips: [
      'Utilize o requisito "Foto Obrigatória" para pontos críticos de desgaste.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'Máquinas e Equipamentos' }
    ]
  },

  '/manutencao/dashboard': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Dashboard de Manutenção',
    icon: 'LayoutDashboard',
    description: 'Painel executivo com a visão global do departamento de manutenção, KPIs e gráficos.',
    steps: [
      'Visualize o MTTR (Mean Time To Repair) e MTBF (Mean Time Between Failures).',
      'Acompanhe as Ordens Críticas que precisam de atenção imediata.'
    ],
    tips: [
      'Estes dados são gerados automaticamente baseados na abertura e encerramento das O.M.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ir para Ordens de Manutenção' }
    ]
  },

  '/manutencao/materiais': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Gestão de Materiais da O.M.',
    icon: 'Package',
    description: 'Acompanhe e faça o planejamento (follow-up) de todos os materiais solicitados nas Ordens de Manutenção.',
    steps: [
      'Busque um material pelo nome, máquina ou ID da ordem.',
      'Clique em "Planejar" para alterar o status do material.',
      'Defina as datas de previsão de compras, chegada e montagem final.'
    ],
    tips: [
      'Ao alterar o planejamento, um registro ficará gravado no histórico da Ordem de Manutenção automaticamente.',
      'Filtre pelo status "Aguardando Entrega" para acompanhar prazos com suprimentos.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' },
      { path: '/manutencao/dashboard', label: 'Dashboard Gerencial' }
    ]
  },

  '/sgq/ativos': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'Gestão de Ativos & Calibração',
    icon: 'Wrench',
    description: 'Módulo dedicado ao controle do inventário físico de equipamentos (paquímetros, trenas, durômetros) com rastreabilidade completa das certificações e prazos de calibração vigentes.',
    steps: [
      'Cadastrar Ativo: Utilize o formulário para registrar as especificações técnicas, fabricante, número de série (nº de patrimônio) e tolerâncias da norma.',
      'Definir Calibração: Preencha as frequências exigidas para calibração, laboratório homologado, validade do último certificado e anexe a documentação técnica no formato PDF.',
      'Rastreabilidade: Todo ativo entra no "Painel de Controle", que alerta automaticamente os equipamentos com vencimento iminente ou expirado.',
      'Suspensão Automática: Se a calibração vencer, o sistema bloqueia o envio desse equipamento em novos Romaneios de SGQ para auditorias.'
    ],
    tips: [
      'Cadastre a foto real do equipamento; facilita muito a identificação no chão de fábrica e na hora do embarque da caixa de ferramentas.',
      'Equipamentos em manutenção externa ou "perdidos" devem ter seu status alterado para evitar emissões indevidas.'
    ],
    links: [
      { path: '/sgq/caixas', label: 'Caixas de Ferramenta' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' }
    ]
  },

  '/sgq/caixas': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'Caixas de Ferramentas (Kits)',
    icon: 'Package',
    description: 'Sistema de gestão que permite agrupar diversos ativos e ferramentas em "Kits" (Caixas), vinculando-os a colaboradores ou frotas para otimizar auditorias e devoluções.',
    steps: [
      'Criar Caixa: Crie um registro com o nome ou numeração da Caixa e designe um responsável direto (ex: Montador Externo X).',
      'Inserir Ativos: Através do menu da caixa, bipe ou selecione os ativos que compõem o kit (como Lixadeira, Multímetro, etc).',
      'Validação de Compliance: Se algum equipamento da caixa estiver com a calibração vencida, o sistema dispara um alerta crítico.',
      'Integração Logística: Uma Caixa de Ferramentas pode ser enviada de forma consolidada dentro de um Romaneio de SGQ para equipes externas.'
    ],
    tips: [
      'Caixas são ótimas para equipes de campo. Quando um funcionário devolve, o sistema audita instantaneamente se falta algum componente.',
      'Nunca inclua equipamentos descalibrados nas caixas, isso pode gerar RNC (Não Conformidade) na obra do cliente.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'Gestão de Ativos' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' }
    ]
  },

  '/sgq/romaneios': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'Romaneios SGQ',
    icon: 'Truck',
    description: 'Módulo de expedição de qualidade focado no trânsito de Instrumentos e Caixas de Ferramentas. Garante a integridade da entrega e devolução dos ativos de auditoria e trabalho de campo.',
    steps: [
      'Gerar Romaneio: Inicie um romaneio informando o Destino, Responsável pelo Envio e o Portador (quem está levando).',
      'Adicionar Itens: Insira no documento os Ativos avulsos ou as Caixas de Ferramentas completas que irão para o local.',
      'Emissão de Checklist: O romaneio consolida todos os itens e imprime um relatório profissional. Só é permitido enviar se todos os certificados obrigatórios estiverem em dia.',
      'Baixa / Retorno: Quando o material volta para a base, utilize a tela do Romaneio para confirmar a devolução física (Check-in), garantindo que nada foi perdido na viagem.'
    ],
    tips: [
      'A rastreabilidade dos Romaneios é exigência direta para auditorias de conformidade ISO-9001 e IATF.',
      'Sempre finalize e assine os Romaneios quando o retorno for concluído.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'Gestão de Ativos' },
      { path: '/sgq/caixas', label: 'Caixas de Ferramenta' }
    ]
  },

  '/manutencao/tecnicos': {
    category: 'Manutenção',
    categoryColor: 'bg-orange-100 text-orange-800',
    title: 'Técnicos de Manutenção',
    icon: 'Users',
    description: 'Gestão do corpo técnico de manutenção. Centraliza informações de disponibilidade, especialidades (Mecânica, Elétrica, Automação) e apuração de carga de trabalho para melhor alocação das O.Ms.',
    steps: [
      'Registrar Técnico: Cadastre o profissional informando seu registro interno, nome, e-mail e função.',
      'Classificação: Defina as áreas de atuação (Especialidades) e turnos em que o técnico opera.',
      'Acompanhamento de OS: Ao acessar o perfil de um técnico, você pode visualizar todo o histórico de execuções de ordens (O.M) das quais ele participou.',
      'Análise de Demanda: Use essa tela para identificar quem está com sobrecarga de apontamentos e quem está disponível para chamados corretivos.'
    ],
    tips: [
      'Mantenha o cadastro sempre atualizado. O sistema de Execução de Manutenção só permite apontamento em nome de técnicos ativos no banco.',
      'Associe a especialidade corretamente; o Dashboard filtra a produtividade cruzando HH e Setores.'
    ],
    links: [
      { path: '/manutencao/dashboard', label: 'Gestão Manutenção' },
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' }
    ]
  },

  '/manutencao/atividades': {
    category: 'Manutenção',
    categoryColor: 'bg-orange-100 text-orange-800',
    title: 'Atividades Padrão',
    icon: 'Layers',
    description: 'Biblioteca central de atividades (instruções e tarefas repetitivas) utilizadas em Checklists Preventivos e Planos de Manutenção. Garante a padronização dos métodos técnicos operacionais.',
    steps: [
      'Criar Atividade Padrão: Registre as tarefas (ex: "Troca de Óleo Lubrificante", "Aperto de Terminais", "Limpeza do Compressor").',
      'Definir Procedimento: Descreva o passo a passo seguro para aquela atividade e associe EPIs ou Ferramentas necessárias.',
      'Tempo Padrão: Determine o tempo estimado (setup e execução) para referência na O.M.',
      'Associação a Checklists: Estas atividades cadastradas ficarão disponíveis para serem "puxadas" no momento em que você criar Planos Preventivos ou Checklists de Equipamentos.'
    ],
    tips: [
      'Não escreva tarefas genéricas ("Verificar máquina"). Seja específico ("Medir tensão das correias do eixo X").',
      'O uso de Atividades Padrão diminui o erro humano e acelera a criação de ordens de serviço rotineiras.'
    ],
    links: [
      { path: '/manutencao/checklists', label: 'Checklists Diários' },
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' }
    ]
  },

  // ── Gestão de RNCs (Relatório de Não Conformidade) ───────────────────────────
  '/sgq/gestao-rncs': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Gestão de RNCs',
    icon: 'ShieldAlert',
    description: 'Fluxo completo de registro, tratativa, 5W2H e controle de peças de reposição para Não Conformidades.',
    tabs: [
      {
        id: 'lista',
        label: 'Aba: Lista de RNCs',
        description: 'Tabela principal com todas as RNCs registradas, filtros de status, exportação e ações administrativas.',
        steps: [
          'Filtro de Status: Use o seletor no topo para filtrar a tabela entre "Todas as RNCs", "Abertas", "Em Andamento" ou "Concluídas".',
          'Coluna Status: Exibe badges visuais indicando a situação da RNC (Aberto em vermelho, Em Andamento em amarelo, Concluído em verde).',
          'Coluna Reposição: Exibe se há solicitação de nova peça ativa (ex: badge azul "Solicitado" ou cinza "Não Requerido").',
          'Rastreabilidade: A tabela mostra o código do Produto, Descrição, OP com item/sequência e o Pedido de Venda associado.',
          'Desenho Técnico (PDF): Se a RNC possuir um PDF anexado na abertura, um ícone vermelho de PDF ficará disponível na coluna Produto para visualização direta.',
          'Apontar Tempo (Ícone Relógio): Permite lançar minutos e observações de trabalho dedicados a tratar e corrigir a RNC física.',
          'Tratar RNC (Botão): Abre o modal completo de tratativa (disposição, análise 5W2H, plano de ação e eficácia) para as RNCs pendentes.',
          'Enviar E-mail (Ícone Envelope): Abre o modal de envio por e-mail para notificar os responsáveis pelo setor da qualidade ou fábrica.',
          'Imprimir PDF: Clique no topo da aba para exportar e baixar um relatório PDF formatado com a listagem atual filtrada.'
        ],
        tips: [
          'A coluna Reposição permite verificar a necessidade de novas peças para a produção sem precisar abrir o modal de tratativa.',
          'O apontamento de tempo é cumulativo por RNC e serve para auditar o custo do retrabalho e o esforço de engenharia no desvio.'
        ]
      },
      {
        id: 'kpis',
        label: 'Aba: Painel de KPIs & Gráficos',
        description: 'Indicadores gerenciais e gráficos dinâmicos para análise do desempenho de qualidade na fábrica.',
        steps: [
          'Cards de Resumo: Acompanhe no topo o total de RNCs, total de Abertas, total Em Andamento, Concluídas (com taxa de eficácia) e RNCs com Prazo Excedido (Atrasadas).',
          'Top Defeitos (Pareto): Analise o gráfico de barras para identificar os tipos de não conformidade mais frequentes.',
          'Análise de Recursos: Gráfico que quantifica e classifica os desvios agrupados por máquina/operação do Protheus.',
          'Tempo Médio de Ciclo: Acompanhe a média de dias/horas gastos desde a abertura até o encerramento da RNC.',
          'Filtros Dinâmicos: Filtre os dados por datas de abertura e setores para segmentar os gráficos de perdas de qualidade.'
        ],
        tips: [
          'Se o card "Prazo Excedido" piscar em vermelho, indica que existem RNCs com a data limite ultrapassada que precisam de atenção urgente.',
          'A taxa de eficácia reflete a qualidade dos planos de ação implementados. Valores baixos indicam que os desvios estão sendo recorrentes.'
        ]
      },
      {
        id: 'reposicoes',
        label: 'Aba: Peças Solicitadas',
        description: 'Painel administrativo para controle e liberação de fabricação de novas peças para reposição de refugo.',
        steps: [
          'Rastreabilidade: A tabela lista o ID da RNC, desenho técnico, código do produto, OP de origem, quantidade e data da solicitação.',
          'Desenho Técnico (PDF): Clique no ícone de arquivo na coluna "Desenho" para visualizar ou baixar o PDF técnico para produção.',
          'Status da Liberação: Visualizações claras entre "Aguardando Liberação" (badge vermelho/laranja) e "Liberada para Fabricação" (badge verde).',
          'Liberação de Fabricação (Botão): O PCP/Qualidade clica em "Liberar Fabricação" para iniciar o processo de reposição.',
          'Vínculo de OP Protheus: Ao liberar a peça, insira obrigatoriamente o número da OP gerada no Protheus para rastreabilidade.',
          'Detalhes da Liberação: Após liberar, o status atualiza exibindo a data, o nome do responsável e o número da OP vinculada.'
        ],
        tips: [
          'A inserção da OP é obrigatória no momento da liberação para garantir o vínculo de custos e produção no Protheus.',
          'O envio da solicitação por e-mail na tratativa pode ser realizado múltiplas vezes para o mesmo item caso ocorram mudanças no projeto ou quantidade.'
        ]
      },
      {
        id: 'modais',
        label: 'Processos (Abertura & Tratativa)',
        description: 'Instruções para os modais internos de registro de ocorrências e definição de planos de ação.',
        steps: [
          'Modal Abertura (+ Nova RNC): Selecione a OP afetada (dados integrados ao Protheus) e o produto. Defina o recurso, defeito e prazo.',
          'Tratativa Seção 1 (Disposição): Determine o destino do produto. Se escolher "Nova Peça", marque o checkbox para ativar o botão de envio.',
          'Tratativa Seção 2 (5W2H): Preencha a causa raiz respondendo às perguntas fundamentais da metodologia 5W2H.',
          'Tratativa Seção 3 (Plano de Ação): Detalhe as tarefas preventivas e corretivas com prazos e responsáveis.',
          'Tratativa Seção 4 (Eficácia): Confirme se as ações solucionaram o desvio e encerre a RNC.'
        ],
        tips: [
          'O botão "Enviar Solicitação de Fabricação de Nova Peça" aparece na Seção 1 do modal de Tratativa após marcar "Nova Peça" e serve para disparar o e-mail de fabricação com o layout do sistema.',
          'Tanto a abertura quanto a tratativa aceitam o upload de anexos e fotos de evidências.'
        ]
      }
    ],
    links: [
      { path: '/sgq/cargos-funcoes', label: 'Cargos e Funções' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  // ── PCP Refinado - Capacidade de Recursos ──────────────────────────────────
  '/pcp-refinado/capacidade': {
    category: 'PCP Refinado',
    categoryColor: '#8b5cf6',
    title: 'Cadastro de Capacidade de Recursos',
    icon: 'Layers',
    image: '/help-images/pcp_capacidade.png',
    description: 'Cadastro dos limites de capacidade diária (em minutos) e tempos padrão dos recursos produtivos para o motor PCF.',
    imageCaption: 'Painel para configuração das capacidades diárias e tempos de setup/fallback em minutos para cada recurso do chão de fábrica.',
    steps: [
      'Visualizar Recursos: A tabela lista todos os recursos ativos integrados a partir do Protheus.',
      'Configurar Capacidade: Defina a capacidade diária em minutos (ex: 480 min para 8h diárias). Recursos com capacidade 0 são considerados inativos.',
      'Definir Tempo Padrão (Fallback): Configure o tempo padrão em minutos de processamento por peça para as operações deste recurso.',
      'Salvar Alterações: Clique no botão Salvar para atualizar as capacidades no banco MySQL.'
    ],
    tips: [
      'Se um recurso não possuir capacidade definida nesta tabela, o motor de Planejamento Inteligente utilizará de forma automática o fallback padrão de 480 minutos/dia.',
      'Configure com precisão os gargalos conhecidos para obter simulações realistas e prazos confiáveis.'
    ],
    links: [
      { path: '/pcp-refinado/ocupacao', label: 'Taxa de Ocupação' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  },

  // ── PCP Refinado - Taxa de Ocupação & Planejamento Inteligente ──────────────────
  '/pcp-refinado/ocupacao': {
    category: 'PCP Refinado',
    categoryColor: '#8b5cf6',
    title: 'Taxa de Ocupação & Planejamento Inteligente (PCF)',
    icon: 'BarChart2',
    image: '/help-images/pcp_ocupacao.png',
    description: 'Painel para análise da capacidade produtiva versus carga de trabalho planejada e apontamentos executados em tempo real por recurso.',
    imageCaption: 'Painel de Taxa de Ocupação comparando Capacidade, Carga Planejada e Apontamento Executado lado a lado. Recursos como MO0003 em vermelho indicam sobrecarga e transbordo automático para dias subsequentes.',
    steps: [
      'Análise de Ocupação: O gráfico de barras exibe para cada dia a comparação de Capacidade vs Carga vs Apontamento.',
      'Fila de Sequenciamento (PCF): O motor PCF ordena a fila de OPs a partir da Data de Entrega PCP (mais urgente primeiro) para garantir o atendimento dos prazos.',
      'Carga das Operações: Calculada como: Carga (minutos) = Quantidade Pendente × Tempo de Engenharia. A quantidade pendente desconta automaticamente tudo o que já foi apontado no chão de fábrica.',
      'Transbordo de Capacidade (Overflow): Caso a carga supere a capacidade diária do recurso, o excedente transborda para o próximo dia útil subsequente.',
      'Encadeamento entre Operações: A data de término da operação anterior define o início da próxima. Se usarem o mesmo recurso, a próxima é forçada a começar no dia seguinte para evitar conflitos.'
    ],
    tips: [
      'Bloqueio do Passado: A menor data para planejamento é sempre hoje. Se o usuário escolher uma data retroativa, o sistema ajusta automaticamente para hoje para evitar planejar no passado.',
      'Desvio de Fins de Semana: O algoritmo ignora domingos e sábados não-trabalhados nas simulações de transbordo e encadeamento.',
      'Executado do Dia: Toda produção apontada no dia atualiza em tempo real a linha do Executado (Apontamento), permitindo comparar diretamente o planejado com a realidade.'
    ],
    links: [
      { path: '/pcp-refinado/capacidade', label: 'Cadastro de Capacidades' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  },

  // ── PCP Refinado - Rastreabilidade de Pedidos ────────────────────────────────────
  '/pcp-refinado/rastreabilidade': {
    category: 'PCP Refinado',
    categoryColor: '#8b5cf6',
    title: 'Rastreabilidade de Pedidos e Faturamento',
    icon: 'Network',
    description: 'Painel para rastreamento de pedidos de venda, ordens de produção vinculadas e evolução física de cada item até o faturamento.',
    steps: [
      'Buscar Pedido: Insira o número do pedido de venda ou nome do cliente para listar os itens.',
      'Acompanhar Evolução: A tabela exibe o percentual produzido e o status atual da OP no roteiro de fabricação.',
      'Previsão de Entrega: Exibe a comparação entre a data prometida ao cliente e a data estimada pelo motor de planejamento (PCF).'
    ],
    tips: [
      'Clique em expandir na linha de um pedido para detalhar todas as operações do roteiro e identificar em qual máquina a produção está retida.'
    ],
    links: [
      { path: '/pcp-refinado/ocupacao', label: 'Taxa de Ocupação' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  },

  // ── SGQ Dashboard ──────────────────────────────────────────────────────────
  '/sgq': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Painel do SGQ',
    icon: 'Building2',
    description: 'Central de controle do Sistema de Gestão da Qualidade da Lynx. Acesse os módulos de processos, documentos, não conformidades, calibrações e ferramentas.',
    steps: [
      'Navegue pelos cards para acessar cada submódulo da qualidade.',
      'O módulo de Treinamentos e Processos mapeia as fichas de processo do setor.',
      'O módulo de RNCs gerencia as ocorrências internas, de fornecedores e clientes.',
      'O módulo de Calibração monitora os vencimentos de instrumentos de medição.',
      'Acesse as diretrizes oficiais em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\04.4 SGQ e seus processos'
    ],
    tips: [
      'Use este painel para auditorias internas e externas da ISO 9001.'
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
      { path: '/sgq/gestao-rncs', label: 'Gestão de RNCs' }
    ]
  },

  // ── Gestão de Ativos ───────────────────────────────────────────────────────
  '/sgq/ativos': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Gestão de Ativos & Calibração',
    icon: 'Wrench',
    description: 'Inventário completo de equipamentos de medição, ferramentas gerais e calibração de instrumentos.',
    steps: [
      'Cadastre um ativo pelo botão "Novo Ativo" definindo se ele exige calibração.',
      'Se o ativo NÃO exige calibração, controle a quantidade em estoque direto na tabela (botões + e -).',
      'Se exige calibração, insira a validade e gerencie as regras de alerta.',
      'Use a aba de anexos dentro do cadastro do ativo para subir fotos e manuais técnicos em PDF.',
      'Acesse as diretrizes oficiais em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\07.1.5 Recursos de monitoramento e medição'
    ],
    tips: [
      'Você pode aplicar as regras de alerta configuradas para um ativo para todos os outros usando o botão de lote no modal.'
    ],
    links: [
      { path: '/sgq/calibracoes', label: 'Controle de Calibração' },
      { path: '/sgq/caixas', label: 'Caixas de Ferramentas' }
    ]
  },

  // ── Caixas de Ferramenta ───────────────────────────────────────────────────
  '/sgq/caixas': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Caixas de Ferramenta (Custódia)',
    icon: 'Package',
    description: 'Gestão de kits e caixas de ferramentas sob custódia de colaboradores específicos.',
    steps: [
      'Crie caixas no padrão "CX-METAL-XXXX" e vincule a um colaborador cadastrado.',
      'Clique em "Gerenciar Ativos" para atribuir ferramentas disponíveis na caixa ou devolvê-las ao estoque.',
      'Use o botão "Relatório" para imprimir o termo de responsabilidade assinado contendo os itens atuais da caixa.',
      'Consulte PDFs de manuais associados às ferramentas de maneira rápida pelo sub-modal.',
      'Acesse as diretrizes oficiais em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\08.5.4 Preservação'
    ],
    tips: [
      'Somente ferramentas com status "Disponível" (available) no inventário podem ser atribuídas a uma caixa.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'Inventário Geral de Ativos' }
    ]
  },

  // ── Romaneios SGQ ──────────────────────────────────────────────────────────
  '/sgq/romaneios': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Romaneios SGQ (Envio/Retorno)',
    icon: 'Truck',
    description: 'Controle logístico de remessa e retorno de equipamentos de medição (ex: envio para laboratório de calibração externo).',
    steps: [
      'Clique em "Novo Romaneio" e informe o fornecedor, destinatário e data de previsão de retorno.',
      'Adicione os itens do inventário que farão parte do romaneio.',
      'Mude o status do romaneio para "Enviado" para indicar a saída física das peças.',
      'Ao receber as peças de volta, marque os itens como retornados e encerre o romaneio.',
      'Acesse as diretrizes oficiais em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\08.4 Fornecedores e Aquisicao'
    ],
    tips: [
      'Ao excluir um romaneio pendente, todos os ativos vinculados voltam automaticamente ao status "Disponível".'
    ],
    links: [
      { path: '/sgq/ativos', label: 'Inventário Geral de Ativos' }
    ]
  },

  // ── Mapeamento de Processos ────────────────────────────────────────────────
  '/sgq/mapeamento-processos': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Mapeamento de Processos',
    icon: 'Layers',
    description: 'Visualização da árvore de processos e fluxogramas da empresa baseados no sistema.',
    steps: [
      'Aba Mapa Mental (ReactFlow): Navegue e clique nos nós dos processos para ver detalhes.',
      'Aba Organograma Nativo: Veja a representação visual da estrutura hierárquica por setores.',
      'Ao clicar em um processo, use o formulário para editar a missão, entradas, saídas e responsáveis pelo processo.',
      'Vincule documentos controlados (procedimentos ISO) diretamente ao processo mapeado.',
      'Acesse as diretrizes oficiais em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\04.4 SGQ e seus processos'
    ],
    tips: [
      'As alterações de processos feitas aqui atualizam em tempo real o banco de dados e os tutoriais contextuais de cada página correspondente.'
    ],
    links: [
      { path: '/sgq/documentos', label: 'Procedimentos' }
    ]
  },

  // ── Cargos e Funções ───────────────────────────────────────────────────────
  '/sgq/cargos-funcoes': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Cargos e Funções',
    icon: 'Users',
    description: 'Descrição de cargos, atribuições, requisitos mínimos e atividades conforme CBO.',
    steps: [
      'Veja a lista de cargos da empresa na tabela principal.',
      'Ao cadastrar ou editar um cargo, defina a denominação CBO, educação exigida, experiência e treinamentos requeridos.',
      'Adicione as atividades executadas na listagem de responsabilidades.',
      'Exporte a ficha do cargo em PDF clicando em "Imprimir".',
      'Consulte a Matriz de Responsabilidades (MRA) em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\05.2.3 Papéis e Responsabilidades\\MRA Matriz de Resp e Aut do SGQ - Rev 01.xlsx',
      'Consulte o Organograma Oficial em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\05.3 Papeis, responsabilidades e autoridades\\D 17001 - Organograma Lynx Rev01.pdf'
    ],
    tips: [
      'Estas fichas servem de base para a matriz de competências do SGQ.'
    ],
    links: [
      { path: '/sgq/treinamento', label: 'Treinamento' }
    ]
  },

  // ── Documentos ISO 9001 ────────────────────────────────────────────────────
  '/sgq/documentos': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Documentos e Procedimentos (ISO)',
    icon: 'FileText',
    description: 'Central de elaboração e controle de procedimentos, instruções de trabalho e registros da qualidade.',
    steps: [
      'Selecione o setor na barra lateral e clique em um documento para carregar o editor.',
      'Use o botão "Carregar Tópicos ISO" para preencher a estrutura regulamentar de 10 cláusulas padrão.',
      'Escreva utilizando o editor SunEditor. Para auxílio, use o painel "Assistente IA".',
      'Salve o documento para registrar uma nova revisão no banco de dados.',
      'Exporte o documento formatado com cabeçalho oficial de análise crítica da Lynx para Word (.docx) ou PDF.',
      'Consulte a Lista Mestre oficial de Documentos do SGQ em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\07.5 Informacao Documentada\\F 110-23 Lista Mestre - Documentos SGQ - Rev 00.xlsx',
      'Consulte os diretórios de Procedimentos (02 PQ\'s / 03 POP\'s) e Instruções (06 IT\'s) no servidor.'
    ],
    tips: [
      'O Assistente de IA é otimizado para a norma ISO 9001. Você pode selecionar trechos do texto para melhoria.'
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'Mapa de Processos' }
    ]
  },

  // ── Padrões de Não Conformidades ───────────────────────────────────────────
  '/sgq/nao-conformidades': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Padrões Visuais de Não Conformidades',
    icon: 'AlertCircle',
    description: 'Cadastro dos padrões fotográficos e critérios de inspeção para guiar os operadores no apontamento do chão de fábrica.',
    steps: [
      'Selecione o recurso/máquina que deseja parametrizar.',
      'Escreva a descrição do desvio (ex: rebarba excessiva, arranhão profundo).',
      'Defina a gravidade (observação, moderada ou crítica) e o tipo de resposta.',
      'Insira uma imagem de "Padrão Correto" (OK) e outra de "Padrão Incorreto" (NOK).',
      'Clique em "Salvar" para disponibilizar esse critério no monitor de conferência do recurso.',
      'Consulte o documento de referência da norma em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\08.7 Controle de saídas não conformes\\Info 8.7.docx'
    ],
    tips: [
      'Gere o PDF do Padrão Visual para afixar fisicamente próximo à estação de trabalho.'
    ],
    links: [
      { path: '/sgq/gestao-rncs', label: 'Gestão de RNCs' }
    ]
  },

  // ── Gestão de RNCs ─────────────────────────────────────────────────────────
  '/sgq/gestao-rncs': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Registro de Não Conformidades (RNC)',
    icon: 'Shield',
    description: 'Processo completo de abertura, tratamento e acompanhamento de desvios e ocorrências de qualidade.',
    steps: [
      'Aba Lista de RNCs: Pesquise RNCs ativas por código, OP ou produto e gerencie o status.',
      'Clique em "Tratar RNC" para abrir o formulário F097 contendo análise de 5W2H.',
      'Defina as ações de disposição (Retrabalho ou Peça Nova).',
      'Use o botão "Apontar Tempo" para registrar o tempo gasto no retrabalho do item, detalhando a operação.',
      'Na aba "Painel de KPIs", analise gráficos de evolução, diagrama de Pareto de defeitos e gravidades.',
      'Consulte e preencha o Plano de Ação oficial (F 095-22) disponível em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\10.2 Não conformidade e ação corretiva\\F 095-22 Formulário de Plano de Ação (PA) - Rev. 00.xlsx'
    ],
    tips: [
      'Se a disposição for "Peça Nova", clique em "Liberar Reposição" na aba "Peças Solicitadas" e informe o número da nova OP de fabricação.'
    ],
    links: [
      { path: '/sgq/nao-conformidades', label: 'Padrões Visuais' }
    ]
  },

  // ── Treinamentos e Processos ───────────────────────────────────────────────
  '/sgq/treinamento': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Processos e Treinamentos',
    icon: 'Target',
    description: 'Mapeamento de fichas de processo e controle de competências do time.',
    steps: [
      'Aba Processos: Cadastre os fornecedores, insumos, atividades principais, saídas e clientes internos/externos de cada setor.',
      'Aba Organograma: Construa a hierarquia organizacional e a divisão de atribuições.',
      'Aba Matriz de Competências: Acompanhe a capacitação do time para as operações.',
      'Consulte a Matriz de Competências oficial e registros em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\07.2 Competência'
    ],
    tips: [
      'Manter as fichas atualizadas é fundamental para a transição dos fluxos de trabalho da fábrica.'
    ],
    links: [
      { path: '/sgq/cargos-funcoes', label: 'Cargos e Funções' }
    ]
  },

  // ── Controle de Calibração ─────────────────────────────────────────────────
  '/sgq/calibracoes': {
    category: 'Qualidade',
    categoryColor: '#3b82f6',
    title: 'Controle de Calibração de Instrumentos',
    icon: 'Calendar',
    description: 'Monitoramento sistemático das datas de calibração e validade de instrumentos e equipamentos de medição.',
    steps: [
      'Consulte a listagem de alertas na aba "Vencimentos". Instrumentos vencidos aparecem em vermelho.',
      'Clique em "Novo Certificado" para subir o documento em PDF emitido pelo laboratório de calibração externo.',
      'Na aba "Histórico", acesse e faça o download de todos os certificados antigos vinculados ao ativo.',
      'Consulte a planilha oficial de controle em: \\\\192.168.1.253\\Iso\\ISO 9001-2015\\Requisitos ISO 9001-2015\\07.1.5.2 Rastreabilidade de medição\\F-011-17 - Controle de Calibração - Rev.00.xls'
    ],
    tips: [
      'Configurações de notificações integradas no WhatsApp avisam automaticamente a qualidade antes do vencimento.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'Inventário Geral de Ativos' }
    ]
  },

  // ── Pendências da Montagem ─────────────────────────────────────────────────
  '/pcp/montagem-solicitacoes': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Pendências da Montagem',
    icon: 'ClipboardList',
    description: 'Módulo de gestão de solicitações de peças e componentes faltantes para o setor de montagem. Permite criar, rastrear e concluir pedidos de material vinculados a Ordens de Produção (OPs), com ciclo de vida completo: Pendente → Em Andamento → Entregue.',
    tabs: [
      {
        id: 'visao-geral',
        label: 'Visão Geral',
        description: 'Painel principal de acompanhamento de todas as solicitações de peças abertas e encerradas do setor de montagem.',
        steps: [
          '📋 PROPÓSITO DO MÓDULO: Este módulo centraliza as solicitações de peças que estão faltando para a montagem de um produto final. Quando um montador identifica que um componente não chegou ao posto, ele registra aqui — e o almoxarifado ou outra área pode ver, atender e confirmar a entrega.',
          '🗂️ CARDS DE STATUS (Contadores): Quatro cards no topo da página mostram o total de solicitações em cada estado. Clique em um deles para filtrar rapidamente a lista abaixo somente por aquele status. Clique novamente para desfazer o filtro.',
          '📦 CARD "PENDENTE" (amarelo): Solicitações criadas mas que ainda não foram atendidas por ninguém. São as prioridades mais altas — exigem atenção imediata do almoxarifado ou do responsável pela separação.',
          '🔵 CARD "EM ANDAMENTO" (azul): O responsável clicou em "Em Andamento", sinalizando que já está buscando/separando o componente. Indica que a solicitação foi vista e está sendo resolvida.',
          '✅ CARD "ENTREGUE" (verde): Solicitações concluídas. O componente foi fisicamente entregue ao montador, e um responsável confirmou a entrega com observações opcionais.',
          '⬛ CARD "CANCELADO" (cinza): Solicitações anuladas. Podem ter sido criadas por engano ou o componente foi encontrado por outra via sem necessidade de entrega formal.',
          '🔍 FILTROS: Use os campos de busca logo abaixo dos cards para refinar a lista. Filtre pelo número da OP (ex: "002730") ou pelo código/descrição do componente (ex: "parafuso M8"). Pressione Enter para aplicar a busca imediatamente.'
        ]
      },
      {
        id: 'nova-solicitacao',
        label: 'Criar Solicitação',
        description: 'Passo a passo para registrar uma nova solicitação de peça para a montagem.',
        steps: [
          '➕ COMO CRIAR: Clique no botão azul "Nova Solicitação" no canto superior direito da página. Um modal se abrirá com opções para localizar a OP e o componente faltante.',
          '🔎 PASSO 1 — MODO DE BUSCA: Escolha como deseja encontrar a OP. Há duas abas:\n  • "Buscar por Nº da OP" → Informe diretamente o número da OP (ex: 002730).\n  • "Buscar por Código do Produto" → Informe o código do produto final sendo montado (ex: MT6-1234) para ver todas as OPs abertas para ele.',
          '🔎 PASSO 2A — BUSCA POR OP: Digite o número da OP no campo e clique em "Buscar" (ou pressione Enter). O sistema consultará o ERP e carregará:\n  • As informações da OP (produto, descrição, número do pedido de venda)\n  • A lista de componentes da estrutura da OP (filhos do produto).',
          '🔎 PASSO 2B — BUSCA POR PRODUTO: Digite o código do produto no campo e clique em "Buscar". O sistema exibirá uma lista de todas as OPs abertas para aquele produto. Clique em uma delas para selecioná-la e o fluxo continua igual à busca por OP.',
          '🧩 PASSO 3 — SELECIONAR O COMPONENTE: Com a OP carregada, uma lista de componentes (estrutura do produto) aparecerá. Clique no componente que está faltando. O código, a descrição e a quantidade serão preenchidos automaticamente nos campos abaixo. A origem será marcada como "da estrutura" (identificado com badge roxo no card).\n  • Se a peça que está faltando NÃO está na estrutura oficial, preencha os campos manualmente: Código do Item, Descrição e Quantidade. Neste caso, a origem será "LIVRE".',
          '📝 PASSO 4 — OBSERVAÇÃO (opcional): Use o campo "Observação do Solicitador" para incluir informações importantes: urgência, localização onde o componente deveria estar, número de lote, referência do cliente, etc. Quanto mais detalhes, mais fácil para o entregador encontrar e atender.',
          '💾 PASSO 5 — SALVAR: Clique em "Criar Solicitação". A solicitação aparecerá imediatamente na lista principal com status "Pendente". Todos os usuários do sistema que acessarem esta página verão a nova solicitação.'
        ]
      },
      {
        id: 'ciclo-vida',
        label: 'Fluxo de Atendimento',
        description: 'Entenda o ciclo de vida completo de uma solicitação, desde a criação até a entrega ou cancelamento.',
        steps: [
          '🔄 FLUXO COMPLETO: Uma solicitação passa pelos estados a seguir:\n  PENDENTE → EM ANDAMENTO → ENTREGUE\n  Em qualquer momento antes da entrega, pode ser CANCELADA.',
          '▶️ BOTÃO "EM ANDAMENTO": Visível no card quando a solicitação está com status "Pendente". Clique para sinalizar que você já está tratando a solicitação (buscando no estoque, solicitando compra, etc.). Isso avisa à equipe de montagem que alguém está cuidando do caso — evitando esforço duplicado.',
          '✅ BOTÃO "ENTREGAR": Disponível quando a solicitação está em "Pendente" ou "Em Andamento". Clique para abrir o modal de confirmação de entrega. Você poderá adicionar uma observação de entregador (ex: "entregue na bancada 3" ou "retirado do estoque secundário"). Ao confirmar, o status muda para "Entregue" e o seu nome fica registrado como entregador com data/hora exata.',
          '❌ BOTÃO "CANCELAR": Localizado à direita no card (texto "Cancelar"). Acione somente se a solicitação foi criada por engano ou se o problema foi resolvido por outro meio. O sistema pedirá confirmação antes de cancelar.',
          '🔍 EXPANDIR DETALHES DO CARD: Clique na seta (▼/▲) no canto direito do card para ver os detalhes adicionais:\n  • Observação do Solicitador: Mensagem deixada pelo criador da solicitação\n  • Entregador: Nome de quem confirmou a entrega + data/hora\n  • Observação do Entregador: Mensagem deixada no ato da entrega\n  • Badge "da estrutura": Indica que o componente faz parte da estrutura oficial do produto no ERP'
        ]
      },
      {
        id: 'rastreabilidade',
        label: 'Rastreabilidade',
        description: 'Informações registradas em cada solicitação para garantir auditoria e histórico completo.',
        steps: [
          '🏷️ DADOS REGISTRADOS POR SOLICITAÇÃO: Cada card exibe e armazena:\n  • Número da OP\n  • Produto da OP e sua descrição (ERP)\n  • Código do item faltante (pode ser da estrutura ou livre)\n  • Descrição do item\n  • Quantidade solicitada\n  • Nome do solicitador + data e hora da criação\n  • Status atual (Pendente / Em Andamento / Entregue / Cancelado)\n  • Badge "da estrutura" quando o componente veio da BOM da OP',
          '📌 DADOS REGISTRADOS NA ENTREGA:\n  • Nome do entregador (usuário logado que clicou em Confirmar Entrega)\n  • Data e hora da entrega\n  • Observação do entregador (campo livre para descrever onde estava o item, como foi resolvido, etc.)',
          '🔍 AUDITORIA: As informações ficam permanentemente armazenadas no banco de dados. Solicitações com status "Cancelado" aparecem com opacidade reduzida (60%) na lista, mas não são excluídas — mantendo o histórico de tudo que foi solicitado.',
          '👤 USUÁRIO AUTENTICADO: O sistema usa o usuário logado para registrar automaticamente quem criou a solicitação e quem realizou a entrega. Nunca é necessário digitar o nome manualmente — ele é preenchido via sessão.'
        ]
      }
    ],
    tips: [
      '⚡ Atalho de teclado: Nos campos de busca do modal "Nova Solicitação", pressione Enter após digitar o número da OP ou o código do produto — a busca é acionada sem precisar clicar no botão.',
      '🔄 Atualização manual: Use o botão de "Atualizar" (ícone ↻) no topo da página para recarregar a lista sem perder os filtros aplicados. Isso é útil quando múltiplos usuários estão usando o sistema ao mesmo tempo.',
      '🧩 Componente não aparece na lista da estrutura? Pode ser que o produto não tenha estrutura cadastrada no ERP, ou o componente seja de um nível abaixo (subcomponente). Neste caso, use o modo livre: preencha manualmente o código e a descrição do item.',
      '📋 Filtragem rápida por status + OP: Combine o clique no card de status com a digitação no campo "Filtrar por OP" para isolar rapidamente, por exemplo, todos os componentes pendentes de uma OP específica.',
      '📊 Dados em tempo real: A lista é carregada diretamente do banco de dados toda vez que você aplica um filtro ou recarrega a página. Para ver atualizações de outros usuários, use o botão de Atualizar.',
      '🔁 Origem "da estrutura" vs "LIVRE": A badge roxa "da estrutura" no card indica que o componente foi selecionado da BOM oficial do produto. Solicitações LIVRES não têm esta badge e indicam componentes não vinculados à estrutura — útil para peças avulsas, ferramentas ou consumíveis.'
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/produtos', label: 'Catálogo de Produtos (Estruturas)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais (Almoxarifado)' }
    ]
  },

  '/portal-cliente': {
    category: 'Comercial',
    categoryColor: '#2563eb',
    title: 'Canal do Cliente (Portal de Acompanhamento)',
    icon: 'MonitorSmartphone',
    description: 'Portal de transparência para acompanhamento em tempo real do faturamento, entregas, notas fiscais emitidas, desenhos técnicos em PDF e saldo pendente de pedidos de venda e ordens de compra.',
    tabs: [
      {
        id: 'abas-visualizacao',
        label: 'Visualização por Abas',
        description: 'Alternância entre a visão detalhada por Nota Fiscal e a visão sumarizada de saldo pendente.',
        steps: [
          'Tabela Completa (NFs): Relação minuciosa de cada item de pedido com desdobramento individual das Notas Fiscais já emitidas, data de emissão da NF, número da nota e quantidade faturada.',
          'Saldo a Faturar: Visão resumida exclusiva dos itens pendentes de entrega (Saldo > 0), com cálculo automático de % faturado, saldo a faturar em destaque Amber, barra de progresso visual de conclusão e previsão PCP.'
        ]
      },
      {
        id: 'filtros-pesquisa',
        label: 'Filtros & Pesquisa Inteligente',
        description: 'Como utilizar a pesquisa rápida, filtros avançados e busca sanitizada.',
        steps: [
          'Busca por Pedido ou Ordem de Compra: Permite pesquisar por código completo ou parcial sem zeros à esquerda (ex: "4618" encontra "004618").',
          'Múltiplos Valores por Vírgula: Digite múltiplos pedidos ou ordens separados por vírgula (ex: "4618, 4620") para pesquisá-los simultaneamente.',
          'Ref. Cliente Sanitizada: Caracteres especiais, pontuações e espaços (como hífens, pontos e barras) são ignorados automaticamente na busca.',
          'Filtro de Intervalo de Datas: Selecione entre Data Emissão Pedido, Data Prev. Entrega, Data Previsão PCP ou Data Emissão NF e defina o período desejado.',
          'Apenas Pendentes: Ative este switch para limitar a listagem apenas a itens que ainda possuem saldo em aberto.',
          'Limpar Filtros: O botão "Limpar Filtros" está sempre disponível para resetar todos os parâmetros de busca em um único clique.'
        ]
      },
      {
        id: 'agrupamentos',
        label: 'Agrupamento Dinâmico',
        description: 'Organize os registros da tabela por categorias e controle a visualização em massa.',
        steps: [
          'Menu "Agrupar por": Selecione entre Ordem de Compra (PC), Pedido de Venda, Produto, Ref. Cliente, Cliente, Nota Fiscal (NF), Data Emissão Pedido ou Data Emissão NF.',
          'Cabeçalho do Grupo: Exibe o nome do grupo, total de registros, soma das quantidades vendidas e faturadas, saldo pendente e barra de progresso do grupo.',
          'Expansão e Recolhimento: Clique na linha do grupo para abrir/fechar individualmente, ou use os botões "Expandir Todos" e "Recolher Todos" na barra superior.'
        ]
      },
      {
        id: 'desenhos-pdf',
        label: 'Desenhos Técnicos (PDF)',
        description: 'Acesso direto às folhas de engenharia dos produtos.',
        steps: [
          'Ícone de PDF Vermelho: Ao lado do código de cada produto na tabela, há um ícone vermelho de PDF.',
          'Visualização em Nova Aba: Clique no código ou ícone para abrir a folha do desenho técnico original diretamente no navegador.'
        ]
      }
    ],
    tips: [
      'Carregamento Integral: A busca carrega os dados completos correspondentes aos seus filtros em uma única consulta.',
      'Ordens de PRODUÇÃO: Ordens classificadas como "PRODUÇÃO" são ocultadas automaticamente por padrão no canal do cliente.',
      'Desenho não abre? Certifique-se de que os bloqueadores de pop-up do navegador estejam desativados para o endereço do sistema.'
    ],
    links: [
      { path: '/comercial/visao-geral', label: 'Visão Geral Comercial' },
      { path: '/comercial/itens-faturar', label: 'Itens a Faturar' }
    ]
  },



  '/visao-geral': {
      "category": "Comercial / PCP",
      "categoryColor": "#2563eb",
      "title": "Pedidos de Venda & Planilha Mestra de Produção",
      "icon": "ShoppingCart",
      "description": "Interface principal de visualização da carteira de pedidos de venda do Protheus (SC5/SC6), programação de entregas, simulação de capacidade finita (FCS), conferência de matérias-primas e Planilha Mestra de Planejamento da Produção com detalhamento de execução por máquina.",
      "tabs": [
          {
              "id": "pedidos_venda",
              "label": "Carteira de Pedidos de Venda",
              "description": "Gestão da carteira com filtros inteligentes, agrupamento por cliente e prioridades.",
              "steps": [
                  "Filtros Globais: Filtre por Cliente, Pedido, Ordem de Compra, Referência, Código de Produto, Datas de Emissão e Classificação (PCP, Restrição, Revisão, Novo).",
                  "Visões Agrupada e Lista Plana: Alterne entre visualização agrupada por pedido de venda ou lista plana item a item para análise rápida.",
                  "Ações em Lote: Alteração de datas de entrega, atribuição de prioridades comerciais e envio de comunicados via WhatsApp/Ata Viva."
              ]
          },
          {
              "id": "planilha_mestra",
              "label": "Planilha Mestra de Produção (Master Sheet)",
              "description": "Suíte completa de planejamento, capacidade e execução fabril.",
              "steps": [
                  "Aba Capa & Resumo: Visão executiva da carteira com indicadores consolidados de peças planejadas, horas de máquina e peso total.",
                  "Aba Itens Detalhados: Relação item a item com códigos de produto, desenhos vinculados, quantidades e prazos contratuais.",
                  "Aba Estrutura dos Produtos: Árvore completa de componentes com cálculo de necessidade de matéria-prima e saldos de Almoxarifado (Almox 01 e 03).",
                  "Aba Carga por Recurso: Matriz de carga calculada por posto de trabalho (Guilhotina, Puncionadeira, Laser, Dobradeira, Prensa, Usinagem, Solda, Pintura).",
                  "Aba Execução OP (COM COLUNAS CONGELADAS): Monitoramento detalhado de execução em chão de fábrica com 7 colunas fixas à esquerda (Pedido, Cliente, OP, Produto com ícone CAD, Qtd Plan, Data PCP, Qtde PCP) que permanecem visíveis durante o scroll horizontal.",
                  "Subcolunas de Execução por Recurso: Para cada máquina, acompanhe Prev (min), Apon (min), Qtd Apon, Qtd Falta (peças faltantes para concluir) e Falta min (tempo restante de máquina), com valores limpos em traço (-) para recursos não utilizados pelo produto.",
                  "Simulação de Prazos FCS: Algoritmo de sequenciamento de capacidade finita que calcula a data estimada de término de cada OP considerando a capacidade instalada."
              ]
          },
          {
              "id": "exportacoes_mestre",
              "label": "Exportações e Relatórios Executivos",
              "description": "Geração de planilhas Excel nativas e documentos PDF de alta resolução.",
              "steps": [
                  "Exportação Excel Completa: Gera planilha multi-aba com formatação profissional, fórmulas automáticas e totais de horas e quantidades por recurso.",
                  "Exportação PDF: Emite relatórios diagramados prontos para reuniões de diretoria e apresentações para clientes."
              ]
          }
      ],
      "tips": [
          "Na aba \"Execução OP\", utilize o scroll horizontal para conferir todos os postos de trabalho; as colunas de identificação da OP e do produto ficam fixas para fácil leitura.",
          "Itens sem operação em um determinado recurso são exibidos com \"-\" e não afetam o cálculo do tempo total de execução da máquina.",
          "Clique no ícone de desenho técnico ao lado de qualquer código de produto para abrir a pré-visualização imediata do desenho de engenharia."
      ],
      "links": [
          {
              "path": "/comercial/gestao-ops",
              "label": "Gestão de OPs"
          },
          {
              "path": "/pcp/fila-dependencias",
              "label": "Fila e Dependências (WIP)"
          },
          {
              "path": "/pcp/controle-execucao",
              "label": "Controle de Execução"
          }
      ]
  },


  '/suprimentos/espelho-nf': {
      "category": "Suprimentos / Fiscal",
      "categoryColor": "#0284c7",
      "title": "Visualizador de Espelho de NF-e",
      "icon": "FileText",
      "description": "Interface de consulta detalhada, conferência e impressão do Espelho de Nota Fiscal Eletrônica (NF-e) do Protheus (SF2/SD2 e SF1/SD1). Permite auditar impostos (ICMS, IPI, PIS, COFINS, ST), itens faturados, dados de transportadora, volumes, chave de acesso de 44 dígitos e romaneios de expedição atrelados.",
      "tabs": [
          {
              "id": "conferencia",
              "label": "Conferência Fiscal & Itens",
              "description": "Detalhamento completo dos produtos faturados e alíquotas aplicadas.",
              "steps": [
                  "Busca por Chave / Número: Localize a nota digitando o número da NF, série ou chave de acesso de 44 dígitos.",
                  "Conferência de Itens: Exibe código Lynx, descrição, quantidade faturada, valor unitário, valor total e NCM.",
                  "Cálculo de Tributos: Visualização dos destaques de base de cálculo e valores de ICMS, IPI, ICMS-ST e retenções federais."
              ]
          },
          {
              "id": "transporte_volumes",
              "label": "Dados de Transporte & Romaneios",
              "description": "Identificação logística da carga e vínculos operacionais.",
              "steps": [
                  "Transportadora: Dados cadastrais da transportadora, placa do veículo, tipo de frete (CIF/FOB) e volumes.",
                  "Vínculo com Romaneios: Identifica quais romaneios de expedição foram agrupados nesta nota fiscal."
              ]
          },
          {
              "id": "emissao_pdf",
              "label": "Impressão de Espelho Padronizado",
              "description": "Geração de espelho para conferência física na expedição e portaria.",
              "steps": [
                  "Gerar PDF: Clique em \"Imprimir Espelho\" para gerar o documento formatado.",
                  "Conferência Física: Utilizado pela equipe de expedição para checar os volumes físicos no caminhão antes da liberação final."
              ]
          }
      ],
      "tips": [
          "Utilize o Espelho de NF para conferir divergências fiscais com fornecedores antes de autorizar o recebimento físico.",
          "O documento em PDF contém código de barras da chave de acesso para leitura rápida com leitor óptico."
      ],
      "links": [
          {
              "path": "/romaneios",
              "label": "Expedição (Romaneios)"
          },
          {
              "path": "/auditoria-pc",
              "label": "Auditoria PC x XML"
          },
          {
              "path": "/comercial/faturamento",
              "label": "Controle de Faturamento"
          }
      ]
  },

  '/auditoria-pc': {
      "category": "Suprimentos / Qualidade",
      "categoryColor": "#059669",
      "title": "Auditoria de Pedidos de Compra (PC x XML)",
      "icon": "ShieldCheck",
      "description": "Ferramenta automatizada de conciliação fiscal e auditoria comparativa entre os Pedidos de Compra (SC7) cadastrados no Protheus e o arquivo XML da Nota Fiscal Eletrônica transmitido pelo fornecedor.",
      "tabs": [
          {
              "id": "leitura_xml",
              "label": "Upload e Leitura de XML",
              "description": "Processamento do arquivo XML da NF-e do fornecedor.",
              "steps": [
                  "Carregar XML: Arraste o arquivo .xml da NF-e para a área de upload.",
                  "Leitura Automática: O sistema extrai dados do emitente (CNPJ), número da nota, itens, NCM, preços unitários e tributos destacados.",
                  "Cruzamento Protheus: Localiza automaticamente o Pedido de Compra (PC) correspondente registrado no ERP."
              ]
          },
          {
              "id": "matriz_auditoria",
              "label": "Matriz de Divergências",
              "description": "Semáforo de conformidade item a item.",
              "steps": [
                  "Verde (Conforme): Preço unitário, quantidade e alíquotas coincidem perfeitamente.",
                  "Amarelo (Tolerância): Pequena variação aceitável de arredondamento de centavos.",
                  "Vermelho (Divergente): Preço unitário maior que o negociado, NCM incorreto, IPI/ICMS divergente ou quantidade acima do pedido."
              ]
          },
          {
              "id": "parecer_fiscal",
              "label": "Parecer e Liberação",
              "description": "Registro de autorização de entrada ou devolução.",
              "steps": [
                  "Liberar para Recebimento: Autoriza a entrada fiscal no almoxarifado caso os dados estejam conformes.",
                  "Rejeitar / Solicitar Carta de Correção: Notifica o comprador para alinhamento com o fornecedor."
              ]
          }
      ],
      "tips": [
          "Nunca receba mercadoria com divergência de preço em vermelho sem aprovação formal da Gerência de Suprimentos.",
          "Auditar o XML antes do descarregamento evita devoluções de mercadoria e notas de estorno complexas."
      ],
      "links": [
          {
              "path": "/solicitacoes-compras",
              "label": "Solicitações de Compras"
          },
          {
              "path": "/suprimentos/espelho-nf",
              "label": "Espelho da NF"
          },
          {
              "path": "/saldo-materiais",
              "label": "Estoque & Saldos"
          }
      ]
  },

  '/engenharia/sinco/estrutura-completa': {
      "category": "Engenharia / Produto",
      "categoryColor": "#6366f1",
      "title": "SolidEdge Estrutura Completa de Produto",
      "icon": "Layers",
      "description": "Visualização da árvore hierárquica multinível completa da estrutura de produtos (BOM) gerada pelo SolidEdge e integrada ao SINCO / Protheus (SG1/SB1). Permite navegar por conjuntos pais, subconjuntos, peças usinadas/estampadas, matéria-prima e roteiros de centros de trabalho.",
      "tabs": [
          {
              "id": "arvore_engenharia",
              "label": "Árvore Multinível de Engenharia",
              "description": "Explosão estrutural nó a nó de montagens e submontagens.",
              "steps": [
                  "Navegação Expansível: Clique nos nós da árvore para expandir conjuntos, peças e insumos.",
                  "Quantidades Acumuladas: Mostra a quantidade unitária por conjunto e a quantidade total acumulada para a estrutura mestre.",
                  "Detalhamento de Peça: Visualize descrição completa, tipo de material (chapa, tubo, barra), espessura e acabamento."
              ]
          },
          {
              "id": "roteiro_fabricacao",
              "label": "Roteiros de Produção & Centros de Trabalho",
              "description": "Operações fabris e tempos padrão cadastrados.",
              "steps": [
                  "Centros de Trabalho: Visualização sequencial das operações (Corte Laser, Guilhotina, Puncionadeira, Dobradeira, Usinagem CNC, Solda, Pintura).",
                  "Tempos Padrão: Tempos de preparação (setup) e tempo unitário por peça cadastrados no Protheus.",
                  "Cálculo de Carga: Base oficial de tempos utilizada pelo módulo de Planejamento de Carga Máquina da Planilha Mestra."
              ]
          },
          {
              "id": "desenhos_cad",
              "label": "Desenhos Técnicos & Modelos CAD",
              "description": "Acesso direto a arquivos de engenharia.",
              "steps": [
                  "Desenho 2D: Acesso rápido aos arquivos de desenho técnico (.dft, .dwg, .pdf) da peça.",
                  "Visualização 3D: Link direto para o módulo de Análise 3D para inspeção geométrica do componente."
              ]
          }
      ],
      "tips": [
          "Utilize esta tela para auditar se a estrutura cadastrada no Protheus reflete 100% o modelo de montagem do SolidEdge.",
          "Erros em tempos de roteiro nesta tela afetam diretamente a precisão do agendamento de capacidade no PCP."
      ],
      "links": [
          {
              "path": "/produtos",
              "label": "Catálogo de Produtos"
          },
          {
              "path": "/bom-generator",
              "label": "Gerador de BOM"
          },
          {
              "path": "/analise-3d",
              "label": "Visualizador 3D"
          }
      ]
  },

  '/analise-3d': {
      "category": "Engenharia / CAD",
      "categoryColor": "#8b5cf6",
      "title": "Visualizador de Modelos 3D (CAD Web)",
      "icon": "Box",
      "description": "Ambiente interativo de renderização e análise tridimensional de modelos CAD (peças individuais e conjuntos mecânicos) diretamente no navegador via WebGL, sem necessidade de licença CAD local.",
      "tabs": [
          {
              "id": "visualizacao_3d",
              "label": "Navegação e Câmera 3D",
              "description": "Controles tridimensionais de visualização.",
              "steps": [
                  "Órbita e Rotação: Clique e arraste com o botão esquerdo para girar o modelo em 360 graus.",
                  "Pan e Zoom: Botão direito ou roda do mouse para mover a cena e aplicar zoom nos detalhes.",
                  "Modos de Exibição: Alterne entre visualização com texturas realistas, sombreado suave, modo aramado (wireframe) e transparência de peças."
              ]
          },
          {
              "id": "medicao_inspecao",
              "label": "Medição & Cotas",
              "description": "Ferramentas de inspeção dimensional em tempo real.",
              "steps": [
                  "Distância entre Faces: Meça a distância exata entre duas superfícies selecionadas.",
                  "Diâmetros e Furações: Verifique diâmetros de furos e raios de curvatura.",
                  "Ângulos de Dobra: Inspecione ângulos de dobras em chapas metálicas."
              ]
          },
          {
              "id": "vista_explodida",
              "label": "Vista Explodida Interativa",
              "description": "Análise sequencial de montagem.",
              "steps": [
                  "Slider de Explosão: Mova a barra de explosão para afastar os componentes do conjunto ao longo dos seus eixos de montagem.",
                  "Instrução de Trabalho: Utilize a vista explodida para orientar operadores de montagem no chão de fábrica."
              ]
          }
      ],
      "tips": [
          "Pressione a tecla \"R\" para resetar a visualização para a perspectiva isométrica padrão.",
          "O visualizador suporta modelos de peças estampadas, conjuntos soldados e submontagens completas."
      ],
      "links": [
          {
              "path": "/produtos",
              "label": "Catálogo de Produtos"
          },
          {
              "path": "/engenharia/sinco/estrutura-completa",
              "label": "SolidEdge Estrutura Completa"
          }
      ]
  },




  '/rh/offboarding': {
      "category": "Recursos Humanos",
      "categoryColor": "#dc2626",
      "title": "Offboarding e Custódia de Ativos",
      "icon": "UserMinus",
      "description": "Processo estruturado de desligamento e encerramento de vínculo de colaboradores. Gerencia a conferência e devolução de ferramentas de trabalho, EPIs, crachás, uniformes, notebooks e a revogação formal de acessos aos sistemas de informação da empresa.",
      "tabs": [
          {
              "id": "conferencia_ativos",
              "label": "Checklist de Devolução de Ativos",
              "description": "Conferência física dos bens em posse do colaborador.",
              "steps": [
                  "Itens em Custódia: Listagem automática de ferramentas, armários, caixas de ferramentas, notebooks e crachás vinculados ao funcionário.",
                  "Conferência de Estado: Registro do estado de conservação no momento da entrega.",
                  "Baixa no Sistema: Atualização do status do item para \"Disponível\" no módulo de Gestão de Ativos/SGQ."
              ]
          },
          {
              "id": "termo_devolucao",
              "label": "Termo de Devolução e Quitação",
              "description": "Emissão e formalização do documento de desligamento.",
              "steps": [
                  "Gerar Termo: Emissão do documento oficial contendo a relação de todos os itens entregues.",
                  "Assinatura: Coleta da assinatura do colaborador e do responsável pelo RH/Almoxarifado.",
                  "Arquivo Digital: Armazenamento seguro do termo no prontuário do colaborador no SGQ."
              ]
          },
          {
              "id": "revogacao_acessos",
              "label": "Revogação de Acessos de TI",
              "description": "Segurança da informação e bloqueio de credenciais.",
              "steps": [
                  "Cancelamento de Usuário: Bloqueio imediato do login no Protheus, SINCO e e-mail corporativo.",
                  "Revogação de VPN: Cancelamento de acessos remotos e chaves de segurança."
              ]
          }
      ],
      "tips": [
          "Nenhum processo de homologação de rescisão deve ser finalizado sem a emissão e assinatura do Termo de Quitação de Ativos.",
          "A baixa de ferramentas devolvidas atualiza automaticamente o inventário de caixas de ferramentas do SGQ."
      ],
      "links": [
          {
              "path": "/rh/vagas",
              "label": "Gestão de Vagas"
          },
          {
              "path": "/sgq/ativos",
              "label": "Gestão de Ativos"
          },
          {
              "path": "/sgq/caixas",
              "label": "Caixas de Ferramenta"
          }
      ]
  },

  '/portal-cliente/tablet': {
      "category": "Acesso Cliente",
      "categoryColor": "#2563eb",
      "title": "Solicitação Rápida (Modo Tablet / Quiosque)",
      "icon": "Smartphone",
      "description": "Interface otimizada para tablets industriais, smartphones e quiosques de chão de fábrica, permitindo que operadores e clientes realizem solicitações rápidas de entrega, abram chamados e consultem o andamento de projetos com botões ampliados e toque simplificado.",
      "tabs": [
          {
              "id": "solicitacao_touch",
              "label": "Abertura Rápida de Solicitação",
              "description": "Fluxo simplificado de solicitação por toque.",
              "steps": [
                  "Seleção de Projeto: Escolha o projeto ou linha de montagem com botões visuais ampliados.",
                  "Código da Peça: Digite o código ou selecione na lista rápida de itens frequentes.",
                  "Quantidade e Urgência: Defina a quantidade demandada e o grau de prioridade da entrega.",
                  "Confirmar: Clique em \"Enviar Solicitação\" para registrar a demanda instantaneamente no painel de PCP e Montagem."
              ]
          },
          {
              "id": "meus_chamados",
              "label": "Status dos Chamados & Entregas",
              "description": "Acompanhamento do atendimento das solicitações.",
              "steps": [
                  "Em Análise: Solicitação recebida pelo time de PCP.",
                  "Em Produção / Separação: Peças em processo de corte/dobra ou sendo separadas no almoxarifado.",
                  "Pronto para Retirada / Entregue: Lote liberado na expedição ou entregue no posto de trabalho."
              ]
          }
      ],
      "tips": [
          "Fixe o tablet na estação de trabalho da expedição ou montagem para agilizar a comunicação sem necessidade de deslocamento físico.",
          "O teclado virtual na tela facilita a digitação rápida de observações pelo operador."
      ],
      "links": [
          {
              "path": "/portal-cliente",
              "label": "Portal do Cliente Completo"
          },
          {
              "path": "/pcp/montagem-solicitacoes",
              "label": "Pendências da Montagem"
          }
      ]
  },

  '/dashboard': {
      "category": "Meu Painel",
      "categoryColor": "#3b82f6",
      "title": "Meu Canal (Dashboard Executivo & Produtividade)",
      "icon": "BarChart2",
      "description": "Painel executivo personalizado para o usuário conectado, consolidando indicadores de produtividade pessoal, tarefas atribuídas na Ata Viva, chamados abertos sob sua responsabilidade, métricas de eficiência e atalhos rápidos para as rotinas diárias.",
      "tabs": [
          {
              "id": "kpis_pessoais",
              "label": "Métricas & Desempenho Pessoal",
              "description": "Indicadores individuais de produtividade.",
              "steps": [
                  "Taxa de Cumprimento de Tarefas: Percentual de atividades concluídas dentro do prazo estipulado.",
                  "Apontamentos Realizados: Volume de horas e operações apontadas nos módulos de produção/manutenção.",
                  "Gráfico Semanal: Evolução diária de produtividade e entregas realizadas."
              ]
          },
          {
              "id": "minhas_atividades",
              "label": "Tarefas da Ata Viva & Pendências",
              "description": "Gestão da lista de prioridades do dia.",
              "steps": [
                  "Tarefas Atribuídas: Relação de compromissos gerados em reuniões ou pelo gestor da área.",
                  "Conclusão Rápida: Marque tarefas como concluídas diretamente pelo painel para atualizar a Ata Viva global.",
                  "Prazos Críticos: Itens com prazo vencendo hoje são destacados em vermelho para ação prioritária."
              ]
          }
      ],
      "tips": [
          "Inicie seu expediente conferindo a lista de tarefas do \"Meu Canal\" para organizar a ordem de prioridades do dia.",
          "Mantenha as atividades da Ata Viva sempre atualizadas para que seu índice de eficiência reflita seu trabalho real."
      ],
      "links": [
          {
              "path": "/calendario-atividades",
              "label": "Calendário de Atividades"
          },
          {
              "path": "/comercial/gestao-ops",
              "label": "Gestão de OPs"
          }
      ]
  },

  '/fornecedor/romaneios': {
      "category": "Logística / Fornecedores",
      "categoryColor": "#059669",
      "title": "Portal do Fornecedor (Beneficiamento Externo)",
      "icon": "Truck",
      "description": "Portal de acesso externo seguro para fornecedores parceiros que realizam serviços de beneficiamento (galvanoplastia, zincagem, bicromatização, pintura eletrostática e tratamento térmico). Permite consultar romaneios emitidos pela Lynx, confirmar recebimento físico de cargas e registrar o envio de lotes prontos.",
      "tabs": [
          {
              "id": "romaneios_recebidos",
              "label": "Romaneios Enviados pela Lynx",
              "description": "Consulta de lotes e ordens de serviço em trânsito.",
              "steps": [
                  "Lista de Romaneios: Visualização de romaneios expedidos pela Lynx destinados à sua empresa.",
                  "Detalhes das Peças: Código, descrição, quantidade enviada, peso líquido/bruto e tratamento solicitado.",
                  "Download de Desenhos: Acesso direto aos desenhos técnicos para conferência de especificações e camadas."
              ]
          },
          {
              "id": "confirmacao_lote",
              "label": "Confirmação de Recebimento Físico",
              "description": "Validação da contagem de peças recebidas na fábrica do parceiro.",
              "steps": [
                  "Confirmar Chegada: Registre a data e hora do recebimento da carga.",
                  "Divergência de Contagem: Caso haja diferença de quantidade ou peças danificadas no transporte, registre a ressalva imediatamente no portal."
              ]
          },
          {
              "id": "retorno_beneficiado",
              "label": "Registro de Retorno à Lynx",
              "description": "Notificação de peças prontas para entrega.",
              "steps": [
                  "Informar Retorno: Registre o número da NF de retorno e a quantidade de peças beneficiadas.",
                  "Laudo de Qualidade: Anexe certificados de espessura de camada ou ensaio de névoa salina (Salt Spray)."
              ]
          }
      ],
      "tips": [
          "A confirmação ágil de recebimento no portal mantém o PCP da Lynx ciente da data real de início do beneficiamento.",
          "Anexar o certificado de banho/pintura no momento do envio agiliza a liberação das peças no controle de qualidade da Lynx."
      ],
      "links": [
          {
              "path": "/romaneios",
              "label": "Expedição Lynx"
          },
          {
              "path": "/recebimentos",
              "label": "Recebimento de Retornos"
          }
      ]
  },

  '/comercial/gestao-ops': {
    category: 'Comercial / PCP / Produção',
    categoryColor: '#2563eb',
    title: 'Gestão de OPs por Lote (LPF & Fracionamento)',
    icon: 'Layers',
    description: 'Cockpit operacional integrado para gestão de ordens de produção (OPs), fracionamento de saldos (Split OPs), formação de lotes de fabricação (LPF), controle estrito por Saldo a Faturar, aglutinação de planos de corte e liberação fabril irreversível com estampa de carimbo de qualidade nos desenhos técnicos.',
    tabs: [
      {
        id: 'saldo_faturar',
        label: 'Regra Soberana: Saldo a Faturar',
        description: 'Entenda por que a quantidade de referência é sempre o saldo pendente a faturar no ERP.',
        steps: [
          '1. Definição do Saldo Real: O sistema calcula o saldo ativo em tempo real direto do Protheus através da fórmula: Saldo Fat. = (C6_QTDVEN - C6_QTDENT), onde C6_QTDVEN é a quantidade vendida original e C6_QTDENT é a quantidade já entregue/faturada em Notas Fiscais anteriores.',
          '2. Prevenção de Superprodução: Se um pedido foi vendido para 100 peças e já foram faturadas 70 peças em entregas passadas, a fábrica só deve produzir o saldo restante de 30 peças. O sistema bloqueia o uso de 100 peças para que não haja consumo indevido de matéria-prima.',
          '3. Itens Concluídos (100% Entregues): Quando o Saldo Fat. chega a zero (C6_QTDVEN <= C6_QTDENT), o item recebe a tag verde "ENTREGUE" e as ações de corte/fracionamento são desabilitadas.',
          '4. Rastreabilidade de NFs: Ao passar o mouse sobre as tags de status, o sistema lista instantaneamente todas as Notas Fiscais parciais emitidas com número, série, data e quantidade entregue.'
        ]
      },
      {
        id: 'fracionamento_op',
        label: 'Fracionamento de OPs (Split AA, AB...)',
        description: 'Divisão de um saldo pendente em múltiplos sublotes independentes com datas e quantidades customizadas.',
        steps: [
          '1. Abertura do Modal de Partição: No menu de ações do item (...), clique em "Partir / Fracionar OP".',
          '2. Base de Distribuição: A quantidade total a ser particionada é estritamente o Saldo a Faturar pendente.',
          '3. Frações Customizadas: Divida o saldo em 2 ou mais frações. Cada fração recebe um identificador alfabético sequencial (ex: Fração #1 = AA, Fração #2 = AB, Fração #3 = AC...).',
          '4. Numeração Exclusiva de OP: As frações recebem o número base da OP com o sufixo da fração (ex: OP 00461809AA, 00461809AB) para garantir rastreabilidade completa no chão de fábrica e nos apontamentos.',
          '5. Validação de Soma Exata: O sistema impede o salvamento se a soma das quantidades das frações for diferente do Saldo a Faturar total do item.',
          '6. Desfazer Fracionamento (Unificação): Caso necessário antes da liberação, o usuário pode clicar em "Unificar / Desfazer Fracionamento", retornando o item para lote único.'
        ]
      },
      {
        id: 'lotes_lpf',
        label: 'Formação de Lotes de Fabricação (LPF)',
        description: 'Agrupamento inteligente de OPs e frações em lotes unificados de corte e montagem.',
        steps: [
          '1. Seleção Múltipla: Marque as caixas de seleção (checkboxes) dos itens ou frações que deseja agrupar no mesmo lote.',
          '2. Criar Lote LPF: No rodapé ou cabeçalho, clique em "Gerenciar Lote / Agrupar em Lote". O sistema gera automaticamente um código único sequencial (ex: LPF-000124).',
          '3. Agrupamento Visual na Grade: As linhas agrupadas passam a ser exibidas sob o cabeçalho destacado em verde esmeralda do Lote LPF, exibindo a quantidade total consolidada de peças e a Data PCP unificada.',
          '4. Edição de Lote: É possível incluir novas OPs em um lote existente ou remover itens antes da liberação fabril.'
        ]
      },
      {
        id: 'liberacao_irreversivel',
        label: 'Liberação Irreversível & Carimbos de Qualidade',
        description: 'Regra de bloqueio permanente e estampa de dados fabris nos desenhos técnicos.',
        steps: [
          '1. Momento da Trava Permanente (Irreversibilidade): Uma vez que o usuário clica em "Liberar Produção / Aglutinar" ou salva uma estratégia de corte para o lote LPF, o status é gravado como LIBERADO. Esta ação é IRREVERSÍVEL — não é permitido desmembrar nem excluir o lote após a liberação.',
          '2. Reflexo Bidirecional: A trava de liberação no lote LPF reflete instantaneamente em todos os itens e frações vinculados a ele.',
          '3. Carimbo da Qualidade nos Desenhos Técnicos: Ao gerar os PDFs do lote, o sistema renderiza automaticamente o carimbo oficial no canto superior do desenho contendo o código LPF, a quantidade consolidada e o roteiro operacional.',
          '4. Desenhos de Peças Aglutinadas: Para peças com múltiplos pedidos/clientes agrupados na mesma chapa de corte, o carimbo exibe a quantidade total somada do lote, garantindo que o operador execute a produção sem ambiguidades de pedidos parciais.'
        ]
      },
      {
        id: 'planilha_mestra',
        label: 'Planilha Mestra e Relatórios Excel',
        description: 'Geração e exportação da matriz completa de planejamento e roteiros.',
        steps: [
          '1. Botão Planilha Mestra: Localizado no topo da página, gera um arquivo Excel (.xlsx) de alta performance com a explosão completa dos itens filtrados.',
          '2. Aba Inicial (Índice de Lotes): A primeira aba da planilha funciona como um sumário executivo com links rápidos e resumo de todos os lotes LPF gerados.',
          '3. Lista Completa de Itens Aglutinados: Detalha código do produto, descrição, espessura da chapa, matéria-prima (MTC), peso unitário, tempo de máquina e sequência de operações (Corte a Laser, Dobra, Solda, Usinagem, Pintura).',
          '4. Download Assíncrono Seguro: O arquivo é processado e baixado mantendo compatibilidade total com redes locais HTTP e HTTPS.'
        ]
      }
    ],
    tips: [
      'Sempre verifique a coluna "Saldo Fat." antes de fracionar uma OP; ela reflete o saldo real restante após qualquer entrega parcial em NF.',
      'A liberação de um Lote LPF é irreversível. Certifique-se de que todas as OPs e frações desejadas foram inseridas antes de confirmar a liberação.',
      'Você pode filtrar simultaneamente por Cliente, Pedido, Produto e Período de Data PCP para visualizar apenas a carteira que deseja planejar.'
    ],
    links: [
      { path: '/pcp/fila-dependencias', label: 'Fila de Dependências PCP' }
    ]
  },

  '/gestao-ops': {
    category: 'Comercial / PCP / Produção',
    categoryColor: '#2563eb',
    title: 'Gestão de OPs por Lote (LPF & Fracionamento)',
    icon: 'Layers',
    description: 'Cockpit operacional integrado para gestão de ordens de produção (OPs), fracionamento de saldos (Split OPs), formação de lotes de fabricação (LPF), controle estrito por Saldo a Faturar, aglutinação de planos de corte e liberação fabril irreversível.',
    tabs: [
      {
        id: 'saldo_faturar',
        label: 'Regra Soberana: Saldo a Faturar',
        description: 'Entenda por que a quantidade de referência é sempre o saldo pendente a faturar no ERP.',
        steps: [
          '1. Definição do Saldo Real: Saldo Fat. = (C6_QTDVEN - C6_QTDENT).',
          '2. Prevenção de Superprodução: Apenas a quantidade não entregue é considerada para corte e produção.',
          '3. Rastreabilidade de NFs: Histórico completo de notas fiscais parciais diretamente na linha da OP.'
        ]
      }
    ],
    tips: [
      'Consulte a documentação completa no painel de Ajuda em /comercial/gestao-ops.'
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs por Lote' }
    ]
  }
};
