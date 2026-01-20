export const getCustomerName = (id, customersList) => customersList?.find(c => c.id === id)?.name || 'Cliente Casual';

export const getServiceName = (id, servicesList) => servicesList?.find(s => s.id === id)?.name || 'Servicio Desconocido';

export const getEmployeeName = (id, employeesList) => employeesList?.find(e => e.id === id)?.name || 'Desconocido';

export const getVehicleInfo = (t, vehiclesList, customersList) => {
    if (!vehiclesList && !customersList) return '...';

    let vehicle = null;
    let customer = null;

    // 1. Fetch from vehicles table
    if (t.vehicle_id) {
        vehicle = vehiclesList?.find(v => v.id == t.vehicle_id);
    }

    // 2. Fetch from customers table
    if (t.customer_id) {
        customer = customersList?.find(c => c.id == t.customer_id);
    }

    if (!vehicle && !customer && !t.extras) return 'Modelo No Registrado';

    // 3. Fallback Logic: Brand
    const brand = (vehicle?.brand && vehicle.brand !== 'null' && vehicle.brand !== 'Generico') ? vehicle.brand : (customer?.vehicle_brand || '');

    // 4. Fallback Logic: Model
    const model = vehicle?.model || customer?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Vehículo';

    // 5. Fallback Logic: Plate
    const plate = vehicle?.plate || customer?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate) || '';

    const display = `${brand} ${model}`.trim();
    return plate ? `${display} (${plate})` : display || 'Modelo No Registrado';
};
