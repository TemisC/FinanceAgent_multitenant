import React, { useState, useEffect } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const categories = [
  'Transporte', 'Alimentación', 'Vivienda', 'Salud',
  'Entretenimiento', 'Suscripciones', 'Personal', 'Educación', 'Varios'
];

const ExpenseForm = ({ onAdd, onUpdate, editingExpense, onCancelEdit }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    monto: '',
    descripcion: '',
    categoria: 'Alimentación',
    fecha_gasto: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        monto: editingExpense.monto,
        descripcion: editingExpense.descripcion || '',
        categoria: editingExpense.categoria,
        fecha_gasto: editingExpense.fecha_gasto
      });
      setIsOpen(true);
    }
  }, [editingExpense]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingExpense) {
        const { data, error } = await supabase
          .from('gastos')
          .update({
            ...formData,
            monto: parseFloat(formData.monto)
          })
          .eq('id', editingExpense.id)
          .select();

        if (error) throw error;
        if (onUpdate) onUpdate(data[0]);
      } else {
        const { data, error } = await supabase
          .from('gastos')
          .insert([{
            ...formData,
            monto: parseFloat(formData.monto),
            user_id: user.id
          }])
          .select();

        if (error) throw error;
        if (onAdd) onAdd(data[0]);
      }

      closeForm();
    } catch (error) {
      alert('Error en la operación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setFormData({
      monto: '',
      descripcion: '',
      categoria: 'Alimentación',
      fecha_gasto: new Date().toISOString().split('T')[0]
    });
    setIsOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all z-50 flex items-center gap-2 shadow-primary/20 cursor-pointer"
      >
        <Plus size={24} />
        <span className="hidden md:inline pr-1 font-semibold">Registrar Gasto</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] text-white w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={closeForm}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-black italic tracking-widest uppercase mb-6 text-white text-center">
          {editingExpense ? 'Editar Registro' : 'Nuevo Registro'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Monto ($)</label>
            <input
              required
              type="number"
              step="0.01"
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium"
              placeholder="0.00"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Categoría</label>
            <select
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium cursor-pointer"
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Descripción</label>
            <input
              type="text"
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium"
              placeholder="Ej. Cena en..."
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Fecha</label>
            <input
              type="date"
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-primary transition-all font-medium cursor-pointer"
              value={formData.fecha_gasto}
              onChange={(e) => setFormData({ ...formData, fecha_gasto: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {loading ? 'Procesando...' : editingExpense ? (
              <><Save size={18} /> Actualizar</>
            ) : (
              <><Plus size={18} /> Guardar</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
