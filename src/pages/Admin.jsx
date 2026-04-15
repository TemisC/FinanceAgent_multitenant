import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Shield, Search, Trash2, CheckCircle, TrendingUp, DollarSign, Activity, PieChart as PieIcon, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Admin() {
    const { user, profile, loading } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ totalRevenue: 0, activeUsers: 0, trialUsers: 0, conversionRate: 0 });
    const [chartData, setChartData] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAdminData = async () => {
        setFetching(true);
        const { data: profiles } = await supabase.from('perfiles').select('*');

        if (profiles) {
            setUsers(profiles);

            const active = profiles.filter(u => u.estado_suscripcion === 'active').length;
            const trials = profiles.filter(u => u.estado_suscripcion === 'trial').length;
            const conversion = profiles.length > 0 ? ((active / profiles.length) * 100).toFixed(1) : 0;

            const { data: sales } = await supabase.from('ventas').select('monto');
            const revenue = sales?.reduce((acc, curr) => acc + parseFloat(curr.monto), 0) || (active * 5);

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

    const deleteUser = async (id) => {
        if (confirm('¿Eliminar definitivamente este usuario?')) {
            const { error } = await supabase.from('perfiles').delete().eq('id', id);
            if (!error) fetchAdminData();
        }
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

    const filteredUsers = users.filter(u =>
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
                            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">SaaS Insights</h1>
                            <p className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">Admin Master Panel</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><DollarSign size={20} /></div>
                            <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Revenue Est.</span>
                        </div>
                        <h3 className="text-3xl font-black text-white italic">${stats.totalRevenue} <span className="text-xs text-white/30 not-italic">USD</span></h3>
                    </div>
                    <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Users size={20} /></div>
                            <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Suscripciones</span>
                        </div>
                        <h3 className="text-3xl font-black text-white italic">{stats.activeUsers} <span className="text-xs text-white/30 not-italic">Activas</span></h3>
                    </div>
                    <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Activity size={20} /></div>
                            <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest">Conversión</span>
                        </div>
                        <h3 className="text-3xl font-black text-white italic">{stats.conversionRate}%</h3>
                    </div>
                    <div className="bg-[#111] p-6 rounded-[32px] border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500"><UserPlus size={20} /></div>
                            <span className="text-[10px] font-black text-purple-500/50 uppercase tracking-widest">Prospectos</span>
                        </div>
                        <h3 className="text-3xl font-black text-white italic">{stats.trialUsers} <span className="text-xs text-white/30 not-italic">en Trial</span></h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                    <div className="lg:col-span-8 bg-[#111] p-8 rounded-[40px] border border-white/5">
                        <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <TrendingUp size={14} className="text-amber-500" /> Crecimiento de Usuarios
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '16px', border: '1px solid #222' }} />
                                    <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="lg:col-span-4 bg-[#111] p-8 rounded-[40px] border border-white/5">
                        <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <PieIcon size={14} className="text-blue-500" /> Estado del SaaS
                        </h3>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            {pieData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                                    <span className="text-[10px] font-bold text-white/50 uppercase">{d.name}: {d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-black text-white uppercase italic tracking-widest">Inquilinos</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar inquilino..."
                                className="bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <th className="p-6">Email / Chat ID</th>
                                    <th className="p-6">Estado</th>
                                    <th className="p-6">Vencimiento</th>
                                    <th className="p-6 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-6">
                                            <p className="text-sm font-bold text-white">{u.email}</p>
                                            <p className="text-[10px] text-blue-500 mt-1 uppercase font-black">{u.telegram_chat_id || 'N/A'}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.estado_suscripcion === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    u.estado_suscripcion === 'trial' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {u.estado_suscripcion}
                                            </span>
                                        </td>
                                        <td className="p-6 text-sm font-medium text-white/60">
                                            {u.fecha_vencimiento ? new Date(u.fecha_vencimiento).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-6 text-right">
                                            <button onClick={() => deleteUser(u.id)} className="p-2 text-white/10 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
