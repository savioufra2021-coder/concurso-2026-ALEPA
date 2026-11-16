import { Question } from '../types';

export const EXTRA_CURATED_QUESTIONS: Question[] = [
  // ========================
  // NÍVEL SUPERIOR (CARGO 03 - PL.AL.102) - EXTRA
  // ========================
  {
    id: 'sup_ext_pt_04',
    disciplineId: 'portugues',
    topicTitle: 'Coesão, Coerência e Conectivos',
    statement:
      'No período "Embora o projeto tenha recebido parecer favorável na Comissão de Justiça, a Mesa Diretora adiou a votação em plenário por falta de quórum", a oração iniciada por "Embora" expressa relação semântica de:',
    options: [
      'Causa.',
      'Consequência.',
      'Concessão.',
      'Condição.',
      'Proporcionalidade.',
    ],
    correctIndex: 2,
    explanation:
      'A conjunção "embora" é subordinativa adverbial concessiva, indicando um fato contrário que não impede a ocorrência da oração principal.',
    legalBasis: 'Gramática Normativa · Orações Subordinadas Adverbiais Concessivas',
    source: 'Fundação CETAP · Estilo Provas Anteriores (Treinamento)',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'sup_ext_pt_05',
    disciplineId: 'portugues',
    topicTitle: 'Colocação Pronominal e Redação Oficial',
    statement:
      'Assinale a alternativa em que a colocação do pronome oblíquo átono respeita integralmente a norma-padrão exigida na redação de pareceres legislativos:',
    options: [
      'Se encaminhou o projeto de lei à Comissão de Finanças.',
      'Não enviaram-se os anexos exigidos pelo Regimento Interno.',
      'Quando apresentou-se o substitutivo, a sessão já estava encerrada.',
      'Em se tratando de emenda parlamentar, observa-se a pertinência temática.',
      'Teriam enviado-nos as notas taquigráficas antes do recesso.',
    ],
    correctIndex: 3,
    explanation:
      'Em "Em se tratando de...", a preposição "em" + gerúndio exige próclise ("em se tratando"). Nas demais há erros: início de frase com pronome átono ("Se encaminhou"), advérbio de negação sem próclise ("Não enviaram-se"), conjunção subordinativa sem próclise ("Quando apresentou-se") e ênclise após particípio ("enviado-nos").',
    legalBasis: 'Gramática Normativa · Próclise, Mesóclise e Ênclise',
    source: 'Treinamento Complementar · Estilo CETAP',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'sup_ext_rl_03',
    disciplineId: 'raciocinio_logico',
    topicTitle: 'Raciocínio Lógico Quantitativo e Conjuntos',
    statement:
      'Em uma consultoria legislativa com 60 técnicos, 38 analisam projetos de lei ordinária, 28 analisam emendas orçamentárias e 10 não analisam nenhum desses dois tipos de proposição. Quantos técnicos analisam simultaneamente os dois tipos?',
    options: ['12 técnicos.', '14 técnicos.', '16 técnicos.', '18 técnicos.', '20 técnicos.'],
    correctIndex: 2,
    explanation:
      'Dos 60 técnicos, 60 - 10 = 50 analisam ao menos um tipo. Pelo princípio da inclusão-exclusão: 38 + 28 - x = 50 -> 66 - x = 50 -> x = 16 técnicos.',
    legalBasis: 'Teoria dos Conjuntos · Diagrama de Venn',
    source: 'Fundação CETAP · Raciocínio Lógico',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'sup_ext_inf_03',
    disciplineId: 'informatica',
    topicTitle: 'Segurança da Informação, Hardening e Nuvem',
    statement:
      'No contexto de segurança corporativa em órgãos públicos, a prática técnica de reduzir a superfície de ataque de servidores e estações de trabalho mediante remoção de serviços desnecessários, atualização de patches e restrição de portas e privilégios denomina-se:',
    options: ['Phishing.', 'Hardening.', 'Spoofing.', 'Sniffing.', 'Overclocking.'],
    correctIndex: 1,
    explanation:
      'Hardening é o processo de endurecimento/fortalecimento da segurança de sistemas operacionais, bancos de dados e redes, fechando portas ociosas e aplicando configurações mínimas de privilégio.',
    legalBasis: 'Segurança da Informação · Edital ALEPA 2026',
    source: 'CERT.br / Treinamento Complementar',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'sup_ext_pl_06',
    disciplineId: 'processo_legislativo',
    topicTitle: 'Comissões Permanentes e Quóruns',
    statement:
      'No âmbito do Poder Legislativo, quando uma Proposta de Emenda à Constituição Estadual (PEC) é submetida à deliberação em plenário, pelo princípio da simetria constitucional (art. 60, §2º CF/88 e CE/PA), exige-se aprovação em:',
    options: [
      'Turno único, por maioria simples dos presentes.',
      'Dois turnos de discussão e votação, por maioria absoluta.',
      'Dois turnos de discussão e votação, por três quintos dos votos dos membros da Assembleia.',
      'Turno único, por dois terços dos membros, sujeita à sanção do Governador.',
      'Dois turnos, por maioria simples, com promulgação exclusiva do Governador.',
    ],
    correctIndex: 2,
    explanation:
      'Pelo art. 60, §2º da CF/88 e simetria na Constituição Estadual do Pará, a PEC é discutida e votada em dois turnos, considerando-se aprovada quando obtiver, em ambos, três quintos dos votos dos respectivos membros, sendo promulgada pela Mesa Diretora sem sanção/veto.',
    legalBasis: 'CF/88, art. 60, §§ 2º e 3º · Constituição do Estado do Pará',
    source: 'Banco de Leis ALEPA · Oficial',
    originType: 'official_alepa',
    isOfficial: true,
  },
  {
    id: 'sup_ext_da_04',
    disciplineId: 'direito_administrativo',
    topicTitle: 'Regime Jurídico Único do Pará (Lei Estadual nº 5.810/1994)',
    statement:
      'Nos termos do Regime Jurídico Único dos Servidores Públicos Civis do Estado do Pará (Lei nº 5.810/1994), o retorno à atividade de servidor aposentado por invalidez, quando junta médica oficial declarar insubsistentes os motivos da aposentadoria, configura forma de provimento denominada:',
    options: ['Readaptação.', 'Reversão.', 'Reintegração.', 'Recondução.', 'Aproveitamento.'],
    correctIndex: 1,
    explanation:
      'Reversão é o retorno à atividade do servidor aposentado por invalidez quando cessam os motivos da incapacidade (ou no interesse da Administração nos casos previstos em lei). Reintegração decorre de anulação de demissão; recondução é o retorno do estável ao cargo anterior.',
    legalBasis: 'Lei Estadual nº 5.810/1994 (RJU/PA) · Provimento Derivado',
    source: 'Banco de Leis ALEPA · Oficial',
    originType: 'official_alepa',
    isOfficial: true,
  },
  {
    id: 'sup_ext_dc_04',
    disciplineId: 'direito_constitucional',
    topicTitle: 'Organização do Estado e Competências Legislativas',
    statement:
      'De acordo com o art. 24 da Constituição Federal de 1988, no âmbito da legislação concorrente entre União, Estados e Distrito Federal, inexistindo lei federal sobre normas gerais:',
    options: [
      'Os Estados ficam impedidos de legislar até a edição da norma federal.',
      'Os Estados exercerão a competência legislativa plena, para atender a suas peculiaridades.',
      'A competência transfere-se automaticamente aos Municípios.',
      'Caberá exclusivamente ao Presidente da República editar medida provisória.',
      'A Assembleia Legislativa dependerá de delegação expressa do Congresso Nacional.',
    ],
    correctIndex: 1,
    explanation:
      'Art. 24, §3º da CF/88: Inexistindo lei federal sobre normas gerais, os Estados exercerão a competência legislativa plena, para atender a suas peculiaridades. A superveniência de lei federal suspende a eficácia da lei estadual no que lhe for contrário (§4º).',
    legalBasis: 'CF/88, art. 24, §§ 3º e 4º',
    source: 'Câmara dos Deputados · Oficial',
    originType: 'official_camara',
    isOfficial: true,
  },
  {
    id: 'sup_ext_df_03',
    disciplineId: 'direito_financeiro',
    topicTitle: 'Princípios Orçamentários e Ciclo Orçamentário (PPA, LDO, LOA)',
    statement:
      'Conforme o art. 165 da Constituição Federal, o instrumento orçamentário que compreende as metas e prioridades da administração pública, orienta a elaboração da lei orçamentária anual e dispõe sobre as alterações na legislação tributária é:',
    options: [
      'O Plano Plurianual (PPA).',
      'A Lei de Diretrizes Orçamentárias (LDO).',
      'A Lei Orçamentária Anual (LOA).',
      'O Relatório Resumido da Execução Orçamentária (RREO).',
      'O Decreto de Contingenciamento Fiscal.',
    ],
    correctIndex: 1,
    explanation:
      'A Lei de Diretrizes Orçamentárias (LDO — art. 165, §2º CF/88) estabelece metas e prioridades, orienta a elaboração da LOA, dispõe sobre alterações tributárias e define a política de aplicação das agências financeiras oficiais de fomento.',
    legalBasis: 'CF/88, art. 165, §2º',
    source: 'Senado Federal · Orçamento Público',
    originType: 'official_camara',
    isOfficial: true,
  },
  {
    id: 'sup_ext_le_04',
    disciplineId: 'legislacao_etica',
    topicTitle: 'Lei Anticorrupção (Lei nº 12.846/2013 e Decreto nº 11.129/2022)',
    statement:
      'Nos termos da Lei Anticorrupção (Lei nº 12.846/2013), a responsabilização administrativa e civil das pessoas jurídicas pela prática de atos contra a administração pública é de natureza:',
    options: [
      'Subjetiva, dependendo da comprovação de dolo dos sócios administradores.',
      'Objetiva, no âmbito administrativo e civil, pelos atos praticados em seu interesse ou benefício.',
      'Exclusivamente penal, aplicada pelo Tribunal de Contas.',
      'Subsidiária à condenação prévia do agente público envolvido.',
      'Aplicável somente às empresas públicas e sociedades de economia mista.',
    ],
    correctIndex: 1,
    explanation:
      'Art. 2º da Lei nº 12.846/2013: As pessoas jurídicas serão responsabilizadas objetivamente, nos âmbitos administrativo e civil, pelos atos lesivos previstos nesta Lei praticados em seu interesse ou benefício, exclusivo ou não.',
    legalBasis: 'Lei nº 12.846/2013, art. 2º',
    source: 'ENAP / Planalto · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'sup_ext_jc_02',
    disciplineId: 'juridicas_complementares',
    topicTitle: 'Arquivologia e Gestão Documental (Lei nº 8.159/1991)',
    statement:
      'Na gestão de documentos públicos disciplinada pela Lei nº 8.159/1991, o instrumento resultante da avaliação documental que determina os prazos de guarda nas fases corrente e intermediária e a destinação final (eliminação ou recolhimento à guarda permanente) é:',
    options: [
      'O Plano de Cargos e Carreiras.',
      'A Tabela de Temporalidade e Destinação de Documentos.',
      'O Livro de Tombo Patrimonial.',
      'O Protocolo de Recebimento Simples.',
      'O Guia de Inventário Anual de Almoxarifado.',
    ],
    correctIndex: 1,
    explanation:
      'A Tabela de Temporalidade é o instrumento arquivístico aprovado por autoridade competente que fixa os prazos de guarda nas fases corrente e intermediária e define a destinação final dos documentos (eliminação ou guarda permanente).',
    legalBasis: 'Lei nº 8.159/1991 · Arquivo Nacional',
    source: 'Arquivo Nacional · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },

  // ========================
  // NÍVEL MÉDIO (CARGO 04 - PL.AL.060 + CARGOS 02/03) - EXTRA
  // ========================
  {
    id: 'nm_ext_pt_02',
    disciplineId: 'nm_portugues',
    topicTitle: 'Interpretação, Crase e Ortografia',
    statement:
      'Assinale a alternativa em que o emprego da crase está plenamente de acordo com a norma culta:',
    options: [
      'O documento foi entregue à ele no protocolo geral.',
      'A servidora assistiu à sessão ordinária da ALEPA.',
      'O prazo de inscrição vai de segunda à sexta-feira.',
      'Começou à redigir a ata da comissão permanente.',
      'Solicitou informações à Vossa Senhoria por ofício.',
    ],
    correctIndex: 1,
    explanation:
      'O verbo "assistir" no sentido de ver/presenciar é transitivo indireto regido pela preposição "a", que se funde ao artigo feminino "a" de "sessão ordinária" -> "à sessão". Não ocorre crase antes de pronome pessoal ("ele"), entre datas sem artigo definido ("de segunda a sexta"), antes de verbo ("redigir") ou antes de pronome de tratamento ("Vossa Senhoria").',
    legalBasis: 'Língua Portuguesa · Crase e Regência Verbal',
    source: 'Fundação CETAP · Nível Médio (Treinamento)',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_pt_03',
    disciplineId: 'nm_portugues',
    topicTitle: 'Concordância e Pontuação',
    statement:
      'Marque a frase pontuada e concordada corretamente segundo a norma-padrão:',
    options: [
      'Os relatórios de atividades, foram protocolados na diretoria.',
      'Fazem dois anos que o regulamento interno foi atualizado.',
      'Protocolaram-se ontem os ofícios e as atas da comissão.',
      'Houveram muitas dúvidas sobre o preenchimento do formulário.',
      'Para o assistente administrativo, cabe-lhe organizar o arquivo.',
    ],
    correctIndex: 2,
    explanation:
      'Em "Protocolaram-se ontem os ofícios e as atas...", ocorre voz passiva sintética com sujeito paciente composto no plural, levando o verbo corretamente ao plural ("Protocolaram-se"). Não se separa sujeito do verbo com vírgula; "fazer" (tempo) e "haver" (existir) são impessoais.',
    legalBasis: 'Gramática Normativa · Voz Passiva Sintética e Impessoalidade',
    source: 'Fundação CETAP · Nível Médio',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_le_03',
    disciplineId: 'nm_legislacao_etica',
    topicTitle: 'Constituição do Estado do Pará e ALEPA',
    statement:
      'No âmbito da Assembleia Legislativa do Estado do Pará, conforme o Regimento Interno (Resolução nº 02/2022) e a Constituição Estadual, o órgão colegiado encarregado da direção dos trabalhos legislativos e dos serviços administrativos da Casa denomina-se:',
    options: [
      'Procuradoria-Geral do Estado.',
      'Mesa Diretora.',
      'Comissão Temporária de Sindicância.',
      'Tribunal de Contas dos Municípios.',
      'Conselho Estadual de Secretários.',
    ],
    correctIndex: 1,
    explanation:
      'A Mesa Diretora (composta pelo Presidente, Vice-Presidentes e Secretários) é o órgão colegiado responsável pela direção dos trabalhos legislativos e dos serviços administrativos da Assembleia Legislativa.',
    legalBasis: 'Constituição do Estado do Pará & Regimento Interno ALEPA (Res. 02/2022)',
    source: 'Banco de Leis ALEPA · Oficial',
    originType: 'official_alepa',
    isOfficial: true,
  },
  {
    id: 'nm_ext_inf_02',
    disciplineId: 'nm_informatica',
    topicTitle: 'Windows, Word, PowerPoint e Internet',
    statement:
      'No Microsoft Word e no LibreOffice Writer (em português), qual combinação de teclas de atalho executa diretamente o comando para salvar o documento em edição?',
    options: ['Ctrl + P', 'Ctrl + Z', 'Ctrl + B (no Word) ou Ctrl + S (no Writer)', 'Alt + F4', 'Ctrl + X'],
    correctIndex: 2,
    explanation:
      'No Microsoft Word em português, o atalho padrão para Salvar é Ctrl + B (enquanto no LibreOffice Writer é Ctrl + S). Ctrl + P imprime, Ctrl + Z desfaz, Ctrl + X recorta e Alt + F4 fecha a janela.',
    legalBasis: 'Noções de Informática · Editores de Texto (Word / Writer)',
    source: 'Fundação CETAP · Nível Médio',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_inf_03',
    disciplineId: 'nm_informatica',
    topicTitle: 'Segurança Digital e Correio Eletrônico',
    statement:
      'Um servidor recebe e-mail aparentemente enviado pelo setor de TI solicitando que clique em um link e informe sua senha institucional sob pena de bloqueio imediato da conta. Esse tipo de golpe de engenharia social é conhecido como:',
    options: ['Firewall.', 'Phishing.', 'Backup incremental.', 'Spooler de impressão.', 'Criptografia simétrica.'],
    correctIndex: 1,
    explanation:
      'Phishing é a técnica de engenharia social que usa mensagens falsas (e-mail, SMS, WhatsApp) simulando instituições legítimas para induzir a vítima a revelar senhas ou dados confidenciais.',
    legalBasis: 'Noções de Informática · Segurança na Internet',
    source: 'CERT.br · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_rl_02',
    disciplineId: 'nm_raciocinio_logico',
    topicTitle: 'Porcentagem e Descontos Sucessivos',
    statement:
      'Na compra de suprimentos de escritório para a secretaria, um lote orçado em R$ 800,00 recebeu 10% de desconto na negociação. Sobre o valor já com desconto, aplicou-se mais 5% de desconto para pagamento à vista. Qual foi o valor final pago?',
    options: ['R$ 680,00', 'R$ 684,00', 'R$ 690,00', 'R$ 700,00', 'R$ 720,00'],
    correctIndex: 1,
    explanation:
      'Após 10% de desconto: 800 × 0,90 = R$ 720,00. Aplicando mais 5% sobre 720: 720 × 0,95 = R$ 684,00. Descontos sucessivos não se somam diretamente (15% daria 680, o que é pegadinha clássica).',
    legalBasis: 'Matemática Básica · Porcentagem Sucessiva',
    source: 'Treinamento Complementar · Nível Médio',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_rl_03',
    disciplineId: 'nm_raciocinio_logico',
    topicTitle: 'Lógica Proposicional e Conectivos',
    statement:
      'Considere verdadeira a proposição "Se o protocolo é registrado hoje, então o processo tramita amanhã". Do ponto de vista lógico, uma frase necessariamente equivalente a ela é:',
    options: [
      'Se o processo tramita amanhã, então o protocolo é registrado hoje.',
      'Se o protocolo não é registrado hoje, então o processo não tramita amanhã.',
      'Se o processo não tramita amanhã, então o protocolo não é registrado hoje.',
      'O protocolo é registrado hoje e o processo não tramita amanhã.',
      'O protocolo não é registrado hoje e o processo tramita amanhã.',
    ],
    correctIndex: 2,
    explanation:
      'A equivalência contrapositiva de "Se P, então Q" (P → Q) é "Se não Q, então não P" (~Q → ~P): "Se o processo não tramita amanhã, então o protocolo não é registrado hoje".',
    legalBasis: 'Raciocínio Lógico · Equivalência Condicional',
    source: 'Fundação CETAP · Nível Médio (Treinamento)',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_dc_02',
    disciplineId: 'nm_01_04_constitucional',
    topicTitle: 'Princípios Fundamentais e Administração Pública (art. 37 CF)',
    statement:
      'Conforme o caput do art. 37 da Constituição Federal de 1988, a administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá expressamente aos princípios de:',
    options: [
      'Legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE).',
      'Soberania, cidadania, dignidade, pluralismo e livre iniciativa.',
      'Sigilo absoluto, pessoalidade, centralização e vitaliciedade.',
      'Economicidade, discricionariedade, hierarquia e informalidade irrestrita.',
      'Segurança jurídica, subsidiariedade, autonomia sindical e greve irrestrita.',
    ],
    correctIndex: 0,
    explanation:
      'Os cinco princípios constitucionais expressos no art. 37, caput, da CF/88 formam o mnemônico LIMPE: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência.',
    legalBasis: 'CF/88, art. 37, caput',
    source: 'Planalto · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_da_02',
    disciplineId: 'nm_01_04_administrativo',
    topicTitle: 'Poderes e Atos Administrativos',
    statement:
      'Quando a Administração Pública anula um ato administrativo praticado em desconformidade com a lei, no exercício do poder de autotutela (Súmula 473 do STF), essa anulação produz efeitos:',
    options: [
      'Ex nunc (apenas prospectivos), preservando atos ilícitos.',
      'Ex tunc (retroativos à data de origem do ato ilegal).',
      'Somente após homologação prévia do Poder Legislativo.',
      'Dependentes de conveniência e oportunidade discricionária.',
      'Válidos apenas no exercício financeiro seguinte.',
    ],
    correctIndex: 1,
    explanation:
      'A anulação decorre de vício de ilegalidade e retroage à origem do ato (efeitos ex tunc), ressalvados os direitos de terceiros de boa-fé. Já a revogação (mérito administrativo) produz efeitos ex nunc.',
    legalBasis: 'Súmula 473 do STF · Lei nº 9.784/1999, art. 53',
    source: 'Treinamento Complementar · Direito Administrativo',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_tl_02',
    disciplineId: 'nm_01_04_tecnica_legislativa',
    topicTitle: 'Proposições Legislativas: Requerimento, Moção e Parecer',
    statement:
      'Na prática parlamentar da Assembleia Legislativa, a proposição por meio da qual a Casa ou uma Comissão manifesta solidariedade, congratulação, apoio, pesar ou protesto diante de acontecimento relevante denomina-se:',
    options: ['Medida Provisória.', 'Moção.', 'Lei Delegada.', 'Decreto Executivo.', 'Edital de Licitação.'],
    correctIndex: 1,
    explanation:
      'Moção é a proposição em que é sugerida a manifestação da Casa Legislativa sobre determinado assunto, aplaudindo, hipotecando solidariedade/apoio, protestando ou repudiando (voto de pesar, aplauso ou repúdio).',
    legalBasis: 'Técnica Legislativa · Proposições Acessórias e Regimento Interno',
    source: 'Câmara dos Deputados / ALEPA · Oficial',
    originType: 'official_camara',
    isOfficial: true,
  },
  {
    id: 'nm_ext_ap_02',
    disciplineId: 'nm_04_administracao_publica',
    topicTitle: 'Organização Administrativa e Gestão de Contratos',
    statement:
      'Na fiscalização e execução dos contratos administrativos regidos pela Lei nº 14.133/2021, o acompanhamento direto do cumprimento das obrigações contratuais pelo agente público formalmente designado pela Administração cabe ao:',
    options: [
      'Pregoeiro da fase externa apenas.',
      'Fiscal do contrato, auxiliado quando necessário por terceiros contratados.',
      'Candidato classificado em cadastro de reserva.',
      'Representante sindical da categoria contratada.',
      'Cartório de Registro de Títulos e Documentos.',
    ],
    correctIndex: 1,
    explanation:
      'Nos termos do art. 117 da Lei nº 14.133/2021, a execução do contrato deverá ser acompanhada e fiscalizada por 1 ou mais fiscais do contrato, representantes da Administração especialmente designados.',
    legalBasis: 'Lei nº 14.133/2021, art. 117',
    source: 'ENAP / Planalto · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_sec_02',
    disciplineId: 'nm_04_secretaria',
    topicTitle: 'Agenda, Atas, Ofícios e Planilhas de Controle',
    statement:
      'Ao lavrar a ata de uma reunião de Comissão da ALEPA, uma boa prática essencial de secretaria para garantir autenticidade e impossibilitar inserções posteriores indevidas é:',
    options: [
      'Deixar linhas em branco entre parágrafos para anotações futuras à caneta.',
      'Redigir de forma corrida ou sem espaços em branco aproveitáveis, registrando presença, deliberações, data e assinaturas.',
      'Substituir o texto formal por abreviações informais de mensagens instantâneas.',
      'Rasurar erros com corretivo líquido sem ressalva ao final do texto.',
      'Omitir o resultado numérico das votações ocorridas na reunião.',
    ],
    correctIndex: 1,
    explanation:
      'A ata é documento formal de registro fiel de ocorrências e deliberações; não deve conter espaços em branco aproveitáveis nem rasuras sem ressalva ("digo" / "em tempo"), devendo consignar data, presentes, decisões e assinaturas.',
    legalBasis: 'Atribuições Cargo 04 (PL.AL.060) · Documentação de Secretaria',
    source: 'Treinamento Complementar · Secretaria',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_arq_02',
    disciplineId: 'nm_04_arquivologia',
    topicTitle: 'Classificação, Protocolo e Métodos de Arquivamento',
    statement:
      'No setor de protocolo e arquivamento da ALEPA, quando as pastas são ordenadas exclusivamente pelo número de registro sequencial atribuído ao processo (ex.: 0001/2026, 0002/2026), emprega-se o método básico de arquivamento:',
    options: ['Alfabético.', 'Geográfico.', 'Numérico simples.', 'Por assunto (ideográfico).', 'Variadex por cores apenas.'],
    correctIndex: 2,
    explanation:
      'O método numérico simples organiza os documentos pela ordem crescente do número atribuído no protocolo ou cadastro, exigindo geralmente um índice auxiliar (por nome ou assunto) para localização.',
    legalBasis: 'Arquivo Nacional · Métodos de Arquivamento',
    source: 'Arquivo Nacional · Oficial',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_rm_02',
    disciplineId: 'nm_04_recursos_materiais',
    topicTitle: 'Recebimento, Armazenagem e Inventário Patrimonial',
    statement:
      'Na rotina de administração de materiais e patrimônio público, a etapa de recebimento em que se verifica se as especificações técnicas, marca, qualidade e quantidade do material entregue conferem exatamente com a nota fiscal e o empenho denomina-se:',
    options: [
      'Baixa patrimonial definitiva.',
      'Conferência qualitativa e quantitativa (aceitação/recebimento definitivo).',
      'Desfazimento por leilão público.',
      'Licitação na modalidade concurso.',
      'Alienação por doação sem registro.',
    ],
    correctIndex: 1,
    explanation:
      'O recebimento envolve o recebimento provisório (conferência de volumes/nota fiscal no ato da entrega) e a conferência qualitativa e quantitativa para emissão do recebimento definitivo/aceite.',
    legalBasis: 'Administração de Recursos Materiais e Patrimônio Público',
    source: 'Treinamento Complementar · Recursos Materiais',
    originType: 'training_platform',
    isOfficial: false,
  },
  // Cargo 02 & Cargo 03 Nível Médio specifics
  {
    id: 'nm_ext_c02_01',
    disciplineId: 'nm_02_atendimento_telefonia',
    topicTitle: 'PABX, DDR e Atendimento Telefônico Oficial',
    statement:
      'Em sistemas de telefonia corporativa utilizados em órgãos públicos, a sigla DDR significa:',
    options: [
      'Discagem Direta a Ramal, permitindo que ligações externas alcancem diretamente um ramal interno sem passar pela telefonista.',
      'Desvio Digital de Rede para bloqueio automático de chamadas locais.',
      'Dispositivo de Dados Reservados para gravação sigilosa de senhas.',
      'Diretriz de Discagem Regional obrigatória apenas para chamadas DDI.',
      'Duplicador de Ramal Analógico sem conexão com central PABX.',
    ],
    correctIndex: 0,
    explanation:
      'DDR (Discagem Direta a Ramal) permite que o chamador externo disque diretamente o número completo associado a um ramal interno específico na central PABX.',
    legalBasis: 'Noções de Telefonia · Edital 001/2026 (Cargo 02 PL.AL.065)',
    source: 'Treinamento Complementar · Cargo 02',
    originType: 'training_platform',
    isOfficial: false,
  },
  {
    id: 'nm_ext_c02_02',
    disciplineId: 'nm_02_rotinas_saude_alepa',
    topicTitle: 'Ergonomia no Teleatendimento (NR-17, Anexo II)',
    statement:
      'Conforme o Anexo II da Norma Regulamentadora nº 17 (NR-17 – Ergonomia em Teleatendimento), para prevenir sobrecarga muscular e vocal dos operadores, o empregador deve assegurar:',
    options: [
      'Jornada ininterrupta de 8 horas sem pausas para descanso.',
      'Fornecimento de conjunto microfone-fone (headset) individual, mobiliário ajustável e pausas regulares durante a jornada.',
      'Proibição de ingestão de água no posto de trabalho.',
      'Uso compartilhado de fone intra-auricular sem higienização.',
      'Substituição das pausas por horas extras obrigatórias.',
    ],
    correctIndex: 1,
    explanation:
      'O Anexo II da NR-17 determina o fornecimento de headsets individuais adequados, mobiliário ergonômico ajustável e pausas regulares fora do posto de atendimento.',
    legalBasis: 'NR-17, Anexo II · Cargo 02 (PL.AL.065)',
    source: 'Fundação CETAP · Cargo 02',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_c03_01',
    disciplineId: 'nm_03_eletricidade_hidraulica',
    topicTitle: 'Segurança em Eletricidade (NR-10) e NBR 5410',
    statement:
      'De acordo com a Norma Regulamentadora nº 10 (NR-10), uma instalação elétrica somente será considerada desenergizada para trabalho seguro após a execução sequencial de etapas específicas, entre as quais se inicia obrigatoriamente pelo:',
    options: [
      'Religamento imediato do disjuntor geral.',
      'Seccionamento do circuito, seguido de impedimento de reenergização, constatação da ausência de tensão, instalação de aterramento temporário e proteção/sinalização.',
      'Apenas o uso de luva de algodão sem verificação com multímetro.',
      'Lavagem úmida do quadro de distribuição antes do bloqueio.',
      'Retirada da placa de advertência para agilizar o serviço.',
    ],
    correctIndex: 1,
    explanation:
      'O item 10.5.1 da NR-10 estabelece as seis etapas obrigatórias para desenergização: seccionamento, impedimento de reenergização, constatação da ausência de tensão, instalação de aterramento temporário, proteção dos elementos energizados na zona controlada e instalação de sinalização de impedimento.',
    legalBasis: 'NR-10, item 10.5.1 · Cargo 03 (PL.AL.062)',
    source: 'Fundação CETAP · Cargo 03',
    originType: 'official_cetap',
    isOfficial: true,
  },
  {
    id: 'nm_ext_c03_02',
    disciplineId: 'nm_03_climatizacao_seguranca_patrimonio',
    topicTitle: 'Combate a Incêndios (NR-23) e PMOC (Lei nº 13.589/2018)',
    statement:
      'Na prevenção e combate a incêndios, um princípio de fogo envolvendo equipamentos elétricos energizados (como quadros de distribuição e servidores) classifica-se como incêndio de:',
    options: [
      'Classe A (apagado preferencialmente com jato pleno de água).',
      'Classe B (líquidos inflamáveis).',
      'Classe C (equipamentos elétricos energizados, exigindo agente não condutor como CO2 ou pó químico seco).',
      'Classe D (metais pirofóricos).',
      'Classe K (óleos e gorduras de cozinha).',
    ],
    correctIndex: 2,
    explanation:
      'Incêndios Classe C ocorrem em equipamentos e instalações elétricas energizadas; jamais se deve usar água comum (condutora de eletricidade), utilizando-se preferencialmente extintores de CO2 (dióxido de carbono) ou Pó Químico Seco (PQS).',
    legalBasis: 'NR-23 · Segurança contra Incêndios · Cargo 03 (PL.AL.062)',
    source: 'Treinamento Complementar · Cargo 03',
    originType: 'training_platform',
    isOfficial: false,
  },
];
