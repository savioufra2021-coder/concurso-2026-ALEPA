# Relatório de Mapeamento Tópico → Página da Apostila (`apostilaMap.report.md`)

Gerado automaticamente por `node scripts/buildApostilaMap.mjs`.

## 1. Resumo das Fontes Analisadas

| Material ID | Arquivo | Tipo | Páginas | Marcadores | Origem |
| --- | --- | --- | ---: | ---: | --- |
| `nm_mat_local_assistente_basico_questoes` | `assistente_adm_assembleia_legislativa_do_estado_do_para_alepa_2026_basico_questoes_d9b0b488.pdf` | `questoes` | 4338 | 57 | local |
| `nm_mat_local_assistente_questoes_especificas` | `assistente_adm_assembleia_legislativa_do_estado_do_para_alepa_2026_questoes_d6d99609.pdf` | `questoes` | 2645 | 51 | local |
| `nm_mat_local_assistente_resumo` | `assistente_adm_assembleia_legislativa_do_estado_do_para_alepa_2026_resumo_3324aa49.pdf` | `resumo` | 204 | 51 | local |
| `nm_mat_local_assistente_impressao` | `assistente_adm_assembleia_legislativa_do_estado_do_para_alepa_2026_versao_para_impressao_c162f37b.pdf` | `teoria` | 878 | 127 | local |

**Status Firebase Storage:**
- Firebase Storage (quick-vent-vv0ns.firebasestorage.app): listagem retornou HTTP 404 (bucket não provisionado ou requer autenticação em ambiente ao vivo).

- **Superior:** 24/31 tópicos vinculados automaticamente.
- **Médio:** 19/29 tópicos vinculados automaticamente.
- **Marcadores extraídos no total:** 286.

---

## 2. Campus 02 — Nível Superior (`src/data/alepaSyllabus.ts`)

### 2.1. Tópicos do edital SEM marcador (7)

- **`processo_legislativo` / `pl_iniciativa_veto`** (Processo Legislativo): Autógrafos, Sanção, Veto, Promulgação e Fiscalização — _sem marcador correspondente encontrado_
- **`administracao_gestao` / `adm_teorias_planejamento`** (Administração & Gestão): Teorias da Administração, Funções PODC e Planejamento Estratégico — _parcialmente sem correspondência esperada (tópico específico de Administração Geral/Pessoas não coberto por esta apostila)_
- **`administracao_gestao` / `adm_processos_qualidade`** (Administração & Gestão): Gestão de Processos, Projetos, Qualidade e Ferramentas de Gestão — _parcialmente sem correspondência esperada (tópico específico de Administração Geral/Pessoas não coberto por esta apostila)_
- **`administracao_gestao` / `adm_gestao_pessoas`** (Administração & Gestão): Gestão de Pessoas e Comportamento Organizacional — _parcialmente sem correspondência esperada (tópico específico de Administração Geral/Pessoas não coberto por esta apostila)_
- **`direito_financeiro` / `df_lrf_despesa_receita`** (Dir. Financeiro): Lei de Responsabilidade Fiscal (LC nº 101/2000) e Fiscalização Financeira — _sem correspondência esperada (LRF / fiscalização detalhada não coberta nesta apostila)_
- **`juridicas_complementares` / `jc_civil_proc_civil`** (Jurídicas & Secretaria): Direito Civil e Direito Processual Civil — _parcialmente sem correspondência esperada (Direito Civil / Processual Civil / Previdenciário / Direitos Humanos não cobertos pela apostila)_
- **`juridicas_complementares` / `jc_previdenciario_dh`** (Jurídicas & Secretaria): Direito Previdenciário e Noções de Direitos Humanos — _parcialmente sem correspondência esperada (Direito Civil / Processual Civil / Previdenciário / Direitos Humanos não cobertos pela apostila)_

### 2.2. Casamentos duvidosos — Superior (29)

