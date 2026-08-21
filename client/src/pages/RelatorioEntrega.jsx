import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    FileText, Download, CheckCircle2, Package, Zap, Link2,
    Clock, Shield, Users, Database, Server, GitBranch,
    Printer, ChevronDown, ChevronUp, Bot, Settings,
    Factory, Truck, BarChart3, HelpCircle, Wrench, Star,
    Building2, Globe, Cpu, RefreshCcw, AlertTriangle, Mail,
    PenLine, KeyRound, Eye, EyeOff, XCircle, BadgeCheck, Lock, Sparkles
} from 'lucide-react';
import api from '../services/api';
import { logoBase64 } from '../services/metalfisaLogoBase64';

// ─── Constantes de dados ────────────────────────────────────────────────────
const DELIVERY_DATE = 'Agosto de 2026';
const SYSTEM_VERSION = 'v2026.2 - Industrial Edition';

const NOVIDADES_REVISOES = [
    {
        label: 'Status de Engenharia com Restrição & Ação em Lote',
        status: 'Inclusão',
        categoria: 'Engenharia & PCP',
        desc: 'Controle rigoroso de status na estrutura de produtos (BOM) com marcação individual e em lote (NOVO, REVISÃO, RESTRIÇÃO, NORMAL). Inclui bloqueio visual de produção para itens em restrição, histórico completo de auditoria e carimbos visuais automáticos nos relatórios técnicos.',
        date: '19/08/2026',
        color: 'red',
        destaques: ['Marcação em lote na árvore', 'Bloqueio preventivo de OPs', 'Rastreio de modificações']
    },
    {
        label: 'Cálculo de Custos Triplo & Overrides Escopados',
        status: 'Inclusão',
        categoria: 'Controladoria & Engenharia',
        desc: 'Separação transparente e auditável do Custo de Materiais (MP - Matéria-Prima, MC - Material Comprado, EM - Embalagem), Custo de Recursos/Mão de Obra de Centro de Trabalho e Custo Total Geral. Permite overrides de custo escopados por produto pai na árvore multinível sem corromper o cadastro mestre.',
        date: '18/08/2026',
        color: 'emerald',
        destaques: ['Custo MP + Custo Recursos', 'Override seguro por pai', 'Exportação com abertura analítica']
    },
    {
        label: 'Módulo VMI & Mapeamento de Revisões Protheus vs Cliente',
        status: 'Inclusão',
        categoria: 'VMI & Cadeia de Suprimentos',
        desc: 'Ambiente completo de Vendor Managed Inventory: importação e leitura de Forecast (Excel/EDI), cálculo de demanda mês a mês, geração e acompanhamento de pedidos de compra/venda, controle de processos especiais (como Bicromatização e Zincagem) e mapeamento inteligente de códigos e revisões entre o ERP Protheus e o Cliente.',
        date: '15/08/2026',
        color: 'violet',
        destaques: ['Forecast & Demand planning', 'Processo de Bicromatização', 'De/Para de Revisões']
    },
    {
        label: 'Relatório de Liberações de Engenharia Otimizado',
        status: 'Revisado',
        categoria: 'Engenharia & Qualidade',
        desc: 'Redesenho completo da interface de Liberação de Engenharia com cabeçalhos fixos (sticky headers), scroll independente por tabela de itens, exportação rápida para Excel formatado e PDF institucional, além do disparo automatizado de e-mails com espelho técnico e anexos para o time produtivo.',
        date: '05/08/2026',
        color: 'blue',
        destaques: ['Sticky headers com scroll interno', 'Disparo de e-mail com anexo', 'Filtros dinâmicos multicritério']
    },
    {
        label: 'Automação de Faturamento & Notificações Programadas',
        status: 'Inclusão',
        categoria: 'Comercial & Financeiro',
        desc: 'Rotinas automáticas agendadas (Cron jobs) que compilam a carteira de pedidos prontos para faturamento, identificam pendências comerciais e disparam relatórios consolidados por e-mail e WhatsApp para os gestores antes do início de cada turno.',
        date: '01/08/2026',
        color: 'indigo',
        destaques: ['Disparo diário de faturamento', 'Notificação de bloqueios e NFs', 'Painel de itens liberados']
    },
    {
        label: 'Exportação PDF Padronizada & Mesclagem de Desenhos',
        status: 'Revisado',
        categoria: 'Design System & Documentação',
        desc: 'Motor universal de renderização de PDF para impressões industriais com cabeçalho oficial Metalfisa, quebra de página inteligente (break-inside avoid), assinatura digital e capacidade de mesclagem automática com desenhos técnicos em vetor/raster.',
        date: '28/07/2026',
        color: 'teal',
        destaques: ['Layout A4 oficial com margens', 'Carimbos dinâmicos', 'Mesclagem de folhas CAD']
    },
    {
        label: 'Resiliência Multi-Database & Otimização de Performance',
        status: 'Otimização',
        categoria: 'Infraestrutura & Backend',
        desc: 'Arquitetura híbrida de alto desempenho conectando PostgreSQL (banco de dados corporativo TOTVS Protheus) e MySQL (banco relacional da aplicação) com reconexão automática, retry em falhas transitórias e cache de ocupação de recursos em memória.',
        date: '25/07/2026',
        color: 'amber',
        destaques: ['Conexão segura PostgreSQL + MySQL', 'Zero downtime em oscilações', 'Cache de ocupação em memória']
    },
];

