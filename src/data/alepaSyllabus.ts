import { BlockType, CampusLevel, Discipline, MedioCargoGroup } from '../types';
import { ALL_MEDIO_DISCIPLINES, getMedioCargoInfo, getMedioDisciplines } from './alepaMedioSyllabus';

export const CONCURSO_PROFILE = {
  title: 'ALEPA 2026 – Cargo 03 & Analista Adm.',
  cargo: 'Assessoramento Legislativo – Técnico Legislativo · Analista Legislativo – Administração',
  code: 'PL.AL.102',
  level: 'Nível Superior',
  board: 'Fundação CETAP',
  editalNumber: 'Edital nº 002/2026',
  editalUrl: 'https://fundacaocetap.selecao.net.br/informacoes/156/',
  anexoIIPdfPath: '/assets/aistudio/ANEXO_II___CONTE_DO_PROGRAM_TICO_028a2412.pdf',
  anexoIIIPdfPath: '/assets/aistudio/ANEXO_III___CRONOGRAMA_COMPLETO_73c02e9f.pdf',
  dailyGoalMinutes: 120,
  examDate: '2026-12-13',
  totalQuestions: 50,
  maxScore: 10.0,
  pointsPerQuestion: 0.2,
} as const;

export interface PriorityTrackItem {
  rank: number;
  title: string;
  detail: string;
  disciplineId: string;
}

export const ADMIN_LEGISLATIVE_PRIORITIES: PriorityTrackItem[] = [
  {
    rank: 1,
    title: 'Teorias da Administração e funções administrativas',
    detail: 'Teorias administrativas e funções PODC (Planejamento, Organização, Direção e Controle).',
    disciplineId: 'administracao_gestao',
  },
  {
    rank: 2,
    title: 'Planejamento estratégico e ferramentas de gestão',
    detail: 'Planejamento estratégico, tático e operacional; missão, visão, valores; PDCA, 5W2H, GUT e Ishikawa.',
    disciplineId: 'administracao_gestao',
  },
  {
    rank: 3,
    title: 'Gestão de Pessoas e comportamento organizacional',
    detail: 'Recrutamento, seleção, competências, liderança, motivação, conflitos, clima, T&D, avaliação e remuneração.',
    disciplineId: 'administracao_gestao',
  },
  {
    rank: 4,
    title: 'Gestão de projetos, processos e qualidade',
    detail: 'Mapeamento e gestão de processos, projetos, indicadores de desempenho e qualidade no serviço público.',
    disciplineId: 'administracao_gestao',
  },
  {
    rank: 5,
    title: 'Administração Pública e governança',
    detail: 'Princípios constitucionais, organização administrativa, centralização, descentralização e governança.',
    disciplineId: 'direito_administrativo',
  },
  {
    rank: 6,
    title: 'Gestão de materiais, logística e estoques',
    detail: 'Gestão de materiais, controle de estoques, logística, compras e cadeia de suprimentos.',
    disciplineId: 'administracao_gestao',
  },
  {
    rank: 7,
    title: 'Orçamento e planejamento governamental',
    detail: 'PPA, LDO, LOA, ciclo orçamentário, créditos adicionais e Lei nº 4.320/1964.',
    disciplineId: 'direito_financeiro',
  },
  {
    rank: 8,
    title: 'Direito Administrativo e Lei de Responsabilidade Fiscal',
    detail: 'Atos, agentes e serviços públicos, Lei nº 14.133/2021 e LC nº 101/2000 (LRF).',
    disciplineId: 'direito_administrativo',
  },
];

export interface DetailedScheduleDay {
  dateKey: string;
  dateLabel: string;
  weekId: 'semana_1' | 'semana_2' | 'semana_3';
  weekTitle: string;
  mainContent: string;
  practiceTarget: string;
  disciplineId: string;
  secondaryDisciplineId: string;
  topicTitle: string;
  studyTip: string;
}

export interface DetailedScheduleWeek {
  id: 'semana_1' | 'semana_2' | 'semana_3';
  title: string;
  period: string;
  days: DetailedScheduleDay[];
}

