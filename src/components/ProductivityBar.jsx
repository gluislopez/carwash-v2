import React from 'react';
import { Trophy, Star, Zap, Crown, Medal } from 'lucide-react';

const ProductivityBar = ({ dailyCount, dailyTarget = 10, totalXp }) => {
    // Calculate Level
    const getLevelInfo = (xp) => {
        if (xp >= 1000) return { level: 5, name: 'Leyenda', icon: <Crown size={20} color="#fbbf24" />, color: '#fbbf24', next: null };
        if (xp >= 500) return { level: 4, name: 'Maestro', icon: <Zap size={20} color="#a855f7" />, color: '#a855f7', next: 1000 };
        if (xp >= 150) return { level: 3, name: 'Experto', icon: <Star size={20} color="#3b82f6" />, color: '#3b82f6', next: 500 };
        if (xp >= 50) return { level: 2, name: 'Lavador', icon: <Medal size={20} color="#22c55e" />, color: '#22c55e', next: 150 };
        return { level: 1, name: 'Novato', icon: <Trophy size={20} color="#94a3b8" />, color: '#94a3b8', next: 50 };
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
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: progressPercent >= 100 ? 'var(--success)' : 'var(--text-main)' }}>
                        {dailyCount}/{dailyTarget}
                    </p>
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