const MODULOS = [
    {
        id: 1,
        nome: 'Autenticação, Segurança & RBAC Granular',
        categoria: 'Segurança',
        desc: 'Login seguro com tokens JWT e renovação de sessão, criptografia bcrypt (10 rounds), recuperação de senha por WhatsApp/e-mail, auto-cadastro com aprovação administrativa e controle de permissões por tela (Visualizar, Criar, Editar, Excluir).',
        detalhes: ['Proteção contra força bruta', 'Auditoria de logs sensíveis', 'Bloqueio instantâneo de contas'],
        icon: Shield,
        color: 'slate'
    },
    {
        id: 2,
        nome: 'Dashboard Executivo — Meu Canal',
        categoria: 'Gestão & KPIs',
        desc: 'Painel gerencial com indicadores de desempenho (KPIs) por setor fabril, produtividade horária e disparo automatizado de relatórios diários matutinos e vespertinos por e-mail e WhatsApp.',
        detalhes: ['Relatórios automáticos às 06:00 e 15:00', 'Gráficos comparativos de metas vs realizado', 'Filtro por setor, período e turno'],
        icon: BarChart3,
        color: 'blue'
    },
    {
        id: 3,
        nome: 'Gestão de Pedidos Protheus (SC5/SC6)',
        categoria: 'Comercial & Vendas',
        desc: 'Tabela mestra conectada em tempo real com o Protheus, rastreabilidade de status por item, drawer lateral de detalhes com histórico completo, filtros por cliente/pedido e exportação para Excel.',
        detalhes: ['Identificação instantânea de atrasos', 'Visão agrupada por cliente e data de entrega', 'Acesso direto à estrutura técnica e OPs'],
        icon: Package,
        color: 'indigo'
    },
    {
        id: 4,
        nome: 'PCP — Planejamento e Controle da Produção',
        categoria: 'PCP & Chão de Fábrica',
        desc: 'Suíte avançada com 11 sub-módulos: Planejador Avançado, Gantt de Produção, Apontamento Vertical, Matriz de Produção, Curva S de Pedido, Programas NCN (CNC), Conferência e Ocupação de Centros de Trabalho.',
        detalhes: ['Explosão de BOM com roteiro de fabricação (Pull)', 'Gestão de filas e dependências de trabalho (WIP)', 'Análise de capacidade vs carga horária'],
        icon: Factory,
        color: 'amber'
    },
    {
        id: 5,
        nome: 'Produção & Apontamentos em Tempo Real',
        categoria: 'Chão de Fábrica',
        desc: 'Controle de Ordens de Produção (OPs), apontamentos diretos via WebSockets (Socket.io) sem recarregar a tela, Analytics de chão de fábrica, Macro Modal de Produção e extrato de tempos e paradas por recurso.',
        detalhes: ['Apontamento por código de barras / QR Code', 'Registro de início, pausa, retorno e conclusão', 'Sincronização imediata com todos os operadores'],
        icon: Zap,
        color: 'orange'
    },
    {
        id: 6,
        nome: 'SINCO — Engenharia & SolidEdge Connect',
        categoria: 'Engenharia & CAD',
        desc: 'Integração bidirecional em tempo real com SolidEdge CAD 3D via agente Windows dedicado. Gerenciamento de Ordens de Serviço (OS), BOM automática a partir do 3D, matriz de montagem, lista de materiais e apontamento por OS.',
        detalhes: ['Detecção automática do modelo 3D ativo no SolidEdge', 'Geração de estrutura e lista de corte com um clique', 'Visualizador de modelos 3D integrado no navegador'],
        icon: GitBranch,
        color: 'cyan'
    },
    {
        id: 7,
        nome: 'Engenharia, Custos & Estrutura de Produtos',
        categoria: 'Engenharia & Custos',
        desc: 'Catálogo de Produtos com suporte a Status de Engenharia (Novo, Revisão, Restrição, Normal), cálculo analítico de custos (Matéria-Prima, Materiais Comprados, Mão de Obra e Total), BOM Generator multinível, mesclagem de desenhos PDF e consulta de Onde é Usado.',
        detalhes: ['Relatório de Controle e Liberações de Engenharia', 'Exportação de árvore técnica com pesos e dimensões', 'Histórico completo de revisões de projetos'],
        icon: Cpu,
        color: 'teal'
    },
    {
        id: 8,
        nome: 'SGQ — Sistema de Gestão da Qualidade',
        categoria: 'Qualidade & Normas',
        desc: 'Módulo de conformidade ISO: Gestão de Ativos e Caixas de Ferramentas, Relatórios de Não Conformidade (RNC) com ciclo 5W2H e causa-raiz, Procedimentos Operacionais Padrão (POPs) com editor rico, Controle de Calibrações e Treinamentos.',
        detalhes: ['Alertas proativos de instrumentos a calibrar', 'Registro fotográfico de evidências em RNCs', 'Emissão e consulta de PPAPs por produto'],
        icon: CheckCircle2,
        color: 'emerald'
    },
    {
        id: 9,
        nome: 'VMI — Vendor Managed Inventory',
        categoria: 'Cadeia de Suprimentos',
        desc: 'Plataforma integrada de reposição contínua: Leitura de Forecast, projeção de Demanda Mês a Mês, gestão de Pedidos VMI, Estratégia de Produção, histórico de atendimento, tratamento superficial (Bicromatização) e mapeamento de revisões.',
        detalhes: ['Interface de upload e conciliação de planilhas', 'Controle de estoques de segurança em trânsito', 'Visão gerencial de aderência de entregas'],
        icon: RefreshCcw,
        color: 'violet'
    },
    {
        id: 10,
        nome: 'Faturamento, Comercial & Gestão de OPs',
        categoria: 'Comercial & Faturamento',
        desc: 'Painel analítico de Itens a Faturar, acompanhamento de emissão de Notas Fiscais (NFs), histórico de solicitações comerciais, conferência de pendências financeiras e automação de alertas de liberação para expedição.',
        detalhes: ['Dashboard de faturamento por período e cliente', 'Controle de pedidos liberados vs saldo em aberto', 'Visão gerencial de atrasos e gargalos comerciais'],
        icon: FileText,
        color: 'blue'
    },
    {
        id: 11,
        nome: 'Financeiro & Controladoria',
        categoria: 'Financeiro',
        desc: 'Dashboard financeiro gerencial, Fluxo de Caixa consolidado por regime de competência/caixa, Plano de Contas estruturado e Balancete Dinâmico com drill-down por centro de custos e período customizado.',
        detalhes: ['Visualização restrita por perfil financeiro sensível', 'Projeção de entradas e saídas programadas', 'Exportação de demonstrativos em formato contábil'],
        icon: BarChart3,
        color: 'green'
    },
    {
        id: 12,
        nome: 'Logística, Romaneios & Portal do Fornecedor',
        categoria: 'Logística & Expedição',
        desc: 'Gestão completa de expedição com geração de Romaneios com QR Code, portal externo seguro para fornecedores terceirizados, recebimento de retornos industriais, conferência cega e impressão térmica rápida.',
        detalhes: ['Rastreamento de itens enviados para beneficiamento', 'Upload de fotos de comprovantes e conferência', 'Integração com saldo de materiais e estoque'],
        icon: Truck,
        color: 'red'
    },
    {
        id: 13,
        nome: 'Suprimentos & Gestão de Compras',
        categoria: 'Compras & Suprimentos',
        desc: 'Controle integrado do ciclo de compras: Solicitações de Compras (SC), Pedidos de Compras amarrados aos Pedidos de Venda do Cliente (PC x PV), Requisições Internas, Rastreamento SC → NF e Auditoria de PC x XML de entrada.',
        detalhes: ['Visualizador de espelho de NF integrado', 'Consulta de saldos de estoque e reservas de projeto', 'Prevenção de compras em duplicidade'],
        icon: Package,
        color: 'orange'
    },
    {
        id: 14,
        nome: 'Manutenção de Equipamentos & Ativos',
        categoria: 'Manutenção Industrial',
        desc: 'Controle de manutenção preventiva e corretiva com cadastro de máquinas industriais, checklists diários operacionais, emissão de Ordens de Manutenção (OM), controle de técnicos e estoque de peças de reposição.',
        detalhes: ['Histórico de intervenções e tempo médio entre falhas (MTBF)', 'Fichas técnicas de máquinas com manuais anexados', 'Controle de atividades padrão de manutenção'],
        icon: Wrench,
        color: 'slate'
    },
    {
        id: 15,
        nome: 'RH — Recursos Humanos & Recrutamento com IA',
        categoria: 'Recursos Humanos',
        desc: 'Gestão de vagas operacionais e administrativas, triagem inteligente de currículos com IA Google Gemini (extração automática de dados, experiências e aderência ao perfil da vaga) e processo estruturado de Offboarding com custódia de bens.',
        detalhes: ['Matriz de Cargos e Funções integrada ao SGQ', 'Checklist eletrônico de desligamento e devolução de EPIs', 'Score de compatibilidade de candidatos'],
        icon: Users,
        color: 'pink'
    },
    {
        id: 16,
        nome: 'Wabtec — Módulo Especializado',
        categoria: 'Contratos Especiais',
        desc: 'Módulo dedicado ao contrato Wabtec: acompanhamento detalhado do escopo de fornecimento, importação de estruturas customizadas de produtos, gestão de PPAPs contratuais e calendário de datas de solicitação.',
        detalhes: ['Conformidade com especificações técnicas do cliente', 'Rastreabilidade de documentação e certificados', 'Painel de status de entrega de lotes'],
        icon: Building2,
        color: 'slate'
    },
    {
        id: 17,
        nome: 'Hermes — Assistente IA & Monitor Proativo',
        categoria: 'Inteligência Artificial',
        desc: 'Assistente inteligente corporativo com compreensão de linguagem natural, acesso contextual seguro aos bancos de dados do sistema, feed proativo de notícias internas e monitoramento contínuo de anomalias de produção.',
        detalhes: ['Geração de respostas técnicas instantâneas', 'Alertas automáticos de inconsistências operacionais', 'Interface conversacional intuitiva'],
        icon: Bot,
        color: 'blue'
    },
    {
        id: 18,
        nome: 'PCPMetal — Engine FCS com IA',
        categoria: 'Inteligência Artificial & PCP',
        desc: 'Engine de simulação de capacidade finita (Factory Capacity Simulation) para prever gargalos de produção, balanceamento de linhas e otimização de sequência de fabricação com cache em memória.',
        detalhes: ['Simulação de cenários de entrega com variação de demanda', 'Cálculo de taxa de ocupação por centro de custo', 'Apoio à tomada de decisão de horas extras'],
        icon: Cpu,
        color: 'indigo'
    },
    {
        id: 19,
        nome: 'Etiquetas & Impressão Industrial Direta',
        categoria: 'Hardware & Impressão',
        desc: 'Integração com Print Agent local em linguagem nativa PPLB / EPL2 para impressoras industriais Zebra/Argox. Permite impressão de etiquetas de identificação de peças, volumes de romaneio e pré-listas de expedição.',
        detalhes: ['Geração de código de barras Code 128 e QR Code 2D', 'Impressão térmica de alta velocidade sem diálogo do navegador', 'Modelos padronizados homologados'],
        icon: Printer,
        color: 'amber'
    },
    {
        id: 20,
        nome: 'WhatsApp & Mensageria Automatizada',
        categoria: 'Comunicação & Mensageria',
        desc: 'Integração com Evolution API para disparos de mensagens automáticas: alertas de ordens concluídas, resumos de produção gerados por IA, recuperação segura de senha e suporte operacional.',
        detalhes: ['Disparo para grupos corporativos e contatos individuais', 'Resumos executivos formatados e limpos', 'Autenticação de dois fatores e avisos urgentes'],
        icon: Mail,
        color: 'emerald'
    },
    {
        id: 21,
        nome: 'Configurações, Auditoria & Administração',
        categoria: 'Administração',
        desc: 'Painel central de controle do sistema: gerenciamento de usuários, personalização de perfis, matriz de permissões por tela, visibilidade de pedidos, controle de módulos ativos e log de auditoria de operações.',
        detalhes: ['Controle de acesso granular por rota e ação', 'Envio automático de credenciais de acesso por e-mail', 'Configuração de parâmetros gerais da empresa'],
        icon: Settings,
        color: 'slate'
    },
    {
        id: 22,
        nome: 'Central de Ajuda & POPs Contextuais',
        categoria: 'Treinamento & Suporte',
        desc: 'Base de conhecimento integrada com ajuda contextual em todas as telas do sistema, sincronizada em tempo real com os Procedimentos Operacionais Padrão (POPs) do SGQ para capacitação contínua.',
        detalhes: ['Guia passo a passo por funcionalidade', 'Acesso direto a manuais e diretrizes operacionais', 'Busca rápida de tópicos de ajuda'],
        icon: HelpCircle,
        color: 'teal'
    },
    {
        id: 23,
        nome: 'Painel TV (Visão Chão de Fábrica)',
        categoria: 'Chão de Fábrica',
        desc: 'Interface visual de alta legibilidade projetada especificamente para televisores e monitores industriais no galpão, com atualização automática via WebSockets sem necessidade de login interativo.',
        detalhes: ['Exibição de status de OPs em andamento e metas do turno', 'Alertas visuais de atrasos e prioridades', 'Carregamento leve e contínuo 24/7'],
        icon: Globe,
        color: 'blue'
    },
    {
        id: 24,
        nome: 'Mural de Avisos & Comunicados Multimídia',
        categoria: 'Comunicação Interna',
        desc: 'Canal de comunicação interna multimídia com suporte a postagens de texto, anexos de imagem e arquivos de áudio gravados, com banners persistentes de avisos urgentes fixados no topo de todas as páginas.',
        detalhes: ['Controle de confirmação de leitura por usuário', 'Priorização de recados urgentes com destaque', 'Histórico arquivado de comunicados'],
        icon: AlertTriangle,
        color: 'yellow'
    },
    {
        id: 25,
        nome: 'Calendário de Atividades & Entregas',
        categoria: 'Planejamento & Agenda',
        desc: 'Visão em calendário mensal, semanal e diário consolidando datas de entrega de pedidos do Protheus, eventos de qualidade, datas de reuniões e compromissos personalizados de cada departamento.',
        detalhes: ['Filtros por tipo de compromisso e setor', 'Sincronização de prazos da Ata Viva', 'Interface arrastar e soltar (drag & drop)'],
        icon: Clock,
        color: 'violet'
    },
    {
        id: 26,
        nome: 'Ata Viva — Gestão Inteligente de Reuniões',
        categoria: 'Gestão Corporativa',
        desc: 'Módulo colaborativo para redação de atas de reuniões em tempo real, com atribuição de tarefas a responsáveis, estipulação de prazos de entrega e integração direta com o Calendário de Atividades.',
        detalhes: ['Acompanhamento de pendências e percentual de conclusão', 'Exportação oficial da ata em PDF formatado', 'Notificação aos participantes das decisões tomadas'],
        icon: FileText,
        color: 'teal'
    },
];

