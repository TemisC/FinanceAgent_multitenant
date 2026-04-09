import React, { useState, useEffect } from 'react';
import { Plus, X, Save, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const categories = [
  'Transporte', 'Alimentación', 'Vivienda', 'Salud', 'Entretenimiento',
  'Suscripciones', 'Personal', 'Educación', 'Varios', 'Impuestos y Servicios',
  'Ahorro e Inversión', 'Mascotas', 'Regalos', 'Ropa y Calzado'
];

const ExpenseForm = ({ onAdd, onUpdate, editingExpense, onCancelEdit }) => {
  const { user, profile } = useAuth();
  const baseCurrency = profile?.moneda || 'USD';

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isConverting, setIsConverting] = useState(false);

  const [formData, setFormData] = useState({
    monto: '',
    descripcion: '',
    categoria: 'Alimentación',
    fecha_gasto: new Date().toISOString().split('T')[0],
    moneda_original: baseCurrency,
    monto_original: ''
  });

  // Efecto para cargar datos en modo edición
  useEffect(() => {
    if (editingExpense) {
      setFormData({
        monto: editingExpense.monto,
        descripcion: editingExpense.descripcion || '',
        categoria: editingExpense.categoria,
        fecha_gasto: editingExpense.fecha_gasto,
        moneda_original: editingExpense.moneda_original || baseCurrency,
        monto_original: editingExpense.monto_original || editingExpense.monto
      });
      setIsOpen(true);
    }
  }, [editingExpense, baseCurrency]);

  // Efecto para actualizar la tasa de cambio cuando se selecciona USD
  useEffect(() => {
    const fetchRate = async () => {
      if (formData.moneda_original === 'USD' && baseCurrency !== 'USD') {
        setIsConverting(true);
        try {
          // Consultar nuestra base de datos local alimentada por n8n
          const { data, error } = await supabase
            .from('tasas_cambio')
            .select('valor')
            .eq('id', baseCurrency)
            .single();

          if (error) throw error;
          const rate = data.valor;

          if (rate) {
            setExchangeRate(rate);
            if (formData.monto_original) {
              setFormData(prev => ({
                ...prev,
                monto: (parseFloat(formData.monto_original) * rate).toFixed(2)
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching rate from DB:', error);
          // Fallback por si n8n aún no carga los datos: usar cambio manual o 4000
          setExchangeRate(1);
        } finally {
          setIsConverting(false);
        }
      } else {
        setExchangeRate(1);
        if (formData.monto_original) {
          setFormData(prev => ({ ...prev, monto: prev.monto_original }));
        }
      }
    };

    fetchRate();
  }, [formData.moneda_original, baseCurrency]);

  const handleAmountChange = (val) => {
    const numVal = parseFloat(val) || 0;
    setFormData(prev => ({
      ...prev,
      monto_original: val,
      monto: (numVal * exchangeRate).toFixed(2)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        monto: parseFloat(formData.monto),
        monto_original: parseFloat(formData.monto_original || formData.monto),
        user_id: user.id
      };

      if (editingExpense) {
        const { data, error } = await supabase
          .from('gastos')
          .update(payload)
          .eq('id', editingExpense.id)
          .select();

        if (error) throw error;
        if (onUpdate) onUpdate(data[0]);
      } else {
        const { data, error } = await supabase
          .from('gastos')
          .insert([payload])
          .select();

        if (error) throw error;
        if (onAdd) onAdd(data[0]);
      }

      closeForm();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setFormData({
      monto: '',
      descripcion: '',
      categoria: 'Alimentación',
      fecha_gasto: new Date().toISOString().split('T')[0],
      moneda_original: baseCurrency,
      monto_original: ''
    });
    setIsOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all z-50 flex items-center gap-2 shadow-primary/20 cursor-pointer">
        <Plus size={24} />
        <span className="hidden md:inline pr-1 font-semibold">Registrar Gasto</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] text-white w-full max-w-md p-8 rounded-[40px] border border-white/5 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={closeForm} className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors cursor-pointer">
          <X size={24} />
        </button>

        <h2 className="text-xl font-black italic tracking-widest uppercase mb-8 text-white text-center flex items-center justify-center gap-3">
          {editingExpense ? <Save className="text-primary" /> : <Plus className="text-primary" />}
          {editingExpense ? 'Editar Registro' : 'Nuevo Registro'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 block">Moneda</label>
              <select
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold cursor-pointer text-sm"
                value={formData.moneda_original}
                onChange={(e) => setFormData({ ...formData, moneda_original: e.target.value })}
              >
                <option value={baseCurrency}>{baseCurrency} (Local)</option>
                <option value="USD">USD (Dólar)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 block">Monto Original</label>
              <input
                required type="number" step="0.01"
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold text-sm"
                placeholder="0.00"
                value={formData.monto_original}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>

          {formData.moneda_original !== baseCurrency && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCcw size={16} className={`text-primary ${isConverting ? 'animate-spin' : ''}`} />
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Conversión Automática</p>
                  <p className="text-lg font-black text-white">{formData.monto} <span className="text-xs text-white/40">{baseCurrency}</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-white/30 uppercase font-bold">Tasa hoy</p>
                <p className="text-xs font-bold text-white/60">1 USD = {exchangeRate.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 block">Categoría</label>
            <select
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold cursor-pointer text-sm"
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 block">Descripción</label>
            <input
              type="text"
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold text-sm"
              placeholder="Ej. Compra en Amazon..."
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 block">Fecha</label>
            <input
              type="date"
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold cursor-pointer text-sm font-mono"
              value={formData.fecha_gasto}
              onChange={(e) => setFormData({ ...formData, fecha_gasto: e.target.value })}
            />
          </div>

          <button
            type="submit" disabled={loading || isConverting}
            className="w-full bg-gradient-to-r from-primary to-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-3 text-sm shadow-xl shadow-primary/20"
          >
            {loading ? <RefreshCcw className="animate-spin" /> : editingExpense ? <Save size={18} /> : <Plus size={18} />}
            {loading ? 'Procesando...' : editingExpense ? 'Actualizar Registro' : 'Guardar Gasto'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
