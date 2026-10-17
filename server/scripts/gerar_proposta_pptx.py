import os
import sys
import json
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_proposal_presentation(data, output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    blank_layout = prs.slide_layouts[6]
    
    # Paleta de Cores Suaves e Leves (Sinco Executive Light)
    BG_COLOR = RGBColor(248, 250, 252)        # #F8FAFC
    CARD_BG = RGBColor(255, 255, 255)         # #FFFFFF
    CARD_BORDER = RGBColor(226, 232, 240)     # #E2E8F0
    TEXT_MAIN = RGBColor(30, 41, 37)          # #1E2925 (Verde Ardósia Escuro)
    TEXT_MUTED = RGBColor(100, 116, 139)      # #64748B (Slate médio)
    TEXT_LIGHT = RGBColor(148, 163, 184)      # #94A3B8
    BRAND_FOREST = RGBColor(37, 68, 56)       # #254438 (Verde Floresta institucional)
    BRAND_SAGE = RGBColor(16, 149, 106)       # #10956A (Verde Sálvia)
    BRAND_LIME = RGBColor(184, 194, 10)       # #B8C20A (Lima suave institucional)
    TINT_GREEN_BG = RGBColor(236, 253, 245)   # #ECFDF5 (Fundo leve esmeralda)

    cliente_nome = data.get("cliente_nome", "Cliente")
    codigo = data.get("codigo", "PROP-2026")
    revisao = data.get("revisao", "Rev 00")
    titulo = data.get("titulo", "Implementação do Ecossistema SINCO")
    url_ambiente = data.get("url_ambiente", f"https://{cliente_nome.lower().replace(' ', '')}.lynxems.com.br")

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, category_text, title_text, subtitle_text=""):
        bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.45), Inches(11.733), Inches(0.85))
        bar.fill.solid()
        bar.fill.fore_color.rgb = CARD_BG
        bar.line.color.rgb = CARD_BORDER
        bar.line.width = Pt(1)
        
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(0.62), Inches(2.4), Inches(0.35))
        pill.fill.solid()
        pill.fill.fore_color.rgb = TINT_GREEN_BG
        pill.line.color.rgb = BRAND_SAGE
        pill.line.width = Pt(1)
        tf_pill = pill.text_frame
        p_pill = tf_pill.paragraphs[0]
        p_pill.text = category_text.upper()
        p_pill.font.size = Pt(8.5)
        p_pill.font.bold = True
        p_pill.font.color.rgb = BRAND_SAGE
        p_pill.alignment = PP_ALIGN.CENTER
        
        tx_box = slide.shapes.add_textbox(Inches(3.55), Inches(0.50), Inches(6.6), Inches(0.45))
        tf = tx_box.text_frame
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = TEXT_MAIN
        
        if subtitle_text:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle_text
            p_sub.font.size = Pt(9.0)
            p_sub.font.color.rgb = TEXT_MUTED
            
        lynx_badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.5), Inches(0.60), Inches(1.8), Inches(0.38))
        lynx_badge.fill.solid()
        lynx_badge.fill.fore_color.rgb = BRAND_FOREST
        lynx_badge.line.fill.background()
        tf_lynx = lynx_badge.text_frame
        p_lynx = tf_lynx.paragraphs[0]
        p_lynx.text = "LYNX EMS • SINCO"
        p_lynx.font.size = Pt(8.5)
        p_lynx.font.bold = True
        p_lynx.font.color.rgb = RGBColor(249, 248, 243)
        p_lynx.alignment = PP_ALIGN.CENTER

    def add_footer(slide, current_page, total_pages=13):
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.9), Inches(11.733), Inches(0.01))
        line.fill.solid()
        line.fill.fore_color.rgb = CARD_BORDER
        line.line.fill.background()
        
        tb_left = slide.shapes.add_textbox(Inches(0.8), Inches(6.95), Inches(7.0), Inches(0.35))
        p_l = tb_left.text_frame.paragraphs[0]
        p_l.text = f"Proposta Técnico-Comercial • {codigo} ({revisao}) • {cliente_nome}"
        p_l.font.size = Pt(8.5)
        p_l.font.color.rgb = TEXT_LIGHT
        
        tb_right = slide.shapes.add_textbox(Inches(9.5), Inches(6.95), Inches(3.0), Inches(0.35))
        p_r = tb_right.text_frame.paragraphs[0]
        p_r.text = f"Página {current_page} de {total_pages} | Confidencial"
        p_r.font.size = Pt(8.5)
        p_r.font.color.rgb = TEXT_LIGHT
        p_r.alignment = PP_ALIGN.RIGHT

    def create_card(slide, left, top, width, height, title, items, tag="", border_color=CARD_BORDER, bg_color=CARD_BG, title_size=12, item_size=9.5):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.18)
        tf.margin_bottom = Inches(0.18)
        
        if tag:
            p_tag = tf.paragraphs[0]
            p_tag.text = tag.upper()
            p_tag.font.size = Pt(8.0)
            p_tag.font.bold = True
            p_tag.font.color.rgb = BRAND_SAGE
            p_tag.space_after = Pt(3)
            p_title = tf.add_paragraph()
        else:
            p_title = tf.paragraphs[0]
            
        p_title.text = title
        p_title.font.size = Pt(title_size)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_MAIN
        p_title.space_after = Pt(6)
        
        for item in items:
            p_item = tf.add_paragraph()
            p_item.text = f"•  {item}"
            p_item.font.size = Pt(item_size)
            p_item.font.color.rgb = TEXT_MUTED
            p_item.space_after = Pt(3)
            
        return card

    # =========================================================================
    # SLIDE 1: CAPA EXECUTIVA
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)
    
    cover_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(0.8), Inches(10.933), Inches(5.8))
    cover_box.fill.solid()
    cover_box.fill.fore_color.rgb = CARD_BG
    cover_box.line.color.rgb = CARD_BORDER
    cover_box.line.width = Pt(1.5)
    
    tag_top = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.8), Inches(1.2), Inches(5.0), Inches(0.4))
    tag_top.fill.solid()
    tag_top.fill.fore_color.rgb = TINT_GREEN_BG
    tag_top.line.color.rgb = BRAND_SAGE
    p_tt = tag_top.text_frame.paragraphs[0]
    p_tt.text = f"PROPOSTA TÉCNICO-COMERCIAL • {revisao.upper()}"
    p_tt.font.size = Pt(10)
    p_tt.font.bold = True
    p_tt.font.color.rgb = BRAND_SAGE
    p_tt.alignment = PP_ALIGN.CENTER
    
    tb_cov = s1.shapes.add_textbox(Inches(1.8), Inches(1.8), Inches(9.5), Inches(3.2))
    tf_c = tb_cov.text_frame
    tf_c.word_wrap = True
    
    p1 = tf_c.paragraphs[0]
    p1.text = f"Implementação do Ecossistema\nSINCO"
    p1.font.size = Pt(32)
    p1.font.bold = True
    p1.font.color.rgb = BRAND_FOREST
    p1.space_after = Pt(10)
    
    p2 = tf_c.add_paragraph()
    p2.text = f"Digitalização de ponta a ponta da operação de campo, chão de fábrica, SGQ (ISO 9001) e SST para a {cliente_nome}."
    p2.font.size = Pt(13)
    p2.font.color.rgb = TEXT_MUTED
    p2.space_after = Pt(18)
    
    p3 = tf_c.add_paragraph()
    p3.text = f"PILARES COBERTOS:  SST Industrial • SGQ & Data Book • Chão de Fábrica • RDO Campo • Solicitações • Conexão Universal ERP"
    p3.font.size = Pt(9.5)
    p3.font.bold = True
    p3.font.color.rgb = BRAND_SAGE
    p3.space_after = Pt(12)

    p4 = tf_c.add_paragraph()
    p4.text = f"Cliente: {cliente_nome.upper()} ({data.get('setor', 'Engenharia & Indústria')})   |   Ambiente: {url_ambiente}"
    p4.font.size = Pt(10.5)
    p4.font.bold = True
    p4.font.color.rgb = TEXT_MAIN

    add_footer(s1, 1, 13)

    # =========================================================================
    # SLIDE 2: CONTEXTO CORPORATIVO & DIAGNÓSTICO
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "Contexto Corporativo", f"A Operação da {cliente_nome} & Alinhamento Estratégico", "Diagnóstico e oportunidades identificadas para o ecossistema Sinco")
    
    create_card(s2, 0.8, 1.5, 3.65, 5.1, "Cenário Operacional", [
        f"Atuação consolidada no segmento de {data.get('setor', 'engenharia e indústria')}.",
        "Exigência de precisão técnica e pontualidade na entrega.",
        "Equipes alocadas em múltiplos postos de trabalho e obras.",
        "Demanda por comunicação ágil e sem ruídos entre canteiros e matriz."
    ], tag="Perfil da Empresa")

    create_card(s2, 4.8, 1.5, 3.65, 5.1, "Desafios de Governança", [
        "Eliminação definitiva de controles manuais e planilhas paralelas.",
        "Conformidade rigorosa com normas de segurança do trabalho (SST).",
        "Atendimento contínuo aos requisitos da certificação ISO 9001.",
        "Acesso à informação em tempo real para tomada de decisão ágil."
    ], tag="Oportunidades de Melhoria")

    create_card(s2, 8.8, 1.5, 3.65, 5.1, "Objetivo da Solução", [
        f"Implantação sob medida do Ecossistema SINCO para a {cliente_nome}.",
        "Mobilidade real para apontamentos de campo e chão de fábrica.",
        "Rastreabilidade de ponta a ponta na nuvem.",
        "Infraestrutura 100% gerenciada pela Lynx no modelo SaaS."
    ], tag="Parceria Lynx", border_color=BRAND_SAGE)
    
    add_footer(s2, 2, 13)

    # =========================================================================
    # SLIDE 3: O ECOSSISTEMA SINCO - ARQUITETURA EM 4 CAMADAS
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Tecnologia Sinco", "O Que é o Ecossistema SINCO", "A camada de mobilidade e inteligência operacional compatível com qualquer ERP (Protheus, Omie, Sankhya, etc.)")

    create_card(s3, 0.8, 1.5, 2.75, 5.1, "PWA Mobile de Campo", [
        "Interface tátil pensada para tablets e smartphones dos operadores.",
        "Apontamentos rápidos de diários de obra e requisições sem burocracia.",
        "Modo offline híbrido com sincronização automática.",
        "Operação simplificada para operadores e encarregados."
    ], tag="Camada 1 • Campo")

    create_card(s3, 3.8, 1.5, 2.75, 5.1, "Cockpit Web Matriz", [
        "Central de comando para gerentes, engenheiros e diretoria.",
        "Acompanhamento em tempo real do avanço físico e pendências.",
        "Dashboards de produtividade fabril, SST e qualidade.",
        "Relatórios executivos e gráficos consolidados."
    ], tag="Camada 2 • Gestão")

    create_card(s3, 6.8, 1.5, 2.75, 5.1, "Conexão Universal com ERPs", [
        "Barramento nativo com qualquer ERP (Protheus, Omie, Sankhya, etc.).",
        "Aproveitamento integral de cadastros de OPs, clientes e produtos.",
        "Eliminação de redigitação de informações.",
        "Sem necessidade de customizações invasivas no ERP de origem."
    ], tag="Camada 3 • ERP")

    create_card(s3, 9.8, 1.5, 2.75, 5.1, "Segurança & Auditoria", [
        "Controle granular de acessos por perfil de usuário.",
        "Trilha de auditoria completa em todas as operações.",
        "Criptografia SSL ponta a ponta e redundância.",
        "Conformidade com normas de governança corporativa."
    ], tag="Camada 4 • Cloud", border_color=BRAND_SAGE)

    add_footer(s3, 3, 13)

    # =========================================================================
    # SLIDES OPERACIONAIS (4 a 7): ADERÊNCIA AO ESCOPO DO CLIENTE
    # =========================================================================
    is_delta = 'delta' in cliente_nome.lower() or 'fixador' in str(data.get('setor', '')).lower()

    if is_delta:
        # SLIDE 4: FABRICAÇÃO DE FIXADORES & CHÃO DE FÁBRICA TOUCH
        s4 = prs.slides.add_slide(blank_layout)
        set_slide_background(s4)
        add_header(s4, "Módulo Operacional • Fábrica", "Módulo Fabricação de Fixadores & Chão de Fábrica Touch (MES & PCP)", "Controle em tempo real de cabeceamento, prensas, laminação de rosca e OPs")

        create_card(s4, 0.8, 1.5, 5.7, 2.45, "Apontamento Operacional Touch", [
            "Telas simplificadas nas cabeceadoras automáticas, prensas e laminadoras de rosca.",
            "Início, pausas e conclusão de bateladas com leitor de código de barras das OPs.",
            "Eliminação definitiva de fichas manuais de produção em papel e retrabalho."
        ], tag="Chão de Fábrica Touch", border_color=BRAND_SAGE)

        create_card(s4, 6.8, 1.5, 5.7, 2.45, "Tempo Padrão vs. Tempo Real", [
            "Cadência automática de batelada em peças/minuto por máquina e operador.",
            "Aferição do tempo de setup de ferramental e matrizes de cabeceamento.",
            "Apuração precisa do custo homem-máquina real por milheiro produzido."
        ], tag="Produtividade Fabril", border_color=BRAND_FOREST)

        create_card(s4, 0.8, 4.15, 5.7, 2.45, "Esteira Produtiva Visual (Kanban Fabril)", [
            "Visibilidade total das OPs: Matéria-Prima, Cabeceamento, Rosca, Banho e Embalagem.",
            "Alertas automáticos para o PCP sobre gargalos em postos de laminação e prensas.",
            "Previsão confiável de datas de entrega e sincronização com faturamento."
        ], tag="Kanban de Fixadores")

        create_card(s4, 6.8, 4.15, 5.7, 2.45, "Gestão de Sucata, Refugo & OP Fracionada", [
            "Apontamento de perdas de aço, quebra de punções e causas de parada de máquina.",
            "OP Fracionada: divisão de lotes volumosos em caixas e paletes identificados.",
            "Rastreabilidade por código de barras em toda a movimentação interna da fábrica."
        ], tag="Expedição & Custos", border_color=BRAND_SAGE)

        add_footer(s4, 4, 13)

        # SLIDE 5: SGQ & LABORATÓRIO DA QUALIDADE
        s5 = prs.slides.add_slide(blank_layout)
        set_slide_background(s5)
        add_header(s5, "Módulo Operacional • SGQ", "Módulo SGQ & Laboratório da Qualidade: Suporte à ISO 9001 e PPAP", "Inspeções dimensionais de rosca, ensaios mecânicos e emissão de laudos de entrega")

        create_card(s5, 0.8, 1.5, 5.7, 2.45, "FIP e FIQ Digitais no Posto de Trabalho", [
            "Inspeções com calibradores passa/não-passa de rosca (6g/6H) e projetores de perfil.",
            "Tolerâncias dimensionais de altura/chave da cabeça, diâmetro primitivo e corpo.",
            "Liberação formal pelo inspetor do SGQ antes do avanço para tratamentos."
        ], tag="Inspeções Dimensionais", border_color=BRAND_SAGE)

        create_card(s5, 6.8, 1.5, 5.7, 2.45, "Ensaios Mecânicos por Lote de Produção", [
            "Lançamento de dureza superficial e núcleo (HRC/HRB), torque de aperto e tração.",
            "Atendimento a fixadores de alta resistência (Classes 8.8, 10.9, 12.9, ASTM e DIN).",
            "Armazenamento seguro dos registros de ensaios vinculados à OP de fabricação."
        ], tag="Laboratório Mecânico", border_color=BRAND_FOREST)

        create_card(s5, 0.8, 4.15, 5.7, 2.45, "Rastreabilidade Lote ↔ Corrida do Aço", [
            "Vínculo direto e inquebrável do lote faturado com a corrida do aço da usina.",
            "Certificado de matéria-prima (composição química e mecânica) anexado à OP.",
            "Histórico completo auditável em caso de auditoria de clientes contratantes."
        ], tag="Rastreabilidade do Aço")

        create_card(s5, 6.8, 4.15, 5.7, 2.45, "Gestão de RNCs & Certificado em 1 Clique", [
            "Abertura de RNCs com fotos de trincas de forjamento e metodologia 5W2H/Ishikawa.",
            "Controle metrológico de calibração de paquímetros, micrômetros e torquímetros.",
            "Emissão instantânea do Certificado de Qualidade / Data Book em PDF com a nota fiscal."
        ], tag="Qualidade Automatizada", border_color=BRAND_SAGE)

        add_footer(s5, 5, 13)

        # SLIDE 6: SUPRIMENTOS & AUDITORIA 3-WAY MATCHING
        s6 = prs.slides.add_slide(blank_layout)
        set_slide_background(s6)
        add_header(s6, "Módulo Operacional • Suprimentos", "Módulo Suprimentos, Matéria-Prima & Auditoria 3-Way Matching", "Recebimento inteligente de arames/bobinas e controle de insumos industriais críticos")

        create_card(s6, 0.8, 1.5, 5.7, 2.45, "Confronto Triplo Automático (3-Way Matching)", [
            "Cruzamento automático do XML da NF do fornecedor de aço com o Pedido de Compra.",
            "Conferência física de peso bruto/líquido e amarração com a corrida do arame.",
            "Validação automática de impostos e tributações antes da escrituração contábil."
        ], tag="Entrada de Aço", border_color=BRAND_SAGE)

        create_card(s6, 6.8, 1.5, 5.7, 2.45, "Gestão de Matrizes, Punções & Pentes de Rosca", [
            "Rastreamento de vida útil de ferramentas de conformação e matrizes de metal duro.",
            "Controle de estoque de pentes de laminação, punções de impacto e óleos de corte.",
            "Previsão de reposição preventiva evitando paradas de máquina não planejadas."
        ], tag="Ferramental Crítico", border_color=BRAND_FOREST)

        create_card(s6, 0.8, 4.15, 5.7, 2.45, "Requisições Internas Digitais", [
            "Solicitação ágil de insumos e ferramentas pelos operadores de linha.",
            "Alçadas de aprovação entre encarregado de fábrica e almoxarifado central.",
            "Fim de bilhetes manuais e garantia de entrega controlada por centro de trabalho."
        ], tag="Almoxarifado Ágil")

        create_card(s6, 6.8, 4.15, 5.7, 2.45, "Controle de Estoque & Saldos", [
            "Visão precisa de estoques de fio máquina, arames trefilados e parafusos prontos.",
            "Rastreamento de lotes acabados separados por cliente, bitola e tratamento.",
            "Inventário rotativo facilitado por leitor de código de barras."
        ], tag="Gestão de Estoques", border_color=BRAND_SAGE)

        add_footer(s6, 6, 13)

        # SLIDE 7: LOGÍSTICA, BENEFICIAMENTO EXTERNO & ROMANEIOS
        s7 = prs.slides.add_slide(blank_layout)
        set_slide_background(s7)
        add_header(s7, "Módulo Operacional • Logística", "Módulo Logística, Beneficiamento Externo & Romaneios", "Controle de etapas externas (têmpera/zincagem) e expedição com romaneio eletrônico")

        create_card(s7, 0.8, 1.5, 5.7, 5.1, "Beneficiamento Externo & Romaneios de Remessa", [
            "Controle rigoroso de lotes enviados para tratamento térmico terceirizado.",
            "Romaneios de remessa para banhos de zincagem, galvanoplastia e Delta Protekt.",
            "Acompanhamento em tempo real do saldo de materiais em poder de terceiros.",
            "Recebimento de retorno de terceiros com conferência de pesagem e laudo de camada.",
            "Reincorporação automática do lote na esteira fabril após inspeção do SGQ."
        ], tag="Beneficiamento Externo", border_color=BRAND_SAGE)

        create_card(s7, 6.8, 1.5, 5.7, 5.1, "Romaneio de Expedição & Trava SGQ", [
            "Emissão eletrônica de romaneios de carga para clientes finais e transportadoras.",
            "Conferência cega com leitor óptico das caixas, embalagens e pesagem líquida/bruta.",
            "Bloqueio automático: nenhum item pode ser despachado sem liberação formal do SGQ.",
            "Ficha Digital de EPI (NR-06) e Checklists Diários de Segurança em Prensas (NR-12).",
            "Blindagem operacional completa e garantia de satisfação dos clientes da Delta."
        ], tag="Expedição & Qualidade", border_color=BRAND_FOREST)

        add_footer(s7, 7, 13)

    else:
        # SLIDES PADRÃO IRRICOM (SST, SGQ, FÁBRICA, CAMPO)
        s4 = prs.slides.add_slide(blank_layout)
        set_slide_background(s4)
        add_header(s4, "Módulo Operacional • SST", "Módulo SST Industrial: Gestão Digital de Compliance e Risco", "Garantindo compliance total em áreas industriais e atendimento rigoroso a normas")

        create_card(s4, 0.8, 1.5, 5.7, 2.45, "DDS Digital & Assinatura na Tela", [
            "Diálogo Diário de Segurança preenchido pelo celular do encarregado.",
            "Assinatura digital na tela e captura fotográfica do time reunido.",
            "Eliminação total de fichas de presença em papel e extravios."
        ], tag="DDS Digital", border_color=BRAND_SAGE)

        create_card(s4, 6.8, 1.5, 5.7, 2.45, "APR & Permissão de Trabalho (PT / PET)", [
            "Liberação digital para atividades críticas (NR-35 altura, NR-10 elétrica, NR-33 confinamento).",
            "Validação obrigatória de pré-requisitos antes de liberar a frente de serviço.",
            "Histórico digital auditável para auditorias de segurança e clientes contratantes."
        ], tag="Permissão de Trabalho", border_color=BRAND_FOREST)

        create_card(s4, 0.8, 4.15, 5.7, 2.45, "Checklists com Fotos Obrigatórias", [
            "Vistorias pré-operacionais de caminhões munck, guindastes, compressores e ferramentas.",
            "Registro fotográfico obrigatório de inconformidades e bloqueio de máquinas.",
            "Comprovação jurídica imediata em caso de fiscalização."
        ], tag="Checklists Pré-Operacionais")

        create_card(s4, 6.8, 4.15, 5.7, 2.45, "Gestão de NRs, ASOs & Indicador HHT", [
            "Alertas preventivos com 30 dias de antecedência para reciclagens de NRs e ASOs.",
            "Registro instantâneo de quase-acidentes e condições inseguras.",
            "Cálculo automático de Horas-Homem Trabalhadas (HHT) e Taxa de Gravidade."
        ], tag="Governança de SST", border_color=BRAND_SAGE)

        add_footer(s4, 4, 13)

        s5 = prs.slides.add_slide(blank_layout)
        set_slide_background(s5)
        add_header(s5, "Módulo Operacional • SGQ", "Módulo SGQ: Suporte à ISO 9001 e Rastreabilidade Total", "Digitalização de inspeções de qualidade e compilação de Data Books para clientes")

        create_card(s5, 0.8, 1.5, 5.7, 2.45, "FIP e FIQ Digitais no Posto de Trabalho", [
            "Fichas de Inspeção de Processo e Qualidade com critérios e tolerâncias dimensionais.",
            "Ensaios não destrutivos (líquido penetrante, visual de solda) com evidência fotográfica.",
            "Liberação formal pelo inspetor antes do avanço para a próxima etapa produtiva."
        ], tag="Inspeções Digitais", border_color=BRAND_SAGE)

        create_card(s5, 6.8, 1.5, 5.7, 2.45, "Gestão de RNCs com 5W2H e Ishikawa", [
            "Abertura ágil de Não Conformidades na fábrica ou na obra de montagem.",
            "Análise de causa-raiz estruturada (Espinha de Peixe / Ishikawa).",
            "Plano de ação corretivo com metodologia 5W2H, responsáveis e prazos."
        ], tag="Tratativa de RNCs", border_color=BRAND_FOREST)

        create_card(s5, 0.8, 4.15, 5.7, 2.45, "Rastreabilidade por QR Code & Certificados", [
            "Identificação unitária das peças e conjuntos soldados via etiqueta QR Code resistente.",
            "Vinculação direta com o certificado de corrida do aço da usina siderúrgica.",
            "Rastreio do soldador qualificado responsável por cada junta soldada."
        ], tag="Rastreabilidade Unitária")

        create_card(s5, 6.8, 4.15, 5.7, 2.45, "Calibração & Data Book em 1 Clique", [
            "Controle metrológico de paquímetros, torquímetros e manômetros com alertas de aferição.",
            "Emissão automatizada do Data Book completo da obra em 1 clique.",
            "Atendimento imediato e sem atrasos para grandes mineradoras e indústrias."
        ], tag="Data Book Automatizado", border_color=BRAND_SAGE)

        add_footer(s5, 5, 13)

        s6 = prs.slides.add_slide(blank_layout)
        set_slide_background(s6)
        add_header(s6, "Módulo Operacional • Fábrica", "Módulo Gestão Fabril: Chão de Fábrica e PCP em Tempo Real", "Terminais industriais touch nos postos produtivos e sincronização com OPs do Protheus")

        create_card(s6, 0.8, 1.5, 5.7, 2.45, "Apontamento Operacional Touch", [
            "Telas industriais touch nos centros de corte, dobra, solda, pintura e montagem.",
            "Início, pausa e conclusão de operações via leitor de código de barras das OPs.",
            "Eliminação de fichas de produção em papel e atrasos de digitação."
        ], tag="Chão de Fábrica Touch", border_color=BRAND_SAGE)

        create_card(s6, 6.8, 1.5, 5.7, 2.45, "Tempo Padrão vs. Tempo Real", [
            "Comparativo automático entre o tempo previsto na engenharia e o tempo real apontado.",
            "Aferição da eficiência operacional e OEE por operador, equipe e posto.",
            "Apuração precisa do custo real de fabricação de cada estrutura."
        ], tag="Produtividade Fabril", border_color=BRAND_FOREST)

        create_card(s6, 0.8, 4.15, 5.7, 2.45, "Esteira Produtiva Visual (Kanban Fabril)", [
            "Visibilidade em tempo real das OPs: Matéria-Prima, Fabricação, SGQ e Liberado.",
            "Alertas automáticos para o PCP sobre gargalos em postos críticos.",
            "Previsão confiável de datas de entrega para faturamento."
        ], tag="Kanban de Produção")

        create_card(s6, 6.8, 4.15, 5.7, 2.45, "Romaneio de Expedição & Gestão de Refugo", [
            "Conferência cega por leitor óptico na expedição: zero itens faltantes no embarque.",
            "Apontamento e quantificação de perdas metálicas, sucatas e retrabalho.",
            "Garantia de que nada sai da fábrica para a obra sem estar inspecionado pelo SGQ."
        ], tag="Expedição & Custos", border_color=BRAND_SAGE)

        add_footer(s6, 6, 13)

        s7 = prs.slides.add_slide(blank_layout)
        set_slide_background(s7)
        add_header(s7, "Módulo Operacional • Campo", "Gestão de Campo (RDO Digital) & Solicitações Canteiro-Matriz", "Controle de canteiros remotos, segurança jurídica contratual e logística ágil")

        create_card(s7, 0.8, 1.5, 5.7, 5.1, "Gestão de Campo & RDO Digital", [
            "Diário de Obra (RDO) 100% Digital preenchido direto no celular na frente de serviço.",
            "Captura automática de clima (sol, chuva) e registro de efetivo presente por função.",
            "Avanço Físico Ponderado (% executado) com registro fotográfico georreferenciado.",
            "Relatório Formal de Paralisações por chuvas ou terceiros (essencial para pleitos/claims).",
            "Modo Offline Híbrido: preenchimento completo sem internet e sincronização automática.",
            "Painel geográfico de canteiros para acompanhamento em tempo real pela diretoria."
        ], tag="Canteiro de Obras", border_color=BRAND_SAGE)

        create_card(s7, 6.8, 1.5, 5.7, 5.1, "Solicitações de Campo Canteiro ↔ Matriz", [
            "Canal digital oficial para requisição de peças, consumíveis, EPIs e ferramentas.",
            "Eliminação definitiva de pedidos informais perdidos em mensagens de WhatsApp.",
            "Alçadas inteligentes de aprovação (Encarregado da Obra -> Coordenador -> Suprimentos).",
            "Timeline logística visual: Solicitado, Em Cotação, Em Separação, Despachado e Entregue.",
            "Comprovante digital de recebimento na obra com foto e assinatura do recebedor.",
            "Centralização de pedidos evitando compras em duplicidade e custos desnecessários."
        ], tag="Canal Oficial Canteiro-Matriz", border_color=BRAND_FOREST)

        add_footer(s7, 7, 13)

    # =========================================================================
    # SLIDE 8: FASE 2 - ROADMAP DE EXPANSÃO (MÓDULOS FUTUROS)
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "Roadmap • Fase 2", "Roadmap de Expansão (Módulos Futuros Pós-MVP)", "Evolução planejada do ecossistema após a consolidação da Fase 1")

    create_card(s8, 0.8, 1.5, 3.65, 5.1, "Catálogo Paramétrico & BOM", [
        "Cálculo de peso linear e consumo de arame por milheiro de parafusos.",
        "Biblioteca de perfis de cabeça (sextavada, allen, chata) e normas DIN/ISO.",
        "Roteiro de fabricação gerado automaticamente do desenho técnico.",
        "Integração de matrizes e parâmetros de conformação a frio."
    ], tag="Roadmap Futuro")

    create_card(s8, 4.8, 1.5, 3.65, 5.1, "Portal B2B do Cliente Delta", [
        "Acesso dedicado para clientes consultarem OPs em fabricação.",
        "Download direto de certificados de qualidade e ensaios metalúrgicos.",
        "Canal ágil para cotações e repetição de pedidos.",
        "Redução de chamados e atrito no atendimento comercial."
    ], tag="Roadmap Futuro")

    create_card(s8, 8.8, 1.5, 3.65, 5.1, "Custo Real por Milheiro / Batelada", [
        "Apropriação de matéria-prima, tempo de máquina e mão de obra.",
        "Consumo real de aço versus sucata gerada por batelada.",
        "DRE gerencial industrial em tempo real.",
        "Apuração da lucratividade real por tipo de fixador e cliente."
    ], tag="Roadmap Futuro", border_color=BRAND_SAGE)

    add_footer(s8, 8, 13)

    # =========================================================================
    # SLIDE 9: METODOLOGIA ÁGIL & IMPLANTAÇÃO
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)

    crono_g = data.get("investimento", {}).get("cronograma_pagamento", {}) or {}
    carencia_dias_g = crono_g.get("carencia_dias", 0)
    parcelas_setup_g = crono_g.get("parcelas_setup", [])
    tem_entrada_g = any(float(p.get("dias_apos_aceite", 0)) == 0 for p in parcelas_setup_g)

    metodologia_obj = data.get("metodologia", {})
    pilares = metodologia_obj.get("pilares", [])
    p1_title = pilares[0].get("titulo") if (pilares and len(pilares) > 0) else ("Imersão Inicial & Diagnóstico Fabril" if tem_entrada_g or carencia_dias_g == 0 else "Imersão de 60 Dias")
    p1_desc = pilares[0].get("descricao") if (pilares and len(pilares) > 0) else f"Adaptação contínua às rotinas reais e peculiaridades da {cliente_nome}."

    add_header(s9, "Metodologia Ágil", "A Metodologia LYNX: Inovação Ágil & Homologação Contínua", "Desenvolvimento profundo e orgânico, sem modelos tradicionais engessados")

    create_card(s9, 0.8, 1.5, 3.65, 5.1, p1_title, [
        f"Dedicação técnica intensiva da Lynx na fábrica da {cliente_nome}.",
        p1_desc,
        "Engenharia de software focada nos gargalos operacionais reais.",
        "Sem limites burocráticos de escopo fechado nesta fase inicial."
    ], tag="Dedicação Profunda", border_color=BRAND_SAGE)

    create_card(s9, 4.8, 1.5, 3.65, 5.1, "Aceleração de Valor", [
        "O sistema NÃO precisa estar 100% finalizado para começar a rodar.",
        "Liberação em ciclos curtos para uso imediato das equipes.",
        "Feedback prático vindo diretamente do campo e da fábrica.",
        "Ajustes rápidos de layout e regras de negócio em tempo real."
    ], tag="Uso Imediato")

    create_card(s9, 8.8, 1.5, 3.65, 5.1, "Foco na Assertividade", [
        "A realidade no chão de fábrica dita as prioridades do sistema.",
        "Garantia de que a ferramenta resolva dores reais sem atrito.",
        "Adesão natural dos colaboradores através de usabilidade simples.",
        "Implantação assertiva e com retorno sobre o investimento imediato."
    ], tag="Eficiência Real")

    add_footer(s9, 9, 13)

    # =========================================================================
    # SLIDE 10: CHECKPOINT AOS 60 DIAS (MARCO PILOTO)
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10)

    checkpoint_title = "Checkpoint de Avaliação & Homologação aos 60 Dias" if tem_entrada_g or carencia_dias_g == 0 else "Checkpoint de Avaliação aos 60 Dias"
    checkpoint_sub = "Validação prática da operação piloto no chão de fábrica e postos SGQ" if tem_entrada_g or carencia_dias_g == 0 else "Transparência total e validação prática de aderência antes da fase continuada"
    add_header(s10, "Governança do Projeto", checkpoint_title, checkpoint_sub)

    create_card(s10, 0.8, 1.5, 5.7, 5.1, "Relatório Técnico de Entrega", [
        "Aos 60 dias de implantação piloto, a Lynx emitirá um dossiê completo.",
        "Detalhamento do status e maturidade de cada módulo implementado.",
        "Volume de apontamentos realizados no chão de fábrica e postos SGQ.",
        "Mapeamento de gargalos eliminados e redução de processos manuais.",
        "Acompanha o marco da 1ª parcela de setup e avanço para homologação final."
    ], tag="Documentação Formal", border_color=BRAND_FOREST)

    create_card(s10, 6.8, 1.5, 5.7, 5.1, "Pesquisa de Satisfação & Validação", [
        f"Coleta formal de feedback com os líderes e equipes operacionais da {cliente_nome}.",
        "Avaliação prática da aderência da plataforma à rotina real fabril.",
        "Decisão segura, transparente e fundamentada para continuidade do ecossistema.",
        "Garantia de parceria de longo prazo baseada em resultados mensuráveis comprovados."
    ], tag="Validação do Cliente", border_color=BRAND_SAGE)

    add_footer(s10, 10, 13)

    # =========================================================================
    # SLIDE 11: INFRAESTRUTURA SAAS INCLUSA
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11)
    add_header(s11, "Infraestrutura SaaS", "Infraestrutura Tecnológica Gerenciada pela Lynx", f"A {cliente_nome} foca na fabricação de ponta; a Lynx cuida de toda a sustentação técnica")

    create_card(s11, 0.8, 1.5, 2.75, 5.1, "Domínio Exclusivo", [
        "Acesso dedicado via:",
        url_ambiente,
        "Ambiente web moderno, rápido e seguro.",
        "Criptografia SSL ponta a ponta em todas as conexões."
    ], tag="Acesso Web")

    create_card(s11, 3.8, 1.5, 2.75, 5.1, "Servidores & Nuvem", [
        "Servidor web e banco de dados em nuvem de alta disponibilidade.",
        "Monitoramento contínuo de uptime e desempenho.",
        f"Sem necessidade de servidores locais na {cliente_nome}."
    ], tag="Cloud Hosting")

    create_card(s11, 6.8, 1.5, 2.75, 5.1, "Backups Automáticos", [
        "Rotinas automáticas diárias de backup de segurança dos dados.",
        "Políticas de retenção segura e tolerância a falhas.",
        "Proteção total dos registros operacionais e relatórios."
    ], tag="Segurança de Dados")

    create_card(s11, 9.8, 1.5, 2.75, 5.1, "Manutenção & Evolução", [
        "Todo o custo de desenvolvimento contínuo incluso.",
        "Correções preventivas e melhorias contínuas de usabilidade.",
        "Suporte técnico especializado com a equipe da Lynx."
    ], tag="Suporte Contínuo", border_color=BRAND_SAGE)

    add_footer(s11, 11, 13)

    # =========================================================================
    # SLIDE 12: INVESTIMENTO - SETUP E SUSTENTAÇÃO MENSAL
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12)
    add_header(s12, "Condições Comerciais", "Investimento: Setup Inicial & Sustentação Mensal", "Valores transparentes, modelo justo de usuários ilimitados e sem surpresas contratuais")

    inv = data.get("investimento", {})
    setup = inv.get("setup_fase_agil", {})
    m1_val = setup.get("mes1_valor", 9562.30)
    m2_val = setup.get("mes2_valor", 8520.00)
    sust = inv.get("sustentacao_mensal", {})
    base_sm = float(sust.get("valor_base_salarios_minimos", sust.get("base_salario_minimo", 3.09)))
    franquia = sust.get("franquia_canteiros", 1)
    extra_sm = float(sust.get("acrescimo_por_canteiro_extra_sm", sust.get("canteiro_adicional_sm", 0.5)))
    salario_minimo = float(sust.get("salario_minimo_vigente", 1518.00))
    mensalidade_sust_base = float(sust.get("valor_mensal") or (base_sm * salario_minimo))
    vigencia_contrato = sust.get("vigencia_meses", 24)

    crono = inv.get("cronograma_pagamento", {})
    incluir_pptx = crono.get("incluir_tabela_pptx", True)
    data_aceite = crono.get("data_aceite", "05/10/2026")
    carencia_dias = crono.get("carencia_dias", 0)
    parcelas_setup = crono.get("parcelas_setup", [])
    if not parcelas_setup:
        parcelas_setup = [
            {"nome": "Entrada", "dias_apos_aceite": 0, "valor": m1_val, "dias_vencimento": 5},
            {"nome": "1ª Parcela Setup", "dias_apos_aceite": 60, "valor": m2_val, "dias_vencimento": 10},
            {"nome": "2ª Parcela Setup", "dias_apos_aceite": 90, "valor": setup.get("mes3_valor", 12636.00), "dias_vencimento": 10}
        ]

    total_setup = sum(float(p.get("valor", 0)) for p in parcelas_setup)
    tem_entrada = any(float(p.get("dias_apos_aceite", 0)) == 0 for p in parcelas_setup)

    if incluir_pptx:
        setup_card_lines = []
        if tem_entrada:
            p_ent = next((p for p in parcelas_setup if float(p.get("dias_apos_aceite", 0)) == 0), None)
            v_ent = float(p_ent.get("valor", 0)) if p_ent else 0
            setup_card_lines.append(f"Entrada Inicial: R$ {v_ent:,.2f} à vista (até {p_ent.get('dias_vencimento', 5) if p_ent else 5} dias após assinatura).".replace(",", "X").replace(".", ",").replace("X", "."))
            tag_setup = f"Fase 1 • Setup em {len(parcelas_setup)} Etapas (Sem Carência)"
        else:
            setup_card_lines.append(f"Carência Comercial: Pagamento inicial somente {carencia_dias} dias após aceite.")
            setup_card_lines.append(f"Dia 0 ({data_aceite}): Aceite formal e início da imersão (R$ 0,00).")
            tag_setup = f"Fase 1 • Carência {carencia_dias} Dias"

        for idx, p in enumerate(parcelas_setup):
            d_apos = p.get("dias_apos_aceite", 0)
            if float(d_apos) == 0:
                continue
            v = float(p.get("valor", 0))
            d_venc = p.get("dias_vencimento", 10)
            nm = p.get("nome", f"Fração #{idx + 1}")
            setup_card_lines.append(f"Dia {d_apos}: Emissão NF {nm} (R$ {v:,.2f}) c/ vencto {d_venc}d.".replace(",", "X").replace(".", ",").replace("X", "."))

        setup_card_lines.append(f"Total Geral Setup: R$ {total_setup:,.2f} ({len(parcelas_setup)} Parcelas).".replace(",", "X").replace(".", ",").replace("X", "."))
        setup_card_lines.append("Faturamento Mensal: Emissão dia 28 c/ vencto dia 10 do mês seguinte.")
    else:
        setup_card_lines = [
            f"Implementação Ágil do MVP em {len(parcelas_setup)} etapas planejadas.",
            f"Investimento Total de Setup: R$ {total_setup:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "Desenvolvimento dedicado, imersão técnica e homologação assistida.",
            "Transferência de conhecimento e capacitação de multiplicadores.",
            "Faturamento e condições comerciais conforme alinhamento de contratação."
        ]
        tag_setup = "Fase 1 • Setup & Implantação"

    create_card(s12, 0.8, 1.5, 5.7, 5.1, f"Setup Inicial • {len(parcelas_setup)} Parcelas", setup_card_lines, tag=tag_setup, border_color=BRAND_FOREST)

    create_card(s12, 6.8, 1.5, 5.7, 5.1, f"Sustentação Mensal (Contrato {vigencia_contrato} Meses)", [
        f"Mensalidade Base: R$ {mensalidade_sust_base:,.2f}/mês.".replace(",", "X").replace(".", ",").replace("X", "."),
        f"Vigência Contratual: {vigencia_contrato} meses com total previsibilidade.",
        "Critério de Reajuste: Anual (a cada 12 meses) atrelado à variação do Salário Mínimo Nacional.",
        "Licenciamento: Usuários e terminais ilimitados em todo o chão de fábrica e escritórios.",
        "Nenhum Custo por Assento: A Delta cresce na fábrica sem pagar mais por operador adicional.",
        "Abrange: Servidor em nuvem, backups diários, suporte técnico especializado LYNX nível 2 e 3."
    ], tag="Fase 2 • Sustentação Contínua", border_color=BRAND_SAGE)

    add_footer(s12, 12, 13)

    # =========================================================================
    # SLIDE 13: CRONOGRAMA FINANCEIRO & PROGRESSÃO DE INVESTIMENTO
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    set_slide_background(s13)
    add_header(s13, "Cronograma Financeiro", f"Projeção e Progressão do Investimento (12 e 24 Meses)", f"Visão consolidada de desembolso para a {cliente_nome} com amortização do setup")

    # Projeção 12 meses
    tot_12m = total_setup + (mensalidade_sust_base * 10)
    media_12m = tot_12m / 12

    # Projeção 24 meses
    tot_24m = total_setup + (mensalidade_sust_base * 22)
    media_24m = tot_24m / 24

    if incluir_pptx:
        comp_12m = [
            f"Investimento Total 1º Ano: R$ {tot_12m:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            f"Média Mensal Diluída: R$ {media_12m:,.2f} / mês".replace(",", "X").replace(".", ",").replace("X", "."),
            "Composição do período:",
            f"  - Setup Inicial: R$ {total_setup:,.2f} em {len(parcelas_setup)} parcelas".replace(",", "X").replace(".", ",").replace("X", "."),
            f"  - Mensalidades de Sustentação (R$ {mensalidade_sust_base:,.2f}/mês)".replace(",", "X").replace(".", ",").replace("X", "."),
            "  - Usuários e terminais de fábrica ilimitados.",
            "  - Reajuste após 12 meses pelo Salário Mínimo Nacional."
        ]
        comp_24m = [
            f"Investimento Total 24 Meses: R$ {tot_24m:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            f"Média Mensal Diluída: R$ {media_24m:,.2f} / mês".replace(",", "X").replace(".", ",").replace("X", "."),
            "Composição do período:",
            "  - Setup Inicial integralmente amortizado",
            f"  - Sustentação contínua de 24 meses (R$ {mensalidade_sust_base:,.2f}/mês)".replace(",", "X").replace(".", ",").replace("X", "."),
            "  - Diluição contínua do custo mensal ao longo do ciclo bienal.",
            "  - Garantia de sustentação e evolução permanente da plataforma."
        ]
    else:
        comp_12m = [
            f"Investimento Total 1º Ano: R$ {tot_12m:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            f"Média Mensal Diluída: R$ {media_12m:,.2f} / mês".replace(",", "X").replace(".", ",").replace("X", "."),
            "Composição do período:",
            f"  - Setup inicial distribuído nas etapas de implantação",
            f"  - Sustentação contínua (R$ {mensalidade_sust_base:,.2f}/mês)".replace(",", "X").replace(".", ",").replace("X", "."),
            "  - Licenças e postos industriais ilimitados.",
            "  - Previsibilidade e controle orçamentário total."
        ]
        comp_24m = [
            f"Investimento Total 24 Meses: R$ {tot_24m:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            f"Média Mensal Diluída: R$ {media_24m:,.2f} / mês".replace(",", "X").replace(".", ",").replace("X", "."),
            "Composição do período:",
            "  - Setup inicial amortizado no ciclo operacional",
            f"  - Sustentação contínua (R$ {mensalidade_sust_base:,.2f}/mês)".replace(",", "X").replace(".", ",").replace("X", "."),
            "  - Diluição progressiva dos custos ao longo dos 24 meses.",
            "  - Previsibilidade total de gastos com TI industrial."
        ]

    create_card(s13, 0.8, 1.5, 3.65, 5.1, "Projeção 1º Ano (12m)", comp_12m, tag="Ciclo Anual", border_color=BRAND_FOREST)
    create_card(s13, 4.8, 1.5, 3.65, 5.1, "Projeção 24 Meses", comp_24m, tag="Ciclo Bienal", border_color=BRAND_SAGE)

    create_card(s13, 8.8, 1.5, 3.65, 5.1, "Próximos Passos & Kick-Off", [
        "Passo 1: Aprovação e assinatura formal da proposta.",
        f"Passo 2: Provisionamento do ambiente dedicado {url_ambiente}.",
        f"Passo 3: Reunião de kick-off com a diretoria e equipe da {cliente_nome}.",
        "Passo 4: Início da imersão diagnóstica no chão de fábrica e SGQ.",
        "Passo 5: Liberação dos primeiros postos touch para uso imediato.",
        "Contato Direto Lynx: edsonmanoel2012@gmail.com"
    ], tag="Formalização & Kick-Off")

    add_footer(s13, 13, 13)

    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python gerar_proposta_pptx.py <caminho_json_ou_dados> <caminho_saida_pptx>")
        sys.exit(1)
        
    json_input = sys.argv[1]
    out_path = sys.argv[2]
    
    if os.path.exists(json_input):
        with open(json_input, 'r', encoding='utf-8') as f:
            proposal_data = json.load(f)
    else:
        proposal_data = json.loads(json_input)
        
    create_proposal_presentation(proposal_data, out_path)