export const DETAILED_NOV_DEC_SCHEDULE: DetailedScheduleWeek[] = [
  {
    id: 'semana_1',
    title: 'Semana 1 – Fundamentos e conteúdos comuns',
    period: '14/11 a 20/11',
    days: [
      {
        dateKey: '2026-11-14',
        dateLabel: '14/11 – Sáb.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Português: interpretação, compreensão, coesão e coerência. Administração: teorias administrativas e funções PODC.',
        practiceTarget: '20 questões de Português e Administração.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'portugues',
        topicTitle: 'Português (interpretação/coesão) + Administração (teorias e funções PODC)',
        studyTip: 'Combine 1h de interpretação e conectivos de coesão/coerência com 1h de teorias administrativas e funções PODC (Planejar, Organizar, Dirigir e Controlar).',
      },
      {
        dateKey: '2026-11-15',
        dateLabel: '15/11 – Dom.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Raciocínio lógico: proposições, relações lógicas, dedução e sequências.',
        practiceTarget: '20 questões de lógica.',
        disciplineId: 'raciocinio_logico',
        secondaryDisciplineId: 'portugues',
        topicTitle: 'Proposições, relações lógicas, dedução e sequências',
        studyTip: 'Monte tabelas-verdade e matrizes de associação antes de marcar nas questões da banca CETAP.',
      },
      {
        dateKey: '2026-11-16',
        dateLabel: '16/11 – Seg.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Administração: planejamento estratégico, tático e operacional; missão, visão e valores.',
        practiceTarget: 'PCI: 20 questões de planejamento.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'direito_administrativo',
        topicTitle: 'Planejamento estratégico, tático e operacional; missão, visão e valores',
        studyTip: 'Diferencie horizonte temporal e abrangência dos níveis estratégico, tático e operacional e pratique 20 questões no PCI.',
      },
      {
        dateKey: '2026-11-17',
        dateLabel: '17/11 – Ter.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Legislação: ética, moral, princípios, valores, conduta e ética no serviço público.',
        practiceTarget: '20 questões de ética.',
        disciplineId: 'legislacao_etica',
        secondaryDisciplineId: 'portugues',
        topicTitle: 'Ética, moral, princípios, valores, conduta e ética no serviço público',
        studyTip: 'Foque na distinção entre ética e moral, responsabilidade social e conduta na função pública.',
      },
      {
        dateKey: '2026-11-18',
        dateLabel: '18/11 – Qua.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Informática: Windows 10/11, hardware, software, arquivos e pastas.',
        practiceTarget: '20 questões de informática.',
        disciplineId: 'informatica',
        secondaryDisciplineId: 'raciocinio_logico',
        topicTitle: 'Windows 10/11, hardware, software, arquivos e pastas',
        studyTip: 'Revise extensões de arquivo, atalhos do Windows Explorer e diferença entre hardware/software básico e utilitário.',
      },
      {
        dateKey: '2026-11-19',
        dateLabel: '19/11 – Qui.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Gestão de Pessoas: recrutamento, seleção, integração e competências.',
        practiceTarget: 'PCI: 20 questões de gestão de pessoas.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'direito_administrativo',
        topicTitle: 'Gestão de Pessoas: recrutamento, seleção, integração e competências',
        studyTip: 'Compare recrutamento interno vs. externo, técnicas de seleção e o tripé CHA (Conhecimentos, Habilidades e Atitudes).',
      },
      {
        dateKey: '2026-11-20',
        dateLabel: '20/11 – Sex.',
        weekId: 'semana_1',
        weekTitle: 'Semana 1 – Fundamentos e conteúdos comuns',
        mainContent: 'Poder Legislativo: funções, competências, organização e fiscalização.',
        practiceTarget: 'PCI: 20 questões legislativas.',
        disciplineId: 'direito_constitucional',
        secondaryDisciplineId: 'processo_legislativo',
        topicTitle: 'Poder Legislativo: funções, competências, organização e fiscalização',
        studyTip: 'Revise funções típica (legislar e fiscalizar) e atípica (administrar e julgar), além do controle externo com auxílio do Tribunal de Contas.',
      },
    ],
  },
  {
    id: 'semana_2',
    title: 'Semana 2 – Administração e legislação legislativa',
    period: '21/11 a 27/11',
    days: [
      {
        dateKey: '2026-11-21',
        dateLabel: '21/11 – Sáb.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Administração Pública: princípios, organização administrativa, centralização e descentralização.',
        practiceTarget: '25 questões.',
        disciplineId: 'direito_administrativo',
        secondaryDisciplineId: 'administracao_gestao',
        topicTitle: 'Administração Pública: princípios, organização, centralização e descentralização',
        studyTip: 'Diferencie desconcentração (órgãos, com hierarquia) de descentralização (entidades, vinculação/tutela).',
      },
      {
        dateKey: '2026-11-22',
        dateLabel: '22/11 – Dom.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Processo Legislativo: iniciativa, proposições, projetos, emendas e tramitação.',
        practiceTarget: 'PCI: 25 questões.',
        disciplineId: 'processo_legislativo',
        secondaryDisciplineId: 'direito_constitucional',
        topicTitle: 'Processo Legislativo: iniciativa, proposições, projetos, emendas e tramitação',
        studyTip: 'Mapeie iniciativa privativa vs. concorrente, espécies de emendas (supressiva, aglutinativa, substitutiva, modificativa e aditiva) e prazos de veto.',
      },
      {
        dateKey: '2026-11-23',
        dateLabel: '23/11 – Seg.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Gestão de Pessoas: liderança, motivação, comunicação, conflitos e clima organizacional.',
        practiceTarget: 'PCI: 20 questões.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'legislacao_etica',
        topicTitle: 'Liderança, motivação, comunicação, conflitos e clima organizacional',
        studyTip: 'Revise Maslow, Herzberg, McClelland e estilos de liderança (autocrática, democrática, liberal, transformacional e transacional).',
      },
      {
        dateKey: '2026-11-24',
        dateLabel: '24/11 – Ter.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Direito Administrativo: atos administrativos, atributos, elementos, anulação e revogação.',
        practiceTarget: '25 questões.',
        disciplineId: 'direito_administrativo',
        secondaryDisciplineId: 'processo_legislativo',
        topicTitle: 'Atos administrativos: atributos, elementos, anulação e revogação',
        studyTip: 'Fixe os 5 requisitos (COFIFOMO), os 4 atributos (PATI) e Súmula 473 do STF (anulação por ilegalidade vs. revogação por mérito).',
      },
      {
        dateKey: '2026-11-25',
        dateLabel: '25/11 – Qua.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Processo Legislativo: Mesa Diretora, Presidência, Plenário e Comissões.',
        practiceTarget: '25 questões.',
        disciplineId: 'processo_legislativo',
        secondaryDisciplineId: 'legislacao_etica',
        topicTitle: 'Mesa Diretora, Presidência, Plenário e Comissões (Regimento ALEPA)',
        studyTip: 'Consulte o Regimento Interno (Res. 02/2022) para competências da CCJ, CCFO e deliberações em Plenário.',
      },
      {
        dateKey: '2026-11-26',
        dateLabel: '26/11 – Qui.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Administração: gestão de processos, projetos, qualidade, PDCA, 5W2H, GUT e Ishikawa.',
        practiceTarget: 'PCI: 25 questões.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'direito_administrativo',
        topicTitle: 'Processos, projetos, qualidade, PDCA, 5W2H, GUT e Ishikawa',
        studyTip: 'Associe cada ferramenta ao seu objetivo: PDCA (melhoria contínua), 5W2H (plano de ação), GUT (priorização de problemas) e Ishikawa (causa e efeito).',
      },
      {
        dateKey: '2026-11-27',
        dateLabel: '27/11 – Sex.',
        weekId: 'semana_2',
        weekTitle: 'Semana 2 – Administração e legislação legislativa',
        mainContent: 'Legislação: Constituição do Pará, LGPD, improbidade administrativa e Lei Anticorrupção.',
        practiceTarget: '25 questões.',
        disciplineId: 'legislacao_etica',
        secondaryDisciplineId: 'direito_constitucional',
        topicTitle: 'Constituição do Pará, LGPD, improbidade e Lei Anticorrupção',
        studyTip: 'Revise os arts. expressos da CE-PA (11, 86, 90, 92–116, 121, 161, 162, 168 e 341) e dolo específico na Lei 14.230/21.',
      },
    ],
  },
  {
    id: 'semana_3',
    title: 'Semana 3 – Aprofundamento e revisão',
    period: '28/11 a 04/12',
    days: [
      {
        dateKey: '2026-11-28',
        dateLabel: '28/11 – Sáb.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Administração: gestão de materiais, estoques, logística, compras e cadeia de suprimentos.',
        practiceTarget: '25 questões.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'direito_administrativo',
        topicTitle: 'Gestão de materiais, estoques, logística, compras e cadeia de suprimentos',
        studyTip: 'Pratique cálculos de estoque mínimo, ponto de pedido, Curva ABC e métodos PEPS/UEPS/Custo Médio.',
      },
      {
        dateKey: '2026-11-29',
        dateLabel: '29/11 – Dom.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Direito Financeiro: PPA, LDO, LOA, Lei 4.320/1964 e LRF.',
        practiceTarget: '25 questões.',
        disciplineId: 'direito_financeiro',
        secondaryDisciplineId: 'processo_legislativo',
        topicTitle: 'PPA, LDO, LOA, Lei 4.320/1964 e LRF',
        studyTip: 'Compare créditos adicionais (art. 41 da Lei 4.320/64) e limites de pessoal da LRF para o Legislativo estadual (3% da RCL).',
      },
      {
        dateKey: '2026-11-30',
        dateLabel: '30/11 – Seg.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Gestão de Pessoas: treinamento, desenvolvimento, avaliação de desempenho e remuneração.',
        practiceTarget: 'PCI: 25 questões.',
        disciplineId: 'administracao_gestao',
        secondaryDisciplineId: 'direito_administrativo',
        topicTitle: 'Treinamento, desenvolvimento, avaliação de desempenho e remuneração',
        studyTip: 'Diferencie avaliação 360 graus, escalas gráficas e incidentes críticos, além de treinamento (curto prazo) vs. desenvolvimento (carreira).',
      },
      {
        dateKey: '2026-12-01',
        dateLabel: '01/12 – Ter.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Direito Administrativo: agentes públicos, serviços públicos, licitações e contratos – Lei 14.133/2021.',
        practiceTarget: '25 questões.',
        disciplineId: 'direito_administrativo',
        secondaryDisciplineId: 'administracao_gestao',
        topicTitle: 'Agentes públicos, serviços públicos e Lei 14.133/2021',
        studyTip: 'Revise modalidades da Lei 14.133/2021, critérios de julgamento, dispensa vs. inexigibilidade e regime dos servidores (Lei 5.810/94).',
      },
      {
        dateKey: '2026-12-02',
        dateLabel: '02/12 – Qua.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Técnica Legislativa: LC 95/1998, redação normativa, estrutura e elaboração de leis.',
        practiceTarget: '25 questões.',
        disciplineId: 'processo_legislativo',
        secondaryDisciplineId: 'portugues',
        topicTitle: 'Técnica Legislativa: LC 95/1998, redação normativa e estrutura de leis',
        studyTip: 'Fixe as três partes da lei (preliminar, normativa e final) e o desdobramento: artigo → parágrafo/inciso → alínea → item.',
      },
      {
        dateKey: '2026-12-03',
        dateLabel: '03/12 – Qui.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Português: crase, concordância, regência, pontuação e redação oficial.',
        practiceTarget: '30 questões.',
        disciplineId: 'portugues',
        secondaryDisciplineId: 'processo_legislativo',
        topicTitle: 'Português: crase, concordância, regência, pontuação e redação oficial',
        studyTip: 'Resolva 30 questões revisando casos proibidos de crase, sujeito composto, regência de verbos recorrentes e fechos do Manual da Presidência.',
      },
      {
        dateKey: '2026-12-04',
        dateLabel: '04/12 – Sex.',
        weekId: 'semana_3',
        weekTitle: 'Semana 3 – Aprofundamento e revisão',
        mainContent: 'Informática e Raciocínio Lógico: revisão dos principais tópicos e resolução de exercícios.',
        practiceTarget: '30 questões.',
        disciplineId: 'informatica',
        secondaryDisciplineId: 'raciocinio_logico',
        topicTitle: 'Revisão Informática e Raciocínio Lógico (30 exercícios)',
        studyTip: 'Divida o bloco entre 15 questões de Informática (Office/LibreOffice, segurança, nuvem) e 15 questões de Raciocínio Lógico (equivalências, sequências, porcentagem).',
      },
    ],
  },
];

