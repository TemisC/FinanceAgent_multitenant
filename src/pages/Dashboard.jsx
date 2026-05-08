import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Zap, AlertCircle, History, Filter, Wallet, LayoutDashboard, X, Printer,
    Gift, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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

    const [allExpenses, setAllExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [useSmartScale, setUseSmartScale] = useState(true);
    const [dateFilter, setDateFilter] = useState('mes');
    const [editingExpense, setEditingExpense] = useState(null);
    const [selectedDayDetails, setSelectedDayDetails] = useState(null);
    const [referralOpen, setReferralOpen] = useState(false);
    const [referralCopied, setReferralCopied] = useState(false);
    const [telegramCopied, setTelegramCopied] = useState(false);
    const [referralCount, setReferralCount] = useState(0);

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
            const dataExpenses = data || [];
            setAllExpenses(dataExpenses);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const { start: startDate, end: endDate } = useMemo(() => {
        const today = new Date();
        if (dateFilter === 'mes') {
            return { start: startOfMonth(today), end: endOfMonth(today) };
        } else if (dateFilter === 'mespasado') {
            return { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) };
        } else if (dateFilter === '3meses') {
            return { start: startOfMonth(subMonths(today, 2)), end: endOfMonth(today) };
        } else if (dateFilter === '6meses') {
            return { start: startOfMonth(subMonths(today, 5)), end: endOfMonth(today) };
        }
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }, [dateFilter]);

    const expenses = useMemo(() => {
        return allExpenses.filter(e => {
            if (!startDate || !endDate) return true;
            const startStr = format(startDate, 'yyyy-MM-dd');
            const endStr = format(endDate, 'yyyy-MM-dd');
            return e.fecha_gasto >= startStr && e.fecha_gasto <= endStr;
        });
    }, [allExpenses, startDate, endDate]);

    const stats = useMemo(() => {
        const total = expenses.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
        const uniqueDays = new Set(expenses.map(e => e.fecha_gasto)).size || 1;
        const avgDaily = total / uniqueDays;

        const dailyTotals = expenses.reduce((acc, curr) => {
            acc[curr.fecha_gasto] = (acc[curr.fecha_gasto] || 0) + parseFloat(curr.monto);
            return acc;
        }, {});

        let highestDay = { amount: 0, date: 'N/A' };
        Object.entries(dailyTotals).forEach(([date, amount]) => {
            if (amount > highestDay.amount) highestDay = { amount, date };
        });

        const catTotals = expenses.reduce((acc, curr) => {
            acc[curr.categoria] = (acc[curr.categoria] || 0) + parseFloat(curr.monto);
            return acc;
        }, {});
        const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        return { total, today: 0, count: expenses.length, avgDaily, topCategory: topCat, highestDay };
    }, [expenses]);

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

    useEffect(() => {
        if (profile?.referral_code && profile?.rol === 'user') {
            supabase
                .from('perfiles')
                .select('id', { count: 'exact', head: true })
                .eq('referred_by', profile.referral_code)
                .then(({ count }) => setReferralCount(count || 0));
        }
    }, [profile?.referral_code]);

    useEffect(() => {
        if (selectedDayDetails) {
            const hasExpenses = expenses.some(e =>
                e.fecha_gasto === selectedDayDetails.fullDate &&
                (selectedCategory === 'Todas' || e.categoria === selectedCategory)
            );
            if (!hasExpenses) setSelectedDayDetails(null);
        }
    }, [expenses, selectedCategory, selectedDayDetails]);

    const monthlyHistoryData = useMemo(() => {
        return Object.entries(
            expenses.reduce((acc, curr) => {
                const month = String(curr.fecha_gasto).substring(0, 7);
                acc[month] = (acc[month] || 0) + parseFloat(curr.monto);
                return acc;
            }, {})
        ).map(([name, value]) => ({ name, value })).reverse().slice(0, 6);
    }, [expenses]);

    const { chartData: dailyTimelineData, yAxisMax, trueMax, calculatedDomain, customTicks } = useMemo(() => {
        const days = eachDayOfInterval({
            start: startDate,
            end: endDate
        });

        const data = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTotal = expenses
                .filter(e => e.fecha_gasto === dateStr && (selectedCategory === 'Todas' || e.categoria === selectedCategory))
                .reduce((acc, curr) => acc + parseFloat(curr.monto), 0);

            return { date: format(day, 'dd/MM'), monto: dayTotal, fullDate: dateStr };
        });

        const values = data.map(d => d.monto).filter(v => v > 0).sort((a, b) => b - a);
        let max = 'auto';
        let currentTrueMax = values.length > 0 ? values[0] : 0;

        if (useSmartScale && values.length >= 2) {
            const highest = values[0];
            const secondHighest = values[1];
            
            if (highest > secondHighest * 3 && secondHighest > 0) {
                max = Math.max(secondHighest * 1.2, (values[2] || secondHighest) * 1.5);
            }
        }

        const processedData = data.map(d => ({
            ...d,
            displayMonto: max === 'auto' ? d.monto : Math.min(d.monto, max),
            isOutlier: max !== 'auto' && d.monto > max
        }));

        let calcDomain = ['auto', 'auto'];
        let ticks = undefined;

        if (max !== 'auto') {
            const topDomain = Math.ceil(max * 1.15);
            calcDomain = [0, topDomain];
            
            const step = Math.ceil((max / 3) / 100) * 100;
            ticks = [0, step, step * 2, step * 3, topDomain];
        }

        return { chartData: processedData, yAxisMax: max, trueMax: currentTrueMax, calculatedDomain: calcDomain, customTicks: ticks };
    }, [expenses, selectedCategory, startDate, endDate, useSmartScale]);

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

    if (profile?.estado_suscripcion === 'banned') {
        return (
            <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 font-sans text-center">
                <div className="bg-[#111] border border-red-500/30 p-12 rounded-[48px] shadow-2xl relative z-10 max-w-md">
                    <AlertCircle className="text-red-500 mx-auto mb-6" size={48} />
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-widest mb-4">Cuenta Suspendida</h2>
                    <p className="text-muted-foreground mb-8">Tu acceso ha sido revocado por el administrador. Contacta con soporte si crees que esto es un error.</p>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-500 border border-red-500/20 font-black py-4 px-8 rounded-2xl w-full hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-sm">Cerrar Sesión</button>
                </div>
            </div>
        );
    }

    if (profile?.estado_suscripcion === 'expired') {
        return (
            <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 font-sans text-center">
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
                </div>
                <div className="bg-[#111] border border-primary/20 p-12 rounded-[48px] shadow-2xl relative z-10 max-w-md">
                    <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <History className="text-primary" size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">¡Tus datos están a salvo!</h2>
                    <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
                        Tu suscripción ha expirado, pero no te preocupes: seguimos guardando todos tus gastos vía Telegram. <br /><br />
                        <span className="text-white">Activa tu Dashboard</span> para desbloquear tus gráficas y análisis detallados.
                    </p>
                    <a
                        href="https://despegando.gumroad.com/l/financeagent"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-white font-black py-5 px-8 rounded-2xl w-full block hover:scale-105 transition-all uppercase tracking-widest text-sm mb-6 shadow-lg shadow-primary/20"
                    >
                        Renovar Acceso Ahora
                    </a>
                    <button onClick={handleLogout} className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-[0.2em] transition-all">Cerrar Sesión / Switch Account</button>
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
                        <select
                            className="bg-black/40 text-white font-bold text-sm outline-none cursor-pointer p-2 rounded-xl border border-white/5 print:hidden"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        >
                            <option value="mes">Este Mes</option>
                            <option value="mespasado">El Mes Pasado</option>
                            <option value="3meses">Últimos 3 Meses</option>
                            <option value="6meses">Últimos 6 Meses</option>
                        </select>
                        <button onClick={() => window.print()} className="print:hidden bg-primary/20 hover:bg-primary text-primary hover:text-white px-3 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
                            <Printer size={16} /> PDF
                        </button>
                        <CurrencySelector />
                        {profile?.rol === 'adminmaster' && (
                            <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black text-amber-500 border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500 hover:text-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all print:hidden">
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 break-inside-avoid">
                    <StatCard title="Capital Saliente" value={formatMoney(stats.total)} icon={TrendingUp} color="primary" />
                    <StatCard title="Gasto Medio" value={formatMoney(stats.avgDaily)} icon={Zap} color="blue-500" />
                    <StatCard title="Máximo Día" value={formatMoney(stats.highestDay.amount)} icon={AlertCircle} color="amber-500" />
                    <StatCard title="Movimientos" value={stats.count} icon={History} color="emerald-500" />
                </div>

                {profile?.rol === 'user' && profile?.referral_code && (() => {
                    const isInactive = profile.estado_suscripcion === 'expired' || profile.estado_suscripcion === 'banned';
                    const isActive = profile.estado_suscripcion === 'active' || profile.estado_suscripcion === 'trial';

                    // Banner de advertencia: expirado/baneado con referidos activos
                    if (isInactive && referralCount > 0) return (
                        <div className="mb-8 print:hidden">
                            <div className="bg-orange-950/30 border border-orange-500/30 rounded-[28px] px-6 py-5 flex items-center gap-4">
                                <div className="shrink-0 bg-orange-500/20 p-3 rounded-2xl text-orange-400">
                                    <Gift size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-orange-300 uppercase tracking-widest mb-1">
                                        Estás perdiendo comisiones
                                    </p>
                                    <p className="text-xs text-orange-200/60 leading-relaxed">
                                        Tenés <span className="text-orange-300 font-black">{referralCount} referido{referralCount !== 1 ? 's' : ''}</span> vinculado{referralCount !== 1 ? 's' : ''} a tu cuenta. Mientras tu suscripción esté inactiva, esas comisiones van al dueño de la app.{' '}
                                        <span className="text-orange-300 font-black">Ponete al día para volver a recibirlas.</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    );

                    // Banner de promo: activo o trial
                    if (isActive) return (
                        <div className="mb-8 print:hidden">
                            <div className={`border rounded-[28px] transition-all duration-300 overflow-hidden ${referralOpen ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
                                <button
                                    onClick={() => setReferralOpen(!referralOpen)}
                                    className="w-full flex items-center justify-between px-6 py-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${referralOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                                            <Gift size={16} />
                                        </div>
                                        <p className="text-xs font-black text-white/50 uppercase tracking-widest">
                                            ¿Te gusta FinanceAgent? <span className="text-white/30 font-bold normal-case tracking-normal">Refiere amigos y gana dinero cada mes.</span>
                                        </p>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${referralOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20 hover:text-white/50'}`}>
                                        {referralOpen ? <><ChevronUp size={12} /> Ocultar</> : <><ChevronDown size={12} /> Activar mi link</>}
                                    </div>
                                </button>
                                {referralOpen && (
                                    <div className="px-6 pb-6 space-y-5">
                                        <div className="h-px bg-emerald-500/10" />
                                        <div className="bg-emerald-950/40 border border-emerald-500/10 rounded-2xl p-4">
                                            <p className="text-xs text-emerald-300/70 leading-relaxed">
                                                Comparte tu link. Si tu amigo activa su membresía, <span className="text-emerald-300 font-black">vos ganás una comisión mensual</span> mientras siga activo.
                                                Él obtiene <span className="text-emerald-300 font-black">1 mes gratis</span> para probar la app.
                                            </p>
                                        </div>

                                        {/* Opción 1 — Landing page */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">Para redes sociales</span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-3">
                                                <span className="flex-1 text-xs text-white/50 font-mono truncate">
                                                    {`https://miwebsiteonline.com/controldefinanzas/landing/?ref=${profile.referral_code}`}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`https://miwebsiteonline.com/controldefinanzas/landing/?ref=${profile.referral_code}`);
                                                        setReferralCopied(true);
                                                        setTimeout(() => setReferralCopied(false), 2000);
                                                    }}
                                                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${referralCopied ? 'bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                                >
                                                    {referralCopied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/20 leading-relaxed px-1">
                                                Lleva a una página con info de la app + botón para ir al bot. Ideal para postear en Instagram, TikTok o grupos donde el prospecto aún no te conoce.
                                            </p>
                                        </div>

                                        {/* Opción 2 — Bot directo */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">Para prospecto listo</span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-3">
                                                <span className="flex-1 text-xs text-white/50 font-mono truncate">
                                                    {`https://t.me/FinanceAgente_bot?start=${profile.referral_code}`}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`https://t.me/FinanceAgente_bot?start=${profile.referral_code}`);
                                                        setTelegramCopied(true);
                                                        setTimeout(() => setTelegramCopied(false), 2000);
                                                    }}
                                                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${telegramCopied ? 'bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                                >
                                                    {telegramCopied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/20 leading-relaxed px-1">
                                                Va directo al bot de Telegram. Usalo cuando ya convenciste al prospecto en persona o por chat y solo necesita el acceso rápido.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );

                    return null;
                })()}

                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">

                    <div className="lg:col-span-8 space-y-8 w-full">
                        <div className="bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden break-inside-avoid">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-2 bg-primary rounded-full" />
                                    <h3 className="font-black text-xl text-white tracking-tight uppercase">Análisis de Picos Diarios</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white/70 print:hidden">
                                        <input type="checkbox" checked={useSmartScale} onChange={(e) => setUseSmartScale(e.target.checked)} className="accent-primary" />
                                        Smart Scale
                                    </label>
                                    <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/5 print:hidden">
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
                            </div>
                            <div className="h-[300px] relative">
                                {selectedDayDetails ? (
                                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-3xl flex flex-col p-2">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <div>
                                                <h4 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                                    Resumen: <span className="text-primary">{selectedDayDetails.date}</span>
                                                </h4>
                                                <p className="text-[10px] text-muted-foreground font-bold">
                                                    Total del día: {formatMoney(
                                                        expenses
                                                            .filter(e => e.fecha_gasto === selectedDayDetails.fullDate && (selectedCategory === 'Todas' || e.categoria === selectedCategory))
                                                            .reduce((acc, curr) => acc + parseFloat(curr.monto), 0)
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedDayDetails(null)}
                                                className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                            <ExpenseList
                                                expenses={expenses.filter(e => e.fecha_gasto === selectedDayDetails.fullDate && (selectedCategory === 'Todas' || e.categoria === selectedCategory))}
                                                loading={false}
                                                onDelete={handleDelete}
                                                onEdit={setEditingExpense}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyTimelineData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.01)" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 9 }} />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#444', fontSize: 9 }} 
                                                domain={calculatedDomain} 
                                                ticks={customTicks}
                                                tickFormatter={(value) => {
                                                    if (customTicks && value === customTicks[customTicks.length - 1]) {
                                                        return trueMax > 1000 ? (trueMax / 1000).toFixed(1) + 'k' : trueMax;
                                                    }
                                                    return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
                                                }}
                                            />
                                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#000', border: '1px solid #111', borderRadius: '16px' }} formatter={(value, name, props) => [formatMoney(props.payload.monto), 'Monto real']} />
                                            <Bar
                                                dataKey="displayMonto"
                                                fill="url(#picoGrad)"
                                                radius={[4, 4, 0, 0]}
                                                style={{ cursor: 'pointer' }}
                                                onClick={(data) => {
                                                    if (data && data.monto > 0) {
                                                        setSelectedDayDetails({
                                                            date: data.date,
                                                            fullDate: data.fullDate,
                                                            total: data.monto
                                                        });
                                                    }
                                                }}
                                                label={(props) => {
                                                    const { x, y, width, index } = props;
                                                    const entry = dailyTimelineData[index];
                                                    if (!entry || !entry.isOutlier) return null;
                                                    return (
                                                        <g>
                                                            <rect x={x + width / 2 - 4} y={y - 8} width="8" height="8" rx="4" fill="#ef4444" opacity="0.8" />
                                                        </g>
                                                    );
                                                }}
                                            >
                                                {
                                                    dailyTimelineData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.isOutlier ? 'url(#outlierGrad)' : 'url(#picoGrad)'} />
                                                    ))
                                                }
                                            </Bar>
                                            <defs>
                                                <linearGradient id="picoGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#a855f7" />
                                                    <stop offset="100%" stopColor="#3b82f6" />
                                                </linearGradient>
                                                <linearGradient id="outlierGrad" x1="0" y1="1" x2="0" y2="0">
                                                    <stop offset="0%" stopColor="#3b82f6" />
                                                    <stop offset="50%" stopColor="#a855f7" />
                                                    <stop offset="100%" stopColor="#ef4444" />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        <div className="bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group break-inside-avoid mt-8">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#111] border border-white/5 p-8 rounded-[40px] shadow-2xl break-inside-avoid mt-8">
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

                    <div className="lg:col-span-4 w-full h-full print:hidden">
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

                    {/* Tabla exclusiva para PDF Print */}
                    <div className="hidden print:block lg:col-span-12 mt-12 w-full break-inside-avoid">
                        <h3 className="text-2xl font-bold mb-6 text-black">Reporte de Gastos por Categoría</h3>
                        <table className="w-full text-left border-collapse bg-white">
                            <thead>
                                <tr>
                                    <th className="border-b-2 border-gray-300 p-4 font-bold text-black">Categoría</th>
                                    <th className="border-b-2 border-gray-300 p-4 font-bold text-black">Monto Total</th>
                                    <th className="border-b-2 border-gray-300 p-4 font-bold text-black">% del Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoryData.map(cat => (
                                    <tr key={cat.name}>
                                        <td className="border-b border-gray-200 p-4 text-black">{cat.name}</td>
                                        <td className="border-b border-gray-200 p-4 text-black font-medium">{formatMoney(cat.value)}</td>
                                        <td className="border-b border-gray-200 p-4 text-black">{Math.round((cat.value / stats.total) * 100)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
        
        @media print {
            header, .print\\:hidden, .custom-scrollbar, #expense-form-container { display: none !important; }
            body { background: white !important; color: black !important; }
            * { color: black !important; }
            .bg-\\[\\#111\\] { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
            .text-white { color: black !important; }
            .text-muted-foreground { color: #444 !important; }
            .bg-black\\/40 { background: white !important; border: 1px solid #ddd !important; }
            svg { color: black !important; }
            .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
            @page { size: A4; margin: 15mm; }
        }
      `}</style>

            <div id="expense-form-container" className="print:hidden">
                <ExpenseForm onAdd={fetchData} onUpdate={() => { fetchData(); setEditingExpense(null); }} editingExpense={editingExpense} onCancelEdit={() => setEditingExpense(null)} />
            </div>
        </div>
    );
}
