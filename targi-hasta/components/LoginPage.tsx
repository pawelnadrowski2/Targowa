import React, { useState } from 'react';
import { AppView, UserSession } from '../types';
import { ArrowLeft, Lock, KeyRound, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  view: AppView.LOGIN_ADMIN | AppView.LOGIN_EXHIBITOR;
  onLogin: (session: UserSession) => void;
  onBack: () => void;
  onLoginSubmit: (input: string, isAdmin: boolean) => Promise<{ success: boolean; error?: string }>;
  logoUrl?: string;
  isBackendConnected: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  view,
  onLogin,
  onBack,
  onLoginSubmit,
  logoUrl,
  isBackendConnected,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const isAdmin = view === AppView.LOGIN_ADMIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      setError(isAdmin ? 'Wprowadź hasło administratora.' : 'Wprowadź otrzymany kod dostępu.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await onLoginSubmit(inputVal.trim(), isAdmin);
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas logowania.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full relative px-4">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 md:left-8 flex items-center text-slate-500 hover:text-slate-800 transition-colors font-semibold text-sm bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200"
      >
        <ArrowLeft size={18} className="mr-2" /> Wróć do menu głównego
      </button>

      {logoUrl && (
        <div className="mb-6 mt-12 md:mt-0 text-center">
          <img src={logoUrl} alt="Logo" className="h-14 md:h-16 object-contain mx-auto drop-shadow-sm" />
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
        {/* Pasek statusu u góry karty */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${isBackendConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />

        <div className="text-center mb-8">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md ${isAdmin ? 'bg-slate-900 text-white shadow-slate-200' : 'bg-indigo-600 text-white shadow-indigo-200'}`}>
            {isAdmin ? <Lock size={30} /> : <KeyRound size={30} />}
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Logowanie Administratora' : 'Strefa Dostawcy Targowego'}
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            {isAdmin
              ? 'Wprowadź hasło administratora, aby zarządzać targami.'
              : 'Wpisz poufny kod dostępu otrzymany na Twojej karcie stoiska.'}
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600">
            <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isBackendConnected ? 'Serwer Backend: Aktywny (Online)' : 'Serwer Backend: Tryb Lokalny'}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                {isAdmin ? 'Hasło Administratora' : 'Poufny Kod Dostępu'}
              </label>
              {!isAdmin && inputVal.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                >
                  {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showCode ? 'Ukryj' : 'Pokaż'}</span>
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type={isAdmin ? 'password' : (showCode ? 'text' : 'password')}
                value={inputVal}
                onChange={(e) => setInputVal(isAdmin ? e.target.value : e.target.value.toUpperCase())}
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:ring-2 outline-none font-medium text-slate-900 transition-all ${
                  isAdmin
                    ? 'focus:ring-slate-800 focus:border-slate-800'
                    : 'focus:ring-indigo-600 focus:border-indigo-600 font-mono tracking-widest text-lg text-center'
                }`}
                placeholder={isAdmin ? 'Wpisz hasło…' : '••••••'}
                autoFocus
                disabled={isLoading}
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              {isAdmin
                ? 'Dostęp zabezpieczony hasłem administracyjnym.'
                : 'Kod dostępu jest poufny i przypisany wyłącznie do Twojego stoiska.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-red-600 text-sm bg-red-50 p-3.5 rounded-xl border border-red-200 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-98 ${
              isAdmin
                ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            } ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Logowanie…
              </>
            ) : (
              'Zaloguj się do systemu'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
