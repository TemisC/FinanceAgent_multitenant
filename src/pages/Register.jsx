import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Shield, Mail, Key, ChevronRight, Loader2, LogIn, UserCheck } from 'lucide-react';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref');

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        const options = refCode ? { data: { referred_by: refCode } } : {};
        const { error } = await supabase.auth.signUp({ email, password, options });
        if (error) {
            setErrorMsg(error.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 font-sans">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/20 blur-[150px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full" />

            <div className="w-full max-w-md bg-[#111] border border-white/5 p-12 rounded-[48px] shadow-2xl relative z-10 text-center">
                <div className="bg-gradient-to-br from-blue-600 to-primary w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-10 shadow-lg shadow-blue-600/20">
                    <Shield className="text-white" size={32} />
                </div>
                <h1 className="text-4xl font-black text-white tracking-widest uppercase italic mb-2">Crear Cuenta</h1>
                <p className="text-muted-foreground font-bold tracking-[0.3em] uppercase text-xs mb-10">Agente de Finanzas</p>

                {refCode && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 mb-6">
                        <UserCheck size={16} className="text-emerald-400 shrink-0" />
                        <p className="text-[11px] text-emerald-400 font-black uppercase tracking-widest">Invitado por un referido</p>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="relative text-left">
                        <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-medium"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="relative text-left">
                        <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Contraseña</label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-medium"
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="text-destructive font-black text-xs uppercase tracking-widest text-center animate-pulse">
                            Error: {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all transform active:scale-95 text-sm uppercase tracking-widest disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : (
                            <>Comenzar Ahora <ChevronRight size={18} /></>
                        )}
                    </button>
                </form>

                <div className="mt-8 border-t border-white/5 pt-8">
                    <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase mb-4">¿Ya tienes cuenta?</p>
                    <Link to="/login" className="inline-flex items-center gap-2 text-blue-500 hover:text-white transition-colors text-sm font-black uppercase tracking-widest">
                        <LogIn size={16} /> Entrar a mi cuenta
                    </Link>
                </div>
            </div>
        </div>
    );
}
