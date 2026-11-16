import { Discipline, MedioCargoGroup } from '../types';

export const MEDIO_CONCURSO_PROFILE = {
  title: 'Concurso ALEPA 2026 – Nível Médio',
  primaryCargoNumber: 'Cargo 04',
  primaryCargoCode: 'PL.AL.060',
  primaryCargoTitle: 'Auxiliar Técnico Legislativo – Assistência Administrativa',
  editalNumber: 'Edital nº 001/2026 (de 28/09/2026)',
  retificacaoNote: 'Anexo II oficial (com Retificação nº 002/2026)',
  board: 'Fundação CETAP',
  editalUrl: 'https://fundacaocetap.selecao.net.br/informacoes/156',
  level: 'Ensino Médio Completo',
  remuneration: 'R$ 2.295,22',
  remunerationFull: 'R$ 2.295,22 + Gratif. Dedicação Legislativa (80%)',
  workload: '30 horas semanais',
  examDate: '2026-12-13',
  cargo04SpecificNote:
    'Importante: Direito Constitucional, Direito Administrativo, Técnica Legislativa, Administração Pública e Secretaria estão descritos conjuntamente para os cargos 01 e 04 no edital. Arquivologia e Recursos Materiais também integram o conteúdo específico do Cargo 04.',
} as const;

export interface MedioCargoInfo {
  cargoNumber: string;
  code: string;
  title: string;
  shortTitle: string;
  group: MedioCargoGroup;
  vacanciesSummary: string;
  vacanciesBreakdown: string;
  remuneration: string;
  workload: string;
  activitiesSummary: string;
}

export const MEDIO_CARGOS: MedioCargoInfo[] = [
  {
    cargoNumber: 'Cargo 04',
    code: 'PL.AL.060',
    title: 'Auxiliar Técnico Legislativo – Assistência Administrativa',
    shortTitle: 'Cargo 04 · Assistência Administrativa',
    group: 'cargo_01_04',
    vacanciesSummary: '14 vagas (maior oferta do Nível Médio)',
    vacanciesBreakdown: '08 AC · 01 PcD · 03 Pretos e Pardos · 01 Quilombolas · 01 Indígenas',
    remuneration: 'R$ 2.295,22',
    workload: '30h semanais',
    activitiesSummary:
      'Redigir correspondências; controlar guias, formulários e materiais; protocolar e arquivar processos; operar editores de textos, planilhas e apresentações em slides; elaborar agendas e roteiros das sessões e comissões; organizar coleções do Diário da Assembleia e avulsos.',
  },
  {
    cargoNumber: 'Cargo 01',
    code: 'PL.AL.066',
    title: 'Auxiliar Técnico Legislativo – Assistência de Plenário',
    shortTitle: 'Cargo 01 · Assistência de Plenário',
    group: 'cargo_01',
    vacanciesSummary: '01 vaga (Ampla Concorrência)',
    vacanciesBreakdown: '01 AC · Sem reserva para PcD, PPP, Quilombolas ou Indígenas',
    remuneration: 'R$ 2.295,22',
    workload: '30h semanais',
    activitiesSummary:
      'Distribuir aos parlamentares impressos e avulsos de reuniões; atender deputados, visitantes, jornalistas e servidores; atender telefone e anotar recados; orientar público e autoridades; embalar e despachar materiais de divulgação; conservar o plenário em ordem.',
  },
  {
    cargoNumber: 'Cargo 02',
    code: 'PL.AL.065',
    title: 'Auxiliar Técnico Legislativo – Atendimento de Central Telefônica',
    shortTitle: 'Cargo 02 · Central Telefônica',
    group: 'cargo_02',
    vacanciesSummary: '01 vaga (Ampla Concorrência)',
    vacanciesBreakdown: '01 AC · Sem reserva para PcD, PPP, Quilombolas ou Indígenas',
    remuneration: 'R$ 2.295,22',
    workload: '30h semanais',
    activitiesSummary:
      'Efetuar, receber e transmitir chamadas internas, externas e interurbanas em troncos e ramais; anotar e transmitir recados; verificar defeitos em ramais e mesa; manter registro de ligações para mapa mensal; zelar pela manutenção dos equipamentos telefônicos.',
  },
  {
    cargoNumber: 'Cargo 03',
    code: 'PL.AL.062',
    title: 'Auxiliar Técnico Legislativo – Manutenção de Patrimônio',
    shortTitle: 'Cargo 03 · Manutenção de Patrimônio',
    group: 'cargo_03',
    vacanciesSummary: '01 vaga (Ampla Concorrência)',
    vacanciesBreakdown: '01 AC · Sem reserva para PcD, PPP, Quilombolas ou Indígenas',
    remuneration: 'R$ 2.295,22',
    workload: '30h semanais',
    activitiesSummary:
      'Executar trabalhos mecânicos e elétricos de manutenção preventiva e corretiva; recuperar instalações elétricas e hidráulicas (ar-condicionado, ventiladores, bombas, válvulas); controlar entrada/saída de equipamentos; manusear equipamentos contra incêndio e registrar ocorrências.',
  },
];

