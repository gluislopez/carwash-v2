import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, Crown, Medal, Edit2 } from 'lucide-react';
import { supabase } from '../supabase';

const ProductivityBar = ({ dailyCount, dailyTarget = 10, totalXp, isEditable = false, onEditTarget }) => {
    const [levels, setLevels] = useState([]);

    useEffect(() => {
        const fetchLevels = async () => {
            const { data, error } = await supabase
                .from('gamification_levels')
                .select('*')
                .order('min_xp', { ascending: true });

            if (data) setLevels(data);
        };
        fetchLevels();
    }, []);

    // Calculate Level
    const getLevelInfo = (xp) => {
        if (levels.length === 0) return { level: 1, name: 'Cargando...', icon: <Trophy size={20} color="#94a3b8" />, color: '#94a3b8', next: null };

        // Find the highest level reached
        let currentLevel = levels[0];
        let nextLevel = null;
        let levelIndex = 1;

        for (let i = 0; i < levels.length; i++) {
            if (xp >= levels[i].min_xp) {
                currentLevel = levels[i];
                levelIndex = i + 1;
                nextLevel = levels[i + 1] || null;
            } else {
                break;
            }
        }

        const iconMap = {
            'Trophy': <Trophy size={20} color={currentLevel.color} />,
            'Star': <Star size={20} color={currentLevel.color} />,
            'Zap': <Zap size={20} color={currentLevel.color} />,
            'Crown': <Crown size={20} color={currentLevel.color} />,
            'Medal': <Medal size={20} color={currentLevel.color} />
        };

        return {
            level: levelIndex,
            name: currentLevel.name,
            icon: iconMap[currentLevel.icon] || <Trophy size={20} color={currentLevel.color} />,
            color: currentLevel.color,
            next: nextLevel ? nextLevel.min_xp : null,
            reward: nextLevel ? nextLevel.reward : null
        };
    };

    const levelInfo = getLevelInfo(totalXp);
    const progressPercent = Math.min((dailyCount / dailyTarget) * 100, 100);

    // Calculate XP progress to next level
    let xpProgress = 0;
    if (levelInfo.next) {
        // Simple linear progress for now, can be improved to be relative to level start
        xpProgress = (totalXp / levelInfo.next) * 100;
    } else {
        xpProgress = 100; // Max level
    }

    const handleEditClick = () => {
        if (onEditTarget) {
            const newTarget = prompt("Ingresa la nueva meta diaria:", dailyTarget);
            if (newTarget && !isNaN(newTarget)) {
                onEditTarget(parseInt(newTarget, 10));
            }
        }
    };

    return (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(to right, var(--bg-card), rgba(99, 102, 241, 0.05))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        padding: '0.5rem',
                        borderRadius: '50%',
                        backgroundColor: `rgba(${levelInfo.color === '#fbbf24' ? '251, 191, 36' : '148, 163, 184'}, 0.1)`,
                        border: `2px solid ${levelInfo.color}`
                    }}>
                        {levelInfo.icon}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: levelInfo.color }}>{levelInfo.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nivel {levelInfo.level} • {totalXp} XP Total</p>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: progressPercent >= 100 ? 'var(--success)' : 'var(--text-main)' }}>
                            {dailyCount}/{dailyTarget}
                        </p>
                        {isEditable && (
                            <button
                                onClick={handleEditClick}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                                title="Editar Meta"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Meta Diaria</p>
                </div>
            </div>

            {/* Daily Progress Bar */}
            <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: progressPercent >= 100 ? 'var(--success)' : 'var(--primary)',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease-out',
                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                }} />
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{progressPercent >= 100 ? '¡Meta cumplida! 🔥' : '¡Sigue así!'}</span>
                {levelInfo.next && <span>Próximo Nivel: {levelInfo.next - totalXp} autos más</span>}
            </div>
        </div>
    );
};

export default ProductivityBar;