const PERFIS_USUARIOS = [
    {
        codigo: 'SA',
        nome: 'Super Admin (SA)',
        nivel: 'Total & Irrestrito',
        color: 'indigo',
        destaque: 'Controle Máximo',
        desc: 'Acesso total e irrestrito a todos os 26 módulos funcionais, configurações mestras, gerenciamento de banco de dados, menus, agentes de IA, auditorias e gestão de outros administradores.',
        permissoes: ['Acesso irrestrito a todas as 95+ rotas', 'Gerenciamento de usuários SA e senhas', 'Configurações de infraestrutura e menus', 'Acesso a valores e relatórios financeiros']
    },
    {
        codigo: 'A',
        nome: 'Administrador Geral (Admin)',
        nivel: 'Administrativo Total',
        color: 'blue',
        destaque: 'Gestão Completa',
        desc: 'Acesso administrativo completo aos módulos operacionais, aprovação de novos cadastros de usuários, atribuição de permissões por tela e parametrização geral das rotinas da fábrica.',
        permissoes: ['Gestão de usuários e aprovação de cadastros', 'Acesso pleno a PCP, Engenharia, SGQ e Comercial', 'Emissão e configuração de relatórios', 'Configuração de integrações de e-mail e impressoras']
    },
    {
        codigo: 'CUSTOM_ADMIN',
        nome: 'Perfis Customizados com Flag Admin (isAdmin: true)',
        nivel: 'Total / Gerencial',
        color: 'cyan',
        destaque: 'Gerência Setorial',
        desc: 'Perfis de coordenação e gerência criados pelo administrador que recebem privilégios elevados automáticos de visualização e edição em todos os módulos operacionais sem travas pontuais.',
        permissoes: ['Acesso amplo às visões gerenciais', 'Supervisão de apontamentos e liberações', 'Edição de cronogramas e cadastros operacionais', 'Consulta de dashboards analíticos']
    },
    {
        codigo: 'CUSTOM_OP',
        nome: 'Perfis Operacionais Customizados (PCP, Eng, SGQ, Prod, etc.)',
        nivel: 'Granular (RBAC 4 Ações)',
        color: 'teal',
        destaque: 'Operação Especializada',
        desc: 'Perfis ajustados sob medida para cada função na fábrica (Operador de Máquina, Analista de PCP, Engenheiro de Produto, Inspetor de Qualidade, Comprador, Faturista, etc.) com controle estrito por tela.',
        permissoes: ['Validação individual por tela (Visualizar, Criar, Editar, Excluir)', 'Acesso restrito apenas ao escopo do seu departamento', 'Proteção contra visualização de abas sensíveis/financeiras', 'Visualização otimizada para o posto de trabalho']
    },
    {
        codigo: 'FIN_SENSIVEL',
        nome: 'Acessos Especiais & Dados Sensíveis (Valores R$)',
        nivel: 'Condicional / Restrito',
        color: 'green',
        destaque: 'Sigilo Comercial',
        desc: 'Permissões específicas concedidas apenas a usuários autorizados da Diretoria, Controladoria e Faturamento para visualizar colunas com valores monetários em R$, margens e custos confidenciais.',
        permissoes: ['Aba Financeira do painel de Itens a Faturar', 'Exibição de valores monetários (R$) de pedidos e faturamento', 'Acesso ao Fluxo de Caixa e Balancete Contábil', 'Custos detalhados de matéria-prima e mão de obra']
    },
    {
        codigo: 'FORNECEDOR',
        nome: 'Perfil Fornecedor Terceirizado',
        nivel: 'Portal Restrito',
        color: 'orange',
        destaque: 'Acesso Externo',
        desc: 'Acesso isolado e seguro destinado a parceiros e fornecedores de serviços externos (ex: Zincagem, Pintura, Tratamento Térmico, Corte a Laser terceirizado) com isolamento total da rede interna.',
        permissoes: ['Acesso restrito ao Portal do Fornecedor', 'Visualização exclusiva dos romaneios destinados ao seu CNPJ', 'Registro de recebimento e upload de fotos/comprovantes', 'Sem acesso a qualquer outro módulo ou dado interno']
    },
    {
        codigo: 'CLIENTE',
        nome: 'Perfil Portal do Cliente (Web & Tablet)',
        nivel: 'Portal Restrito',
        color: 'violet',
        destaque: 'Transparência de Projetos',
        desc: 'Ambiente com login exclusivo para clientes acompanharem o status de fabricação dos seus pedidos em tempo real ou realizarem solicitações rápidas via interface tablet dedicada.',
        permissoes: ['Visualização do cronograma e status dos seus pedidos', 'Download de relatórios de entrega e medições liberadas', 'Canal direto de solicitação rápida', 'Restrição completa aos dados de outros clientes']
    },
    {
        codigo: 'BASICO',
        nome: 'Perfil Básico / Em Aprovação',
        nivel: 'Mínimo / Quarentena',
        color: 'slate',
        destaque: 'Acesso Inicial',
        desc: 'Perfil atribuído automaticamente a novos auto-cadastros até que a equipe de administração valide a identidade e atribua o perfil definitivo e as permissões de tela apropriadas.',
        permissoes: ['Visualização limitada de avisos gerais', 'Sem privilégio de edição ou acesso a pedidos', 'Proteção ativa contra acessos não autorizados', 'Ativação condicionada à aprovação em Configurações']
    }
];