const MEDIO_COMMON_DISCIPLINES: Discipline[] = [
  {
    id: 'nm_portugues',
    name: 'Língua Portuguesa',
    shortName: 'Língua Portuguesa',
    editalBlock: 'Língua Portuguesa',
    priorityRank: 1,
    examQuestions: 10,
    examPoints: 2.0,
    tieBreakerOrder: 3,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'nm_lp_interpretacao_coesao',
        disciplineId: 'nm_portugues',
        title: 'Compreensão, Argumentação, Coesão, Coerência e Significação',
        subtopics: [
          'Compreensão e Interpretação de Textos; Argumentação e persuasão',
          'Comunicação assertiva: linguagem simples, concisa e objetiva',
          'Coesão e coerência; Figuras de Linguagem',
          'Sinônimos, antônimos, homônimos e parônimos',
        ],
        highYield: true,
      },
      {
        id: 'nm_lp_gramatica_crase',
        disciplineId: 'nm_portugues',
        title: 'Ortografia, Acentuação, Crase, Porquês e Classes de Palavras',
        subtopics: [
          'Ortografia e Acentuação gráfica; Uso dos porquês',
          'Emprego do sinal indicativo de crase',
          'Classes de Palavras (substantivo, verbo, adjetivo, pronome, artigo, numeral, preposição, conjunção, interjeição e advérbio)',
        ],
        highYield: true,
      },
      {
        id: 'nm_lp_sintaxe_redacao',
        disciplineId: 'nm_portugues',
        title: 'Sintaxe, Concordância, Regência, Pronomes e Redação Oficial',
        subtopics: [
          'Período simples e composto; Pontuação',
          'Concordância Nominal e Verbal; Regência Nominal e Verbal',
          'Colocação dos pronomes oblíquos átonos',
          'Redação oficial: textos formais e Manual de Redação da Presidência da República',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_legislacao_etica',
    name: 'Legislação e Ética',
    shortName: 'Legislação e Ética',
    editalBlock: 'Legislação e Ética',
    priorityRank: 2,
    examQuestions: 10,
    examPoints: 2.0,
    tieBreakerOrder: 2,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_le_etica_lgpd_anticorrupcao',
        disciplineId: 'nm_legislacao_etica',
        title: 'LGPD, Ética no Serviço Público, Anticorrupção e Improbidade (Lei 8.429/92)',
        subtopics: [
          'Enfrentamento ao assédio moral e sexual; Ética, moral, cidadania e função pública',
          'LGPD (Lei nº 13.709/2018 e alterações)',
          'Legislação anticorrupção (Lei nº 12.846/2013 e Decreto nº 11.129/2022)',
          'Improbidade Administrativa (Lei nº 8.429/1992 alterada pela Lei nº 14.230/2021)',
        ],
        highYield: true,
      },
      {
        id: 'nm_le_const_para_lc95',
        disciplineId: 'nm_legislacao_etica',
        title: 'Constituição do Estado do Pará e Legislação da ALEPA',
        subtopics: [
          'Constituição do Pará aplicada ao Legislativo: arts. 11, 86, 90, 92 a 116, 121, 161, 162, 168 e 341',
          'ALEPA, Deputados Estaduais, Plenário, Comissões, fiscalização, controle interno e constitucionalidade',
          'Lei Complementar Federal nº 95/1998 e alterações',
        ],
        highYield: true,
      },
      {
        id: 'nm_le_regimento_resolucoes',
        disciplineId: 'nm_legislacao_etica',
        title: 'Regimento Interno (Res. 02/2022), Decretos Legislativos e Resoluções ALEPA',
        subtopics: [
          'Mesa Diretora, Presidência, sessões, deliberações, CCJ e CCFO',
          'Proposições, quóruns, turnos, interstícios, urgência, autógrafos, sanção e veto',
          'PPA, LDO, LOA, emendas orçamentárias, iniciativa popular e assessoramento legislativo',
          'Decretos Legislativos (1990–2025) e Resoluções ALEPA (1991–2026) — Retificação nº 002/2026',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_informatica',
    name: 'Informática',
    shortName: 'Informática',
    editalBlock: 'Noções de Informática',
    priorityRank: 3,
    examQuestions: 5,
    examPoints: 1.0,
    tieBreakerOrder: 5,
    recommendedMinutesPerCycle: 40,
    topics: [
      {
        id: 'nm_inf_so_office',
        disciplineId: 'nm_informatica',
        title: 'Windows 10/11, Word, Excel, PowerPoint (2013–O365) e LibreOffice 7+',
        subtopics: [
          'Windows 10 e Windows 11; hardware, periféricos, arquivos, pastas e programas',
          'Word, Excel e PowerPoint (2013 até O365) e LibreOffice 7 ou superior',
        ],
        highYield: true,
      },
      {
        id: 'nm_inf_seguranca_redes_nuvem',
        disciplineId: 'nm_informatica',
        title: 'Internet, Segurança da Informação, Nuvem e Colaboração',
        subtopics: [
          'Segurança: controle de USB, hardening, antimalware e firewall pessoal',
          'Internet/intranet; Chrome, Edge e Firefox; Outlook (2013–O365), fóruns, wikis e redes sociais',
          'Moodle, SharePoint, Google Drive, multimídia, Microsoft Teams, Cisco Webex e Google Meet',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_raciocinio_logico',
    name: 'Raciocínio Lógico',
    shortName: 'Raciocínio Lógico',
    editalBlock: 'Raciocínio Lógico',
    priorityRank: 4,
    examQuestions: 5,
    examPoints: 1.0,
    tieBreakerOrder: 4,
    recommendedMinutesPerCycle: 40,
    topics: [
      {
        id: 'nm_rl_logica_situacoes',
        disciplineId: 'nm_raciocinio_logico',
        title: 'Lógica, Relações Arbitrárias, Sequências e Dedução',
        subtopics: [
          'Relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios',
          'Raciocínio verbal, sequencial, orientação espacial/temporal e formação de conceitos',
          'Processo lógico a partir de hipóteses até conclusões determinadas',
        ],
        highYield: true,
      },
      {
        id: 'nm_rl_matematica_proporcional',
        disciplineId: 'nm_raciocinio_logico',
        title: 'Matemática, Proporção, Regra de Três e Porcentagem',
        subtopics: [
          'Conjuntos numéricos racionais e reais (frações e decimais) e conjuntos complexos',
          'Razão e proporção, divisão proporcional, regra de três simples e composta e porcentagem',
        ],
        highYield: true,
      },
    ],
  },
];

const MEDIO_CARGO_01_04_SPECIFICS: Discipline[] = [
  {
    id: 'nm_01_04_constitucional',
    name: 'Direito Constitucional',
    shortName: 'Direito Constitucional',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 5,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c14_const_teoria_direitos',
        disciplineId: 'nm_01_04_constitucional',
        title: 'Constituição, Princípios Fundamentais (arts. 1º–4º) e Direitos Fundamentais (art. 5º)',
        subtopics: [
          'Conceito, classificação, elementos, supremacia e controle de constitucionalidade',
          'Direitos individuais/coletivos e Remédios Constitucionais (HC, HD, MS, MI, Ação Popular)',
          'Direitos sociais, nacionalidade, direitos políticos e partidos políticos',
        ],
        highYield: true,
      },
      {
        id: 'nm_c14_const_estado_legislativo',
        disciplineId: 'nm_01_04_constitucional',
        title: 'Organização do Estado, Poder Legislativo e Processo Legislativo',
        subtopics: [
          'União, Estados, DF e Municípios: repartição de competências e autonomia estadual',
          'Congresso Nacional, Câmara, Senado, Assembleias Legislativas e Comissões Parlamentares',
          'Espécies normativas: LC, LO, lei delegada, medida provisória, decretos legislativos e resoluções',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_01_04_administrativo',
    name: 'Direito Administrativo',
    shortName: 'Direito Administrativo',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 6,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c14_adm_principios_rju',
        disciplineId: 'nm_01_04_administrativo',
        title: 'Administração Pública (art. 37 CF), Servidores e RJU do Pará (Lei 5.810/94)',
        subtopics: [
          'Princípios constitucionais e disposições sobre servidores públicos',
          'RJU do Pará (Lei Estadual nº 5.810/1994): provimento, vacância, direitos, deveres e regime disciplinar',
          'Ordem Econômica/Financeira e Orçamento Público (PPA, LDO, LOA e papel do Legislativo)',
        ],
        highYield: true,
      },
      {
        id: 'nm_c14_adm_atos_licitacoes',
        disciplineId: 'nm_01_04_administrativo',
        title: 'Atos Administrativos, Organização, Serviços Públicos e Licitações (Lei 14.133/21)',
        subtopics: [
          'Atos Administrativos e Organização Administrativa (direta e indireta)',
          'Serviços Públicos; Licitações e Contratos Administrativos (Lei nº 14.133/2021)',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_01_04_tecnica_legislativa',
    name: 'Técnica Legislativa',
    shortName: 'Técnica Legislativa',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 7,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'nm_c14_tl_estrutura_lc95',
        disciplineId: 'nm_01_04_tecnica_legislativa',
        title: 'Redação de Leis (LC nº 95/98), Pareceres, Indicações, Requerimentos e Moções',
        subtopics: [
          'Clareza, precisão, concisão, impessoalidade, formalidade e vícios de redação',
          'Epígrafe, ementa, preâmbulo, texto normativo; partes, livros, títulos, capítulos, seções, artigos a itens',
          'Alteração (modificação, revogação), consolidação, codificação; pareceres, indicações, requerimentos e moções',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_04_administracao_publica',
    name: 'Administração Pública',
    shortName: 'Administração Pública',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 8,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'nm_c04_adm_publica_gestao',
        disciplineId: 'nm_04_administracao_publica',
        title: 'Organização, Estruturas, Processos, Projetos e Gestão de Contratos',
        subtopics: [
          'Estrutura organizacional, departamentalização, centralização e descentralização',
          'Gestão de processos, gestão por projetos, gestão por competências e gestão por resultados',
          'Planejamento institucional e fiscalização/gestão de contratos administrativos',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_04_secretaria',
    name: 'Secretaria',
    shortName: 'Secretaria',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 9,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 40,
    topics: [
      {
        id: 'nm_c04_secretaria_rotinas',
        disciplineId: 'nm_04_secretaria',
        title: 'Documentos, Relatórios, Formulários, Planilhas e Atendimento ao Público',
        subtopics: [
          'Preparo de documentos oficiais, relatórios, formulários e planilhas operacionais',
          'Controle de envio e recebimento de expedientes, agendas e roteiros de reuniões/comissões',
          'Atendimento presencial e telefônico ao público e autoridades; Manual de Redação',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_04_arquivologia',
    name: 'Arquivologia',
    shortName: 'Arquivologia',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 10,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'nm_c14_arquivologia',
        disciplineId: 'nm_04_arquivologia',
        title: 'Protocolo, Classificação, Temporalidade e Gestão de Documentos (Lei 8.159/91)',
        subtopics: [
          'Princípios arquivísticos e Política Nacional de Arquivos Públicos e Privados (Lei nº 8.159/1991)',
          'Teoria das três idades (corrente, intermediário e permanente) e gestão documental',
          'Protocolo (recebimento, registro, autuação, tramitação), classificação, ordenação e tabela de temporalidade',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_04_recursos_materiais',
    name: 'Recursos Materiais',
    shortName: 'Recursos Materiais',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 11,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 40,
    topics: [
      {
        id: 'nm_c14_recursos_materiais',
        disciplineId: 'nm_04_recursos_materiais',
        title: 'Compras, Estoque, Recebimento, Armazenagem e Gestão Patrimonial',
        subtopics: [
          'Administração de compras e classificação de materiais (ABC, XYZ, criticidade)',
          'Compras governamentais (Lei nº 14.133/2021), gestão de estoques (PEPS/FIFO, estoque mínimo, ponto de pedido)',
          'Recebimento, conferência, armazenagem, distribuição e tombamento/inventário patrimonial',
        ],
        highYield: true,
      },
    ],
  },
];

const MEDIO_CARGO_02_SPECIFICS: Discipline[] = [
  {
    id: 'nm_02_atendimento_telefonia',
    name: 'Atendimento Telefônico e Noções de Telefonia (Cargo 02 · PL.AL.065)',
    shortName: 'Atend. e Telefonia',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 5,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c02_tecnicas_atendimento',
        disciplineId: 'nm_02_atendimento_telefonia',
        title: 'Técnicas de Atendimento Telefônico, Comunicação e Pronomes de Tratamento',
        subtopics: [
          'Comunicação oral, barreiras, voz, dicção, entonação e etapas da chamada',
          'Formas e pronomes de tratamento com autoridades (Manual de Redação da Presidência)',
          'Transferência, recados, alfabeto fonético, situações difíceis, emergências e sigilo',
        ],
        highYield: true,
      },
      {
        id: 'nm_c02_nocoes_telefonia',
        disciplineId: 'nm_02_atendimento_telefonia',
        title: 'Noções de Telefonia: PABX, DDR, VoIP, Softphones e Tarifação',
        subtopics: [
          'Telefonia fixa/móvel; centrais PABX (analógicas, digitais e IP), troncos, ramais e DDR',
          'Chamadas locais, DDD, DDI e serviços de emergência; URA, correio de voz, siga-me e conferência',
          'VoIP, softphones, tarifação, bilhetagem, diagnóstico de defeitos e conservação dos aparelhos',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_02_rotinas_saude_alepa',
    name: 'Rotinas Telefônicas, Atendimento ao Público, Ergonomia e ALEPA (Cargo 02)',
    shortName: 'Rotinas, NR-17 e ALEPA',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 6,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c02_rotinas_lgpd',
        disciplineId: 'nm_02_rotinas_saude_alepa',
        title: 'Rotinas, Mapas de Chamadas, Planilhas e LGPD no Atendimento',
        subtopics: [
          'Listas de ramais, catálogos de autoridades, formulários e mapa mensal de chamadas',
          'Planilhas/tabelas de controle e tratamento de dados pessoais (LGPD – Lei nº 13.709/2018)',
        ],
        highYield: true,
      },
      {
        id: 'nm_c02_direitos_nr17',
        disciplineId: 'nm_02_rotinas_saude_alepa',
        title: 'Atendimento ao Público, Prioridades e Ergonomia (NR-17, Anexo II)',
        subtopics: [
          'Direitos dos usuários (Lei nº 13.460/2017) e prioridade / PcD (Leis 10.048/2000 e 13.146/2015)',
          'Ergonomia e saúde no teleatendimento (NR-17, Anexo II): pausas, postura, headset e voz',
        ],
        highYield: true,
      },
      {
        id: 'nm_c02_alepa_gestao',
        disciplineId: 'nm_02_rotinas_saude_alepa',
        title: 'Noções sobre a ALEPA, RJU (Lei 5.810/94) e Gestão (PDCA)',
        subtopics: [
          'Estrutura da ALEPA (Mesa Diretora, Plenário, Comissões), cerimonial e protocolo',
          'Deveres e proibições do servidor (Lei Estadual nº 5.810/1994), gestão de conflitos e ciclo PDCA',
        ],
        highYield: true,
      },
    ],
  },
];

const MEDIO_CARGO_03_SPECIFICS: Discipline[] = [
  {
    id: 'nm_03_eletricidade_hidraulica',
    name: 'Eletricidade e Instalações Hidráulicas/Sanitárias (Cargo 03 · PL.AL.062)',
    shortName: 'Elétrica e Hidráulica',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 5,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c03_eletricidade_nr10',
        disciplineId: 'nm_03_eletricidade_hidraulica',
        title: 'Eletricidade, Instalações (NBR 5410 / NBR 14136) e Segurança (NR-10)',
        subtopics: [
          'Tensão, corrente, resistência, potência, Lei de Ohm, CC/CA e sistemas mono/bi/trifásico',
          'Baixa tensão (ABNT NBR 5410): disjuntores, DR, DPS, aterramento, tomadas (NBR 14136)',
          'Esquemas elétricos, multímetro, alicate amperímetro e NR-10 (desenergização, bloqueio e sinalização)',
        ],
        highYield: true,
      },
      {
        id: 'nm_c03_hidraulica_sanitaria',
        disciplineId: 'nm_03_eletricidade_hidraulica',
        title: 'Instalações Hidráulicas e Sanitárias (ABNT NBR 5626 e NBR 8160)',
        subtopics: [
          'Água fria e quente (NBR 5626) e esgoto sanitário (NBR 8160): tubos, válvulas e registros',
          'Caixas d’água (limpeza/desinfecção), bombas de recalque, pressurizadores e reparo de vazamentos',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'nm_03_climatizacao_seguranca_patrimonio',
    name: 'Climatização, Segurança do Trabalho, Incêndio e Gestão Patrimonial (Cargo 03)',
    shortName: 'Climatização, NRs e Patrimônio',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 6,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'nm_c03_maquinas_pmoc',
        disciplineId: 'nm_03_climatizacao_seguranca_patrimonio',
        title: 'Máquinas, Equipamentos, Climatização e PMOC (Lei nº 13.589/2018)',
        subtopics: [
          'Manutenção preventiva, corretiva e preditiva; ar-condicionado (janela/split), bebedouros e compressores',
          'PMOC (Lei nº 13.589/2018), ferramentas, mecânica básica, lubrificação e ordens de serviço',
        ],
        highYield: true,
      },
      {
        id: 'nm_c03_seguranca_incendio',
        disciplineId: 'nm_03_climatizacao_seguranca_patrimonio',
        title: 'Segurança do Trabalho (NRs 6, 23, 26 e 35) e Combate a Incêndios',
        subtopics: [
          'EPI/EPC (NR-6), trabalho em altura (NR-35), sinalização (NR-26) e primeiros socorros',
          'NR-23: tetraedro do fogo, classes de incêndio, extintores, hidrantes e abandono de edificação',
        ],
        highYield: true,
      },
      {
        id: 'nm_c03_alepa_patrimonio',
        disciplineId: 'nm_03_climatizacao_seguranca_patrimonio',
        title: 'ALEPA, RJU (Lei 5.810/94), PDCA e Gestão Patrimonial',
        subtopics: [
          'Funções e estrutura da ALEPA; deveres e proibições (Lei Estadual nº 5.810/1994); PDCA',
          'Gestão patrimonial: tombamento, guarda, conservação, movimentação, inventário e sustentabilidade',
        ],
        highYield: true,
      },
    ],
  },
];

export function getMedioDisciplines(cargoGroup: MedioCargoGroup = 'cargo_01_04'): Discipline[] {
  if (cargoGroup === 'cargo_02') {
    return [...MEDIO_COMMON_DISCIPLINES, ...MEDIO_CARGO_02_SPECIFICS];
  }
  if (cargoGroup === 'cargo_03') {
    return [...MEDIO_COMMON_DISCIPLINES, ...MEDIO_CARGO_03_SPECIFICS];
  }
  return [...MEDIO_COMMON_DISCIPLINES, ...MEDIO_CARGO_01_04_SPECIFICS];
}

export function getMedioCargoInfo(cargoGroup: MedioCargoGroup = 'cargo_01_04'): MedioCargoInfo {
  return MEDIO_CARGOS.find((c) => c.group === cargoGroup) || MEDIO_CARGOS[0];
}

export const ALL_MEDIO_DISCIPLINES: Discipline[] = [
  ...MEDIO_COMMON_DISCIPLINES,
  ...MEDIO_CARGO_01_04_SPECIFICS,
  ...MEDIO_CARGO_02_SPECIFICS,
  ...MEDIO_CARGO_03_SPECIFICS,
];

export function isMedioDisciplineId(disciplineId?: string): boolean {
  return Boolean(disciplineId && disciplineId.startsWith('nm_'));
}
