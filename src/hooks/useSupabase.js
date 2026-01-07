import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const useSupabase = (tableName, selectQuery = '*', options = {}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            let query = supabase.from(tableName).select(selectQuery);

            if (options.orderBy) {
                query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
            }

            const { data, error } = await query;
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

            if (updated && updated.length > 0) {
                setData(data.map(item => item.id === id ? updated[0] : item));
                return updated;
            } else {
                // RLS likely blocked the update, or id not found. Return empty but don't corrupt state.
                return [];
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const remove = async (id) => {
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', id).select();
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
