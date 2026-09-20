import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import json
import os
import sys

def set_cell_background(cell, hex_color):
    """Define a cor de fundo de uma célula."""
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Define margens internas (padding) da célula."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                      f'<w:top w:w="{top}" w:type="dxa"/>'
                      f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                      f'<w:left w:w="{left}" w:type="dxa"/>'
                      f'<w:right w:w="{right}" w:type="dxa"/>'
                      f'</w:tcMar>')
    tcPr.append(tcMar)

def generate_proposal_docx(json_path=None, output_path=None):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not json_path:
        json_path = os.path.join(base_dir, 'data', 'proposta_comercial.json')
    if not output_path:
        root_dir = os.path.dirname(base_dir)
        output_path = os.path.join(root_dir, 'Proposta_Comercial_Lynx_Metalfisa_2026.docx')

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    doc = docx.Document()

    # Definir margens do documento (2 cm)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Cores corporativas
    COLOR_PRIMARY = RGBColor(14, 43, 92)     # Azul Marinho Corporativo Lynx
    COLOR_SECONDARY = RGBColor(217, 83, 30)  # Laranja / Terracota Aço Industrial
    COLOR_TEXT = RGBColor(40, 44, 52)        # Cinza Chumbo
    COLOR_MUTED = RGBColor(100, 110, 125)    # Cinza Médio
    HEX_PRIMARY = "0E2B5C"
    HEX_LIGHT_BG = "F4F6F9"
    HEX_ACCENT_BG = "EBF2FA"

    # ==================== CABEÇALHO EXECUTIVO ====================
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_org = p_header.add_run(f"{data.get('fornecedor', {}).get('empresa', 'LYNX EMS SISTEMA & CONSULTORIA')}\n")
    run_org.font.size = Pt(9.5)
    run_org.font.bold = True
    run_org.font.color.rgb = COLOR_MUTED
    run_doc_id = p_header.add_run(f"DOCUMENTO TÉCNICO-COMERCIAL | REF: {data.get('referencia', 'PC-2026/MF-09')}")
    run_doc_id.font.size = Pt(8.5)
    run_doc_id.font.color.rgb = COLOR_MUTED

    # Título Principal
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(18)
    p_title.paragraph_format.space_after = Pt(4)
    run_pre = p_title.add_run(f"{data.get('titulo', 'PROPOSTA TÉCNICA E COMERCIAL')}\n")
    run_pre.font.size = Pt(13)
    run_pre.font.bold = True
    run_pre.font.color.rgb = COLOR_SECONDARY

    run_title = p_title.add_run("Expansão do Ecossistema Integrado Metalfisa\n")
    run_title.font.size = Pt(21)
    run_title.font.bold = True
    run_title.font.color.rgb = COLOR_PRIMARY

    run_sub = p_title.add_run(data.get('subtitulo', ''))
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = COLOR_MUTED

    # Linha divisória
    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_after = Pt(18)
    run_line = p_line.add_run("―" * 58)
    run_line.font.color.rgb = COLOR_SECONDARY
    run_line.font.bold = True

    # Metadados das Partes
    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    
    col_widths = [Inches(3.4), Inches(3.4)]
    for row in meta_table.rows:
        for i, cell in enumerate(row.cells):
            cell.width = col_widths[i]
            set_cell_background(cell, HEX_LIGHT_BG)
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)

    # Célula 1: Fornecedor
    c00 = meta_table.cell(0, 0)
    p = c00.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("FORNECEDOR / DESENVOLVEDOR:\n")
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    r2 = p.add_run(f"{data.get('fornecedor', {}).get('empresa', 'LYNX')}\nResponsável: {data.get('fornecedor', {}).get('responsavel', '')}\nContato: {data.get('fornecedor', {}).get('contato', '')}")
    r2.font.size = Pt(9)
    r2.font.color.rgb = COLOR_TEXT

    # Célula 2: Cliente
    c01 = meta_table.cell(0, 1)
    p = c01.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("CLIENTE CONTRATANTE:\n")
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    r2 = p.add_run(f"{data.get('cliente', {}).get('empresa', 'METALFISA')}\n{data.get('cliente', {}).get('representante', '')}")
    r2.font.size = Pt(9)
    r2.font.color.rgb = COLOR_TEXT

    # Célula 3: Data e Validade
    c10 = meta_table.cell(1, 0)
    p = c10.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("DATA DE EMISSÃO: ")
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    r2 = p.add_run(f"{data.get('data_emissao', 'Setembro de 2026')}\n")
    r2.font.size = Pt(9)
    r3 = p.add_run("VALIDADE DA PROPOSTA: ")
    r3.font.size = Pt(8.5)
    r3.font.bold = True
    r3.font.color.rgb = COLOR_PRIMARY
    r4 = p.add_run(f"{data.get('validade_dias', 30)} dias corridos")
    r4.font.size = Pt(9)

    # Célula 4: Regime e Licença
    c11 = meta_table.cell(1, 1)
    p = c11.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("MODELO DE LICENCIAMENTO: ")
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    r2 = p.add_run(f"{data.get('licenciamento', {}).get('modelo', 'Usuários Ilimitados')}\n")
    r2.font.size = Pt(9)
    r3 = p.add_run("INFRAESTRUTURA: ")
    r3.font.size = Pt(8.5)
    r3.font.bold = True
    r3.font.color.rgb = COLOR_PRIMARY
    r4 = p.add_run(data.get('infraestrutura', {}).get('servidor', 'On-Premise SINCO (192.168.1.77)'))
    r4.font.size = Pt(9)

    doc.add_paragraph().paragraph_format.space_before = Pt(12)

    def add_section_title(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title_text)
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY

    def add_subsection_title(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(11)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title_text)
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = COLOR_SECONDARY

    def add_body_p(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.15
        r_t = p.add_run(text)
        r_t.font.size = Pt(9.5)
        r_t.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet_item(item_title, item_desc):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        r_title = p.add_run(item_title + ": ")
        r_title.font.bold = True
        r_title.font.size = Pt(9.5)
        r_title.font.color.rgb = COLOR_PRIMARY
        r_desc = p.add_run(item_desc)
        r_desc.font.size = Pt(9.5)
        r_desc.font.color.rgb = COLOR_TEXT

    # ==================== 1. OBJETIVO E ESTRATÉGIA ====================
    add_section_title("1. INTRODUÇÃO E VISÃO ESTRATÉGICA")
    add_body_p(
        "A presente proposta formaliza o plano de expansão do sistema integrado da METALFISA sob a arquitetura da LYNX, "
        "incorporando seis novos módulos de alto valor agregado à rotina operacional da empresa. O projeto unifica o fluxo de "
        "informações entre chão de fábrica, engenharia, compras, fiscal, departamento pessoal, segurança do trabalho e diretoria."
    )
    add_body_p(
        "A solução opera de maneira nativa com o banco de dados do TOTVS Protheus, aproveitando a infraestrutura existente do "
        "servidor local SINCO (192.168.1.77) e os agentes de CAD SolidEdge/SolidWorks, com processamento rápido e segurança total de dados."
    )

    # ==================== 2. DIRETRIZES TÉCNICAS E REFINAMENTOS ====================
    add_section_title("2. DIRETRIZES TÉCNICAS E AMBIENTE DE HOMOLOGAÇÃO")
    homolog = data.get('homologacao', {})
    add_bullet_item("Ambiente Seguro de Homologação", 
                    homolog.get('ambiente', 'Validação assistida em Base de Testes do Protheus antes do rollout em produção, garantindo risco zero à operação corrente.'))
    add_bullet_item("Integração de Ponto Eletrônico", 
                    homolog.get('ponto_eletronico', 'Conformidade com a Portaria 671/MTE, com suporte nativo a coletores homologados e importação direta de arquivos AFD/AFDT.'))
    add_bullet_item("Pontos de Integração Protheus", 
                    homolog.get('pontos_integracao', 'Tabelas SE1, SE2, SE5, SF1, SF2, SD1, SD2, SC7, SRA, SRD via APIs TLPP e pools otimizados de consulta direta.'))

    # ==================== 3. DETALHAMENTO DOS MÓDULOS ====================
    mods_list = data.get('modulos', [])
    add_section_title(f"3. ESCOPO DETALHADO DOS {len(mods_list)} MÓDULOS")
    
    for idx, mod in enumerate(mods_list, start=1):
        add_subsection_title(f"3.{idx}. {mod.get('nome')}")
        add_body_p(mod.get('descricao', ''))
        for it in mod.get('itens', []):
            add_bullet_item(it.get('titulo'), it.get('descricao'))

    # ==================== 4. CONDIÇÕES COMERCIAIS ====================
    add_section_title("4. CONDIÇÕES COMERCIAIS E INVESTIMENTO")
    add_body_p("A proposta contempla modelo de parcelamento para a fase de implantação e taxa mensal perpétua de sustentação:")

    # Tabela de Implantação
    add_subsection_title("4.1. Cronograma de Investimento de Implantação")
    inv = data.get('investimento', {})
    impl_items = inv.get('implantacao', [])
    
    table_imp = doc.add_table(rows=len(impl_items) + 2, cols=3)
    table_imp.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_imp.autofit = False
    col_w = [Inches(1.8), Inches(3.4), Inches(1.6)]

    headers = ["PARCELA", "VENCIMENTO E CONDIÇÃO", "VALOR (R$)"]
    for i, h in enumerate(headers):
        c = table_imp.cell(0, i)
        c.width = col_w[i]
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, 120, 120, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    for r_idx, it in enumerate(impl_items, start=1):
        row = table_imp.rows[r_idx]
        vals = [it.get('parcela', ''), it.get('vencimento', ''), it.get('valor_formatado', '')]
        for c_idx, val in enumerate(vals):
            c = row.cells[c_idx]
            c.width = col_w[c_idx]
            set_cell_background(c, HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF")
            set_cell_margins(c, 100, 100, 120, 120)
            p = c.paragraphs[0]
            if c_idx == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            r = p.add_run(val)
            r.font.size = Pt(9)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = COLOR_PRIMARY

    # Total row
    tot_row = table_imp.rows[len(impl_items) + 1]
    tot_vals = ["TOTAL DA IMPLANTAÇÃO", f"Totalização das {len(impl_items)} parcelas de implantação e integração", inv.get('total_implantacao_formatado', 'R$ 24.000,00')]
    for c_idx, val in enumerate(tot_vals):
        c = tot_row.cells[c_idx]
        c.width = col_w[c_idx]
        set_cell_background(c, HEX_ACCENT_BG)
        set_cell_margins(c, 110, 110, 120, 120)
        p = c.paragraphs[0]
        if c_idx == 2:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run(val)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = COLOR_PRIMARY

    # Mensalidade Perpétua
    add_subsection_title("4.2. Mensalidade Perpétua de Suporte, Manutenção e Atualizações")
    mens = inv.get('mensalidade', {})
    m_ano1 = mens.get('ano1', {})
    m_ano2 = mens.get('ano2_em_diante', {})

    add_bullet_item("Primeiro Ano (10/02/2027 a 10/02/2028)",
                    f"{m_ano1.get('base_calculo', '1,0 Salário Mínimo')} — Primeiro vencimento em {m_ano1.get('primeiro_vencimento', '10/02/2027')}.")
    add_bullet_item("A partir do Segundo Ano (pós 10/02/2028)",
                    f"{m_ano2.get('base_calculo', '2,5 Salários Mínimos')} — {m_ano2.get('regra_reajuste', 'Reajuste anual pelo Salário Mínimo.')}")
    add_bullet_item("Licenciamento Empresarial",
                    data.get('licenciamento', {}).get('detalhes', 'Sem limite de usuários.'))

    # ==================== 5. OBSERVAÇÕES GERAIS E DISPOSIÇÕES FINAIS ====================
    obs_gerais = data.get('observacoes_gerais', '').strip()
    if obs_gerais:
        add_section_title("5. OBSERVAÇÕES GERAIS E DISPOSIÇÕES FINAIS")
        for line in obs_gerais.split('\n'):
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith(('-', '•', '*')):
                content = line_str.lstrip('-•* ').strip()
                if ':' in content:
                    t, d = content.split(':', 1)
                    add_bullet_item(t.strip(), d.strip())
                else:
                    p = doc.add_paragraph(style='List Bullet')
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(3)
                    p.paragraph_format.line_spacing = 1.15
                    r = p.add_run(content)
                    r.font.size = Pt(9.5)
                    r.font.color.rgb = COLOR_TEXT
            elif len(line_str) > 2 and line_str[0].isdigit() and line_str[1] in ('.', ')'):
                prefix = line_str[:2]
                content = line_str[2:].strip()
                if ':' in content:
                    t, d = content.split(':', 1)
                    add_bullet_item(f"{prefix} {t.strip()}", d.strip())
                else:
                    p = doc.add_paragraph()
                    p.paragraph_format.space_before = Pt(2)
                    p.paragraph_format.space_after = Pt(4)
                    p.paragraph_format.line_spacing = 1.15
                    r_num = p.add_run(f"{prefix} ")
                    r_num.font.bold = True
                    r_num.font.size = Pt(9.5)
                    r_num.font.color.rgb = COLOR_PRIMARY
                    r_txt = p.add_run(content)
                    r_txt.font.size = Pt(9.5)
                    r_txt.font.color.rgb = COLOR_TEXT
            else:
                add_body_p(line_str)

    # ==================== 6. ASSINATURAS ====================
    sec_num = "6" if obs_gerais else "5"
    add_section_title(f"{sec_num}. DE ACORDO DAS PARTES")
    add_body_p("Estando as partes devidamente alinhadas quanto ao escopo técnico, prazos, integrações, condições comerciais e disposições gerais, firmam o presente instrumento:")

    doc.add_paragraph().paragraph_format.space_before = Pt(35)

    sig_table = doc.add_table(rows=1, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.autofit = False
    for cell in sig_table.rows[0].cells:
        cell.width = Inches(3.3)
        set_cell_margins(cell, 80, 80, 80, 80)

    # Lynx
    p1 = sig_table.cell(0, 0).paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.add_run("_________________________________________\n").font.color.rgb = COLOR_MUTED
    r = p1.add_run(f"{data.get('fornecedor', {}).get('empresa', 'LYNX EMS SISTEMA')}\n")
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    p1.add_run("Gestão de Tecnologia / Fornecedor").font.size = Pt(8.5)

    # Metalfisa
    p2 = sig_table.cell(0, 1).paragraphs[0]
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.add_run("_________________________________________\n").font.color.rgb = COLOR_MUTED
    r = p2.add_run(f"{data.get('cliente', {}).get('empresa', 'METALFISA INDÚSTRIA METALÚRGICA')}\n")
    r.font.bold = True
    r.font.color.rgb = COLOR_PRIMARY
    p2.add_run("Diretoria Executiva / Contratante").font.size = Pt(8.5)

    doc.save(output_path)
    print(f"Documento Word gerado com sucesso em: {output_path}")
    return output_path

if __name__ == "__main__":
    json_arg = sys.argv[1] if len(sys.argv) > 1 else None
    out_arg = sys.argv[2] if len(sys.argv) > 2 else None
    generate_proposal_docx(json_arg, out_arg)
