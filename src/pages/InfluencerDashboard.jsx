import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, Copy, Check, TrendingUp, UserCheck, Clock, AlertCircle, LogOut, Link as LinkIcon } from 'lucide-react';

const BASE_URL = `${window.location.origin}/controldefinanzas`;

export default function InfluencerDashboard() {
    const { profile, signOut } = useAuth();
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const referralLink = profile?.referral_code
        ? `${BASE_URL}/register?ref=${profile.referral_code}`
        : null;

    useEffect(() => {
        if (profile?.referral_code) fetchReferrals();
    }, [profile]);

    const fetchReferrals = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('perfiles')
            .select('id, email, estado_suscripcion, fecha_registro, fecha_vencimiento')
            .eq('referred_by', profile.referral_code)
            .order('fecha_registro', { ascending: false });

        if (data) {
            // Buscar última actividad de cada referido
            const enriched = await Promise.all(data.map(async (r) => {
                const { data: lastExpense } = await supabase
                    .from('gastos')
                    .select('created_at')
                    .eq('user_id', r.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                return { ...r, ultima_actividad: lastExpense?.created_at || null };
            }));
            setReferrals(enriched);
        }
        setLoading(false);
    };

    const copyLink = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getTimeSince = (dateString) => {
        if (!dateString) return 'Sin actividad';
        const diff = Date.now() - new Date(dateString).getTime();
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 1) return 'Hace < 1h';
        if (hrs < 24) return `Hace ${hrs}h`;
        return `Hace ${Math.floor(hrs / 24)}d`;
    };

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '---';

    const maskedEmail = (email) => {
        const [user, domain] = email.split('@');
        return `${user.slice(0, 2)}***@${domain}`;
    };

    const stats = {
        total: referrals.length,
        trials: referrals.filter(r => r.estado_suscripcion === 'trial').length,
        active: referrals.filter(r => r.estado_suscripcion === 'active').length,
        expired: referrals.filter(r => r.estado_suscripcion === 'expired').length,
    };

    const statusStyle = {
        trial: 'bg-blue-500/10 text-blue-400',
        active: 'bg-emerald-500/10 text-emerald-400',
        expired: 'bg-white/5 text-white/30',
        banned: 'bg-red-500/10 text-red-400',
    };

    return (
        <div className="min-h-screen bg-[#080808] text-white font-sans">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-violet-600 to-purple-500 p-2.5 rounded-2xl shadow-lg">
                            <TrendingUp className="text-white" size={22} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-white uppercase italic">FinanceAgent</h1>
                            <p className="text-[10px] text-violet-400 font-bold tracking-widest uppercase">Panel Gestor</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] text-white/30 font-bold hidden md:block">{profile?.email}</span>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 text-white/30 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                        >
                            <LogOut size={14} /> Salir
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

                {/* Referral Link */}
                <div className="bg-gradient-to-br from-violet-900/30 to-purple-900/10 border border-violet-500/20 rounded-[40px] p-8">
                    <div className="flex items-center gap-2 mb-2">
                        <LinkIcon size={14} className="text-violet-400" />
                        <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Tu Link de Referido</p>
                    </div>
                    <p className="text-xs text-white/40 mb-5">
                        Comparte este link. Cada usuario que se registre quedará vinculado a ti de por vida.
                    </p>
                    <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                        <span className="flex-1 text-sm text-white/70 font-mono truncate">{referralLink || '---'}</span>
                        <button
                            onClick={copyLink}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
                        >
                            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Referidos', value: stats.total, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        { label: 'En Trial', value: stats.trials, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { label: 'Activos (Pago)', value: stats.active, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Vencidos', value: stats.expired, icon: AlertCircle, color: 'text-white/30', bg: 'bg-white/5' },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="bg-[#111] border border-white/5 rounded-[28px] p-5">
                            <div className={`${bg} ${color} w-9 h-9 rounded-xl flex items-center justify-center mb-4`}>
                                <Icon size={18} />
                            </div>
                            <p className="text-3xl font-black text-white italic tracking-tighter">{value}</p>
                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabla de referidos */}
                <div className="bg-[#111] border border-white/5 rounded-[40px] overflow-hidden">
                    <div className="px-8 pt-8 pb-4 flex items-center gap-2">
                        <Users size={14} className="text-violet-400" />
                        <h2 className="text-xs font-black text-white/40 uppercase tracking-widest italic">Mis Referidos</h2>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                        </div>
                    ) : referrals.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-white/20 font-black uppercase tracking-widest text-sm">
                                Aún no tienes referidos
                            </p>
                            <p className="text-white/10 text-xs mt-2">Comparte tu link para empezar a crecer</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-black/40 text-white/20 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                                        <th className="px-8 py-4">Usuario</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4">Vence</th>
                                        <th className="px-6 py-4">Último uso</th>
                                        <th className="px-6 py-4">Registro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {referrals.map((r) => (
                                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-bold text-white">{maskedEmail(r.email)}</p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusStyle[r.estado_suscripcion] || 'bg-white/5 text-white/30'}`}>
                                                    {r.estado_suscripcion}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className={`text-xs font-bold ${r.estado_suscripcion === 'expired' ? 'text-red-400' : 'text-white/60'}`}>
                                                    {formatDate(r.fecha_vencimiento)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className={`text-[10px] font-black uppercase ${r.ultima_actividad ? 'text-violet-400' : 'text-white/20'}`}>
                                                    {getTimeSince(r.ultima_actividad)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] text-white/30 font-bold">{formatDate(r.fecha_registro)}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
