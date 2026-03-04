-- Script para criar tabela de metadados extraídos de PDFs
-- Execute este script no MySQL para criar a estrutura necessária

CREATE TABLE IF NOT EXISTS produtos_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Referências
  produto_codigo VARCHAR(50) NOT NULL,
  doc_id INT,
  
  -- Dados Extraídos do PDF
  titulo_desenho VARCHAR(255) DEFAULT NULL COMMENT 'Título do desenho técnico',
  peso_kg DECIMAL(10, 3) DEFAULT NULL COMMENT 'Peso da peça em quilogramas',
  area_pintura_m2 DECIMAL(10, 3) DEFAULT NULL COMMENT 'Área de pintura em metros quadrados',
  material VARCHAR(100) DEFAULT NULL COMMENT 'Material principal da peça',
  espessura_mm DECIMAL(10, 3) DEFAULT NULL COMMENT 'Espessura do material em milímetros',
  dimensoes VARCHAR(255) DEFAULT NULL COMMENT 'Dimensões principais',
  revisao VARCHAR(50) DEFAULT NULL COMMENT 'Revisão do desenho',
  
  -- Metadados da Extração
  confianca DECIMAL(3, 2) DEFAULT NULL COMMENT 'Nível de confiança da IA (0.00 a 1.00)',
  extraido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data/hora da extração',
  extraido_por ENUM('manual', 'automatico') DEFAULT 'manual' COMMENT 'Forma de extração',
  
  -- Índices e Constraints
  FOREIGN KEY (doc_id) REFERENCES produtos_docs(id) ON DELETE CASCADE,
  INDEX idx_produto (produto_codigo),
  INDEX idx_doc (doc_id),
  UNIQUE KEY unique_doc_metadata (doc_id)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Metadados extraídos de PDFs técnicos';