export const FINAL_REVIEW_DAY_05_12 = {
  dateKey: '2026-12-05',
  dateLabel: '05/12 – Sáb.',
  title: '05/12 – Revisão geral e simulado',
  totalHours: 4,
  periods: [
    {
      id: 'manha',
      label: 'Manhã',
      durationLabel: '2 horas',
      durationMinutes: 120,
      disciplineId: 'processo_legislativo',
      topicTitle: 'Revisão geral: resumos, mapas mentais, dispositivos legais e erros acumulados',
      tasks: [
        'Revisão dos resumos e mapas mentais.',
        'Leitura dos principais dispositivos legais.',
        'Revisão dos erros acumulados.',
      ],
    },
    {
      id: 'tarde',
      label: 'Tarde',
      durationLabel: '2 horas',
      durationMinutes: 120,
      disciplineId: 'administracao_gestao',
      topicTitle: 'Simulado geral (todas as disciplinas), correção comentada e reforço',
      tasks: [
        'Simulado com questões de todas as disciplinas.',
        'Correção comentada.',
        'Identificação dos assuntos que ainda precisam de reforço.',
      ],
    },
  ],
} as const;

const DETAILED_DAY_BY_KEY: Record<string, DetailedScheduleDay> = DETAILED_NOV_DEC_SCHEDULE.flatMap(
  (w) => w.days
).reduce<Record<string, DetailedScheduleDay>>((acc, day) => {
  acc[day.dateKey] = day;
  return acc;
}, {});

export interface OfficialMilestone {
  item: string;
  description: string;
  dateLabel: string;
  isoStart: string;
  isoEnd?: string;
  category: 'inscricao' | 'prova' | 'recurso' | 'resultado';
}

export const OFFICIAL_ANEXO_III_MILESTONES: OfficialMilestone[] = [
  { item: '01', description: 'Publicação do Edital de Abertura do Concurso Público', dateLabel: '28/09/2026', isoStart: '2026-09-28', category: 'inscricao' },
  { item: '02', description: 'Prazo de recurso contra o Edital de Abertura', dateLabel: '29/09/2026 e 30/09/2026', isoStart: '2026-09-29', isoEnd: '2026-09-30', category: 'recurso' },
  { item: '03', description: 'Período das inscrições', dateLabel: '01/10/2026 a 04/11/2026', isoStart: '2026-10-01', isoEnd: '2026-11-04', category: 'inscricao' },
  { item: '04', description: 'Inscrições PcD e Hipossuficientes (solicitação de isenção da taxa)', dateLabel: '01/10/2026 e 02/10/2026', isoStart: '2026-10-01', isoEnd: '2026-10-02', category: 'inscricao' },
  { item: '05', description: 'Envio dos documentos referentes à solicitação de isenção da taxa', dateLabel: '01/10/2026 a 05/10/2026', isoStart: '2026-10-01', isoEnd: '2026-10-05', category: 'inscricao' },
  { item: '06', description: 'Relação preliminar das solicitações de isenção deferidas e indeferidas', dateLabel: '21/10/2026', isoStart: '2026-10-21', category: 'resultado' },
  { item: '07', description: 'Recurso contra a relação preliminar de isenção da taxa', dateLabel: '22/10/2026 e 23/10/2026', isoStart: '2026-10-22', isoEnd: '2026-10-23', category: 'recurso' },
  { item: '08', description: 'Relação definitiva das solicitações de isenção da taxa', dateLabel: '30/10/2026', isoStart: '2026-10-30', category: 'resultado' },
  { item: '09', description: 'Solicitação de atendimento pelo nome social', dateLabel: '01/10/2026 a 04/11/2026', isoStart: '2026-10-01', isoEnd: '2026-11-04', category: 'inscricao' },
  { item: '10', description: 'Envio de documentos comprobatórios – vagas reservadas PcD', dateLabel: '01/10/2026 a 05/11/2026', isoStart: '2026-10-01', isoEnd: '2026-11-05', category: 'inscricao' },
  { item: '11', description: 'Envio da solicitação de atendimento especial e documentação', dateLabel: '01/10/2026 a 05/11/2026', isoStart: '2026-10-01', isoEnd: '2026-11-05', category: 'inscricao' },
  { item: '12', description: 'Lista provisória de candidatos inscritos', dateLabel: '13/11/2026', isoStart: '2026-11-13', category: 'inscricao' },
  { item: '13', description: 'Confirmação das inscrições (recurso contra lista provisória)', dateLabel: '16/11/2026 e 17/11/2026', isoStart: '2026-11-16', isoEnd: '2026-11-17', category: 'recurso' },
  { item: '14', description: 'Edital de homologação das inscrições e locais/horário da Prova Objetiva', dateLabel: '25/11/2026', isoStart: '2026-11-25', category: 'prova' },
  { item: '15', description: 'Realização da Prova Objetiva', dateLabel: '13/12/2026', isoStart: '2026-12-13', category: 'prova' },
  { item: '16', description: 'Publicação do gabarito oficial preliminar da Prova Objetiva', dateLabel: '14/12/2026', isoStart: '2026-12-14', category: 'resultado' },
  { item: '17', description: 'Período de recurso contra o gabarito oficial preliminar', dateLabel: '15/12/2026 e 16/12/2026', isoStart: '2026-12-15', isoEnd: '2026-12-16', category: 'recurso' },
  { item: '18', description: 'Publicação do gabarito oficial definitivo da Prova Objetiva', dateLabel: '25/01/2027', isoStart: '2027-01-25', category: 'resultado' },
  { item: '19', description: 'Resultado preliminar da Prova Objetiva', dateLabel: '25/01/2027', isoStart: '2027-01-25', category: 'resultado' },
  { item: '20', description: 'Período de recurso contra o resultado preliminar da Prova Objetiva', dateLabel: '26/01/2027 e 27/01/2027', isoStart: '2027-01-26', isoEnd: '2027-01-27', category: 'recurso' },
  { item: '21', description: 'Resultado definitivo da Prova Objetiva', dateLabel: '05/02/2027', isoStart: '2027-02-05', category: 'resultado' },
  { item: '22', description: 'Convocação para heteroidentificação – candidatos pretos ou pardos', dateLabel: '05/02/2027', isoStart: '2027-02-05', category: 'resultado' },
  { item: '23', description: 'Convocação para verificação documental – candidatos indígenas', dateLabel: '05/02/2027', isoStart: '2027-02-05', category: 'resultado' },
  { item: '24', description: 'Convocação para verificação documental – candidatos quilombolas', dateLabel: '05/02/2027', isoStart: '2027-02-05', category: 'resultado' },
  { item: '25', description: 'Realização do procedimento de heteroidentificação (pretos ou pardos)', dateLabel: '13/02/2027 e 14/02/2027', isoStart: '2027-02-13', isoEnd: '2027-02-14', category: 'prova' },
  { item: '26', description: 'Realização da verificação documental (indígenas)', dateLabel: '13/02/2027 e 14/02/2027', isoStart: '2027-02-13', isoEnd: '2027-02-14', category: 'prova' },
  { item: '27', description: 'Realização da verificação documental (quilombolas)', dateLabel: '13/02/2027 e 14/02/2027', isoStart: '2027-02-13', isoEnd: '2027-02-14', category: 'prova' },
  { item: '28', description: 'Resultado preliminar da heteroidentificação (pretos ou pardos)', dateLabel: '19/02/2027', isoStart: '2027-02-19', category: 'resultado' },
  { item: '29', description: 'Resultado preliminar da verificação documental (indígenas)', dateLabel: '19/02/2027', isoStart: '2027-02-19', category: 'resultado' },
  { item: '30', description: 'Resultado preliminar da verificação documental (quilombolas)', dateLabel: '19/02/2027', isoStart: '2027-02-19', category: 'resultado' },
  { item: '31', description: 'Recurso contra resultado preliminar de heteroidentificação (pretos ou pardos)', dateLabel: '22/02/2027 e 23/02/2027', isoStart: '2027-02-22', isoEnd: '2027-02-23', category: 'recurso' },
  { item: '32', description: 'Recurso contra resultado preliminar da verificação (indígenas)', dateLabel: '22/02/2027 e 23/02/2027', isoStart: '2027-02-22', isoEnd: '2027-02-23', category: 'recurso' },
  { item: '33', description: 'Recurso contra resultado preliminar da verificação (quilombolas)', dateLabel: '22/02/2027 e 23/02/2027', isoStart: '2027-02-22', isoEnd: '2027-02-23', category: 'recurso' },
  { item: '34', description: 'Resultado definitivo da heteroidentificação (pretos ou pardos)', dateLabel: '03/03/2027', isoStart: '2027-03-03', category: 'resultado' },
  { item: '35', description: 'Resultado definitivo da verificação documental (indígenas)', dateLabel: '03/03/2027', isoStart: '2027-03-03', category: 'resultado' },
  { item: '36', description: 'Resultado definitivo da verificação documental (quilombolas)', dateLabel: '03/03/2027', isoStart: '2027-03-03', category: 'resultado' },
  { item: '37', description: 'Resultado Final Preliminar', dateLabel: '03/03/2027', isoStart: '2027-03-03', category: 'resultado' },
  { item: '38', description: 'Período de recurso contra o Resultado Final Preliminar', dateLabel: '04/03/2027 e 05/03/2027', isoStart: '2027-03-04', isoEnd: '2027-03-05', category: 'recurso' },
  { item: '39', description: 'Resultado Final Definitivo', dateLabel: '10/03/2027', isoStart: '2027-03-10', category: 'resultado' },
];

