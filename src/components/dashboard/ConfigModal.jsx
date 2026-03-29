import React from 'react';
import { X, Save } from 'lucide-react';

const ConfigModal = ({ 
    isOpen, 
    onClose, 
    reviewLink, 
    setReviewLink, 
    stripeLink, 
    setStripeLink, 
    onSave 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[3000] p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-3xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">AJUSTES DEL SISTEMA</h3>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Configuración Global de Enlaces</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Review Link Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <span>Google Review Link</span>
                            <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="https://g.page/r/..."
                                value={reviewLink}
                                onChange={(e) => setReviewLink(e.target.value)}
                                className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium italic">
                            * Este link aparecerá en el PDF del recibo para que los clientes dejen su reseña.
                        </p>
                    </div>

                    {/* Stripe Link Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <span>Stripe Checkout (Legacy)</span>
                            <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="https://buy.stripe.com/..."
                                value={stripeLink}
                                onChange={(e) => setStripeLink(e.target.value)}
                                className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium italic">
                            * Opcional si utiliza el panel nativo de pagos.
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="flex-1 h-12 text-sm font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={async () => {
                                const success = await onSave({ review_link: reviewLink, stripe_link: stripeLink });
                                if (success) {
                                    alert('✅ Configuración guardada correctamente.');
                                    onClose();
                                }
                            }}
                            className="flex-1 h-12 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Save size={18} />
                            GUARDAR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigModal;
