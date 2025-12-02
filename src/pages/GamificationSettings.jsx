import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Trophy, Star, Zap, Crown, Medal, Plus, Trash, Check, X } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const GamificationSettings = () => {
    const { data: levels, loading, create, update, remove } = useSupabase('gamification_levels', '*');
    const [editingLevel, setEditingLevel] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        min_xp: '',
        color: '#94a3b8',
        icon: 'Trophy',
        reward: ''
    });

    // Sort levels by XP
    const sortedLevels = [...(levels || [])].sort((a, b) => a.min_xp - b.min_xp);

    const handleEdit = (level) => {
        setEditingLevel(level);
        setFormData({
            name: level.name,
            min_xp: level.min_xp,
            color: level.color,
            icon: level.icon,
            reward: level.reward || ''
        });
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingLevel(null);
        setFormData({
            name: '',
            min_xp: '',
            color: '#94a3b8',
            icon: 'Trophy',
            reward: ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const levelData = {
                name: formData.name,
                min_xp: parseInt(formData.min_xp),
                color: formData.color,
                icon: formData.icon,
                reward: formData.reward || null
            };

            if (editingLevel) {
                await update(editingLevel.id, levelData);
            } else {
                await create(levelData);
            }
            setIsModalOpen(false);
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este nivel?')) {
            try {
                await remove(id);
            } catch (error) {
                alert('Error al eliminar: ' + error.message);
            }
        }
    };

    const iconOptions = [
        { value: 'Trophy', icon: <Trophy size={20} /> },
        { value: 'Star', icon: <Star size={20} /> },
        { value: 'Zap', icon: <Zap size={20} /> },
        { value: 'Crown', icon: <Crown size={20} /> },
        { value: 'Medal', icon: <Medal size={20} /> }
    ];

    const getIconComponent = (iconName) => {
        const option = iconOptions.find(o => o.value === iconName);
        return option ? option.icon : <Trophy size={20} />;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Configuración de Gamificación</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Administra los niveles, XP y premios.</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddNew}>
                    <Plus size={20} />
                    Nuevo Nivel
                </button>
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem' }}>Icono</th>
                                <th style={{ padding: '1rem' }}>Nivel</th>
                                <th style={{ padding: '1rem' }}>XP Mínima</th>
                                <th style={{ padding: '1rem' }}>Color</th>
                                <th style={{ padding: '1rem' }}>Premio</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLevels.map(level => (
                                <tr key={level.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ color: level.color }}>
                                            {getIconComponent(level.icon)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{level.name}</td>
                                    <td style={{ padding: '1rem' }}>{level.min_xp} XP</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: level.color }}></div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{level.color}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {level.reward ? (
                                            <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#d97706', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                                                {level.reward}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            <button className="btn" onClick={() => handleEdit(level)} style={{ padding: '0.5rem', color: 'var(--primary)', backgroundColor: 'transparent' }}>
                                                <Check size={18} />
                                            </button>
                                            <button className="btn" onClick={() => handleDelete(level.id)} style={{ padding: '0.5rem', color: 'var(--danger)', backgroundColor: 'transparent' }}>
                                                <Trash size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card modal-card" style={{ width: '100%', maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>{editingLevel ? 'Editar Nivel' : 'Nuevo Nivel'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Nombre del Nivel</label>
                                <input
                                    type="text"
                                    className="input"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Maestro"
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">XP Mínima (Autos Lavados)</label>
                                <input
                                    type="number"
                                    className="input"
                                    required
                                    value={formData.min_xp}
                                    onChange={(e) => setFormData({ ...formData, min_xp: e.target.value })}
                                    placeholder="Ej. 500"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Color</label>
                                    <input
                                        type="color"
                                        className="input"
                                        style={{ height: '42px', padding: '0.25rem' }}
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Icono</label>
                                    <select
                                        className="input"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    >
                                        {iconOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="label">Premio (Opcional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.reward}
                                    onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                                    placeholder="Ej. Bono $50"
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamificationSettings;
