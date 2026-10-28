
import React from 'react';
import { Shield, Store } from 'lucide-react';
import { AppView } from '../types';

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
  logoUrl: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, logoUrl }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-in fade-in duration-700">
      <div className="text-center mb-12 flex flex-col items-center">
        <img src={logoUrl} alt="TARGI HASta" className="h-24 md:h-40 object-contain mb-8 drop-shadow-xl" />
        <p className="text-lg text-slate-500">Rejestracja Zamówień i Loteria</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
        {/* Exhibitor Card */}
        <button 
          onClick={() => onNavigate(AppView.LOGIN_EXHIBITOR)}
          className="group relative overflow-hidden bg-white hover:bg-indigo-50 border-2 border-slate-100 hover:border-indigo-200 rounded-3xl p-8 transition-all duration-300 shadow-lg hover:shadow-xl text-left"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-100 rounded-full transition-transform group-hover:scale-150 group-hover:bg-indigo-200"></div>
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-indigo-200 shadow-lg">
              <Store size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Panel Wystawcy</h2>
            <p className="text-slate-500">
              Zaloguj się, aby rejestrować zamówienia klientów i generować bilety do loterii.
            </p>
            <div className="mt-6 flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
              Zaloguj się &rarr;
            </div>
          </div>
        </button>

        {/* Admin Card */}
        <button 
          onClick={() => onNavigate(AppView.LOGIN_ADMIN)}
          className="group relative overflow-hidden bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-slate-300 rounded-3xl p-8 transition-all duration-300 shadow-lg hover:shadow-xl text-left"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-slate-100 rounded-full transition-transform group-hover:scale-150 group-hover:bg-slate-200"></div>
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-slate-800 text-white rounded-2xl flex items-center justify-center mb-6 shadow-slate-300 shadow-lg">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Panel Administratora</h2>
            <p className="text-slate-500">
              Zarządzaj dostępami wystawców, przeglądaj statystyki i prowadź losowania.
            </p>
            <div className="mt-6 flex items-center text-slate-800 font-semibold group-hover:translate-x-2 transition-transform">
              Zaloguj się &rarr;
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