const INTEGRACOES = [
    { nome: 'Protheus / TOTVS (PostgreSQL)', tipo: 'Leitura e sincronização estruturada', desc: 'Tabelas SC5010 (Pedidos), SC6010 (Itens), SC2010 (OPs), SB1010 (Produtos), SG1010/SG2010 (Estruturas e Roteiros), SF2010 (NFs), SA5010 (Amarr. Prod x Cli), SH6010 (Recursos)', status: 'Operacional', color: 'blue' },
    { nome: 'SolidEdge (CAD 3D)', tipo: 'WebSocket em tempo real', desc: 'Agente Windows detecta modelo 3D ativo no SolidEdge e sincroniza instantaneamente com o SINCO via Socket.io', status: 'Operacional', color: 'cyan' },
    { nome: 'Google Gemini AI', tipo: 'API de Inteligência Artificial Generativa', desc: 'Extração automática de metadados em desenhos PDF, triagem de currículos em RH, assistente Hermes e diagnósticos proativos', status: 'Operacional', color: 'indigo' },
    { nome: 'WhatsApp (Evolution API)', tipo: 'Mensageria e Alertas em Tempo Real', desc: 'Recuperação de senhas, envio programado de KPIs (Meu Canal), resumos com IA e notificações críticas de chão de fábrica', status: 'Operacional', color: 'emerald' },
    { nome: 'E-mail Corporativo (SMTP / IMAP)', tipo: 'smtp.task.com.br | Porta 587 SSL/TLS', desc: 'Disparo de relatórios do Meu Canal, liberações de engenharia com espelho/PDF, notificações do SGQ e alertas de faturamento', status: 'Operacional', color: 'orange' },
    { nome: 'Impressoras Industriais Zebra (PPLB / EPL2)', tipo: 'Print Agent local instalável', desc: 'Comunicação direta com impressoras térmicas para impressão de etiquetas industriais, romaneios e expedição', status: 'Operacional', color: 'slate' },
];

