import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Video,
  FileText,
  ClipboardList,
  StickyNote,
  BarChart3,
  Layers,
  Home,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { CampusLevel, StudyMaterial, Question } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { BookReaderModal } from './BookReaderModal';

interface PortugueseRepositoryViewProps {
  campus: CampusLevel;
  onNavigate: (section: any) => void;
  onSummarizeWithGemini?: (target: {
    mode: 'pdf' | 'topic';
    materialId?: string;
    url?: string;
    title?: string;
    disciplineId?: string;
  }) => void;
}

export type PortugueseTab =
  | 'inicio'
  | 'aulas'
  | 'biblioteca'
  | 'leitor'
  | 'exercicios'
  | 'anotacoes'
  | 'progresso'
  | 'complementares';

interface FabricioClass {
  id: string;
  number: string;
  title: string;
  description: string;
  url: string;
  fallbackUrl: string;
  iconName: string;
  durationMinutes: number;
}

const FABRICIO_CLASSES: FabricioClass[] = [
  {
    id: 'aula-01',
    number: '01',
    title: 'INTERPRETAÇÃO DE TEXTOS',
    description: 'Técnicas avançadas de compreensão e interpretação de textos exigidas pela banca CETAP em concursos públicos.',
    url: 'https://fabriciodutra.com.br/interpretacao/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'book-open',
    durationMinutes: 45,
  },
  {
    id: 'aula-02',
    number: '02',
    title: 'REGÊNCIA VERBAL',
    description: 'Estudo prático dos verbos transitivos diretos, indiretos e bitransitivos conforme a norma culta.',
    url: 'https://fabriciodutra.com.br/regencia-verbal/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'spell-check',
    durationMinutes: 50,
  },
  {
    id: 'aula-03',
    number: '03',
    title: 'USO DOS PORQUÊS',
    description: 'Guia completo e definitivo para nunca mais errar o uso de por quê, por que, porque e porquê.',
    url: 'https://fabriciodutra.com.br/como-usar-o-porque-guia-completo-e-definitivo/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'type',
    durationMinutes: 30,
  },
  {
    id: 'aula-04',
    number: '04',
    title: 'PONTUAÇÃO E VÍRGULA',
    description: 'Regras essenciais para o emprego correto da vírgula, ponto e vírgula e demais sinais de pontuação.',
    url: 'https://fabriciodutra.com.br/pontuacao-virgula/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'edit-3',
    durationMinutes: 55,
  },
  {
    id: 'aula-05',
    number: '05',
    title: 'CLASSES GRAMATICAIS',
    description: 'Revisão detalhada das 10 classes de palavras (substantivo, adjetivo, verbo, pronome, etc.) e suas funções sintáticas.',
    url: 'https://fabriciodutra.com.br/classes-gramaticais/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'list-tree',
    durationMinutes: 60,
  },
  {
    id: 'aula-06',
    number: '06',
    title: 'CONJUNÇÕES',
    description: 'Análise aprofundada das conjunções coordenadas e subordinadas e seus valores semânticos nas orações.',
    url: 'https://fabriciodutra.com.br/ebookconjuncoes/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'git-merge',
    durationMinutes: 40,
  },
  {
    id: 'aula-07',
    number: '07',
    title: 'SUJEITO E CONCORDÂNCIA',
    description: 'Identificação de sujeito simples, composto, oculto e as principais regras de concordância verbal e nominal.',
    url: 'https://fabriciodutra.com.br/sujeitoconcordanciagratuito/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'network',
    durationMinutes: 50,
  },
  {
    id: 'aula-08',
    number: '08',
    title: 'PARTÍCULA SE',
    description: 'Diferenciação precisa entre índice de indeterminação do sujeito, partícula apassivadora, pronome reflexivo e parte integrante do verbo.',
    url: 'https://fabriciodutra.com.br/particula-se/',
    fallbackUrl: 'https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas',
    iconName: 'text-cursor-input',
    durationMinutes: 45,
  },
];

