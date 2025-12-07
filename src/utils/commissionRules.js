// Utility to calculate base commission based on business rules

export const calculateSharedCommission = (currentPrice, employeeCount, defaultCommission) => {
    const price = parseFloat(currentPrice) || 0;
    const count = parseInt(employeeCount) || 1;
    const base = parseFloat(defaultCommission) || 0;

    // Regla: Servicios de $35 y $45 (Lavados Básicos/SUV con Extra)
    // Si hay más de 1 empleado, la comisión TOTAL debe ser $12 (para que toque a $6 c/u).
    // Rango de seguridad: $35 a $55 para cubrir variaciones pequeñas.
    if (count > 1 && price >= 35 && price <= 55) {
        // Solo aplicar si la comisión base definida no es YA mayor (ej. un detallado de $20 de comisión).
        if (base < 12) {
            return 12;
        }
    }

    return base;
};