const AUTOMACOES = [
    { horario: '06:00 (dias úteis)', nome: 'Meu Canal — Manhã', desc: 'E-mail + WhatsApp com KPIs de produção para cada responsável de setor' },
    { horario: '15:00 (dias úteis)', nome: 'Meu Canal — Tarde', desc: 'Atualização dos KPIs de produção — relatório consolidado por setor' },
    { horario: '15:00 (dias úteis)', nome: 'Relatório WhatsApp com IA', desc: 'Resumo inteligente de produção gerado por IA e enviado aos grupos monitorados' },
    { horario: '08:30 (diário)', nome: 'Alertas SGQ & Qualidade', desc: 'Notificações de calibrações a vencer, treinamentos pendentes e RNCs em aberto' },
    { horario: 'Configurável', nome: 'Automações de Faturamento', desc: 'Relatórios consolidados de faturamento e avisos de pendências financeiras' },
    { horario: 'A cada 1 hora', nome: 'Monitoramento de Métricas & Saúde', desc: 'Cron job contínuo de coleta de métricas de ocupação, banco de dados e CPU' },
    { horario: 'Contínuo', nome: 'Hermes — Monitor Proativo', desc: 'Detecção de anomalias operacionais e alertas instantâneos via Socket.io' },
];

const METRICAS = [
    { label: 'Rotas / Páginas Web', value: '95+', icon: Globe },
    { label: 'Módulos Funcionais', value: '26', icon: Package },
    { label: 'Endpoints de API', value: '75+', icon: Server },
    { label: 'Componentes React', value: '85+', icon: Cpu },
    { label: 'Integrações Externas', value: '6', icon: Link2 },
    { label: 'Automações (Cron Jobs)', value: '7', icon: Zap },
    { label: 'Canais de Mensageria', value: '3', icon: Mail },
    { label: 'Bancos Integrados', value: '2', icon: Database },
];

const AMBIENTES = [
    { label: 'Intranet (Rede Local)', url: 'http://192.168.1.77:3001', status: 'Operacional' },
    { label: 'Módulo SINCO Web', url: 'https://sincometal.metalfisa.com.br', status: 'Operacional' },
    { label: 'Painel TV (Chão de Fábrica)', url: '/painel-producao', status: 'Operacional' },
];