const EDITAL_TOPICS_PORTUGUESE = [
  { id: 't1', title: 'Ortografia Oficial', category: 'Norma Padrão' },
  { id: 't2', title: 'Acentuação Gráfica', category: 'Norma Padrão' },
  { id: 't3', title: 'Comunicação Assertiva & Redação Oficial', category: 'Redação' },
  { id: 't4', title: 'Emprego do Sinal de Crase', category: 'Sintaxe' },
  { id: 't5', title: 'Coesão e Coerência Textual', category: 'Interpretação' },
  { id: 't6', title: 'Semântica e Significação de Palavras', category: 'Semântica' },
  { id: 't7', title: 'Classes de Palavras e seus Empregos', category: 'Morfologia' },
  { id: 't8', title: 'Período Simples e Período Compostos', category: 'Sintaxe' },
  { id: 't9', title: 'Pontuação e Emprego de Sinais', category: 'Sintaxe' },
  { id: 't10', title: 'Concordância Verbal e Nominal', category: 'Sintaxe' },
  { id: 't11', title: 'Regência Verbal e Nominal', category: 'Sintaxe' },
  { id: 't12', title: 'Colocação Pronominal', category: 'Sintaxe' },
  { id: 't13', title: 'Figuras de Linguagem e Vícios de Linguagem', category: 'Estilística' },
  { id: 't14', title: 'Reescrita de Frases e Correção de Textos', category: 'Estilística' },
];

