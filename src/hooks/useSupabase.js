import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

const useSupabase = (tableName, selectQuery = '*', options = {}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const optionsKey = JSON.stringify(options);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from(tableName).select(selectQuery);

            if (options.orderBy) {
                query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
            }

            const { data: fetchedData, error } = await query;
            if (error) throw error;
            setData(fetchedData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [tableName, selectQuery, optionsKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const create = async (newItem) => {
        try {
            const { data: created, error } = await supabase.from(tableName).insert(newItem).select();
            if (error) throw error;
            setData(prev => [...prev, ...created]);
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
                setData(prev => prev.map(item => item.id === id ? updated[0] : item));
                return updated;
            } else {
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
            setData(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    return { data, loading, error, create, update, remove, refresh: fetchData };
};

export default useSupabase;
