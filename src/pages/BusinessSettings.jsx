import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Save, Upload, Loader2, Image as ImageIcon } from 'lucide-react';

const BusinessSettings = () => {
    const [settings, setSettings] = useState({
        business_name: '',
        business_logo_url: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('business_settings')
            .select('*');

        if (data) {
            const newSettings = {};
            data.forEach(item => {
                newSettings[item.setting_key] = item.setting_value;
            });
            setSettings(prev => ({ ...prev, ...newSettings }));
        }
        setLoading(false);
    };

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Upsert each setting manually
            const updates = [
                { setting_key: 'business_name', setting_value: settings.business_name },
                { setting_key: 'business_logo_url', setting_value: settings.business_logo_url },
                // Add more as needed
            ];

            const { error } = await supabase
                .from('business_settings')
                .upsert(updates);

            if (error) throw error;
            alert('¡Configuración guardada! Recarga la página para ver los cambios.');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar configuración.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to 'branding' bucket
            const { error: uploadError } = await supabase.storage
                .from('branding')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('branding')
                .getPublicUrl(filePath);

            setSettings(prev => ({ ...prev, business_logo_url: publicUrl }));

        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Error al subir logo: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Cargando configuración...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <ImageIcon className="text-blue-500" /> Configuración de Marca (White-Label)
            </h1>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">

                {/* BUSINESS NAME */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Nombre del Negocio</label>
                    <input
                        type="text"
                        name="business_name"
                        value={settings.business_name}
                        onChange={handleChange}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: Mi Car Wash"
                    />
                    <p className="text-xs text-slate-500 mt-1">Este nombre aparecerá en el encabezado y títulos.</p>
                </div>

                {/* LOGO UPLOAD */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Logo del Negocio</label>
                    <div className="flex items-start gap-6">
                        <div className="flex-shrink-0">
                            {settings.business_logo_url ? (
                                <img
                                    src={settings.business_logo_url}
                                    alt="Logo Preview"
                                    className="w-32 h-32 object-contain bg-slate-900 rounded-lg border border-slate-600 p-2"
                                />
                            ) : (
                                <div className="w-32 h-32 bg-slate-900 rounded-lg border border-slate-600 flex items-center justify-center text-slate-500">
                                    No Logo
                                </div>
                            )}
                        </div>

                        <div className="flex-grow">
                            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
                                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                                {uploading ? 'Subiendo...' : 'Subir Nuevo Logo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleLogoUpload}
                                    disabled={uploading}
                                />
                            </label>
                            <p className="text-xs text-slate-400 mt-2">
                                Formatos recomendados: PNG (fondo transparente), JPG. Tamaño ideal: 500x500px.
                            </p>

                            {/* Manual URL Input Fallback */}
                            <input
                                type="text"
                                name="business_logo_url"
                                value={settings.business_logo_url}
                                onChange={handleChange}
                                className="mt-4 w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="O pega una URL de imagen directa aquí..."
                            />
                        </div>
                    </div>
                </div>

                {/* SAVE BUTTON */}
                <div className="pt-6 border-t border-slate-700 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default BusinessSettings;
