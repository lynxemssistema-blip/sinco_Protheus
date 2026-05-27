import re

with open('client/src/config/helpContent.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Add the new entry for /sgq/documentos
new_entry = """
  // ── SGQ Documentos ───────────────────────────────────────────────────────────
  '/sgq/documentos': {
    category: 'SGQ',
    categoryColor: '#0ea5e9',
    title: 'POP-AJUDA-101 - Gestão de Documentos SGQ',
    icon: 'FileText',
    description: 'Manual completo para criação, edição e gestão de Procedimentos Operacionais Padrão (POPs) e documentos da Qualidade utilizando o editor inteligente com IA.',
    steps: [
      '**1. Criando e Editando Documentos:**',
      'Para criar um novo documento, clique no botão azul **"Novo Documento"** na barra lateral. O editor em branco será aberto.',
      'Utilize o botão **"INSERIR CABEÇALHO"** no topo para adicionar automaticamente o cabeçalho padrão ISO 9001. Preencha os campos (Código, Revisão, Data, Elaborador, Aprovador). O sistema salvará estes dados vinculados ao documento.',
      'Para usar uma estrutura pronta, clique em **"CARREGAR TÓPICOS ISO"**. O sistema preencherá o documento com os 10 tópicos padrão da norma.',
      '',
      '**2. Importando Documentos Existentes:**',
      'Caso já tenha o documento em Word, clique em **"Importar Word (.docx)"** na barra lateral esquerda. O sistema lerá o arquivo e extrairá todo o texto e formatação diretamente para o editor.',
      '',
      '**3. Gestão de Setores (O Truque da Troca de Setor):**',
      'Os documentos são organizados por Setores (ex: Produção, PCP, RH, etc) localizados como "abas" na lateral esquerda.',
      'Para **Transferir um documento de Setor**: Abra o documento desejado. Em seguida, na barra lateral, clique na aba do novo setor que deve recebê-lo. O documento continuará aberto na tela. Então, clique em **"SALVAR NO BANCO"**. O documento será imediatamente transferido para o setor selecionado.',
      'Para **Criar um novo setor**: Clique no botão de engrenagem ao lado das abas de setor, e depois em "Novo setor".',
      '',
      '**4. Assistente de Inteligência Artificial (IA):**',
      'O módulo conta com um Assistente IA integrado (botão **"Assistente IA"** no topo).',
      '**Como usar:** Selecione qualquer trecho de texto no seu documento e clique em **"Capturar Texto Selecionado"** no painel da IA. Peça para a IA reescrever, melhorar a gramática ou traduzir.',
      '**Substituição Rápida:** Ao receber a resposta da IA, você pode clicar em **"Substituir Seleção"** para que a IA troque automaticamente o texto antigo pelo novo diretamente no seu editor.',
      '**Leitura de Anexos (Multimodal):** Clique no ícone de "clipe de papel" no painel da IA para enviar PDFs, Word (.docx) ou até Imagens. A IA lerá o arquivo em segundos e você poderá conversar com ela sobre o conteúdo ou pedir para criar resumos com base nele.',
    ],
    tips: [
      '**Salvar Sempre:** Se você tentar sair do documento ou carregar um novo sem salvar, o sistema emitirá um alerta vermelho para evitar a perda de dados.',
      '**Impressão e PDF:** A interface foi programada para simular uma folha A4. Ao clicar em **"PDF / Imprimir"**, o sistema ocultará todas as barras de ferramentas para gerar um PDF perfeitamente formatado.',
      '**Backup e Exportação:** O botão **"Exportar"** gera um arquivo .doc nativo que você pode abrir no Microsoft Word localmente.',
    ],
    links: [
      { path: '/sgq', label: 'Painel Geral do SGQ' },
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
    ],
  },
"""

# Insert it before the last closing brace of HELP_CONTENT
if "'/sgq/documentos':" not in c:
    c = c.replace('export const HELP_CONTENT = {', 'export const HELP_CONTENT = {' + new_entry)

with open('client/src/config/helpContent.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Help content added!")