- **`nm_mat_local_assistente_basico_questoes` [p. 128]** "Controle de Documentos: Envio e Recebimento" _(seção: Noções Básicas de Secretaria)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.525, raw=0.425) ; `juridicas_complementares/jc_secretaria_adm` (score=0.475, raw=0.375) ; `administracao_gestao/adm_teorias_planejamento` (score=0.465, raw=0.365)
- **`nm_mat_local_assistente_basico_questoes` [p. 2208]** "Redes de Computadores: Conceitos Básicos, Ferramentas, Aplicativos e Procedimentos de Internet e Intranet" _(seção: Noções de Informática)_ — **pontuação baixa** → Candidatos: `informatica/inf_internet_seguranca` (score=0.484, raw=0.344)
- **`nm_mat_local_assistente_questoes_especificas` [p. 584]** "Tipos de Estrutura Organizacional, Natureza, Finalidades e Critérios de Departamentalização" _(seção: Noções de Administração Pública)_ — **pontuação baixa** → Candidatos: `administracao_gestao/adm_gestao_pessoas` (score=0.432, raw=0.312)
- **`nm_mat_local_assistente_questoes_especificas` [p. 702]** "Gestão de Processos" _(seção: Noções de Administração Pública)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_processos_qualidade` (score=1, raw=0.9) ; `juridicas_complementares/jc_secretaria_adm` (score=1, raw=0.9) ; `administracao_gestao/adm_gestao_pessoas` (score=0.545, raw=0.425)
- **`nm_mat_local_assistente_questoes_especificas` [p. 946]** "Supremacia da Constituição e Controle de Constitucionalidade" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_principios_direitos` (score=0.64, raw=0.5) ; `direito_constitucional/dc_processual_controle` (score=0.64, raw=0.5)
- **`nm_mat_local_assistente_questoes_especificas` [p. 1560]** "Processo Legislativo: Espécies Normativas (Lei Complementar, Lei Ordinária, Lei Delegada, Medida Provisória, Decretos Legislativos e Resoluções)" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_organizacao_poderes` (score=0.544, raw=0.404) ; `processo_legislativo/pl_especies_normativas` (score=0.515, raw=0.475)
- **`nm_mat_local_assistente_questoes_especificas` [p. 1980]** "Administração de Compras e Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547) ; `administracao_gestao/adm_teorias_planejamento` (score=0.453, raw=0.333)
- **`nm_mat_local_assistente_questoes_especificas` [p. 2030]** "Classificação de Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.524, raw=0.404) ; `juridicas_complementares/jc_secretaria_adm` (score=0.495, raw=0.375)
- **`nm_mat_local_assistente_questoes_especificas` [p. 2080]** "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547)
- **`nm_mat_local_assistente_questoes_especificas` [p. 2390]** "Técnicas de Redação: Vocabulário e Terminologia Técnica" _(seção: Técnica Legislativa)_ — **empate / margem mínima** → Candidatos: `processo_legislativo/pl_especies_normativas` (score=0.528, raw=0.388) ; `processo_legislativo/pl_regimento_alepa` (score=0.515, raw=0.375) ; `processo_legislativo/pl_tecnica_legislativa` (score=0.515, raw=0.375)
- **`nm_mat_local_assistente_resumo` [p. 47]** "Tipos de Estrutura Organizacional, Natureza, Finalidades e Critérios de Departamentalização" _(seção: Noções de Administração Pública)_ — **pontuação baixa** → Candidatos: `administracao_gestao/adm_gestao_pessoas` (score=0.432, raw=0.312)
- **`nm_mat_local_assistente_resumo` [p. 55]** "Gestão de Processos" _(seção: Noções de Administração Pública)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_processos_qualidade` (score=1, raw=0.9) ; `juridicas_complementares/jc_secretaria_adm` (score=1, raw=0.9) ; `administracao_gestao/adm_gestao_pessoas` (score=0.545, raw=0.425)
- **`nm_mat_local_assistente_resumo` [p. 70]** "Supremacia da Constituição e Controle de Constitucionalidade" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_principios_direitos` (score=0.64, raw=0.5) ; `direito_constitucional/dc_processual_controle` (score=0.64, raw=0.5)
- **`nm_mat_local_assistente_resumo` [p. 111]** "Processo Legislativo: Espécies Normativas (Lei Complementar, Lei Ordinária, Lei Delegada, Medida Provisória, Decretos Legislativos e Resoluções)" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_organizacao_poderes` (score=0.544, raw=0.404) ; `processo_legislativo/pl_especies_normativas` (score=0.515, raw=0.475)
- **`nm_mat_local_assistente_resumo` [p. 146]** "Administração de Compras e Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547) ; `administracao_gestao/adm_teorias_planejamento` (score=0.453, raw=0.333)
- **`nm_mat_local_assistente_resumo` [p. 150]** "Classificação de Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.524, raw=0.404) ; `juridicas_complementares/jc_secretaria_adm` (score=0.495, raw=0.375)
- **`nm_mat_local_assistente_resumo` [p. 155]** "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547)
- **`nm_mat_local_assistente_resumo` [p. 181]** "Técnicas de Redação: Vocabulário e Terminologia Técnica" _(seção: Técnica Legislativa)_ — **empate / margem mínima** → Candidatos: `processo_legislativo/pl_especies_normativas` (score=0.528, raw=0.388) ; `processo_legislativo/pl_regimento_alepa` (score=0.515, raw=0.375) ; `processo_legislativo/pl_tecnica_legislativa` (score=0.515, raw=0.375)
- **`nm_mat_local_assistente_impressao` [p. 19]** "Controle de Documentos: Envio e Recebimento" _(seção: Noções Básicas de Secretaria)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.525, raw=0.425) ; `juridicas_complementares/jc_secretaria_adm` (score=0.475, raw=0.375) ; `administracao_gestao/adm_teorias_planejamento` (score=0.465, raw=0.365)
- **`nm_mat_local_assistente_impressao` [p. 222]** "Redes de Computadores: Conceitos Básicos, Ferramentas, Aplicativos e Procedimentos de Internet e Intranet" _(seção: Noções de Informática)_ — **pontuação baixa** → Candidatos: `informatica/inf_internet_seguranca` (score=0.484, raw=0.344)
- **`nm_mat_local_assistente_impressao` [p. 474]** "Tipos de Estrutura Organizacional, Natureza, Finalidades e Critérios de Departamentalização" _(seção: Noções de Administração Pública)_ — **pontuação baixa** → Candidatos: `administracao_gestao/adm_gestao_pessoas` (score=0.432, raw=0.312)
- **`nm_mat_local_assistente_impressao` [p. 486]** "Gestão de Processos" _(seção: Noções de Administração Pública)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_processos_qualidade` (score=1, raw=0.9) ; `juridicas_complementares/jc_secretaria_adm` (score=1, raw=0.9) ; `administracao_gestao/adm_gestao_pessoas` (score=0.545, raw=0.425)
- **`nm_mat_local_assistente_impressao` [p. 510]** "Supremacia da Constituição e Controle de Constitucionalidade" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_principios_direitos` (score=0.64, raw=0.5) ; `direito_constitucional/dc_processual_controle` (score=0.64, raw=0.5)
- **`nm_mat_local_assistente_impressao` [p. 579]** "Processo Legislativo: Espécies Normativas (Lei Complementar, Lei Ordinária, Lei Delegada, Medida Provisória, Decretos Legislativos e Resoluções)" _(seção: Noções de Direito Constitucional)_ — **empate / margem mínima** → Candidatos: `direito_constitucional/dc_organizacao_poderes` (score=0.544, raw=0.404) ; `processo_legislativo/pl_especies_normativas` (score=0.515, raw=0.475)
- **`nm_mat_local_assistente_impressao` [p. 626]** "Administração de Compras e Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547) ; `administracao_gestao/adm_teorias_planejamento` (score=0.453, raw=0.333)
- **`nm_mat_local_assistente_impressao` [p. 631]** "Classificação de Materiais" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.524, raw=0.404) ; `juridicas_complementares/jc_secretaria_adm` (score=0.495, raw=0.375)
- **`nm_mat_local_assistente_impressao` [p. 637]** "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `administracao_gestao/adm_materiais_logistica` (score=0.667, raw=0.547) ; `juridicas_complementares/jc_secretaria_adm` (score=0.667, raw=0.547)
- **`nm_mat_local_assistente_impressao` [p. 672]** "Técnicas de Redação: Vocabulário e Terminologia Técnica" _(seção: Técnica Legislativa)_ — **empate / margem mínima** → Candidatos: `processo_legislativo/pl_especies_normativas` (score=0.528, raw=0.388) ; `processo_legislativo/pl_regimento_alepa` (score=0.515, raw=0.375) ; `processo_legislativo/pl_tecnica_legislativa` (score=0.515, raw=0.375)
- **`nm_mat_local_assistente_impressao` [p. 863]** "Resoluções (Pará): Nº 11/1991, Nº 13/1991, Nº 18/1991, Nº 62/1991, Nº 14/1992, Nº 02/1993, Nº 04/1993, Nº 05/1993, Nº 18/1993, Nº 29/1993, Nº 04/1995, Nº 11/1997, Nº 01/1999, Nº 03/2007, Nº 04/2012, Nº 08/2012, Nº 03/2013, Nº 01/2017, Nº 05/2017, Nº 04/2019, Nº 02/2021, Nº 03/2021, Nº 04/2021, Nº 02/2023, Nº 01/2025, Nº 02/2025, Nº 18/2026" _(seção: Legislação)_ — **empate / margem mínima** → Candidatos: `legislacao_etica/le_constituicao_para` (score=0.743, raw=0.663) ; `processo_legislativo/pl_regimento_alepa` (score=0.73, raw=0.65)

