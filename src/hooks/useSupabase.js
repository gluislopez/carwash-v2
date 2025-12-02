import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const useSupabase = (tableName) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) throw error;
            setData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [tableName]);

    const create = async (newItem) => {
        try {
            const { data: created, error } = await supabase.from(tableName).insert(newItem).select();
            if (error) throw error;
            setData([...data, ...created]);
            return created;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const update = async (id, updates) => {
        try {
            const { data: updated, error } = await supabase.from(tableName).update(updates).eq('id', id).select();
            if (error) throw error;
            setData(data.map(item => item.id === id ? updated[0] : item));
            return updated;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const remove = async (id) => {
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) throw error;
            setData(data.filter(item => item.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    return { data, loading, error, create, update, remove, refresh: fetchData };
};

export default useSupabase;