const COLOR_MAP = {
    slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  ring: 'ring-slate-200',  dot: 'bg-slate-400' },
    blue:   { bg: 'bg-blue-50',    text: 'text-blue-700',   ring: 'ring-blue-200',   dot: 'bg-blue-500' },
    indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-700', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
    amber:  { bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200',  dot: 'bg-amber-500' },
    orange: { bg: 'bg-orange-50',  text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-500' },
    cyan:   { bg: 'bg-cyan-50',    text: 'text-cyan-700',   ring: 'ring-cyan-200',   dot: 'bg-cyan-500' },
    teal:   { bg: 'bg-teal-50',    text: 'text-teal-700',   ring: 'ring-teal-200',   dot: 'bg-teal-500' },
    emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-700',ring: 'ring-emerald-200',dot: 'bg-emerald-500' },
    violet: { bg: 'bg-violet-50',  text: 'text-violet-700', ring: 'ring-violet-200', dot: 'bg-violet-500' },
    green:  { bg: 'bg-green-50',   text: 'text-green-700',  ring: 'ring-green-200',  dot: 'bg-green-500' },
    red:    { bg: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-200',    dot: 'bg-red-500' },
    pink:   { bg: 'bg-pink-50',    text: 'text-pink-700',   ring: 'ring-pink-200',   dot: 'bg-pink-500' },
    yellow: { bg: 'bg-yellow-50',  text: 'text-yellow-700', ring: 'ring-yellow-200', dot: 'bg-yellow-500' },
};

function getColor(c) { return COLOR_MAP[c] || COLOR_MAP.slate; }

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function StatusBadge({ label = 'Operacional' }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {label}
        </span>
    );
}

function ModuloCard({ mod }) {
    const c = getColor(mod.color);
    const Icon = mod.icon;
    return (
        <div className={`flex flex-col justify-between p-4 rounded-xl ring-1 ${c.ring} ${c.bg} group hover:shadow-md transition-all duration-200 break-inside-avoid`}>
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg} ring-1 ${c.ring}`}>
                            <Icon className={`w-4 h-4 ${c.text}`} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                {mod.categoria || 'Módulo'}
                            </span>
                            <p className={`text-sm font-bold ${c.text} leading-tight`}>{mod.nome}</p>
                        </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{mod.desc}</p>
            </div>
            {mod.detalhes && mod.detalhes.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                    {mod.detalhes.map((det, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/70 text-slate-700 px-2 py-0.5 rounded-md ring-1 ring-slate-200">
                            <span className={`w-1 h-1 rounded-full ${c.dot}`} />
                            {det}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CollapseSection({ title, icon: Icon, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);

    // Refs (not state) so the print handlers always read the latest value
    // without needing to resubscribe — avoids stale closures across re-renders.
    const openRef = useRef(open);
    const preprintOpenRef = useRef(open);
    useEffect(() => { openRef.current = open; }, [open]);

    // Force every section fully open for the duration of printing/PDF export,
    // regardless of what the user had toggled on screen, then restore it after.
    useEffect(() => {
        const handleBeforePrint = () => {
            preprintOpenRef.current = openRef.current;
            setOpen(true);
        };
        const handleAfterPrint = () => {
            setOpen(preprintOpenRef.current);
        };
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-800">{title}</span>
                </div>
                <span className="print:hidden">
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </span>
            </button>
            {/* Print always shows full content, forced open above */}
            <div className={`${open ? 'block' : 'hidden'} print:block px-6 pb-6`}>
                {children}
            </div>
        </div>
    );
}

// ─── Electronic Signature Modal ──────────────────────────────────────────────────
function ElectronicSignatureModal({ role, party, onConfirm, onClose }) {
    const [loginVal, setLoginVal] = useState('');
    const [senha, setSenha] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSign = async (e) => {
        e.preventDefault();
        if (!loginVal.trim() || !senha.trim()) { setError('Preencha o usuário e a senha.'); return; }
        setLoading(true); setError('');
        try {
            const res = await api.post('/auth/login', { login: loginVal.trim(), senha });
            const { user } = res.data;
            onConfirm({
                nome: user.NomeUsuario || user.nome || loginVal,
                login: user.Usuario || user.login || loginVal,
                cargo: user.Cargo || user.cargo || '',
                timestamp: new Date().toLocaleString('pt-BR'),
                iso: new Date().toISOString(),
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Usuário ou senha incorretos.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <PenLine className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm">Assinatura Eletrônica</p>
                            <p className="text-slate-400 text-xs">{party} — {role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <div className="mx-6 mt-4 mb-0 p-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Insira suas credenciais de acesso ao sistema. Seus dados serão registrados como assinante deste documento.
                    </p>
                </div>
                <form onSubmit={handleSign} className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Usuário</label>
                        <input autoFocus type="text" value={loginVal} onChange={e => setLoginVal(e.target.value)}
                            placeholder="Seu login do sistema"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Senha</label>
                        <div className="relative">
                            <input type={showPwd ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            />
                            <button type="button" onClick={() => setShowPwd(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 ring-1 ring-red-200">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <p className="text-xs text-red-700 font-semibold">{error}</p>
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-bold transition-colors">
                            {loading
                                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                : <PenLine className="w-4 h-4" />}
                            {loading ? 'Verificando...' : 'Assinar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Signature Block ────────────────────────────────────────────────────────
function SignatureBlock({ label, organization, role, signatureData, onClickSign, locked }) {
    const isSigned = !!signatureData;
    return (
        <div className={`p-5 rounded-xl ring-1 space-y-4 transition-all ${
            isSigned
                ? locked
                    ? 'bg-emerald-50 ring-emerald-300 shadow-sm shadow-emerald-100'
                    : 'bg-emerald-50 ring-emerald-200'
                : locked
                    ? 'bg-slate-100 ring-slate-300 opacity-60'
                    : 'bg-slate-50 ring-slate-200'
        }`}>
            {/* Party header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-base font-black text-slate-800">{organization}</p>
                    <p className="text-sm text-slate-600">{role}</p>
                </div>
                {isSigned && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 shrink-0">
                        <Lock className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Bloqueado</span>
                    </div>
                )}
            </div>

            <div className="border-t border-slate-300 pt-4 space-y-3">
                {isSigned ? (
                    <>
                        <div className="flex items-start gap-2">
                            <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-slate-800">{signatureData.nome}</p>
                                {signatureData.cargo && <p className="text-xs text-slate-500">{signatureData.cargo}</p>}
                                <p className="text-xs text-slate-400 font-mono mt-0.5">@{signatureData.login}</p>
                            </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-100/60 ring-1 ring-emerald-200">
                            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Assinado eletronicamente em</p>
                            <p className="text-xs text-emerald-800 font-semibold mt-0.5">{signatureData.timestamp}</p>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono break-all">
                            sig:{btoa(`${signatureData.login}|${signatureData.iso}`).substring(0, 40)}…
                        </p>
                    </>
                ) : locked ? (
                    // Unsigned but process already closed by other party signing (should not reach here normally)
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <Lock className="w-6 h-6 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">Processo encerrado</span>
                    </div>
                ) : (
                    <>
                        <button onClick={onClickSign}
                            className="w-full group flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all no-print">
                            <PenLine className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                            <span className="text-xs font-semibold text-slate-400 group-hover:text-emerald-600 transition-colors">
                                Clique para assinar eletronicamente
                            </span>
                        </button>
                        <div className="hidden print:flex flex-col items-center justify-center pt-8 pb-2">
                            <div className="w-56 border-b border-slate-700 mb-1.5"></div>
                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Assinatura / Carimbo</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function RelatorioEntrega({ embedded = false }) {
    const reportRef = useRef(null);
    const [signFornecedor, setSignFornecedor] = useState(null);
    const [signCliente, setSignCliente] = useState(null);
    const [signModal, setSignModal] = useState(null);

    // Process is permanently closed once BOTH parties have signed
    const isClosed = !!(signFornecedor && signCliente);

    const handleConfirmSign = useCallback((side, data) => {
        if (side === 'fornecedor') setSignFornecedor(data);
        else setSignCliente(data);
        setSignModal(null);
    }, []);

    // Block modal if process is already closed
    const handleOpenModal = useCallback((side) => {
        if (isClosed) return;
        setSignModal(side);
    }, [isClosed]);

    const handlePrint = () => {
        const headerContent = document.getElementById('relatorio-header-oficial');
        const bodyContent = document.getElementById('relatorio-body-oficial');
        const footerContent = document.getElementById('relatorio-footer-oficial');

        if (!headerContent || !bodyContent) {
            window.print();
            return;
        }

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const doc = printFrame.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatorio_Tecnico_Entrega_MetalFisa_ERP_v2026.2</title>
                <meta charset="utf-8" />
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @page { size: A4 portrait; margin: 8mm 10mm; }
                    body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; }
                    * { box-sizing: border-box; }
                    .break-inside-avoid, 
                    .rounded-xl, 
                    .rounded-2xl, 
                    .ring-1, 
                    .grid > div, 
                    tr, th, td { 
                        break-inside: avoid !important; 
                        page-break-inside: avoid !important; 
                    }
                    h1, h2, h3, h4, .section-header { 
                        break-after: avoid !important; 
                        page-break-after: avoid !important; 
                    }
                    .no-print, .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    table.print-wrapper-table { width: 100%; border-collapse: collapse; }
                    table.print-wrapper-table thead { display: table-header-group !important; }
                    table.print-wrapper-table tfoot { display: table-footer-group !important; }
                    table.print-wrapper-table tbody tr td { padding: 0; }
                </style>
            </head>
            <body class="p-2">
                <table class="print-wrapper-table">
                    <thead>
                        <tr>
                            <th style="padding: 0 0 10px 0; text-align: left; font-weight: normal;">
                                ${headerContent.outerHTML}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div class="space-y-5">
                                    ${bodyContent.innerHTML}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style="padding: 10px 0 0 0;">
                                <div style="border-top: 1.5px solid #334155; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #475569;">
                                    <div>
                                        <span style="font-weight: 700; color: #0f172a;">MetalFisa ERP</span> · ${SYSTEM_VERSION} · Relatório Técnico Oficial
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 20px;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569;">Rubrica Fornecedor:</span>
                                            <span style="display: inline-block; width: 70px; border-bottom: 1.2px solid #334155; height: 10px;"></span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569;">Rubrica Cliente:</span>
                                            <span style="display: inline-block; width: 70px; border-bottom: 1.2px solid #334155; height: 10px;"></span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
            }, 2000);
        }, 400);
    };

    return (
        <div className={embedded ? 'bg-gray-50' : 'min-h-screen bg-gray-50'}>

            {/* ── Signature Modal ── */}
            {signModal && (
                <ElectronicSignatureModal
                    role={signModal === 'fornecedor' ? 'Responsável Técnico' : 'Responsável pelo Recebimento'}
                    party={signModal === 'fornecedor' ? 'LynxEMS Sistemas' : 'Metalfisa Indústria'}
                    onConfirm={(data) => handleConfirmSign(signModal, data)}
                    onClose={() => setSignModal(null)}
                />
            )}

            <div ref={reportRef} className="max-w-5xl mx-auto px-4 py-6 space-y-6">

                {/* ═══ BOTÃO DE EXPORTAÇÃO WEB ════════════════════════════════════ */}
                <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-xl shadow-sm no-print">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Documento Técnico Oficial</p>
                            <h2 className="text-sm font-bold text-white">Relatório de Entrega & Homologação em Produção</h2>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow cursor-pointer active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        Exportar PDF / Imprimir Relatório
                    </button>
                </div>

                <div id="relatorio-entrega-printable-area" className="space-y-6">

                    {/* ═══ CABEÇALHO PADRÃO OFICIAL METALFISA ════════════════════════ */}
                    <div id="relatorio-header-oficial" className="border-2 border-slate-800 rounded-xl overflow-hidden bg-white shadow-sm break-inside-avoid">
                        <div className="grid grid-cols-12 divide-x-2 divide-slate-800 bg-slate-50">
                            {/* Logo */}
                            <div className="col-span-3 p-3 flex flex-col items-center justify-center bg-white">
                                {logoBase64 ? (
                                    <img 
                                        src={logoBase64} 
                                        alt="Logo MetalFisa" 
                                        className="h-12 object-contain max-w-full"
                                    />
                                ) : (
                                    <div className="font-extrabold text-xl text-slate-900 tracking-tight">METALFISA</div>
                                )}
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">
                                    Estruturas Metálicas
                                </span>
                            </div>

                            {/* Título Central */}
                            <div className="col-span-6 p-3 flex flex-col items-center justify-center text-center bg-white">
                                <span className="text-[9px] font-extrabold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider mb-1">
                                    MARCO DE ENTREGA TÉCNICA OFICIAL
                                </span>
                                <h1 className="text-sm sm:text-base font-extrabold text-slate-950 uppercase tracking-tight">
                                    Relatório de Entrega & Homologação
                                </h1>
                                <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                    MetalFisa ERP — Sistema Integrado de Gestão Industrial
                                </p>
                            </div>

                            {/* Metadados da Entrega */}
                            <div className="col-span-3 p-2.5 text-[10px] flex flex-col justify-center space-y-1 bg-slate-50">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Cliente:</span>
                                    <span className="font-bold text-slate-900">Metalfisa Indústria</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Fornecedor:</span>
                                    <span className="font-bold text-blue-900">LynxEMS Sistemas</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Data Entrega:</span>
                                    <span className="font-semibold text-slate-700">{DELIVERY_DATE}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Versão:</span>
                                    <span className="font-mono font-bold text-emerald-700">{SYSTEM_VERSION}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                <div id="relatorio-body-oficial" className="space-y-6">

                {/* ═══ SUMÁRIO EXECUTIVO ════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={Star} title="Sumário Executivo" />
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Este documento certifica a entrega do <strong>MetalFisa ERP</strong>, sistema integrado de gestão industrial
                        desenvolvido sob medida para a Metalfisa. O sistema cobre todo o ciclo operacional da empresa — desde
                        a entrada de pedidos até a expedição — integrando PCP, Produção, Engenharia, Qualidade, Logística,
                        Financeiro e RH em uma única plataforma web.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mt-3">
                        A entrega contempla um sistema <strong>totalmente operacional</strong>, com integrações ativas ao ERP Protheus (TOTVS),
                        sistema CAD SolidEdge, Inteligência Artificial (Google Gemini), WhatsApp e impressoras industriais.
                        O sistema está disponível na rede interna e externamente via internet com certificado SSL.
                    </p>
                </div>

                {/* ═══ AMBIENTES ════════════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={Globe} title="Ambientes de Acesso" subtitle="URLs de acesso ao sistema em produção" />
                    <div className="grid sm:grid-cols-2 gap-3">
                        {AMBIENTES.map(a => (
                            <div key={a.label} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{a.url}</p>
                                </div>
                                <StatusBadge />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ MÉTRICAS ════════════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={BarChart3} title="Métricas do Sistema" subtitle="Dimensionamento técnico do que foi desenvolvido e entregue" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {METRICAS.map(m => {
                            const Icon = m.icon;
                            return (
                                <div key={m.label} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 hover:bg-blue-50 hover:ring-blue-200 transition-all">
                                    <Icon className="w-5 h-5 text-blue-600 mb-2" />
                                    <span className="text-2xl font-black text-slate-900">{m.value}</span>
                                    <span className="text-xs text-slate-500 mt-0.5 leading-tight text-center">{m.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ MÓDULOS ENTREGUES ═══════════════════════════════════════ */}
                {/* ✨ ÚLTIMAS INCLUSÕES E REVISÕES ✨ */}
                <CollapseSection title={`Últimas Inclusões e Revisões de Alta Performance (${NOVIDADES_REVISOES.length})`} icon={Sparkles} defaultOpen={true}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3.5">
                        {NOVIDADES_REVISOES.map(rev => {
                            const c = getColor(rev.color);
                            return (
                                <div key={rev.label} className={`flex flex-col justify-between p-4 rounded-xl ring-1 ${c.ring} ${c.bg} transition-all hover:shadow-md break-inside-avoid`}>
                                    <div>
                                        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${rev.status === 'Inclusão' ? 'bg-indigo-600' : rev.status === 'Otimização' ? 'bg-amber-600' : 'bg-blue-600'}`}>
                                                    {rev.status}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white/70 px-2 py-0.5 rounded-md ring-1 ring-slate-200">
                                                    {rev.categoria}
                                                </span>
                                            </div>
                                            <span className="text-xs font-mono text-slate-600 bg-white/60 px-2 py-0.5 rounded-md ring-1 ring-slate-200">{rev.date}</span>
                                        </div>
                                        <p className={`text-sm font-bold ${c.text}`}>{rev.label}</p>
                                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{rev.desc}</p>
                                    </div>
                                    {rev.destaques && (
                                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                                            {rev.destaques.map((dest, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded-md ring-1 ring-slate-200">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                    {dest}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CollapseSection>

                <CollapseSection title={`Módulos Entregues e Capacidades Operacionais (${MODULOS.length})`} icon={Package} defaultOpen={true}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {MODULOS.map(mod => (
                            <ModuloCard key={mod.id} mod={mod} />
                        ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-xs font-semibold text-emerald-700">
                            Todos os {MODULOS.length} módulos entregues, testados e operacionais em ambiente de produção.
                        </p>
                    </div>
                </CollapseSection>

                {/* ═══ INTEGRAÇÕES ════════════════════════════════════════════ */}
                <CollapseSection title={`Integrações Ativas (${INTEGRACOES.length})`} icon={Link2} defaultOpen={true}>
                    <div className="mt-2 space-y-3">
                        {INTEGRACOES.map(intg => {
                            const c = getColor(intg.color);
                            return (
                                <div key={intg.nome} className={`p-4 rounded-xl ring-1 ${c.ring} ${c.bg}`}>
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className={`text-sm font-bold ${c.text}`}>{intg.nome}</p>
                                            <p className={`text-xs font-medium opacity-70 ${c.text} mt-0.5`}>{intg.tipo}</p>
                                        </div>
                                        <StatusBadge />
                                    </div>
                                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">{intg.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </CollapseSection>

                {/* ═══ AUTOMAÇÕES ═════════════════════════════════════════════ */}
                <CollapseSection title={`Automações Agendadas (${AUTOMACOES.length})`} icon={Zap} defaultOpen={true}>
                    <div className="mt-2 space-y-2">
                        {AUTOMACOES.map(auto => (
                            <div key={auto.nome} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <div className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold whitespace-nowrap shrink-0">
                                    {auto.horario}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{auto.nome}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{auto.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 italic">
                        * Todas as automações respeitam o calendário de dias úteis e feriados configurados no sistema.
                    </p>
                </CollapseSection>

                {/* ═══ SEGURANÇA ══════════════════════════════════════════════ */}
                <CollapseSection title="Segurança Implementada & Conformidade" icon={Shield} defaultOpen={false}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {[
                            { label: 'Autenticação Robusta', desc: 'JWT com expiração de 8 horas por sessão e renovação automática' },
                            { label: 'Criptografia de Senhas', desc: 'bcrypt com 10 rounds de hash — sem senhas em texto claro' },
                            { label: 'Autorização RBAC Granular', desc: 'Controle de 4 ações por página: can_view, can_create, can_edit, can_delete' },
                            { label: 'CORS & Origens Autorizadas', desc: 'Lista branca restrita — apenas domínios e IPs homologados' },
                            { label: 'Upload Seguro de Arquivos', desc: 'Validação de tipo MIME e limitação de tamanho em todas as rotas' },
                            { label: 'Proteção Path Traversal', desc: 'Sanitização rigorosa contra acesso a diretórios externos' },
                            { label: 'AI Error Tracker', desc: 'Middleware com IA analisa automaticamente exceções 500 em tempo de execução' },
                            { label: 'Compressão HTTP (Gzip)', desc: 'Compressão ativa em todas as rotas da API com redução de tráfego' },
                        ].map(item => (
                            <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapseSection>

                {/* ═══ PERFIS DE USUÁRIO DETALHADOS ═════════════════════════════ */}
                <CollapseSection title={`Perfis de Usuários & Matriz de Controle de Acesso (RBAC) (${PERFIS_USUARIOS.length})`} icon={Users} defaultOpen={true}>
                    <div className="mt-2 space-y-3">
                        <div className="p-3.5 rounded-xl bg-blue-50/70 ring-1 ring-blue-200 flex items-start gap-3 mb-2">
                            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-900 leading-relaxed">
                                <strong className="font-bold">Arquitetura de Permissões RBAC (Role-Based Access Control):</strong> O sistema opera sob uma matriz de segurança por usuário e perfil, permitindo controle individual por rota sobre quatro níveis de ação (<strong>Visualizar</strong>, <strong>Criar</strong>, <strong>Editar</strong> e <strong>Excluir</strong>), além do isolamento de dados confidenciais (valores em R$) e portais externos restritos.
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3.5">
                            {PERFIS_USUARIOS.map(item => {
                                const c = getColor(item.color);
                                return (
                                    <div key={item.codigo} className={`flex flex-col justify-between p-4 rounded-xl ring-1 ${c.ring} ${c.bg} break-inside-avoid shadow-sm hover:shadow-md transition-all`}>
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                                        {item.destaque}
                                                    </span>
                                                    <h3 className={`text-sm font-bold ${c.text} leading-tight`}>{item.nome}</h3>
                                                </div>
                                                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                                                    {item.nivel}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                                        </div>

                                        {item.permissoes && item.permissoes.length > 0 && (
                                            <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1">
                                                {item.permissoes.map((p, idx) => (
                                                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                                                        <span className="leading-tight">{p}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 italic">
                        * Novos perfis e permissões granulares por tela podem ser criados a qualquer momento pelo Administrador através do painel de Configurações sem necessidade de novas compilações ou alterações de código.
                    </p>
                </CollapseSection>

                {/* ═══ INFRAESTRUTURA ═════════════════════════════════════════ */}
                <CollapseSection title="Infraestrutura e Operação" icon={Server} defaultOpen={false}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {[
                            { label: 'Servidor de Produção', value: 'Linux (Ubuntu Server) — IP 192.168.1.77' },
                            { label: 'Gerenciador de Processos', value: 'PM2 em cluster — restart e watchdog automáticos' },
                            { label: 'Porta de Serviço', value: '3001 (interno) | 443 HTTPS SSL/TLS (externo)' },
                            { label: 'Script de Deploy Contínuo', value: 'sync-deployment.ps1 (PowerShell Automatizado)' },
                            { label: 'Bancos de Dados', value: 'PostgreSQL (TOTVS Protheus) + MySQL (Aplicação/Hostinger)' },
                            { label: 'Comunicação em Tempo Real', value: 'WebSockets (Socket.io) para chão de fábrica e SolidEdge' },
                            { label: 'Pools de Conexão & Cache', value: 'Pools dedicados com retry e cache de ocupação em memória' },
                            { label: 'Agente de Impressão Industrial', value: 'Print Agent Windows PPLB/EPL2 para impressoras térmicas' },
                            { label: 'Inteligência Artificial', value: 'Google Gemini Pro 1.5/Flash integrado para extração e chat' },
                            { label: 'Monitoramento & Health Check', value: 'Endpoint /health ativo e AI Error Tracker com diagnóstico de 500' },
                        ].map(item => (
                            <div key={item.label} className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                                <p className="text-sm font-bold text-slate-800 mt-0.5">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </CollapseSection>

                {/* ═══ ASSINATURA ══════════════════════════════════════════════ */}
                <div className={`rounded-2xl shadow-sm border p-6 print:shadow-none ${
                    isClosed
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-white border-slate-200'
                }`}>
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                        <SectionHeader
                            icon={isClosed ? Lock : FileText}
                            title="Aceite de Entrega"
                            subtitle={isClosed
                                ? 'Processo finalizado e permanentemente bloqueado'
                                : 'Assinatura eletrônica das partes responsáveis pelo projeto'}
                        />
                        {isClosed && (
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-sm no-print">
                                <Lock className="w-3.5 h-3.5" />
                                Entrega Selada
                            </span>
                        )}
                    </div>

                    {/* Sealed banner */}
                    {isClosed && (
                        <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 ring-2 ring-emerald-500/40 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Lock className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-emerald-300 uppercase tracking-wider">Processo Bloqueado Permanentemente</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Ambas as partes assinaram eletronicamente. Este documento não pode mais ser alterado.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Status bar (partial signing) */}
                    {!isClosed && (signFornecedor || signCliente) && (
                        <div className="mb-4 p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center gap-2">
                            <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <p className="text-xs font-semibold text-emerald-700">
                                {signFornecedor && signCliente
                                    ? 'Documento assinado por ambas as partes — aceite de entrega concluído.'
                                    : signFornecedor
                                    ? 'Aguardando assinatura do Cliente.'
                                    : 'Aguardando assinatura do Fornecedor.'}
                            </p>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-6 mt-2">
                        <SignatureBlock
                            label="Fornecedor"
                            organization="LynxEMS Sistemas"
                            role="Time de Desenvolvimento"
                            signatureData={signFornecedor}
                            onClickSign={() => setSignModal('fornecedor')}
                        />
                        <SignatureBlock
                            label="Cliente"
                            organization="Metalfisa Indústria"
                            role="Responsável pelo Recebimento"
                            signatureData={signCliente}
                            onClickSign={() => setSignModal('cliente')}
                        />
                    </div>

                    {/* Rodapé */}
                    <div id="relatorio-footer-oficial" className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-300 break-inside-avoid flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <p className="text-slate-600 font-medium text-center sm:text-left">
                            <strong className="text-slate-900">MetalFisa ERP</strong> · {SYSTEM_VERSION} · Entrega: {DELIVERY_DATE} · Desenvolvido por <strong className="text-slate-900">LynxEMS Sistemas</strong>
                        </p>
                        <div className="flex items-center gap-4 text-[10px] uppercase font-bold text-slate-500 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span>Rubrica Fornecedor:</span>
                                <span className="w-16 border-b border-slate-500 inline-block h-2"></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span>Rubrica Cliente:</span>
                                <span className="w-16 border-b border-slate-500 inline-block h-2"></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fim do relatorio-body-oficial */}
                </div>

                {/* Fim da área imprimível */}
                </div>

                {/* Botão PDF flutuante (mobile) */}
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 no-print sm:hidden">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-semibold text-sm shadow-2xl hover:bg-blue-700 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                    </button>
                </div>

            </div>
        </div>
    );
}