export function PortugueseRepositoryView({
  campus,
  onNavigate,
  onSummarizeWithGemini,
}: PortugueseRepositoryViewProps) {
  const { materials, readingProgressMap, simuladoAttempts, user, profile } = useAuth();
  const uid = user?.uid || profile?.uid || 'guest_local';
  const notesStorageKey = `alepa_portugues_notes_${uid}`;
  const lessonsStorageKey = `alepa_pt_completed_lessons_${uid}`;

  const [activeTab, setActiveTab] = useState<PortugueseTab>('inicio');
  const [selectedMaterialForReader, setSelectedMaterialForReader] = useState<StudyMaterial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');

  // Interactive Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});

  // Per-user completed lessons state
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(lessonsStorageKey);
      setCompletedLessonIds(saved ? (JSON.parse(saved) as string[]) : []);
    } catch {
      setCompletedLessonIds([]);
    }
  }, [lessonsStorageKey]);

  const toggleLessonComplete = (lessonId: string) => {
    setCompletedLessonIds((prev) => {
      const next = prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId];
      try {
        localStorage.setItem(lessonsStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  // Digital Notes state (isolated per user)
  const [notesList, setNotesList] = useState<Array<{ id: string; title: string; content: string; date: string }>>([]);
  useEffect(() => {
    try {
      const perUser = localStorage.getItem(notesStorageKey);
      if (perUser !== null) {
        setNotesList(JSON.parse(perUser));
        return;
      }
      const legacy = uid === 'guest_local' ? localStorage.getItem('alepa_portugues_notes') : null;
      setNotesList(
        legacy
          ? JSON.parse(legacy)
          : [
              {
                id: 'n1',
                title: 'Dica de Crase com Casa e Terra',
                content: 'Palavra "casa" sem determinante não tem crase. Ex: Fiquei em casa.',
                date: '2026-11-10',
              },
            ]
      );
    } catch {
      setNotesList([]);
    }
  }, [notesStorageKey, uid]);

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Filter study materials belonging to Portuguese
  const portugueseMaterials = useMemo(() => {
    return materials.filter(
      (m: StudyMaterial) =>
        m.disciplineId === 'cat_01_portugues' ||
        m.disciplineId === 'nm_cat_01_portugues' ||
        m.disciplineId === 'geral_cat_01_portugues' ||
        m.disciplineId === 'portugues' ||
        m.title.toLowerCase().includes('portugês') ||
        m.title.toLowerCase().includes('gramática') ||
        m.title.toLowerCase().includes('interpretação')
    );
  }, [materials]);

  // Sample Portuguese Questions (CETAP & Training)
  const portugueseQuestions: Question[] = useMemo(() => [
    {
      id: 'q_pt_1',
      disciplineId: 'portugues',
      topicTitle: 'Crase',
      statement: 'Assinale a alternativa em que o emprego do acento indicativo de crase está CORRETO conforme a norma padrão.',
      options: [
        'Referiu-se à Vossa Excelência com muito respeito durante a sessão.',
        'Chegamos cedo àquela cidade histórica no interior do Pará.',
        'Os deputados foram à Brasília participar da votação da ALEPA.',
        'Daqui à duas semanas teremos o simulado oficial.',
        'Começou à ventar forte logo após a abertura dos trabalhos.'
      ],
      correctIndex: 1,
      explanation: 'O correto é "àquela cidade" (preposição a + pronome demonstrativo aquela). Diante de pronomes de tratamento como Vossa Excelência não se usa crase; diante de nomes de cidades que admitem artigo feminino usa-se crase (ir à Bahia, mas ir a Brasília sem artigo); "daqui a duas semanas" indica tempo futuro (sem crase); antes de verbo no infinitivo ("ventar") não há crase.',
      source: 'CETAP - ALEPA 2026 (Treinamento Autorizado)',
      isOfficial: true,
      difficulty: 'intermediario',
    },
    {
      id: 'q_pt_2',
      disciplineId: 'portugues',
      topicTitle: 'Concordância Verbal',
      statement: 'No que tange à concordância verbal, assinale a opção correta para o texto oficial da ALEPA:',
      options: [
        'Fez dez anos que os parlamentares aprovaram o novo plano.',
        'Devem existir regras mais rígidas para a tramitação de projetos.',
        'Houveram muitos debates acalorados na sessão plenária de ontem.',
        'Mais de um deputado votaram favoravelmente ao requerimento.',
        'Faltou detalhes na redação final da proposição legislativa.'
      ],
      correctIndex: 1,
      explanation: '"Devem existir" está correto pois o verbo existir é pessoal e concorda com o sujeito "regras mais rígidas". "Fez dez anos" (verbo fazer indicando tempo decorrido é impessoal, fica no singular). "Houveram" está incorreto (verbo haver no sentido de existir é impessoal: houve muitos debates). "Mais de um deputado votou" (singular ou plural, mas a 1 é inquestionável). "Faltaram detalhes" (o sujeito é plural).',
      source: 'CETAP - Analista Legislativo (Treinamento)',
      isOfficial: true,
      difficulty: 'avancado',
    },
    {
      id: 'q_pt_3',
      disciplineId: 'portugues',
      topicTitle: 'Regência Verbal',
      statement: 'Assinale a frase em que o verbo assistir foi empregado em desacordo com a regência oficial:',
      options: [
        'O médico assistiu o paciente com dedicação exclusiva.',
        'Assistimos a um excelente espetáculo cultural em Belém.',
        'O assistente social assiste aos desempregados da capital.',
        'Meu tio assiste em Santarém há mais de trinta anos.',
        'Os técnicos assistiram ao projeto de modernização da ALEPA.'
      ],
      correctIndex: 0,
      explanation: 'Na acepção de prestar atendimento ou socorrer, o verbo assistir é transitivo indireto na norma culta padrão (assistiu ao paciente), embora haja tolerância em gramáticas modernas, a banca CETAP cobra rigorosamente a regência clássica.',
      source: 'CETAP / FGV - Língua Portuguesa',
      isOfficial: true,
      difficulty: 'intermediario',
    }
  ], []);

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    const item = {
      id: `n_${Date.now()}`,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      date: new Date().toISOString().split('T')[0],
    };
    const next = [item, ...notesList];
    setNotesList(next);
    try {
      localStorage.setItem(notesStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleDeleteNote = (id: string) => {
    const next = notesList.filter((n: { id: string }) => n.id !== id);
    setNotesList(next);
    try {
      localStorage.setItem(notesStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B3321] via-[#146C43] to-[#0B3321] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Módulo Especial · Concurso ALEPA 2026 ({campus === 'medio' ? 'Nível Médio' : 'Nível Superior'})</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Repositório Digital de Língua Portuguesa
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 max-w-2xl">
              Ambiente interativo completo com as 8 aulas gratuitas do professor <strong className="text-white">Fabrício Dutra</strong>, leitor inteligente de e-books, simulados da banca CETAP, caderno digital e teoria alinhada ao edital oficial.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('aulas')}
              className="min-h-[44px] px-4 py-2 bg-white text-[#0B3321] font-bold text-xs sm:text-sm rounded-xl hover:bg-emerald-50 transition-colors inline-flex items-center gap-2 shadow-md"
            >
              <Video className="w-4 h-4 text-[#146C43]" />
              <span>Aulas do Prof. Fabrício</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('biblioteca')}
              className="min-h-[44px] px-4 py-2 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 border border-emerald-700/60 font-semibold text-xs sm:text-sm rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Biblioteca PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex items-center gap-1.5 overflow-x-auto shadow-xs">
        {(
          [
            { id: 'inicio', label: 'Início', icon: Home },
            { id: 'aulas', label: 'Aulas Gratuitas', icon: Video },
            { id: 'biblioteca', label: 'Biblioteca PDFs', icon: FileText },
            { id: 'leitor', label: 'Leitor de Estudos', icon: BookOpen },
            { id: 'exercicios', label: 'Exercícios & Simulados', icon: ClipboardList },
            { id: 'anotacoes', label: 'Anotações (Caderno)', icon: StickyNote },
            { id: 'progresso', label: 'Meu Progresso', icon: BarChart3 },
            { id: 'complementares', label: 'Conteúdos Edital', icon: Layers },
          ] as const
        ).map((t) => {
          const TabIcon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                active
                  ? 'bg-[#0B3321] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <TabIcon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: INÍCIO */}
      {activeTab === 'inicio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-400 flex items-center justify-center font-bold">
                08
              </div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Aulas Gratuitas Essenciais
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Acesse o curso completo do professor Fabrício Dutra para concursos públicos, cobrindo os tópicos mais cobrados pela CETAP na ALEPA 2026.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('aulas')}
                className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 inline-flex items-center gap-1 hover:underline pt-1"
              >
                <span>Ver todas as 8 aulas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-400 flex items-center justify-center font-bold">
                PDF
              </div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Leitor Digital & E-books
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Abra apostilas, faça destaques coloridos, salve marcadores de página e consulte anotações com salvamento automático na nuvem.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('biblioteca')}
                className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 inline-flex items-center gap-1 hover:underline pt-1"
              >
                <span>Abrir biblioteca PDF</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-400 flex items-center justify-center font-bold">
                IA
              </div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Simulados & Professor IA
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Resolva questões inéditas com gabarito comentado, tire dúvidas gramaticais em tempo real e revise seus erros com espaçamento inteligente.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('exercicios')}
                className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 inline-flex items-center gap-1 hover:underline pt-1"
              >
                <span>Praticar questões</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Access to Fabrício Dutra Link Source */}
          <div className="bg-[#E8F3EC] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 uppercase tracking-wider">
                Fonte Externa Autorizada
              </p>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Portal Oficial do Professor Fabrício Dutra
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Acesse o portal original com videoaulas gratuitas de Língua Portuguesa para concursos.
              </p>
            </div>
            <a
              href="https://fabriciodutra.com.br/portugues-para-concursos-gratis/?utm_source=chatgpt.com#aulas"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white font-semibold text-xs rounded-xl inline-flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              <span>Visitar Site Oficial</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* TAB 2: AULAS GRATUITAS (PROFESSOR FABRÍCIO DUTRA) */}
      {activeTab === 'aulas' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                8 Aulas Gratuitas de Língua Portuguesa
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Conteúdo recomendado para candidatos da ALEPA 2026. Fonte: Professor Fabrício Dutra.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar aulas..."
                className="w-full sm:w-64 min-h-[38px] pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FABRICIO_CLASSES.filter((c: FabricioClass) => c.title.toLowerCase().includes(searchQuery.toLowerCase())).map((aula: FabricioClass) => {
              const isCompleted = completedLessonIds.includes(aula.id);
              return (
              <div
                key={aula.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between transition-all shadow-xs ${
                  isCompleted
                    ? 'border-emerald-400 dark:border-emerald-700'
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-300">
                        AULA {aula.number}
                      </span>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Concluída
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {aula.durationMinutes} min
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    {aula.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {aula.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLessonComplete(aula.id)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isCompleted ? 'Concluída' : 'Marcar concluída'}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {onSummarizeWithGemini && (
                      <button
                        type="button"
                        onClick={() =>
                          onSummarizeWithGemini({
                            mode: 'topic',
                            title: `Resumo: ${aula.title} (Prof. Fabrício Dutra)`,
                            disciplineId: 'portugues',
                          })
                        }
                        title="Resumir com Professor IA"
                        className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Resumo IA</span>
                      </button>
                    )}
                    <a
                      href={aula.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>ACESSAR AULA</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: BIBLITECA DE PDFS */}
      {activeTab === 'biblioteca' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Biblioteca Digital de Língua Portuguesa
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Apostilas, gramática normativa e e-books integrados ao leitor digital e ao Google Drive.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoria"
                className="min-h-[38px] px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="todos">Todas as Categorias</option>
                <option value="gramatica">Gramática</option>
                <option value="interpretacao">Interpretação</option>
                <option value="redacao">Redação Oficial</option>
              </select>
            </div>
          </div>

          {portugueseMaterials.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <FileText className="w-10 h-10 text-emerald-600 mx-auto opacity-60" />
              <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Nenhum PDF cadastrado especificamente para Português ainda.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Você pode adicionar novos materiais na Central de Estudos ou abrir os materiais gerais da instituição.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('materials')}
                className="min-h-[40px] px-4 bg-[#0B3321] text-white text-xs font-semibold rounded-xl"
              >
                Ir para Central de Estudos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {portugueseMaterials.map((mat: StudyMaterial) => {
                const prog = readingProgressMap[mat.id];
                return (
                  <div
                    key={mat.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-300">
                          {mat.fileType.toUpperCase()}
                        </span>
                        {prog && (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {prog.progressPercent}% Lido
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {mat.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {mat.description || 'Material oficial autorizado para estudo de Língua Portuguesa.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 truncate">
                        {mat.author || 'Prof. Fabrício / ALEPA'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isInAppReadableMaterial(mat) && (
                          <button
                            type="button"
                            onClick={() => setSelectedMaterialForReader(mat)}
                            className="min-h-[36px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Abrir no Leitor</span>
                          </button>
                        )}
                        {mat.url.startsWith('http') && !mat.url.includes('blob') && (
                          <a
                            href={mat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[36px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span>Abrir Fonte</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LEITOR DE ESTUDOS */}
      {activeTab === 'leitor' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Leitor Digital Inteligente & Histórico
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              O leitor digital possui Modo Livro (páginas duplas), Modo Texto (reflow ajustável) e Modo PDF Original, além de salvar automaticamente sua última página, destaques e anotações.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portugueseMaterials.slice(0, 4).map((m: StudyMaterial) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-emerald-500 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{m.title}</p>
                  <p className="text-[11px] text-slate-500">Última página lida: {readingProgressMap[m.id]?.lastPage || 1}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMaterialForReader(m)}
                  className="min-h-[38px] px-3.5 bg-[#0B3321] text-white text-xs font-semibold rounded-xl shrink-0 inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Continuar Leitura</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: EXERCÍCIOS & SIMULADOS */}
      {activeTab === 'exercicios' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Questões de Língua Portuguesa (Banca CETAP & Treinamento)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Teste seus conhecimentos com correção automática e gabarito comentado por especialistas.
            </p>
          </div>

          <div className="space-y-5">
            {portugueseQuestions.map((q: Question, idx: number) => {
              const qKey = q.id;
              const selectedOpt = quizAnswers[qKey];
              const isSubmitted = quizSubmitted[qKey];
              const isCorrect = selectedOpt === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Questão {idx + 1} · {q.topicTitle}
                    </span>
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      {q.source}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {q.statement}
                  </p>

                  <div className="space-y-2">
                    {q.options.map((opt: string, oIdx: number) => {
                      let btnStyle = 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800';
                      if (isSubmitted) {
                        if (oIdx === q.correctIndex) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 font-semibold';
                        } else if (selectedOpt === oIdx) {
                          btnStyle = 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-200';
                        }
                      } else if (selectedOpt === oIdx) {
                        btnStyle = 'border-[#146C43] bg-emerald-50/60 dark:bg-emerald-950/40 font-semibold';
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qKey]: oIdx }))}
                          className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-colors ${btnStyle}`}
                        >
                          <span className="font-mono font-bold shrink-0 w-5">
                            {['A', 'B', 'C', 'D', 'E'][oIdx]})
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!isSubmitted ? (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={selectedOpt === undefined}
                        onClick={() => setQuizSubmitted((prev) => ({ ...prev, [qKey]: true }))}
                        className="min-h-[40px] px-5 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm"
                      >
                        Responder Questão
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`p-4 rounded-xl border text-xs sm:text-sm space-y-2 ${
                        isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-950 dark:text-emerald-200'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-200 text-red-950 dark:text-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Resposta Correta! Parabéns.</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span>Resposta Incorreta.</span>
                          </>
                        )}
                      </div>
                      <p className="leading-relaxed opacity-90">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: ANOTAÇÕES (CADERNO DIGITAL) */}
      {activeTab === 'anotacoes' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Caderno Digital de Língua Portuguesa
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Registre regras gramaticais, macetes e dúvidas para revisão frequente antes da prova da ALEPA.
            </p>
          </div>

          <form onSubmit={handleSaveNote} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">Adicionar Nova Anotação</h3>
            <div className="space-y-3">
              <input
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Título do resumo ou regra (Ex.: Concordância do Verbo Fazer)"
                className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <textarea
                rows={3}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Escreva os detalhes, exemplos e pegadinhas da banca..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[40px] px-5 bg-[#0B3321] hover:bg-[#134b32] text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                Salvar no Caderno
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notesList.map((n: { id: string; title: string; content: string; date: string }) => (
              <div
                key={n.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{n.date}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(n.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">{n.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {n.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: MEU PROGRESSO */}
      {activeTab === 'progresso' && (() => {
        const totalLessons = FABRICIO_CLASSES.length;
        const completedLessonsCount = completedLessonIds.length;
        const lessonsPct = Math.round((completedLessonsCount / totalLessons) * 100);

        const consultedPdfsCount = portugueseMaterials.filter(
          (m) => Boolean(readingProgressMap[m.id])
        ).length;

        const submittedQuizIds = Object.keys(quizSubmitted).filter((id) => quizSubmitted[id]);
        const quizCorrectCount = submittedQuizIds.filter((id) => {
          const q = portugueseQuestions.find((item) => item.id === id);
          return q !== undefined && quizAnswers[id] === q.correctIndex;
        }).length;

        const portugueseSimulados = simuladoAttempts.filter(
          (a) =>
            a.primaryDisciplineId === 'portugues' ||
            a.primaryDisciplineId === 'nm_portugues'
        );
        const simTotalQ = portugueseSimulados.reduce((acc, a) => acc + a.totalQuestions, 0);
        const simCorrectQ = portugueseSimulados.reduce((acc, a) => acc + a.correctCount, 0);

        const totalAnswered = submittedQuizIds.length + simTotalQ;
        const totalCorrect = quizCorrectCount + simCorrectQ;
        const accuracyPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

        const statusLabel =
          completedLessonsCount === 0 && consultedPdfsCount === 0 && totalAnswered === 0
            ? 'AGUARDANDO INÍCIO'
            : accuracyPct >= 80 || lessonsPct >= 75
              ? 'EM RITMO FORTE'
              : 'EM PROGRESSO';

        return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Painel de Progresso em Língua Portuguesa
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Indicadores calculados a partir das suas aulas concluídas, leituras registradas e questões respondidas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400">Aulas Concluídas</p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {completedLessonsCount} / {totalLessons}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lessonsPct}% do módulo básico
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Materiais Lidos / Acervo</p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {consultedPdfsCount} / {portugueseMaterials.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Com progresso salvo no leitor</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Questões Resolvidas</p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {totalAnswered}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {totalAnswered > 0 ? `${accuracyPct}% de acertos (${totalCorrect}/${totalAnswered})` : 'Nenhuma respondida ainda'}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status Geral</p>
              <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {statusLabel}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {notesList.length} {notesList.length === 1 ? 'anotação' : 'anotações'} no caderno
              </p>
            </div>
          </div>
        </div>
        );
      })()}

      {/* TAB 8: CONTEÚDOS COMPLEMENTARES (EDITAL) */}
      {activeTab === 'complementares' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Conteúdos Complementares & Edital Oficial
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Os 14 tópicos oficiais cobrados no edital da ALEPA 2026 para Língua Portuguesa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EDITAL_TOPICS_PORTUGUESE.map((top: { id: string; title: string; category: string }, idx: number) => (
              <div
                key={top.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-xs hover:border-emerald-500 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Tópico {idx + 1} · {top.category}
                  </span>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {top.title}
                  </h3>
                </div>
                {onSummarizeWithGemini && (
                  <button
                    type="button"
                    onClick={() =>
                      onSummarizeWithGemini({
                        mode: 'topic',
                        title: `Resumo Edital: ${top.title}`,
                        disciplineId: 'portugues',
                      })
                    }
                    className="min-h-[36px] px-3 bg-emerald-50 dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold rounded-xl shrink-0 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Estudar IA</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Reader Modal if opened */}
      {selectedMaterialForReader && (
        <BookReaderModal
          material={selectedMaterialForReader}
          onClose={() => setSelectedMaterialForReader(null)}
          onSummarizeWithGemini={onSummarizeWithGemini}
        />
      )}
    </div>
  );
}
