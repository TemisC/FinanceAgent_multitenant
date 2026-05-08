import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Shield, Search, Trash2, Crown, Activity, PieChart as PieIcon, UserPlus, ArrowUpDown, ChevronDown, ChevronUp, DollarSign, TrendingUp, Copy, Check, Link as LinkIcon, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const LANDING_URL = 'https://miwebsiteonline.com/controldefinanzas/landing';

export default function Admin() {
    const { user, profile, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('kpis');
    const [users, setUsers] = useState([]);
    const [influencers, setInfluencers] = useState([]);
    const [stats, setStats] = useState({ totalRevenue: 0, activeUsers: 0, trialUsers: 0, conversionRate: 0 });
    const [chartData, setChartData] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [sortBy, setSortBy] = useState('fecha_vencimiento');
    const [copiedCode, setCopiedCode] = useState(null);

    const fetchAdminData = async () => {
        setFetching(true);
        const { data: profiles } = await supabase.from('perfiles').select('*').order('fecha_registro', { ascending: false });

        if (profiles) {
            const usersWithActivity = await Promise.all(profiles.map(async (p) => {
                const { data: lastExpense } = await supabase
                    .from('gastos')
                    .select('created_at')
                    .eq('user_id', p.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                return { ...p, ultima_actividad: lastExpense?.created_at || null };
            }));
            setUsers(usersWithActivity);

            // Influencers + adminmaster con su link propio
            const influencerProfiles = usersWithActivity.filter(u =>
                u.rol === 'influencer' || u.rol === 'adminmaster'
            );
            const influencersWithStats = influencerProfiles.map((inf) => {
                const referrals = profiles.filter(u => u.referred_by === inf.referral_code);
                return {
                    ...inf,
                    total_referidos: referrals.length,
                    referidos_activos: referrals.filter(r => r.estado_suscripcion === 'active').length,
                    referidos_trial: referrals.filter(r => r.estado_suscripcion === 'trial').length,
                };
            });
            setInfluencers(influencersWithStats);

            const active = profiles.filter(u => u.estado_suscripcion === 'active').length;
            const trials = profiles.filter(u => u.estado_suscripcion === 'trial').length;
            const conversion = profiles.length > 0 ? ((active / profiles.length) * 100).toFixed(1) : 0;

            const { data: sales } = await supabase.from('ventas').select('monto');
            const revenue = sales?.reduce((acc, curr) => acc + parseFloat(curr.monto), 0) || 0;

            setStats({ totalRevenue: revenue, activeUsers: active, trialUsers: trials, conversionRate: conversion });

            const last15Days = [...Array(15)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const count = profiles.filter(u => u.fecha_registro && u.fecha_registro.startsWith(dateStr)).length;
                return { name: dateStr.split('-').slice(1).reverse().join('/'), count };
            }).reverse();
            setChartData(last15Days);
        }
        setFetching(false);
    };

    useEffect(() => {
        if (profile?.rol === 'adminmaster') {
            fetchAdminData();
        }
    }, [profile]);

    const updateStatus = async (userId, newStatus) => {
        const { error } = await supabase.from('perfiles').update({ estado_suscripcion: newStatus }).eq('id', userId);
        if (!error) fetchAdminData();
    };

    const toggleVip = async (userId, currentVip) => {
        const { error } = await supabase.from('perfiles').update({ es_vip: !currentVip }).eq('id', userId);
        if (!error) fetchAdminData();
    };

    const deleteUser = async (id) => {
        if (confirm('¿Eliminar definitivamente este usuario?')) {
            const { error } = await supabase.from('perfiles').delete().eq('id', id);
            if (!error) fetchAdminData();
        }
    };

    const toggleSort = (field) => {
        const order = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortOrder(order);
        setSortBy(field);
    };

    const toggleInfluencer = async (userId, currentRol) => {
        const newRol = currentRol === 'influencer' ? 'user' : 'influencer';
        const label = newRol === 'influencer' ? 'gestor' : 'usuario normal';
        if (!confirm(`¿Cambiar rol a ${label}?`)) return;
        const { error } = await supabase.from('perfiles').update({ rol: newRol }).eq('id', userId);
        if (!error) fetchAdminData();
    };

    const copyReferralLink = (code) => {
        navigator.clipboard.writeText(`${LANDING_URL}/?ref=${code}`);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getHoursSince = (dateString) => {
        if (!dateString) return 'Sin actividad';
        const last = new Date(dateString);
        const now = new Date();
        const diffMs = now - last;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs < 1) return 'Hace < 1h';
        if (diffHrs > 72) return `Hace ${Math.floor(diffHrs / 24)}d`;
        return `Hace ${diffHrs}h`;
    };

    if (loading) return null;
    if (profile?.rol !== 'adminmaster') return <Navigate to="/" replace />;

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const pieData = [
        { name: 'Trial', value: stats.trialUsers },
        { name: 'Activos', value: stats.activeUsers },
        { name: 'Expirados', value: users.filter(u => u.estado_suscripcion === 'expired').length },
        { name: 'Banned', value: users.filter(u => u.estado_suscripcion === 'banned').length },
    ];

    const sortedUsers = [...users].sort((a, b) => {
        if (sortBy === 'fecha_vencimiento') {
            const dateA = a.fecha_vencimiento ? new Date(a.fecha_vencimiento) : new Date(8640000000000000); // Max date if null
            const dateB = b.fecha_vencimiento ? new Date(b.fecha_vencimiento) : new Date(8640000000000000);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        return 0;
    });

    const filteredUsers = sortedUsers.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.telegram_chat_id && u.telegram_chat_id.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-[#080808] text-foreground font-sans">
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2.5 rounded-2xl shadow-lg">
                            <Shield className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">FinanceAgent</h1>
                            <p className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">Admin Master Console</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('kpis')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'kpis' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            Negocio (KPIs)
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            Usuarios
                        </button>
                        <button
                            onClick={() => setActiveTab('influencers')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'influencers' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            Gestores
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                {activeTab === 'kpis' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            <div className="bg-[#111] p-6 rounded-[32px] border border-white/5 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><DollarSign size={20} /></div>
                                    <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Revenue Est.</span>
                                </div>
                                <h3 className="text-4xl font-black text-white italic tracking-tighter">${stats.totalRevenue} <span className="text-xs text-white/30 not-italic uppercase">USD</span></h3>
                            </div>
                            <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Users size={20} /></div>
                                    <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Activos</span>
                                </div>
                                <h3 className="text-4xl font-black text-white italic tracking-tighter">{stats.activeUsers} <span className="text-xs text-white/30 not-italic font-bold">PAID</span></h3>
                            </div>
                            <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Activity size={20} /></div>
                                    <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest">Conversión</span>
                                </div>
                                <h3 className="text-4xl font-black text-white italic tracking-tighter">{stats.conversionRate}%</h3>
                            </div>
                            <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500"><UserPlus size={20} /></div>
                                    <span className="text-[10px] font-black text-purple-500/50 uppercase tracking-widest">Prospectos</span>
                                </div>
                                <h3 className="text-4xl font-black text-white italic tracking-tighter">{stats.trialUsers} <span className="text-xs text-white/30 not-italic uppercase font-bold">Trials</span></h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                            <div className="lg:col-span-8 bg-[#111] p-8 rounded-[40px] border border-white/5">
                                <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-8 flex items-center gap-2 italic">
                                    <TrendingUp size={14} className="text-amber-500" /> Crecimiento de Usuarios
                                </h3>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10 }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '16px', border: '1px solid #222' }} />
                                            <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="lg:col-span-4 bg-[#111] p-8 rounded-[40px] border border-white/5">
                                <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-8 flex items-center gap-2 italic">
                                    <PieIcon size={14} className="text-blue-500" /> Distribución
                                </h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                                                {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '16px', border: 'none' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-6">
                                    {pieData.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-black/20 p-2 rounded-xl">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                                            <span className="text-[9px] font-black text-white/60 uppercase">{d.name}: {d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                            <div className="flex items-center gap-3">
                                <Shield className="text-amber-500" size={32} />
                                <h2 className="text-3xl font-black text-white uppercase italic tracking-widest">Base de Inquilinos</h2>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por email o TG ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#111] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="bg-[#111] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl relative">
                            {fetching && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/50 text-white/30 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                                            <th className="p-6">Información Inquilino</th>
                                            <th className="p-6">Estado</th>
                                            <th
                                                className="p-6 cursor-pointer hover:text-white transition-colors group"
                                                onClick={() => toggleSort('fecha_vencimiento')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Vencimiento
                                                    {sortBy === 'fecha_vencimiento' ? (
                                                        sortOrder === 'asc' ? <ChevronUp size={12} className="text-amber-500" /> : <ChevronDown size={12} className="text-amber-500" />
                                                    ) : <ArrowUpDown size={12} className="opacity-30 group-hover:opacity-100" />}
                                                </div>
                                            </th>
                                            <th className="p-6">Actividad</th>
                                            <th className="p-6 text-center">Roles</th>
                                            <th className="p-6 text-right">Control de Acceso</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr><td colSpan="6" className="p-20 text-center text-white/20 uppercase font-black tracking-widest">No se encontraron inquilinos</td></tr>
                                        ) : filteredUsers.map(u => (
                                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <p className="text-sm font-bold text-white mb-1">{u.email}</p>
                                                    <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest">{u.telegram_chat_id || 'Sin vincular'}</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.estado_suscripcion === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                                                        u.estado_suscripcion === 'trial' ? 'bg-blue-500/10 text-blue-500' :
                                                            u.estado_suscripcion === 'banned' ? 'bg-red-500/10 text-red-500' : 'bg-white/10 text-white/40'
                                                        }`}>
                                                        {u.estado_suscripcion}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    <p className={`text-xs font-bold ${u.estado_suscripcion === 'expired' ? 'text-red-500' : 'text-white/80'}`}>
                                                        {u.fecha_vencimiento ? new Date(u.fecha_vencimiento).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                                                    </p>
                                                </td>
                                                <td className="p-6">
                                                    <p className={`text-[10px] font-black uppercase ${!u.ultima_actividad ? 'text-white/20' : 'text-amber-500'}`}>
                                                        {getHoursSince(u.ultima_actividad)}
                                                    </p>
                                                </td>
                                                <td className="p-6 text-center">
                                                    {u.rol !== 'adminmaster' && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => toggleVip(u.id, u.es_vip)}
                                                                className={`p-2 rounded-xl transition-all ${u.es_vip ? 'bg-amber-500/20 text-amber-500 scale-110 shadow-lg shadow-amber-500/10' : 'text-white/10 hover:text-white/30'}`}
                                                                title="VIP"
                                                            >
                                                                <Crown size={18} fill={u.es_vip ? "currentColor" : "none"} />
                                                            </button>
                                                            <button
                                                                onClick={() => toggleInfluencer(u.id, u.rol)}
                                                                className={`p-2 rounded-xl transition-all ${u.rol === 'influencer' ? 'bg-violet-500/20 text-violet-400 scale-110 shadow-lg shadow-violet-500/10' : 'text-white/10 hover:text-violet-400'}`}
                                                                title="Gestor"
                                                            >
                                                                <Star size={18} fill={u.rol === 'influencer' ? "currentColor" : "none"} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-6 text-right space-x-4">
                                                    {u.rol !== 'adminmaster' && (
                                                        <div className="inline-flex items-center gap-4">
                                                            <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5 group-hover:border-white/20 transition-all">
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 ${u.estado_suscripcion === 'banned' ? 'text-red-500' : 'text-white/20'}`}>Bloquear</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const isActive = u.estado_suscripcion === 'active' || u.estado_suscripcion === 'trial';
                                                                        updateStatus(u.id, isActive ? 'banned' : 'active');
                                                                    }}
                                                                    className={`relative w-10 h-5 rounded-full transition-all duration-300 ${u.estado_suscripcion === 'banned' ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}
                                                                >
                                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${u.estado_suscripcion === 'banned' ? 'left-0.5 bg-red-500' : 'right-0.5 bg-emerald-500'}`} />
                                                                </button>
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 ${u.estado_suscripcion !== 'banned' ? 'text-emerald-500' : 'text-white/20'}`}>Acceso OK</span>
                                                            </div>
                                                            <button onClick={() => deleteUser(u.id)} className="text-white/10 hover:text-red-500 transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'influencers' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

                        {/* Link propio del adminmaster */}
                        {profile?.referral_code && (
                            <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/10 border border-amber-500/20 rounded-[40px] p-8">
                                <div className="flex items-center gap-2 mb-1">
                                    <LinkIcon size={13} className="text-amber-400" />
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Tu Link Personal (Admin Master)</p>
                                </div>
                                <p className="text-xs text-white/30 mb-4">Los usuarios que se registren con este link quedan vinculados a ti directamente.</p>
                                <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                                    <span className="flex-1 text-sm text-white/60 font-mono truncate">
                                        {`${LANDING_URL}/?ref=${profile.referral_code}`}
                                    </span>
                                    <button
                                        onClick={() => copyReferralLink(profile.referral_code)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copiedCode === profile.referral_code ? 'bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
                                    >
                                        {copiedCode === profile.referral_code ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tabla de influencers */}
                        <div className="bg-[#111] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative">
                            {fetching && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
                                </div>
                            )}
                            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Star size={14} className="text-violet-400" />
                                    <h2 className="text-xs font-black text-white/40 uppercase tracking-widest italic">Red de Gestores</h2>
                                </div>
                                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                                    Para promover un usuario, ve a la pestaña Usuarios
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/50 text-white/30 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                                            <th className="p-6">Gestor</th>
                                            <th className="p-6">Rol</th>
                                            <th className="p-6 text-center">Referidos</th>
                                            <th className="p-6 text-center">Activos</th>
                                            <th className="p-6 text-center">Trial</th>
                                            <th className="p-6">Link de Referido</th>
                                            <th className="p-6 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {influencers.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="p-20 text-center text-white/20 uppercase font-black tracking-widest">
                                                    No hay gestores aún
                                                </td>
                                            </tr>
                                        ) : influencers.map((inf) => (
                                            <tr key={inf.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <p className="text-sm font-bold text-white">{inf.email}</p>
                                                    <p className="text-[10px] text-white/30 mt-0.5">Código: {inf.referral_code}</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${inf.rol === 'adminmaster' ? 'bg-amber-500/10 text-amber-400' : 'bg-violet-500/10 text-violet-400'}`}>
                                                        {inf.rol === 'adminmaster' ? 'Admin Master' : 'Gestor'}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="text-2xl font-black text-white">{inf.total_referidos}</span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="text-lg font-black text-emerald-400">{inf.referidos_activos}</span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="text-lg font-black text-blue-400">{inf.referidos_trial}</span>
                                                </td>
                                                <td className="p-6">
                                                    <button
                                                        onClick={() => copyReferralLink(inf.referral_code)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${copiedCode === inf.referral_code ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30 hover:bg-violet-500/10 hover:text-violet-400'}`}
                                                    >
                                                        {copiedCode === inf.referral_code ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar Link</>}
                                                    </button>
                                                </td>
                                                <td className="p-6 text-center">
                                                    {inf.rol !== 'adminmaster' && (
                                                        <button
                                                            onClick={() => toggleInfluencer(inf.id, inf.rol)}
                                                            className="text-[9px] font-black uppercase tracking-widest text-red-400/50 hover:text-red-400 transition-colors px-3 py-1.5 rounded-xl hover:bg-red-500/10"
                                                        >
                                                            Quitar Rol
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Instrucción para promover */}
                        <div className="bg-[#111] border border-violet-500/10 rounded-[32px] p-6 flex items-start gap-4">
                            <div className="bg-violet-500/10 p-3 rounded-2xl text-violet-400 shrink-0">
                                <Star size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-1">¿Cómo agregar un gestor?</p>
                                <p className="text-xs text-white/30 leading-relaxed">
                                    Ve a la pestaña <span className="text-amber-400 font-black">Usuarios</span>, busca al usuario y activa el ícono <span className="text-violet-400 font-black">★ Gestor</span> en su fila. El usuario quedará promovido y su link de referido se activará automáticamente.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
