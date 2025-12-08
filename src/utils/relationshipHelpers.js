export const getCustomerName = (id, customersList) => customersList?.find(c => c.id === id)?.name || 'Cliente Casual';

export const getServiceName = (id, servicesList) => servicesList?.find(s => s.id === id)?.name || 'Servicio Desconocido';

export const getEmployeeName = (id, employeesList) => employeesList?.find(e => e.id === id)?.name || 'Desconocido';

export const getVehicleInfo = (t, vehiclesList, customersList) => {
    if (!vehiclesList) return '...';

    let vehicle = null;

    // 1. Try by Direct ID
    if (t.vehicle_id) {
        vehicle = vehiclesList.find(v => v.id == t.vehicle_id);
    }

    // 2. Fallback: Try by Customer ID
    if (!vehicle && t.customer_id) {
        vehicle = vehiclesList.find(v => v.customer_id == t.customer_id);
    }

    if (vehicle) {
        const brand = vehicle.brand === 'Generico' || !vehicle.brand ? '' : vehicle.brand;
        return `${brand} ${vehicle.model || ''}`.trim() || 'Sin Modelo';
    }

    // 3. Fallback: Try by Customer ID (Customers Table - Legacy/QuickAdd)
    if (t.customer_id && customersList) {
        const customer = customersList.find(c => c.id == t.customer_id);
        if (customer && (customer.vehicle_model || customer.vehicle_plate)) {
            return `${customer.vehicle_model || ''} ${customer.vehicle_plate ? `(${customer.vehicle_plate})` : ''}`.trim();
        }
    }

    return 'Modelo No Registrado';
};
