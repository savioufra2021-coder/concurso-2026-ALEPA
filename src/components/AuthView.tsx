import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, User as UserIcon, UserPlus, AlertCircle, BookOpen, ExternalLink, Users } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import bannerImg from '../assets/images/alepa_campus_banner_1794572280452.jpg';
import emblemImg from '../assets/images/alepa_campus_emblem_1794572279329.jpg';
import { useAuth } from '../contexts/AuthContext';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';
import { CONCURSO_PROFILE, getDaysUntilExam } from '../data/alepaSyllabus';

export function AuthView() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, enterGuestMode } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'family'>('login');
  const [familyStep, setFamilyStep] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showProviderHelp, setShowProviderHelp] = useState(false);
  const [imgBannerFailed, setImgBannerFailed] = useState(false);
  const [imgEmblemFailed, setImgEmblemFailed] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const acesso = params.get('acesso');
      const invitedEmail = params.get('email');
      if (acesso === 'familiar') {
        setMode('family');
      }
      if (invitedEmail) {
        setEmail(invitedEmail.trim());
      }
    } catch {
      // ignore invalid URL search params
    }
  }, []);

  const daysLeft = getDaysUntilExam();

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      setShowProviderHelp(true);
      return 'O provedor E-mail/Senha ainda não foi ativado no Firebase Console. Ative-o ou entre imediatamente com o botão Google abaixo.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'E-mail ou senha inválidos. Verifique os dados ou crie uma conta nova.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já possui cadastro. Use a aba Entrar.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'A janela de autenticação Google foi fechada antes de concluir.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Este domínio ainda não está autorizado no Firebase Authentication. Use "Entrar como Visitante (sem e-mail)" abaixo ou adicione este domínio nos domínios autorizados do Firebase.';
    }
    return err instanceof Error ? err.message : 'Não foi possível autenticar agora.';
  };

  const isRegistering = mode === 'register' || (mode === 'family' && familyStep === 'register');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (!isRegistering) {
        await loginWithEmail(email, password);
      } else {
        if (!displayName.trim()) {
          throw new Error('Informe seu nome completo.');
        }
        await registerWithEmail(email, password, displayName, 'student');
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left Institutional Column */}
      <div className="lg:w-1/2 bg-[#0B3321] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          {!imgEmblemFailed ? (
            <img
              src={emblemImg}
              alt="Emblema Concurso ALEPA 2026"
              referrerPolicy="no-referrer"
              onError={() => setImgEmblemFailed(true)}
              className="w-12 h-12 rounded-xl object-cover bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-white">Concurso ALEPA 2026</p>
            <p className="text-xs text-slate-300 tracking-wide">
              Assembleia Legislativa do Estado do Pará · Nível Médio e Nível Superior
            </p>
          </div>
        </div>

        <div className="relative z-10 my-10 lg:my-0 space-y-6 max-w-xl">
          <p className="text-xs font-medium tracking-wide text-emerald-300">
            Editais 001/2026 (Médio) e 002/2026 (Superior) · {CONCURSO_PROFILE.board}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white">
            Concurso ALEPA 2026
          </h1>
          <p className="text-base text-slate-200 leading-relaxed max-w-lg">
            Plataforma de estudo direcionado com dois Campus — <strong>Nível Médio (Edital 001/2026)</strong> e{' '}
            <strong>Nível Superior (Edital 002/2026)</strong> — plano diário de 2 horas, conteúdo programático
            oficial, simulados CETAP, podcasts e integração com Google Drive.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15">
            <div>
              <p className="text-xs text-slate-300">Prova Objetiva</p>
              <p className="font-mono text-lg font-semibold tabular-nums mt-1">13/12/2026</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Contagem</p>
              <p className="font-mono text-lg font-semibold tabular-nums mt-1">{daysLeft} dias</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Meta Diária</p>
              <p className="font-mono text-lg font-semibold tabular-nums mt-1">2h / dia</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 hidden lg:block rounded-2xl overflow-hidden border border-white/15 bg-slate-900/40">
          {!imgBannerFailed ? (
            <div className="relative h-48">
              <img
                src={bannerImg}
                alt="Mesa de estudos jurídicos e legislação"
                referrerPolicy="no-referrer"
                onError={() => setImgBannerFailed(true)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B3321]/90 via-[#0B3321]/30 to-transparent flex items-end p-4">
                <p className="text-xs text-slate-100">
                  Sincronização em nuvem entre computador e celular · Progresso, simulados e revisões preservados.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-200">
              Sincronização contínua entre desktop e celular · Banco de melhoria e simulados CETAP.
            </div>
          )}
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mode === 'family'
                  ? 'Acesso por Familiares'
                  : mode === 'login'
                    ? 'Acessar Campus'
                    : 'Criar Conta'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {mode === 'family'
                  ? 'Entre com seu Google ou e-mail familiar para acessar os conteúdos compartilhados.'
                  : mode === 'login'
                    ? 'Entre para sincronizar seu histórico entre dispositivos.'
                    : 'Cadastre-se como estudante ou professor da turma.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`min-h-[42px] text-xs sm:text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                mode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('family');
                setErrorMsg(null);
              }}
              className={`min-h-[42px] text-xs sm:text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                mode === 'family' ? 'bg-[#0B3321] text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Familiares</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`min-h-[42px] text-xs sm:text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                mode === 'register' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
              <span>Cadastrar</span>
            </button>
          </div>

          {mode === 'family' && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-[#0B3321] dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <p className="font-bold text-[#0B3321] dark:text-emerald-300">Área de Ensino Compartilhada da Família</p>
                  <p className="mt-0.5">
                    Ao entrar aqui, você acessa imediatamente os PDFs, pastas do Drive, aulas e simulados publicados na
                    biblioteca da família.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-white/80 dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFamilyStep('login')}
                  className={`py-1.5 text-xs font-semibold rounded-md ${
                    familyStep === 'login' ? 'bg-[#0B3321] text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Já tenho acesso
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyStep('register')}
                  className={`py-1.5 text-xs font-semibold rounded-md ${
                    familyStep === 'register' ? 'bg-[#0B3321] text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Primeiro acesso
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700 dark:text-red-400" />
              <div className="space-y-2">
                <p>{errorMsg}</p>
                {showProviderHelp && (
                  <div className="text-xs text-red-900 dark:text-red-200 pt-2 border-t border-red-200 dark:border-red-800 space-y-2">
                    <p>
                      Para ativar login por e-mail/senha: acesse o <strong>Firebase Console</strong> →{' '}
                      <em>Authentication</em> → <em>Sign-in method</em> → <em>Email/Password</em> → <strong>Enable</strong>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold underline text-red-950 dark:text-red-200 hover:text-red-800"
                      >
                        <span>Abrir Sign-in method no Firebase Console</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={handleGoogle}
                        disabled={loading}
                        className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-lg"
                      >
                        Entrar com Google agora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {mode === 'family' ? 'Nome do familiar' : 'Nome completo'}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex.: Ana Paula Oliveira"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Perfil inicial: Estudante</p>
                    <p className="leading-relaxed">
                      Novas contas são criadas no ambiente do estudante. Permissões de Editor/Professor ou
                      Administrador são atribuídas exclusivamente no Painel Administrativo.
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] pl-10 pr-11 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] px-4 py-2.5 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              {!loading && (isRegistering ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />)}
              <span>
                {loading
                  ? 'Autenticando...'
                  : isRegistering
                    ? mode === 'family'
                      ? 'Criar Acesso Familiar e Entrar'
                      : 'Criar Conta e Entrar na Hora'
                    : mode === 'family'
                      ? 'Entrar como Familiar'
                      : 'Entrar com E-mail e Senha'}
              </span>
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-500 dark:text-slate-400">ou acesso instantâneo</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full min-h-[46px] px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>Entrar com Google (nuvem)</span>
            </button>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label htmlFor="guest-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome para acesso visitante (obrigatório)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="guest-name-input"
                  type="text"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    if (guestError) setGuestError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = guestName.trim();
                      if (trimmed.length < 2) {
                        setGuestError('Informe seu nome (mínimo 2 caracteres) para entrar como visitante.');
                        return;
                      }
                      enterGuestMode(trimmed);
                    }
                  }}
                  placeholder="Ex.: Maria Silva"
                  maxLength={80}
                  className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>
              {guestError && (
                <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                  {guestError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  const trimmed = guestName.trim();
                  if (trimmed.length < 2) {
                    setGuestError('Informe seu nome (mínimo 2 caracteres) para entrar como visitante.');
                    return;
                  }
                  enterGuestMode(trimmed);
                }}
                disabled={loading}
                className="w-full min-h-[46px] px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-300 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-[#146C43] dark:text-emerald-400" />
                <span>Entrar como Visitante (sem e-mail)</span>
              </button>
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed">
                No modo visitante você acessa o conteúdo aberto imediatamente e seu progresso fica salvo neste navegador.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <PWAInstallButton variant="auth" />
            </div>
          </div>
        </div>
      </div>
      <OfflineIndicator />
    </div>
  );
}
