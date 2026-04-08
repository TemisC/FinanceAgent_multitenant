import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Key, ChevronRight, Loader2, UserPlus } from 'lucide-react';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        // Lógica de Login Híbrido:
        // Si el identificador es solo números, le ponemos el dominio de Telegram
        let finalEmail = identifier.trim().toLowerCase();
        if (/^\d+$/.test(finalEmail)) {
            finalEmail = `usuario_${finalEmail}@bot.financeagent.com`;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: finalEmail,
            password: password.trim()
        });

        if (error) {
            setErrorMsg(error.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 font-sans">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full" />

            <div className="w-full max-w-md bg-[#111] border border-white/5 p-12 rounded-[48px] shadow-2xl relative z-10 text-center">
                <div className="bg-gradient-to-tr from-primary to-blue-600 w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-10 shadow-lg shadow-primary/20">
                    <Shield className="text-white" size={32} />
                </div>
                <h1 className="text-4xl font-black text-white tracking-widest uppercase italic mb-2">FinanceAgent</h1>
                <p className="text-muted-foreground font-bold tracking-[0.3em] uppercase text-xs mb-10">Acceso Seguro</p>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="relative text-left">
                        <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Usuario</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium placeholder:text-white/20"
                                placeholder="Usuario enviado a tu chat de telegram"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
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
                                className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium"
                                placeholder="••••••••"
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
                        className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all transform active:scale-95 text-sm uppercase tracking-widest disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : (
                            <>Verificar Identidad <ChevronRight size={18} /></>
                        )}
                    </button>
                </form>

                <div className="mt-8 border-t border-white/5 pt-8">
                    <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase mb-4">¿No tienes cuenta?</p>
                    <Link to="/register" className="inline-flex items-center gap-2 text-primary hover:text-white transition-colors text-sm font-black uppercase tracking-widest">
                        <UserPlus size={16} /> Crear mi cuenta
                    </Link>
                </div>
            </div>
        </div>
    );
}
