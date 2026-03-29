import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateDailyReport = async ({ 
    statsTransactions, 
    expenses, 
    getPRDateString, 
    getServiceName,
    employees 
}) => {
    const todayDate = new Date().toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const completedTxs = statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid');
    const count = completedTxs.length;

    const incomeCash = completedTxs
        .filter(t => t.payment_method === 'cash')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

    const incomeTransfer = completedTxs
        .filter(t => t.payment_method === 'transfer')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

    const totalIncome = incomeCash + incomeTransfer;

    const totalTips = completedTxs.reduce((sum, t) => sum + (parseFloat(t.tip) || 0), 0);
    const totalCommissions = statsTransactions
        .filter(t => t.status === 'completed' || t.status === 'paid' || t.status === 'unpaid')
        .reduce((sum, t) => sum + (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0), 0);

    const expensesProduct = expenses
        .filter(e => {
            const eDate = getPRDateString(e.date);
            const today = getPRDateString(new Date());
            return eDate === today && e.category === 'product';
        })
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const expensesLunch = expenses
        .filter(e => {
            const eDate = getPRDateString(e.date);
            const today = getPRDateString(new Date());
            return eDate === today && e.category === 'lunch';
        })
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalExpenses = totalCommissions + totalTips + expensesProduct + expensesLunch;
    const netProfit = totalIncome - totalExpenses; 

    const doc = new jsPDF();

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Reporte Diario Detallado", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(todayDate.toUpperCase(), 105, 30, { align: 'center' });

    autoTable(doc, {
        startY: 50,
        head: [['Concepto', 'Monto']],
        body: [
            ['Autos Lavados', count.toString()],
            ['', ''], 
            ['Ingresos (Efectivo)', `$${incomeCash.toFixed(2)}`],
            ['Ingresos (ATH Móvil)', `$${incomeTransfer.toFixed(2)}`],
            ['INGRESOS TOTALES', `$${totalIncome.toFixed(2)}`],
            ['', ''], 
            ['Comisiones Pagadas', `$${totalCommissions.toFixed(2)}`],
            ['Propinas Pagadas', `$${totalTips.toFixed(2)}`],
            ['Almuerzos (Gastos)', `$${expensesLunch.toFixed(2)}`],
            ['Compras (Gastos)', `$${expensesProduct.toFixed(2)}`],
            ['GASTOS TOTALES', `$${totalExpenses.toFixed(2)}`],
            ['', ''], 
            ['GANANCIA NETA', `$${netProfit.toFixed(2)}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
        }
    });

    const employeesList = employees; 
    const empStats = {};
    completedTxs.forEach(t => {
        const assignments = t.transaction_assignments?.length > 0 ? Array.from(new Set(t.transaction_assignments.map(a => a.employee_id))).map(id => ({employee_id: id})) : [{ employee_id: t.employee_id }];
        const count = assignments.length > 0 ? assignments.length : 1;
        const shareComm = (parseFloat(t.commission_amount) || 0) / count;
        const shareTip = (parseFloat(t.tip) || 0) / count;

        assignments.forEach(a => {
            const eid = a.employee_id;
            if (!eid) return; 
            if (!empStats[eid]) empStats[eid] = { comm: 0, tips: 0 };
            empStats[eid].comm += shareComm;
            empStats[eid].tips += shareTip;
        });
    });

    const empBody = Object.entries(empStats).map(([eid, stats]) => {
        const emp = employeesList.find(e => String(e.id) === String(eid));
        const name = emp ? (emp.name || emp.first_name || `Emple. ${eid}`) : `ID: ${eid}`; 
        return [name, `$${stats.comm.toFixed(2)}`, `$${stats.tips.toFixed(2)}`, `$${(stats.comm + stats.tips).toFixed(2)}`];
    });

    doc.text("Desglose por Empleado", 14, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Empleado', 'Comisión', 'Propina', 'Total']],
        body: empBody,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] } 
    });

    const txBody = completedTxs.map(t => {
        const time = new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const brand = (t.vehicles?.brand && t.vehicles.brand !== 'null' && t.vehicles.brand !== 'Generico') ? t.vehicles.brand : (t.customers?.vehicle_brand || '');
        const model = t.vehicles?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Auto';
        const plate = t.vehicles?.plate || t.customers?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate) || '';
        const vehicleStr = `${brand} ${model} ${plate ? `(${plate})` : ''}`.trim();
        const clientName = t.customers?.name || 'Cliente';
        const price = `$${parseFloat(t.price).toFixed(2)}`;
        const serviceName = getServiceName(t.service_id);
        return [time, clientName, vehicleStr, serviceName, price];
    });

    doc.text("Historial de Autos", 14, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Hora', 'Cliente', 'Vehículo', 'Servicio', 'Precio']],
        body: txBody,
        theme: 'striped',
        headStyles: { fillColor: [75, 85, 99] } 
    });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Reporte_${getPRDateString(new Date())}.pdf`, { type: 'application/pdf' });

    if (navigator.share) {
        await navigator.share({
            files: [file],
            title: 'Reporte Diario Completo',
            text: `Reporte detallado de operaciones`
        });
    } else {
        doc.save(`Reporte_${getPRDateString(new Date())}.pdf`);
        alert("PDF Descargado. Envíalo manualmente por WhatsApp.");
    }
};
