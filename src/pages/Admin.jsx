import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Users, LayoutDashboard, Shield, AlertTriangle, CheckCircle, Search, Trash2 } from 'lucide-react';

export default function Admin() {
    const { user, profile, loading } = useAuth();
    const [users, setUsers] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setFetching(true);
        const { data: profilesData, error: profilesError } = await supabase
            .from('perfiles')
            .select('*')
            .order('fecha_registro', { ascending: false });

        if (!profilesError && profilesData) {
            const usersWithActivity = await Promise.all(profilesData.map(async (p) => {
                const { data: lastExpense } = await supabase
                    .from('gastos')
                    .select('created_at')
                    .eq('user_id', p.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                return {
                    ...p,
                    ultima_actividad: lastExpense?.created_at || null
                };
            }));
            setUsers(usersWithActivity);
        }
        setFetching(false);
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

    useEffect(() => {
        if (profile?.rol === 'adminmaster') {
            fetchUsers();
        }
    }, [profile]);

    const updateStatus = async (userId, newStatus) => {
        const { error } = await supabase
            .from('perfiles')
            .update({ estado_suscripcion: newStatus })
            .eq('id', userId);

        if (!error) {
            fetchUsers();
        } else {
            alert('Error: ' + error.message);
        }
    };

    const deleteUser = async (userId) => {
        if (!confirm('¿Estás SEGURO de eliminar definitivamente este usuario? Se borrarán todos sus gastos permanentemente.')) return;

        setFetching(true);
        // Al borrar de 'perfiles', el ON DELETE CASCADE del SQL debería limpiar lo demás.
        const { error } = await supabase
            .from('perfiles')
            .delete()
            .eq('id', userId);

        if (!error) {
            alert('Usuario eliminado de la base de datos empresarial.');
            fetchUsers();
        } else {
            alert('Error al eliminar: ' + error.message);
            setFetching(false);
        }
    };

    if (loading) return null;

    if (profile?.rol !== 'adminmaster') {
        return <Navigate to="/" replace />;
    }

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.telegram_chat_id && u.telegram_chat_id.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-[#080808] text-foreground font-sans">
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2.5 rounded-2xl shadow-lg shadow-amber-500/20">
                            <Shield className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">Admin Master</h1>
                            <p className="text-[10px] text-amber-500 font-bold tracking-[0.2em] uppercase">Panel de Control</p>
                        </div>
                    </div>
                    <Link to="/" className="flex items-center gap-2 text-[10px] font-black text-muted-foreground hover:text-white uppercase tracking-widest border border-white/10 px-4 py-2 rounded-xl transition-all">
                        <LayoutDashboard size={14} /> Volver a Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <Users className="text-amber-500" size={32} />
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-widest">Inquilinos ({users.length})</h2>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                <div className="bg-[#111] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/50 border-b border-white/5">
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50">Email</th>
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50">Rol</th>
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50">Estado</th>
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50">Última Actividad</th>
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50">Registrado</th>
                                    <th className="p-6 text-xs font-black uppercase tracking-widest text-white/50 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fetching ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-white/50">Cargando...</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-white/50">No hay usuarios</td>
                                    </tr>
                                ) : filteredUsers.map((u) => (
                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-6 font-bold text-white text-sm">
                                            {u.email}
                                            {u.telegram_chat_id && <span className="block text-xs mt-1 font-normal text-blue-400">TG: {u.telegram_chat_id}</span>}
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${u.rol === 'adminmaster' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                                                {u.rol}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <span className={`flex items-center gap-1.5 w-max px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${u.estado_suscripcion === 'active' ? 'bg-emerald-500/20 text-emerald-500' :
                                                u.estado_suscripcion === 'trial' ? 'bg-blue-500/20 text-blue-500' :
                                                    u.estado_suscripcion === 'banned' ? 'bg-red-500/20 text-red-500' :
                                                        'bg-white/10 text-white/50'
                                                }`}>
                                                {u.estado_suscripcion === 'active' ? <CheckCircle size={12} /> : u.estado_suscripcion === 'banned' ? <AlertTriangle size={12} /> : null}
                                                {u.estado_suscripcion}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-black ${!u.ultima_actividad ? 'text-white/20' : 'text-amber-500'}`}>
                                                    {getHoursSince(u.ultima_actividad)}
                                                </span>
                                                {u.ultima_actividad && (
                                                    <span className="text-[9px] text-white/30 uppercase mt-1">
                                                        {new Date(u.ultima_actividad).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6 text-xs text-white/50 font-medium">
                                            {new Date(u.fecha_registro).toLocaleDateString()}
                                        </td>
                                        <td className="p-6 text-right space-x-2">
                                            {u.rol !== 'adminmaster' && (
                                                <>
                                                    <button onClick={() => updateStatus(u.id, 'active')} className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded transition-colors">Activar</button>
                                                    <button onClick={() => updateStatus(u.id, 'banned')} className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded transition-colors">Banear</button>
                                                    <button onClick={() => deleteUser(u.id)} className="text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/30 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded transition-all group-hover:opacity-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
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