export const ALEPA_DISCIPLINES: Discipline[] = [
  {
    id: 'processo_legislativo',
    name: 'Processo Legislativo e Técnica Legislativa',
    shortName: 'Processo Legislativo',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 1,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 60,
    topics: [
      {
        id: 'pl_regimento_alepa',
        disciplineId: 'processo_legislativo',
        title: 'Regimento Interno da ALEPA (Resolução nº 02/2022) e Estrutura da Casa',
        subtopics: [
          'Organização, composição e funcionamento da ALEPA',
          'Mesa Diretora, Presidência, sessões e deliberações',
          'Comissões permanentes e temporárias: CCJ e Redação Final, CCFO',
          'Quóruns, turnos, interstícios, urgência, prioridade, preferência e destaque',
        ],
        highYield: true,
      },
      {
        id: 'pl_especies_normativas',
        disciplineId: 'processo_legislativo',
        title: 'Espécies Normativas, Proposições e Tramitação Orçamentária',
        subtopics: [
          'Projetos, requerimentos, emendas, subemendas, moções e indicações',
          'Apresentação, recebimento, distribuição, prejudicialidade e redação final',
          'PPA, LDO e LOA: tramitação de leis orçamentárias e emendas na CCFO',
          'Iniciativa popular e assessoramento legislativo',
        ],
        highYield: true,
      },
      {
        id: 'pl_iniciativa_veto',
        disciplineId: 'processo_legislativo',
        title: 'Autógrafos, Sanção, Veto, Promulgação e Fiscalização',
        subtopics: [
          'Iniciativa privativa e concorrente; pertinência temática',
          'Prazos de sanção e veto (total/parcial) e apreciação em plenário',
          'Promulgação, publicação e matérias sujeitas a disposições especiais',
          'Prestação de contas e controle financeiro e orçamentário',
        ],
        highYield: true,
      },
      {
        id: 'pl_tecnica_legislativa',
        disciplineId: 'processo_legislativo',
        title: 'Técnica Legislativa (LC nº 95/1998 e LC nº 107/2001)',
        subtopics: [
          'Estrutura: parte preliminar (epígrafe, ementa, preâmbulo), normativa e final',
          'Divisão e hierarquia: partes, livros, títulos, capítulos, artigos, parágrafos, incisos, alíneas e itens',
          'Vícios de redação (ambiguidade, contradição, obscuridade) e norma hipotética',
          'Alteração, consolidação, codificação, pareceres e documentos não normativos',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'administracao_gestao',
    name: 'Administração Geral, Gestão de Pessoas, Processos e Recursos Materiais',
    shortName: 'Administração & Gestão',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 2,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 60,
    topics: [
      {
        id: 'adm_teorias_planejamento',
        disciplineId: 'administracao_gestao',
        title: 'Teorias da Administração, Funções PODC e Planejamento Estratégico',
        subtopics: [
          'Teorias administrativas e funções PODC (Planejamento, Organização, Direção e Controle)',
          'Planejamento estratégico, tático e operacional',
          'Missão, visão, valores organizacionais e análise ambiental (SWOT)',
          'Administração Pública e governança pública',
        ],
        highYield: true,
      },
      {
        id: 'adm_processos_qualidade',
        disciplineId: 'administracao_gestao',
        title: 'Gestão de Processos, Projetos, Qualidade e Ferramentas de Gestão',
        subtopics: [
          'Gestão de processos, gestão de projetos e gestão da qualidade',
          'Ciclo PDCA e plano de ação 5W2H',
          'Matriz GUT (Gravidade, Urgência e Tendência) e Diagrama de Ishikawa',
          'Indicadores de desempenho e melhoria contínua',
        ],
        highYield: true,
      },
      {
        id: 'adm_gestao_pessoas',
        disciplineId: 'administracao_gestao',
        title: 'Gestão de Pessoas e Comportamento Organizacional',
        subtopics: [
          'Recrutamento, seleção, integração e gestão por competências',
          'Liderança, motivação, comunicação, conflitos e clima organizacional',
          'Treinamento e desenvolvimento (T&D)',
          'Avaliação de desempenho e sistemas de remuneração',
        ],
        highYield: true,
      },
      {
        id: 'adm_materiais_logistica',
        disciplineId: 'administracao_gestao',
        title: 'Gestão de Materiais, Estoques, Logística, Compras e Cadeia de Suprimentos',
        subtopics: [
          'Gestão de materiais, almoxarifado e patrimônio público',
          'Gestão de estoques: Curva ABC, PEPS/FIFO, ponto de pedido e estoque mínimo',
          'Compras governamentais e cadeia de suprimentos',
          'Logística pública, recebimento e armazenagem',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'direito_administrativo',
    name: 'Direito Administrativo',
    shortName: 'Dir. Administrativo',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 2,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 60,
    topics: [
      {
        id: 'da_principios_organizacao',
        disciplineId: 'direito_administrativo',
        title: 'Princípios Constitucionais (art. 37 CF) e Organização Administrativa',
        subtopics: [
          'LIMPE e princípios implícitos da Administração Pública',
          'Administração Direta e Indireta (Autarquias, Fundações, EP e SEM)',
          'Centralização, descentralização, concentração e desconcentração',
          'Serviços Públicos e delegação',
        ],
        highYield: true,
      },
      {
        id: 'da_atos_poderes',
        disciplineId: 'direito_administrativo',
        title: 'Poderes Administrativos e Atos Administrativos',
        subtopics: [
          'Poder hierárquico, disciplinar, regulamentar e de polícia',
          'Requisitos, atributos e classificação dos atos administrativos',
          'Anulação, revogação e convalidação (Súmulas 346 e 473 do STF)',
          'Ordem Econômica e Financeira na Constituição',
        ],
        highYield: true,
      },
      {
        id: 'da_licitacoes_contratos',
        disciplineId: 'direito_administrativo',
        title: 'Licitações e Contratos Administrativos (Lei nº 14.133/2021)',
        subtopics: [
          'Modalidades: pregão, concorrência, concurso, leilão e diálogo competitivo',
          'Contratação direta: dispensa e inexigibilidade',
          'Gestão de contratos, cláusulas exorbitantes e equilíbrio econômico-financeiro',
          'Administração de compras governamentais, recebimento e gestão patrimonial',
        ],
        highYield: true,
      },
      {
        id: 'da_agentes_responsabilidade',
        disciplineId: 'direito_administrativo',
        title: 'RJU do Pará (Lei Estadual nº 5.810/1994) e Responsabilidade Civil',
        subtopics: [
          'Provimento, vacância, direitos, vantagens e regime disciplinar (Lei 5.810/94)',
          'Estabilidade, acumulação e deveres/proibições do servidor público',
          'Teoria do risco administrativo (art. 37, §6º CF)',
          'Ação regressiva e excludentes de responsabilidade',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'direito_constitucional',
    name: 'Direito Constitucional e Processual Constitucional',
    shortName: 'Dir. Constitucional',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 3,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 60,
    topics: [
      {
        id: 'dc_principios_direitos',
        disciplineId: 'direito_constitucional',
        title: 'Teoria da Constituição, Princípios e Direitos Fundamentais (arts. 1º a 5º)',
        subtopics: [
          'Conceito, classificação, elementos e supremacia da Constituição',
          'Direitos e deveres individuais e coletivos (art. 5º)',
          'Direitos sociais, nacionalidade, direitos políticos e partidos políticos',
          'Eficácia e aplicabilidade das normas constitucionais',
        ],
        highYield: true,
      },
      {
        id: 'dc_organizacao_poderes',
        disciplineId: 'direito_constitucional',
        title: 'Organização do Estado, Competências e Poder Legislativo',
        subtopics: [
          'União, Estados, DF e Municípios: repartição de competências e autonomia estadual',
          'Separação, independência e harmonia entre os Poderes',
          'Congresso Nacional, Câmara, Senado e Assembleias Legislativas',
          'Comissões Parlamentares, CPIs, imunidades e Tribunal de Contas',
        ],
        highYield: true,
      },
      {
        id: 'dc_processual_controle',
        disciplineId: 'direito_constitucional',
        title: 'Direito Processual Constitucional e Remédios Constitucionais',
        subtopics: [
          'Controle difuso e concentrado de constitucionalidade',
          'ADI, ADC, ADPF e ADO (Leis 9.868/99 e 9.882/99)',
          'Habeas Corpus, Habeas Data, Mandado de Segurança, Mandado de Injunção e Ação Popular',
          'Reclamação Constitucional',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'legislacao_etica',
    name: 'Legislação e Ética no Serviço Público',
    shortName: 'Legislação e Ética',
    editalBlock: 'Legislação e Ética',
    priorityRank: 4,
    examQuestions: 10,
    examPoints: 2.0,
    tieBreakerOrder: 2,
    recommendedMinutesPerCycle: 50,
    topics: [
      {
        id: 'le_constituicao_para',
        disciplineId: 'legislacao_etica',
        title: 'Constituição do Estado do Pará aplicada ao Poder Legislativo',
        subtopics: [
          'Artigos expressos do edital: arts. 11, 86, 90, 92 a 116, 121, 161, 162, 168 e 341',
          'Organização e competências da ALEPA, Deputados Estaduais e Plenário',
          'Fiscalização e controle, controle interno e controle de constitucionalidade estadual',
          'Decretos Legislativos e Resoluções da ALEPA listados no Anexo II',
        ],
        highYield: true,
      },
      {
        id: 'le_lgpd',
        disciplineId: 'legislacao_etica',
        title: 'Lei Geral de Proteção de Dados – LGPD (Lei nº 13.709/2018)',
        subtopics: [
          'Princípios, dados pessoais e dados sensíveis',
          'Bases legais e tratamento de dados pelo Poder Público',
          'Direitos do titular e responsabilidade dos agentes',
          'Encarregado (DPO), segurança e ANPD',
        ],
        highYield: true,
      },
      {
        id: 'le_improbidade_anticorrupcao',
        disciplineId: 'legislacao_etica',
        title: 'Improbidade (Lei 8.429/92 · Lei 14.230/21) e Anticorrupção (Lei 12.846/13 e Dec. 11.129/22)',
        subtopics: [
          'Atos de improbidade administrativa e exigência de dolo específico',
          'Sanções, prescrição e acordo de não persecução civil',
          'Responsabilização objetiva de pessoas jurídicas (Lei 12.846/2013)',
          'Regulamento pelo Decreto nº 11.129/2022 e programa de integridade',
        ],
        highYield: true,
      },
      {
        id: 'le_etica_assedio',
        disciplineId: 'legislacao_etica',
        title: 'Ética no Serviço Público e Enfrentamento ao Assédio Moral e Sexual',
        subtopics: [
          'Ética e moral, princípios, valores e a lei; democracia e cidadania',
          'Conduta ética, ética profissional, responsabilidade social e função pública',
          'Conceitos e medidas de enfrentamento ao assédio moral e sexual',
        ],
        highYield: false,
      },
    ],
  },
  {
    id: 'direito_financeiro',
    name: 'Direito Financeiro',
    shortName: 'Dir. Financeiro',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 5,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'df_orcamento_ppa_ldo_loa',
        disciplineId: 'direito_financeiro',
        title: 'Orçamento Público: PPA, LDO, LOA, Lei nº 4.320/1964 e Princípios Orçamentários',
        subtopics: [
          'PPA, LDO, LOA e princípios orçamentários (anualidade, universalidade, unidade, exclusividade e legalidade)',
          'Lei nº 4.320/1964: normas gerais de direito financeiro, receita, despesa e empenho',
          'Ciclo orçamentário e papel do Poder Legislativo na análise e votação',
          'Créditos adicionais (suplementares, especiais e extraordinários) e vedações do art. 167 CF',
        ],
        highYield: true,
      },
      {
        id: 'df_lrf_despesa_receita',
        disciplineId: 'direito_financeiro',
        title: 'Lei de Responsabilidade Fiscal (LC nº 101/2000) e Fiscalização Financeira',
        subtopics: [
          'Limites de despesa com pessoal (Legislativo estadual 3% da RCL)',
          'Receita Corrente Líquida, renúncia de receita e geração de despesa',
          'Restos a pagar e dívida pública',
          'Fiscalização contábil, financeira e orçamentária (TCE-PA e ALEPA)',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'portugues',
    name: 'Língua Portuguesa',
    shortName: 'Português',
    editalBlock: 'Língua Portuguesa',
    priorityRank: 6,
    examQuestions: 10,
    examPoints: 2.0,
    tieBreakerOrder: 3,
    recommendedMinutesPerCycle: 45,
    topics: [
      {
        id: 'pt_interpretacao_coesao',
        disciplineId: 'portugues',
        title: 'Compreensão, Argumentação, Comunicação Assertiva e Semântica',
        subtopics: [
          'Compreensão e interpretação de textos; argumentação e persuasão',
          'Comunicação assertiva: linguagem simples, concisa e objetiva',
          'Coesão, coerência e significação (sinônimos, antônimos, homônimos, parônimos)',
          'Figuras de linguagem',
        ],
        highYield: true,
      },
      {
        id: 'pt_sintaxe_concordancia',
        disciplineId: 'portugues',
        title: 'Ortografia, Morfologia, Sintaxe, Crase, Concordância e Regência',
        subtopics: [
          'Ortografia, acentuação gráfica, crase, pontuação e uso dos porquês',
          'As 10 classes de palavras e período simples e composto',
          'Concordância nominal e verbal; regência nominal e verbal',
          'Colocação dos pronomes oblíquos átonos',
        ],
        highYield: true,
      },
      {
        id: 'pt_redacao_oficial',
        disciplineId: 'portugues',
        title: 'Redação Oficial (Manual da Presidência da República)',
        subtopics: [
          'Escrita de textos formais e atributos da redação oficial',
          'Padrão Ofício, fechos (Respeitosamente / Atenciosamente) e pronomes de tratamento',
          'Atos normativos e comunicações oficiais legislativas',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'raciocinio_logico',
    name: 'Raciocínio Lógico',
    shortName: 'Raciocínio Lógico',
    editalBlock: 'Raciocínio Lógico',
    priorityRank: 6,
    examQuestions: 5,
    examPoints: 1.0,
    tieBreakerOrder: 4,
    recommendedMinutesPerCycle: 35,
    topics: [
      {
        id: 'rl_logica_proposicoes',
        disciplineId: 'raciocinio_logico',
        title: 'Relações Arbitrárias, Raciocínio Verbal, Sequencial e Lógica Formal',
        subtopics: [
          'Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos e eventos',
          'Dedução de novas informações e validade de argumentos a partir de hipóteses',
          'Raciocínio verbal, sequencial, orientação espacial e temporal',
          'Formação de conceitos e discriminação de elementos',
        ],
        highYield: true,
      },
      {
        id: 'rl_matematica_proporcao',
        disciplineId: 'raciocinio_logico',
        title: 'Raciocínio Matemático, Proporções, Regra de Três e Porcentagem',
        subtopics: [
          'Conjuntos numéricos racionais, reais e complexos (frações e decimais)',
          'Razão, proporção, grandezas proporcionais e divisão proporcional',
          'Regra de três simples e composta e porcentagem',
        ],
        highYield: false,
      },
    ],
  },
  {
    id: 'informatica',
    name: 'Noções de Informática',
    shortName: 'Informática',
    editalBlock: 'Noções de Informática',
    priorityRank: 6,
    examQuestions: 5,
    examPoints: 1.0,
    tieBreakerOrder: 5,
    recommendedMinutesPerCycle: 35,
    topics: [
      {
        id: 'inf_windows_escritorio',
        disciplineId: 'informatica',
        title: 'Windows 10/11, Hardware, Office (2013–O365) e LibreOffice 7+',
        subtopics: [
          'Windows 10 e 11, hardware/periféricos e organização de arquivos e pastas',
          'Microsoft Word, Excel e PowerPoint (2013 até O365) e LibreOffice 7+',
          'Tecnologias multimídia e reprodução de áudio e vídeo',
        ],
        highYield: true,
      },
      {
        id: 'inf_internet_seguranca',
        disciplineId: 'informatica',
        title: 'Internet, Nuvem, Colaboração a Distância e Segurança da Informação',
        subtopics: [
          'Navegadores (Chrome, Edge, Firefox), Outlook (2013–O365), fóruns, wikis e redes sociais',
          'Educação a distância (Moodle), SharePoint e Google Drive',
          'Microsoft Teams, Cisco Webex e Google Meet',
          'Segurança: controle de USB, hardening, antimalware e firewall pessoal',
        ],
        highYield: true,
      },
    ],
  },
  {
    id: 'juridicas_complementares',
    name: 'Dir. Civil, Proc. Civil, Previdenciário, Direitos Humanos, Arquivologia e Secretaria',
    shortName: 'Jurídicas & Secretaria',
    editalBlock: 'Conhecimentos Específicos',
    priorityRank: 7,
    examQuestions: 20,
    examPoints: 4.0,
    tieBreakerOrder: 1,
    recommendedMinutesPerCycle: 40,
    topics: [
      {
        id: 'jc_civil_proc_civil',
        disciplineId: 'juridicas_complementares',
        title: 'Direito Civil e Direito Processual Civil',
        subtopics: [
          'LINDB, personalidade, capacidade, bens públicos e negócio jurídico',
          'Prescrição, decadência, obrigações e contratos',
          'Jurisdição, competência, prazos, atos processuais e tutelas no CPC',
          'Fazenda Pública em juízo e recursos',
        ],
        highYield: false,
      },
      {
        id: 'jc_previdenciario_dh',
        disciplineId: 'juridicas_complementares',
        title: 'Direito Previdenciário e Noções de Direitos Humanos',
        subtopics: [
          'Seguridade Social: princípios, RGPS e RPPS (EC nº 103/2019)',
          'Benefícios e custeio previdenciário',
          'Declaração Universal dos Direitos Humanos e Pacto de San José',
          'Hierarquia dos tratados de direitos humanos (art. 5º, §§2º e 3º CF)',
        ],
        highYield: false,
      },
      {
        id: 'jc_secretaria_adm',
        disciplineId: 'juridicas_complementares',
        title: 'Secretaria, Administração Pública, Arquivologia (Lei 8.159/91) e Recursos Materiais',
        subtopics: [
          'Organização formal, departamentalização, gestão de processos, projetos e competências',
          'Preparo de documentos, relatórios, planilhas, protocolo e atendimento ao público',
          'Arquivologia (Lei nº 8.159/1991): classificação, ordenação e tabela de temporalidade',
          'Administração de recursos materiais, estoques, armazenagem e gestão patrimonial',
        ],
        highYield: true,
      },
    ],
  },
];

export interface DailyStudyBlock {
  order: number;
  blockType: BlockType;
  label: string;
  durationMinutes: number;
  disciplineId: string;
  disciplineName: string;
  topicTitle: string;
}

export interface DailyPlan {
  dateKey: string;
  dayNumber: number;
  daysRemaining: number;
  phaseName: string;
  totalMinutes: number;
  studyTip: string;
  alertFocus: string;
  officialMilestone?: OfficialMilestone;
  isExamDay?: boolean;
  blocks: DailyStudyBlock[];
}

const STUDY_ROTATION: Array<{
  disciplineId: string;
  focus: string;
  tip: string;
  alert: string;
}> = [
  {
    disciplineId: 'processo_legislativo',
    focus: 'Regimento Interno ALEPA (Res. 02/2022) & Tramitação',
    tip: 'Mapeie quóruns (maioria simples, absoluta e 2/3), prazos das comissões CCJ e CCFO e diferença entre urgência, prioridade e preferência.',
    alert: 'Prioridade 1 do Cargo 03: revise os arts. de tramitação na Res. nº 02/2022.',
  },
  {
    disciplineId: 'direito_administrativo',
    focus: 'Atos, Lei nº 14.133/21 & RJU Pará (Lei 5.810/94)',
    tip: 'Na Lei nº 14.133/2021, memorize as 5 modalidades (sem tomada de preços e convite) e compare dispensa vs. inexigibilidade.',
    alert: 'Atenção à Lei Estadual nº 5.810/1994 (provimento, vacância e penalidades).',
  },
  {
    disciplineId: 'direito_constitucional',
    focus: 'Poder Legislativo & Controle de Constitucionalidade',
    tip: 'Diferencie poderes investigatórios de CPI (quebra de sigilo bancário/fiscal) da reserva de jurisdição (interceptação e busca domiciliar).',
    alert: 'Resolva ao menos 10 questões de controle concentrado (ADI, ADC e ADPF).',
  },
  {
    disciplineId: 'legislacao_etica',
    focus: 'Constituição do Pará, LGPD & Improbidade',
    tip: 'Leia os artigos expressos do Anexo II da Constituição do Pará (11, 86, 90, 92–116, 121, 161, 162, 168 e 341) e lembre que improbidade exige dolo específico.',
    alert: 'Revise dados pessoais sensíveis na LGPD (art. 5º, II) e Decreto 11.129/2022.',
  },
  {
    disciplineId: 'direito_financeiro',
    focus: 'PPA/LDO/LOA & Lei de Responsabilidade Fiscal',
    tip: 'Fixe os limites estaduais da LRF (60% RCL total: 3% Legislativo + TCE, 6% Judiciário, 49% Executivo, 2% MP) e os 3 tipos de créditos adicionais.',
    alert: 'Compare crédito suplementar, especial e extraordinário no art. 41 da Lei 4.320/64.',
  },
  {
    disciplineId: 'portugues',
    focus: 'Interpretação, Sintaxe & Redação Oficial',
    tip: 'Em Redação Oficial, lembre os dois fechos: Respeitosamente (autoridade superior) e Atenciosamente (mesma ou menor hierarquia). Atenção à crase e regência.',
    alert: 'Português vale 2,0 pontos (10 questões) e é 3º critério de desempate.',
  },
  {
    disciplineId: 'raciocinio_logico',
    focus: 'Relações Arbitrárias & Dedução CETAP',
    tip: 'Use tabela-verdade e equivalência contrapositiva (P→Q equivale a ~Q→~P). Em relações arbitrárias, monte matrizes de associação antes de responder.',
    alert: 'Pratique regra de três composta e porcentagem aplicada à pontuação da prova.',
  },
  {
    disciplineId: 'informatica',
    focus: 'Office/LibreOffice, Moodle, Teams/Webex & Hardening',
    tip: 'Revise referências absolutas no Excel ($C$4), funções SE/PROCV e segurança da informação (hardening, USB, ransomware e firewall).',
    alert: 'Edital cobra também Moodle, SharePoint, Google Drive e Cisco Webex.',
  },
  {
    disciplineId: 'administracao_gestao',
    focus: 'Teorias PODC, Planejamento, Gestão de Pessoas, PDCA/5W2H/GUT/Ishikawa e Materiais',
    tip: 'Revise as ferramentas de gestão (PDCA, 5W2H, GUT e Ishikawa), comportamento organizacional e gestão de estoques/logística.',
    alert: 'Prioridade central para Analista Legislativo – Administração: resolva 25 questões no PCI ou simulado.',
  },
  {
    disciplineId: 'juridicas_complementares',
    focus: 'Secretaria, Arquivologia, Civil, CPC, Prev. & DH',
    tip: 'Foque nos tópicos de maior retorno: tabela de temporalidade na Arquivologia (Lei 8.159/91), prazos no CPC e hierarquia dos tratados (art. 5º, §3º CF).',
    alert: 'Bloco para revisão direcionada por questões e caderno de erros.',
  },
];

const MEDIO_STUDY_FOCUS_BY_ID: Record<
  string,
  { focus: string; tip: string; alert: string }
> = {
  nm_portugues: {
    focus: 'Interpretação, Crase, Concordância & Redação Oficial',
    tip: 'Revise os fechos do Manual da Presidência (Respeitosamente vs. Atenciosamente), emprego da crase e concordância verbal.',
    alert: 'Português vale 2,0 pontos (10 questões) e é critério de desempate no Edital 001/2026.',
  },
  nm_legislacao_etica: {
    focus: 'LGPD, Improbidade, Constituição do Pará & Regimento ALEPA',
    tip: 'Priorize os arts. 11, 86, 90, 92–116, 121, 161, 162, 168 e 341 da CE-PA e a Retificação nº 002/2026 (Resoluções ALEPA).',
    alert: 'Legislação e Ética responde por 10 questões (2,0 pontos) e 2º critério de desempate.',
  },
  nm_informatica: {
    focus: 'Windows 10/11, Office/LibreOffice, Nuvem & Segurança',
    tip: 'Pratique atalhos e fórmulas do Excel/Calc ($C$4, SE, SOMA), além de hardening, controle de USB, Moodle, Teams e Webex.',
    alert: 'Bloco de 5 questões objetivas (1,0 ponto) com cobrança prática de escritório e segurança.',
  },
  nm_raciocinio_logico: {
    focus: 'Relações Arbitrárias, Regra de Três & Porcentagem',
    tip: 'Em relações arbitrárias CETAP, organize tabelas de associação antes de marcar e revise porcentagem e divisão proporcional.',
    alert: 'Resolva ao menos 8 questões de lógica dedutiva e regra de três composta.',
  },
  nm_01_04_constitucional: {
    focus: 'Direitos Fundamentais (art. 5º), Poder Legislativo & Espécies Normativas',
    tip: 'Diferencie quóruns e processos de LC, LO, medidas provisórias, decretos legislativos e remédios constitucionais.',
    alert: 'Integra o bloco de Conhecimentos Específicos (20 questões · 4,0 pts).',
  },
  nm_01_04_administrativo: {
    focus: 'Atos, RJU Pará (Lei 5.810/94), Licitações (14.133/21) & Orçamento',
    tip: 'Compare provimento e vacância na Lei Estadual nº 5.810/1994 e as modalidades licitatórias da Lei nº 14.133/2021.',
    alert: 'Atenção às regras de servidores públicos e PPA/LDO/LOA no bloco específico.',
  },
  nm_01_04_tecnica_legislativa: {
    focus: 'LC nº 95/1998, Estrutura Normativa, Pareceres & Moções',
    tip: 'Memorize a hierarquia artigo → parágrafo → inciso → alínea → item e os elementos epígrafe, ementa e preâmbulo.',
    alert: 'Tema central de Técnica Legislativa para os Cargos 01 e 04.',
  },
  nm_04_administracao_publica: {
    focus: 'Estruturas Organizacionais, Processos, Projetos & Contratos',
    tip: 'Diferencie gestão por processos, projetos e competências e revise fiscalização de contratos administrativos.',
    alert: 'Conteúdo específico do Cargo 04 (Assistência Administrativa · PL.AL.060).',
  },
  nm_04_secretaria: {
    focus: 'Documentos Oficiais, Protocolo, Agendas & Atendimento ao Público',
    tip: 'Revise rotinas de expedição/recebimento de documentos, roteiros de comissões e postura no atendimento.',
    alert: 'Conteúdo específico de Secretaria para o Cargo 04.',
  },
  nm_04_arquivologia: {
    focus: 'Teoria das Três Idades, Protocolo & Tabela de Temporalidade (Lei 8.159/91)',
    tip: 'Fixe as etapas do protocolo (recebimento, registro, autuação, tramitação) e destinação final (eliminação vs. guarda permanente).',
    alert: 'Arquivologia aparece com frequência nas provas da Fundação CETAP.',
  },
  nm_04_recursos_materiais: {
    focus: 'Compras, Estoques (PEPS/ABC), Armazenagem & Patrimônio',
    tip: 'Diferencie curva ABC, método PEPS/FIFO, ponto de pedido e etapas de tombamento e inventário patrimonial.',
    alert: 'Revise recebimento provisório e definitivo e gestão de estoques.',
  },
  nm_02_atendimento_telefonia: {
    focus: 'Atendimento Telefônico, PABX/DDR, VoIP & Pronomes de Tratamento',
    tip: 'Memorize pronomes de tratamento para autoridades (Vossa Excelência, Vossa Senhoria) e funcionamento de ramais/PABX/VoIP.',
    alert: 'Conteúdo específico do Cargo 02 (Central Telefônica · PL.AL.065).',
  },
  nm_02_rotinas_saude_alepa: {
    focus: 'Mapas de Chamadas, LGPD, NR-17 (Anexo II) & RJU/ALEPA',
    tip: 'Revise normas de ergonomia no teleatendimento (NR-17), atendimento prioritário (Lei 10.048/00) e ciclo PDCA.',
    alert: 'Atenção aos prazos, pausas da NR-17 e deveres do servidor (Lei 5.810/94).',
  },
  nm_03_eletricidade_hidraulica: {
    focus: 'NBR 5410, NR-10, Sistemas Elétricos & Hidráulica (NBR 5626/8160)',
    tip: 'Revise Lei de Ohm, função de DR/DPS/disjuntores, etapas de desenergização na NR-10 e manutenção hidráulica.',
    alert: 'Conteúdo específico do Cargo 03 (Manutenção de Patrimônio · PL.AL.062).',
  },
  nm_03_climatizacao_seguranca_patrimonio: {
    focus: 'PMOC (Lei 13.589/18), NRs 6/23/26/35, Incêndio & Patrimônio',
    tip: 'Fixe classes de incêndio e tipos de extintores (NR-23), EPI/trabalho em altura (NR-6/NR-35) e tombamento patrimonial.',
    alert: 'Revise também estrutura da ALEPA, Lei 5.810/94 e ciclo PDCA.',
  },
};

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysUntilExam(examDateStr: string = CONCURSO_PROFILE.examDate): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = examDateStr.split('-').map(Number);
  const examMidnight = new Date(y, (m || 12) - 1, d || 13);
  const diffMs = examMidnight.getTime() - todayMidnight.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function generateDailyPlanForDate(
  date: Date,
  dayIndex: number,
  campus: CampusLevel = 'superior',
  medioCargoGroup: MedioCargoGroup = 'cargo_01_04'
): DailyPlan {
  const dateKey = formatDateKey(date);
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(2026, 11, 13).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const milestoneToday = OFFICIAL_ANEXO_III_MILESTONES.find(
    (m) => m.isoStart === dateKey || (m.isoEnd && dateKey >= m.isoStart && dateKey <= m.isoEnd)
  );

  const isMedio = campus === 'medio';
  const medioCargo = isMedio ? getMedioCargoInfo(medioCargoGroup) : null;
  const medioDisciplines = isMedio ? getMedioDisciplines(medioCargoGroup) : [];

  if (dateKey === '2026-12-13') {
    const firstMedioDisc = medioDisciplines[0];
    return {
      dateKey,
      dayNumber: dayIndex + 1,
      daysRemaining: 0,
      phaseName: 'Dia da Prova Objetiva · Fundação CETAP',
      totalMinutes: 120,
      officialMilestone: milestoneToday,
      isExamDay: true,
      studyTip:
        'Chegue com antecedência mínima de 1h ao local divulgado em 25/11. Leia primeiro o comando das 20 questões de Conhecimentos Específicos (maior peso no desempate) e administre o tempo para preencher o cartão-resposta com calma.',
      alertFocus: isMedio
        ? `Prova Objetiva ALEPA 2026 – ${medioCargo?.cargoNumber} (${medioCargo?.code}): documento oficial com foto, cartão de confirmação e caneta esferográfica transparente preta ou azul.`
        : 'Prova Objetiva ALEPA 2026 (turno da tarde): documento oficial com foto, cartão de confirmação e caneta esferográfica transparente preta ou azul.',
      blocks: [
        {
          order: 1,
          blockType: 'revision',
          label: 'Leitura leve (manhã)',
          durationMinutes: 30,
          disciplineId: isMedio ? firstMedioDisc?.id || 'nm_portugues' : 'processo_legislativo',
          disciplineName: isMedio ? firstMedioDisc?.shortName || 'Língua Portuguesa' : 'Processo Legislativo',
          topicTitle: isMedio
            ? 'Revisão rápida de artigos-chave, prazos e fórmulas'
            : 'Revisão rápida de fórmulas, prazos e quóruns',
        },
        {
          order: 2,
          blockType: 'questions',
          label: 'Prova Objetiva',
          durationMinutes: 90,
          disciplineId: isMedio ? firstMedioDisc?.id || 'nm_portugues' : 'processo_legislativo',
          disciplineName: 'Todas as 50 questões',
          topicTitle: isMedio
            ? `Execução da Prova Objetiva · ${medioCargo?.cargoNumber} (${medioCargo?.code})`
            : 'Execução da Prova Objetiva · Cargo 03 (PL.AL.102)',
        },
      ],
    };
  }

  if (!isMedio && dateKey === FINAL_REVIEW_DAY_05_12.dateKey) {
    return {
      dateKey,
      dayNumber: dayIndex + 1,
      daysRemaining,
      phaseName: FINAL_REVIEW_DAY_05_12.title,
      totalMinutes: 240,
      officialMilestone: milestoneToday,
      studyTip:
        'Dia final do ciclo de 3 semanas (4 horas): dedique 2h pela manhã para consolidar resumos, dispositivos legais e erros acumulados, e 2h à tarde para simulado completo com correção comentada.',
      alertFocus: 'Dia 05/12: Revisão geral pela manhã (2h) + Simulado completo com correção à tarde (2h).',
      blocks: [
        {
          order: 1,
          blockType: 'revision',
          label: 'Manhã · Revisão Geral (2h)',
          durationMinutes: 120,
          disciplineId: 'processo_legislativo',
          disciplineName: 'Todas as disciplinas',
          topicTitle: 'Resumos e mapas mentais + Principais dispositivos legais + Erros acumulados',
        },
        {
          order: 2,
          blockType: 'questions',
          label: 'Tarde · Simulado Geral (2h)',
          durationMinutes: 120,
          disciplineId: 'administracao_gestao',
          disciplineName: 'Simulado Completo',
          topicTitle: 'Simulado com questões de todas as disciplinas + Correção comentada + Pontos de reforço',
        },
      ],
    };
  }

  if (!isMedio && DETAILED_DAY_BY_KEY[dateKey]) {
    const detailed = DETAILED_DAY_BY_KEY[dateKey];
    const pDisc = ALEPA_DISCIPLINES.find((d) => d.id === detailed.disciplineId) || ALEPA_DISCIPLINES[0];
    const sDisc = ALEPA_DISCIPLINES.find((d) => d.id === detailed.secondaryDisciplineId) || ALEPA_DISCIPLINES[1];
    return {
      dateKey,
      dayNumber: dayIndex + 1,
      daysRemaining,
      phaseName: detailed.weekTitle,
      totalMinutes: 120,
      officialMilestone: milestoneToday,
      studyTip: detailed.studyTip,
      alertFocus: milestoneToday
        ? `Marco oficial hoje (${milestoneToday.dateLabel}): ${milestoneToday.description}.`
        : `${detailed.dateLabel} · Prática recomendada: ${detailed.practiceTarget}`,
      blocks: [
        {
          order: 1,
          blockType: 'theory',
          label: 'Conteúdo principal',
          durationMinutes: 55,
          disciplineId: pDisc.id,
          disciplineName: pDisc.shortName,
          topicTitle: detailed.mainContent,
        },
        {
          order: 2,
          blockType: 'questions',
          label: 'Prática / Questões',
          durationMinutes: 35,
          disciplineId: pDisc.id,
          disciplineName: pDisc.shortName,
          topicTitle: detailed.practiceTarget,
        },
        {
          order: 3,
          blockType: 'correction',
          label: 'Correção comentada',
          durationMinutes: 15,
          disciplineId: sDisc.id,
          disciplineName: sDisc.shortName,
          topicTitle: `Análise de gabarito · ${detailed.practiceTarget}`,
        },
        {
          order: 4,
          blockType: 'revision',
          label: 'Revisão do dia',
          durationMinutes: 15,
          disciplineId: sDisc.id,
          disciplineName: sDisc.shortName,
          topicTitle: 'Registro no Caderno de Erros e leitura de lei seca',
        },
      ],
    };
  }

  let primaryDisc: Discipline;
  let secondaryDisc: Discipline;
  let primaryFocus: string;
  let primaryTip: string;
  let primaryAlert: string;

  if (isMedio && medioDisciplines.length > 0) {
    primaryDisc = medioDisciplines[dayIndex % medioDisciplines.length];
    secondaryDisc = medioDisciplines[(dayIndex + 1) % medioDisciplines.length];
    const meta = MEDIO_STUDY_FOCUS_BY_ID[primaryDisc.id];
    primaryFocus = meta?.focus || primaryDisc.topics[0]?.title || primaryDisc.name;
    primaryTip =
      meta?.tip ||
      `Estude os pontos centrais de ${primaryDisc.shortName} com resolução imediata de questões estilo CETAP.`;
    primaryAlert =
      meta?.alert ||
      `Prioridade ${primaryDisc.priorityRank} (${medioCargo?.cargoNumber} · ${medioCargo?.code}): ${primaryDisc.shortName}.`;
  } else {
    const primary = STUDY_ROTATION[dayIndex % STUDY_ROTATION.length];
    const secondary = STUDY_ROTATION[(dayIndex + 1) % STUDY_ROTATION.length];
    primaryDisc = ALEPA_DISCIPLINES.find((d) => d.id === primary.disciplineId)!;
    secondaryDisc = ALEPA_DISCIPLINES.find((d) => d.id === secondary.disciplineId)!;
    primaryFocus = primary.focus;
    primaryTip = primary.tip;
    primaryAlert = primary.alert;
  }

  let phaseName = isMedio
    ? `Ciclo Base · Nível Médio (${medioCargo?.code || 'PL.AL.060'})`
    : 'Ciclo Base · Prioridade Legislativa';
  let extraTip = primaryTip;
  if (daysRemaining === 1) {
    phaseName = 'Véspera da Prova · Revisão Leve';
    extraTip =
      'Revisão apenas de anotações curtas e caderno de erros. Evite conteúdo inédito à noite e priorize descanso antes da prova de amanhã.';
  } else if (daysRemaining <= 7) {
    phaseName = isMedio
      ? 'Reta Final · Lei Seca, Específicas e Erros'
      : 'Reta Final · Lei Seca, Regimento e Erros';
    extraTip = `${primaryTip} Na reta final, reforce a letra da lei e zere pendências do Caderno de Erros.`;
  } else if (daysRemaining <= 15) {
    phaseName = 'Intensivo CETAP · Simulados e Revisão';
  }

  return {
    dateKey,
    dayNumber: dayIndex + 1,
    daysRemaining,
    phaseName,
    totalMinutes: 120,
    officialMilestone: milestoneToday,
    studyTip: extraTip,
    alertFocus: milestoneToday
      ? `Marco oficial hoje (${milestoneToday.dateLabel}): ${milestoneToday.description}.`
      : primaryAlert,
    blocks: [
      {
        order: 1,
        blockType: 'theory',
        label: 'Teoria e Lei Seca',
        durationMinutes: 50,
        disciplineId: primaryDisc.id,
        disciplineName: primaryDisc.shortName,
        topicTitle: primaryFocus,
      },
      {
        order: 2,
        blockType: 'questions',
        label: 'Questões CETAP',
        durationMinutes: 35,
        disciplineId: primaryDisc.id,
        disciplineName: primaryDisc.shortName,
        topicTitle: `Bateria direcionada · ${primaryDisc.shortName}`,
      },
      {
        order: 3,
        blockType: 'correction',
        label: 'Correção Comentada',
        durationMinutes: 15,
        disciplineId: secondaryDisc.id,
        disciplineName: secondaryDisc.shortName,
        topicTitle: `Análise de gabarito · ${secondaryDisc.shortName}`,
      },
      {
        order: 4,
        blockType: 'revision',
        label: 'Revisão Espaçada',
        durationMinutes: 20,
        disciplineId: secondaryDisc.id,
        disciplineName: secondaryDisc.shortName,
        topicTitle: isMedio
          ? 'Caderno de Erros e Legislação ALEPA'
          : 'Caderno de Erros e Regimento Interno',
      },
    ],
  };
}

export function generateCalendarUntilExam(
  startDate = new Date(),
  maxDays = 365,
  campus: CampusLevel = 'superior',
  medioCargoGroup: MedioCargoGroup = 'cargo_01_04'
): DailyPlan[] {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const exam = new Date(2026, 11, 13);
  const diffDays = Math.max(
    1,
    Math.min(maxDays, Math.ceil((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );
  const plans: DailyPlan[] = [];
  for (let i = 0; i < diffDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    plans.push(generateDailyPlanForDate(d, i, campus, medioCargoGroup));
  }
  return plans;
}

const GERAL_DISCIPLINE_LABELS: Record<string, string> = {
  geral_portugues: 'Língua Portuguesa (Geral)',
  geral_raciocinio_logico: 'Raciocínio Lógico (Geral)',
  geral_informatica: 'Informática (Geral)',
  geral_constitucional: 'Direito Constitucional (Base Comum)',
  geral_administrativo: 'Direito Administrativo (Base Comum)',
  geral_legislacao_alepa: 'Legislação da ALEPA (Base Comum)',
  geral_etica: 'Ética no Serviço Público (Base Comum)',
  geral_tecnica_legislativa: 'Técnica Legislativa (Base Comum)',
};

export function getDisciplineName(disciplineId: string): string {
  if (disciplineId === 'nm_geral') return 'Geral · Nível Médio (Cargo 04)';
  if (GERAL_DISCIPLINE_LABELS[disciplineId]) return GERAL_DISCIPLINE_LABELS[disciplineId];
  return (
    ALEPA_DISCIPLINES.find((d) => d.id === disciplineId)?.name ??
    ALL_MEDIO_DISCIPLINES.find((d) => d.id === disciplineId)?.name ??
    disciplineId
  );
}

export function getDisciplineShortName(disciplineId: string): string {
  if (disciplineId === 'nm_geral') return 'Geral (Médio)';
  if (GERAL_DISCIPLINE_LABELS[disciplineId]) return GERAL_DISCIPLINE_LABELS[disciplineId];
  return (
    ALEPA_DISCIPLINES.find((d) => d.id === disciplineId)?.shortName ??
    ALL_MEDIO_DISCIPLINES.find((d) => d.id === disciplineId)?.shortName ??
    disciplineId
  );
}
