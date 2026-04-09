import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Zap, AlertCircle, History, Filter, Wallet, LayoutDashboard
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import ExpenseList from '../components/ExpenseList';
import ExpenseForm from '../components/ExpenseForm';
import CurrencySelector from '../components/CurrencySelector';
import { useNavigate, Link } from 'react-router-dom';

const COLORS = [
    '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
    '#f97316', '#8b5cf6', '#14b8a6', '#f43f5e', '#eab308'
];
const categories = [
    'Transporte', 'Alimentación', 'Vivienda', 'Salud', 'Entretenimiento',
    'Suscripciones', 'Personal', 'Educación', 'Varios', 'Impuestos y Servicios',
    'Ahorro e Inversión', 'Mascotas', 'Regalos', 'Ropa y Calzado'
];

export default function Dashboard() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const currency = profile?.moneda || 'USD';

    // Helper para formatear dinero según la moneda seleccionada
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: currency,
            currencyDisplay: 'symbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [stats, setStats] = useState({
        total: 0, today: 0, count: 0, avgDaily: 0, topCategory: '', highestDay: { amount: 0, date: '' }
    });
    const [editingExpense, setEditingExpense] = useState(null);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('gastos')
                .select('*')
                .eq('user_id', user.id) // FILTRO VISUAL: El admin solo ve lo suyo en el Dashboard personal
                .order('fecha_gasto', { ascending: false });

            if (error) throw error;
            const allExpenses = data || [];
            setExpenses(allExpenses);

            const total = allExpenses.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
            const uniqueDays = new Set(allExpenses.map(e => e.fecha_gasto)).size || 1;
            const avgDaily = total / uniqueDays;

            const dailyTotals = allExpenses.reduce((acc, curr) => {
                acc[curr.fecha_gasto] = (acc[curr.fecha_gasto] || 0) + parseFloat(curr.monto);
                return acc;
            }, {});

            let highestDay = { amount: 0, date: 'N/A' };
            Object.entries(dailyTotals).forEach(([date, amount]) => {
                if (amount > highestDay.amount) highestDay = { amount, date };
            });

            const catTotals = allExpenses.reduce((acc, curr) => {
                acc[curr.categoria] = (acc[curr.categoria] || 0) + parseFloat(curr.monto);
                return acc;
            }, {});
            const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

            setStats({ total, today: 0, count: allExpenses.length, avgDaily, topCategory: topCat, highestDay });
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('gastos').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    useEffect(() => {
        if (user && profile) {
            if (profile.rol === 'adminmaster' && window.location.pathname === '/') {
                navigate('/admin');
            } else if (profile.estado_suscripcion !== 'banned') {
                fetchData();
            }
        }
    }, [user, profile, navigate]);

    const monthlyHistoryData = useMemo(() => {
        return Object.entries(
            expenses.reduce((acc, curr) => {
                const month = String(curr.fecha_gasto).substring(0, 7);
                acc[month] = (acc[month] || 0) + parseFloat(curr.monto);
                return acc;
            }, {})
        ).map(([name, value]) => ({ name, value })).reverse().slice(0, 6);
    }, [expenses]);

    const dailyTimelineData = useMemo(() => {
        const days = eachDayOfInterval({
            start: startOfMonth(new Date()),
            end: endOfMonth(new Date())
        });

        return days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTotal = expenses
                .filter(e => e.fecha_gasto === dateStr && (selectedCategory === 'Todas' || e.categoria === selectedCategory))
                .reduce((acc, curr) => acc + parseFloat(curr.monto), 0);

            return { date: format(day, 'dd/MM'), monto: dayTotal };
        });
    }, [expenses, selectedCategory]);

    const categoryData = Object.entries(
        expenses.reduce((acc, curr) => {
            acc[curr.categoria] = (acc[curr.categoria] || 0) + parseFloat(curr.monto);
            return acc;
        }, {})
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    if (profile?.estado_suscripcion === 'banned' || profile?.estado_suscripcion === 'expired') {
        return (
            <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 font-sans text-center">
                <div className="bg-[#111] border border-red-500/30 p-12 rounded-[48px] shadow-2xl relative z-10 max-w-md">
                    <AlertCircle className="text-red-500 mx-auto mb-6" size={48} />
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-widest mb-4">Suscripción Inactiva</h2>
                    <p className="text-muted-foreground mb-8">Tu cuenta está actualmente suspendida o expirada. Por favor, renueva tu suscripción para continuar usando FinanceAgent.</p>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-500 border border-red-500/20 font-black py-4 px-8 rounded-2xl w-full hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-sm">Cerrar Sesión</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080808] text-foreground font-sans selection:bg-primary/40 selection:text-white">
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
            </div>

            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-primary to-blue-600 p-2.5 rounded-2xl shadow-lg shadow-primary/20">
                            <Wallet className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">FinanceAgent</h1>
                            <p className="text-[10px] text-primary/80 font-bold tracking-[0.2em] uppercase">V. 4.0 SaaS</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <CurrencySelector />
                        {profile?.rol === 'adminmaster' && (
                            <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black text-amber-500 border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500 hover:text-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all">
                                <LayoutDashboard size={14} /> Admin
                            </Link>
                        )}
                        <button
                            onClick={handleLogout}
                            className="text-[10px] font-black text-muted-foreground hover:text-white uppercase tracking-widest border border-white/10 px-4 py-2 rounded-xl transition-all"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
                    <div>
                        <h2 className="text-5xl font-black text-white tracking-tighter mb-3 leading-none italic uppercase">
                            Finanzas <span className="text-primary underline decoration-primary/30 underline-offset-8">Inteligentes</span>
                        </h2>
                        <p className="text-muted-foreground text-lg font-medium max-w-xl italic">
                            Visión total de tus finanzas en tiempo real.
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-white/40 font-black uppercase tracking-widest mb-1">Usuario Activo</p>
                        <p className="text-sm text-white font-bold">{user?.email}</p>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard title="Capital Saliente" value={formatMoney(stats.total)} icon={TrendingUp} color="primary" />
                    <StatCard title="Gasto Medio" value={formatMoney(stats.avgDaily)} icon={Zap} color="blue-500" />
                    <StatCard title="Máximo Día" value={formatMoney(stats.highestDay.amount)} icon={AlertCircle} color="amber-500" />
                    <StatCard title="Movimientos" value={stats.count} icon={History} color="emerald-500" />
                </div>

                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">

                    <div className="lg:col-span-8 space-y-8 w-full">
                        <div className="bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-2 bg-primary rounded-full" />
                                    <h3 className="font-black text-xl text-white tracking-tight uppercase">Análisis de Picos Diarios</h3>
                                </div>
                                <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/5">
                                    <Filter size={14} className="text-primary ml-2" />
                                    <select
                                        className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer pr-4"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        <option value="Todas">Categoría: Todas</option>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyTimelineData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.01)" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 9 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 9 }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #111', borderRadius: '16px' }} />
                                        <Bar dataKey="monto" fill="url(#picoGrad)" radius={[4, 4, 0, 0]} />
                                        <defs>
                                            <linearGradient id="picoGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#a855f7" />
                                                <stop offset="100%" stopColor="#3b82f6" />
                                            </linearGradient>
                                        </defs>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-1 h-8 bg-blue-600 rounded-full" />
                                <h3 className="font-black text-xl text-white tracking-widest uppercase italic">Evolución Mensual</h3>
                            </div>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyHistoryData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" opacity={0.2} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px' }} />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl">
                            <div>
                                <h3 className="font-black text-xl text-white tracking-tight uppercase mb-8 italic">Distribución de Capital</h3>
                                <div className="space-y-5">
                                    {categoryData.slice(0, 5).map((cat) => (
                                        <div key={cat.name} className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                                <span className="text-white/40">{cat.name}</span>
                                                <span className="text-primary">{formatMoney(cat.value)}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${(cat.value / stats.total) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                                            {categoryData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 w-full h-full">
                        <div className="bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl flex flex-col min-h-[850px] lg:h-[calc(100vh-180px)] lg:sticky lg:top-32">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-black text-xs text-white uppercase tracking-[0.3em] italic">Historial de Gastos</h3>
                                <div className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black rounded uppercase">En Vivo</div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <ExpenseList expenses={expenses} loading={loading} onDelete={handleDelete} onEdit={setEditingExpense} />
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            <style>{`
        body { margin: 0; background: #080808; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a855f7; }
        select option { background: #111; color: #fff; }
      `}</style>

            <ExpenseForm onAdd={fetchData} onUpdate={() => { fetchData(); setEditingExpense(null); }} editingExpense={editingExpense} onCancelEdit={() => setEditingExpense(null)} />
        </div>
    );
}