---

## 3. Campus 01 — Nível Médio (`src/data/alepaMedioSyllabus.ts`)

### 3.1. Tópicos do edital SEM marcador (10)

- **`nm_02_atendimento_telefonia` / `nm_c02_tecnicas_atendimento`** (Atend. e Telefonia): Técnicas de Atendimento Telefônico, Comunicação e Pronomes de Tratamento — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_02_atendimento_telefonia` / `nm_c02_nocoes_telefonia`** (Atend. e Telefonia): Noções de Telefonia: PABX, DDR, VoIP, Softphones e Tarifação — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_02_rotinas_saude_alepa` / `nm_c02_rotinas_lgpd`** (Rotinas, NR-17 e ALEPA): Rotinas, Mapas de Chamadas, Planilhas e LGPD no Atendimento — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_02_rotinas_saude_alepa` / `nm_c02_direitos_nr17`** (Rotinas, NR-17 e ALEPA): Atendimento ao Público, Prioridades e Ergonomia (NR-17, Anexo II) — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_02_rotinas_saude_alepa` / `nm_c02_alepa_gestao`** (Rotinas, NR-17 e ALEPA): Noções sobre a ALEPA, RJU (Lei 5.810/94) e Gestão (PDCA) — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_03_eletricidade_hidraulica` / `nm_c03_eletricidade_nr10`** (Elétrica e Hidráulica): Eletricidade, Instalações (NBR 5410 / NBR 14136) e Segurança (NR-10) — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_03_eletricidade_hidraulica` / `nm_c03_hidraulica_sanitaria`** (Elétrica e Hidráulica): Instalações Hidráulicas e Sanitárias (ABNT NBR 5626 e NBR 8160) — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_03_climatizacao_seguranca_patrimonio` / `nm_c03_maquinas_pmoc`** (Climatização, NRs e Patrimônio): Máquinas, Equipamentos, Climatização e PMOC (Lei nº 13.589/2018) — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_03_climatizacao_seguranca_patrimonio` / `nm_c03_seguranca_incendio`** (Climatização, NRs e Patrimônio): Segurança do Trabalho (NRs 6, 23, 26 e 35) e Combate a Incêndios — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_
- **`nm_03_climatizacao_seguranca_patrimonio` / `nm_c03_alepa_patrimonio`** (Climatização, NRs e Patrimônio): ALEPA, RJU (Lei 5.810/94), PDCA e Gestão Patrimonial — _sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)_

