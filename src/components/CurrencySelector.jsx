import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Globe } from 'lucide-react';

const currencies = [
    { code: 'USD', flag: '🇺🇸', label: 'Dólar' },
    { code: 'EUR', flag: '🇪🇸', label: 'Euro' },
    { code: 'ARS', flag: '🇦🇷', label: 'Peso Arg' },
    { code: 'MXN', flag: '🇲🇽', label: 'Peso Mex' },
    { code: 'COP', flag: '🇨🇴', label: 'Peso Col' },
    { code: 'CLP', flag: '🇨🇱', label: 'Peso Chi' },
    { code: 'PEN', flag: '🇵🇪', label: 'Sol Peru' },
    { code: 'BRL', flag: '🇧🇷', label: 'Real Bra' },
    { code: 'UYU', flag: '🇺🇾', label: 'Peso Uru' },
    { code: 'VES', flag: '🇻🇪', label: 'Bolívar' },
];

export default function CurrencySelector() {
    const { profile, updateCurrency } = useAuth();
    const currentCurrency = profile?.moneda || 'USD';

    return (
        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 hover:border-primary/50 transition-all group">
            <Globe size={14} className="text-primary ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
            <select
                value={currentCurrency}
                onChange={(e) => updateCurrency(e.target.value)}
                className="bg-transparent text-white font-black text-[10px] outline-none cursor-pointer pr-4 uppercase tracking-widest appearance-none"
            >
                {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code} className="bg-[#111] text-white">
                        {curr.flag} {curr.code}
                    </option>
                ))}
            </select>
        </div>
    );
}