### 3.2. Casamentos duvidosos — Médio (3)

- **`nm_mat_local_assistente_questoes_especificas` [p. 2188]** "Gestão Patrimonial" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `nm_04_recursos_materiais/nm_c14_recursos_materiais` (score=1, raw=0.9) ; `nm_03_climatizacao_seguranca_patrimonio/nm_c03_alepa_patrimonio` (score=1, raw=0.9)
- **`nm_mat_local_assistente_resumo` [p. 163]** "Gestão Patrimonial" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `nm_04_recursos_materiais/nm_c14_recursos_materiais` (score=1, raw=0.9) ; `nm_03_climatizacao_seguranca_patrimonio/nm_c03_alepa_patrimonio` (score=1, raw=0.9)
- **`nm_mat_local_assistente_impressao` [p. 648]** "Gestão Patrimonial" _(seção: Noções de Administração de Recursos Materiais)_ — **empate / margem mínima** → Candidatos: `nm_04_recursos_materiais/nm_c14_recursos_materiais` (score=1, raw=0.9) ; `nm_03_climatizacao_seguranca_patrimonio/nm_c03_alepa_patrimonio` (score=1, raw=0.9)

---

## 4. Marcadores SEM tópico em nenhum dos dois campus (25)

- **`nm_mat_local_assistente_basico_questoes` (questoes) [pp. 210–272]**: "Técnicas de Arquivo e Organização Documental" _(seção: Noções Básicas de Secretaria)_
- **`nm_mat_local_assistente_basico_questoes` (questoes) [pp. 528–584]**: "Tipologia e Gêneros Textuais" _(seção: Língua Portuguesa)_
- **`nm_mat_local_assistente_basico_questoes` (questoes) [pp. 2506–2539]**: "Busca e Pesquisa na Web" _(seção: Noções de Informática)_
- **`nm_mat_local_assistente_basico_questoes` (questoes) [pp. 3553–3660]**: "Compreensão e Elaboração da Lógica das Situações" _(seção: Raciocínio Lógico)_
- **`nm_mat_local_assistente_basico_questoes` (questoes) [pp. 3788–3851]**: "Problemas Envolvendo as Quatro Operações Fundamentais (Forma Fracionária e Decimal)" _(seção: Raciocínio Lógico)_
- **`nm_mat_local_assistente_questoes_especificas` (questoes) [pp. 520–583]**: "Características Básicas das Organizações Formais Modernas" _(seção: Noções de Administração Pública)_
- **`nm_mat_local_assistente_questoes_especificas` (questoes) [pp. 1644–1680]**: "Princípios e Conceitos Fundamentais de Arquivologia" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_questoes_especificas` (questoes) [pp. 1811–1849]**: "Arquivamento e Ordenação de Documentos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_questoes_especificas` (questoes) [pp. 1937–1979]**: "Tipologias Documentais e Suportes Físicos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_questoes_especificas` (questoes) [pp. 2080–2133]**: "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_
- **`nm_mat_local_assistente_resumo` (resumo) [pp. 44–46]**: "Características Básicas das Organizações Formais Modernas" _(seção: Noções de Administração Pública)_
- **`nm_mat_local_assistente_resumo` (resumo) [pp. 118–120]**: "Princípios e Conceitos Fundamentais de Arquivologia" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_resumo` (resumo) [pp. 131–133]**: "Arquivamento e Ordenação de Documentos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_resumo` (resumo) [pp. 141–145]**: "Tipologias Documentais e Suportes Físicos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_resumo` (resumo) [pp. 155–158]**: "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 26–31]**: "Técnicas de Arquivo e Organização Documental" _(seção: Noções Básicas de Secretaria)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 59–64]**: "Tipologia e Gêneros Textuais" _(seção: Língua Portuguesa)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 247–250]**: "Busca e Pesquisa na Web" _(seção: Noções de Informática)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 349–356]**: "Compreensão e Elaboração da Lógica das Situações" _(seção: Raciocínio Lógico)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 368–372]**: "Problemas Envolvendo as Quatro Operações Fundamentais (Forma Fracionária e Decimal)" _(seção: Raciocínio Lógico)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 468–473]**: "Características Básicas das Organizações Formais Modernas" _(seção: Noções de Administração Pública)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 588–591]**: "Princípios e Conceitos Fundamentais de Arquivologia" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 606–610]**: "Arquivamento e Ordenação de Documentos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 620–625]**: "Tipologias Documentais e Suportes Físicos" _(seção: Noções de Arquivologia)_
- **`nm_mat_local_assistente_impressao` (teoria) [pp. 637–641]**: "Gerenciamento de Materiais e Estoques" _(seção: Noções de Administração de Recursos Materiais)_
