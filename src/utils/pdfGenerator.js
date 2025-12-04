import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateReceiptPDF = (transaction, serviceName, extras, total, tip) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200] // 80mm width (thermal printer standard), adjustable height
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let y = 10; // Start Y position

    // Helper for centering text
    const centerText = (text, yPos, size = 10, bold = false) => {
        doc.setFontSize(size);
        doc.setFont('courier', bold ? 'bold' : 'normal');
        doc.text(text, centerX, yPos, { align: 'center' });
    };

    // Helper for left/right aligned text
    const row = (label, value, yPos, size = 9) => {
        doc.setFontSize(size);
        doc.setFont('courier', 'normal');
        doc.text(label, 5, yPos);
        doc.text(value, pageWidth - 5, yPos, { align: 'right' });
    };

    const line = (yPos) => {
        doc.setLineWidth(0.1);
        doc.line(2, yPos, pageWidth - 2, yPos);
    };

    // HEADER
    centerText('RECIBO DE PAGO', y, 12, true);
    y += 5;
    centerText('Express CarWash', y, 10);
    y += 5;
    centerText('Barranquitas, PR', y, 10);
    y += 5;
    line(y);
    y += 5;

    // INFO
    const dateObj = new Date();
    const dateStr = dateObj.toLocaleDateString('es-PR');
    const timeStr = dateObj.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });

    doc.setFontSize(9);
    doc.text(`FECHA: ${dateStr} ${timeStr}`, 5, y);
    y += 5;
    doc.text(`CLIENTE: ${(transaction.customers.name || '').toUpperCase()}`, 5, y);
    y += 5;
    doc.text(`AUTO: ${(transaction.customers.vehicle_plate || '').toUpperCase()}`, 5, y);
    y += 4;
    doc.text(`      (${(transaction.customers.vehicle_model || '').toUpperCase()})`, 5, y);
    y += 5;
    line(y);
    y += 5;

    // ITEMS
    row('DESCRIPCION', 'PRECIO', y, 9);
    y += 2;
    line(y);
    y += 5;

    // Base Service
    // Calculate base price (Total - Extras - Tip is not quite right if total includes tip, 
    // but here 'total' passed is usually price. Let's assume passed total is the form price (service + extras))
    // We need to recalculate base service price from the passed total.

    const extrasTotal = extras.reduce((sum, e) => sum + parseFloat(e.price), 0);
    const basePrice = parseFloat(total) - extrasTotal;

    row((serviceName || 'Servicio').toUpperCase(), `$${basePrice.toFixed(2)}`, y);
    y += 5;

    // Extras
    extras.forEach(ex => {
        row(ex.description.toUpperCase(), `$${parseFloat(ex.price).toFixed(2)}`, y);
        y += 5;
    });

    line(y);
    y += 5;

    // TOTALS
    row('SUBTOTAL', `$${parseFloat(total).toFixed(2)}`, y);
    y += 5;

    if (tip > 0) {
        row('PROPINA', `$${parseFloat(tip).toFixed(2)}`, y);
        y += 5;
    }

    doc.setFont('courier', 'bold');
    row('TOTAL', `$${(parseFloat(total) + parseFloat(tip)).toFixed(2)}`, y, 11);
    y += 5;
    doc.setFont('courier', 'normal');

    line(y);
    y += 5;

    // FOOTER
    centerText('¡GRACIAS POR SU VISITA!', y, 10);
    y += 5;
    doc.save(`recibo_${transaction.id}.pdf`);
    return doc;
};

export const generateReportPDF = (transactions, dateRange, stats, userRole) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Reporte Financiero - Express CarWash', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Periodo: ${dateRange.toUpperCase()}`, 14, 34);

    // Summary Section
    let y = 45;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const summaryData = [
        ['Total Autos', stats.count],
        ['Ingresos Totales', `$${stats.income.toFixed(2)}`],
        ['   - Efectivo', `$${stats.totalCash.toFixed(2)}`],
        ['   - Ath Móvil', `$${stats.totalTransfer.toFixed(2)}`],
        ['Gastos (Comisiones + Compras)', `$${stats.expenses.toFixed(2)}`],
        ['Ganancia Neta', `$${stats.net.toFixed(2)}`]
    ];

    autoTable(doc, {
        startY: y,
        head: [['Métrica', 'Valor']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }, // Blue header
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
        },
        margin: { left: 14, right: 100 } // Narrow table for summary
    });

    y = doc.lastAutoTable.finalY + 15;

    // Transactions Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Transacciones', 14, y);
    y += 5;

    const tableHeaders = [['Fecha', 'Cliente', 'Servicio', 'Método', 'Total']];

    const tableBody = transactions.map(t => [
        new Date(t.date).toLocaleDateString() + ' ' + new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        t.client_info || 'Cliente',
        t.service_info || t.service_id,
        t.payment_method === 'cash' ? 'Efectivo' : t.payment_method === 'card' ? 'Tarjeta' : 'Ath Móvil',
        `$${t.total_price.toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: y,
        head: tableHeaders,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41] }, // Dark header
        styles: { fontSize: 8, textColor: [0, 0, 0] }, // Ensure text is black for contrast
        columnStyles: {
            4: { halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: function (data) {
            if (data.section === 'body') {
                const dateStr = data.row.raw[0]; // "DD/MM/YYYY HH:MM"
                // Parse date manually or use the raw transaction if we had passed it. 
                // Since we only have the string, let's parse it. 
                // Assuming locale 'es-PR' or similar might be tricky, but let's try standard Date parse or just use the day from the string if possible.
                // Actually, passing the raw date object in the row data would be cleaner, but 'body' expects arrays.
                // Let's rely on the fact that the date string starts with the date.

                // Better approach: We can't easily parse "DD/MM/YYYY" reliably across locales without a library.
                // However, we can infer the day from the date string if we know the format.
                // OR, we can pass the day index as a hidden column or metadata? 
                // autoTable doesn't support hidden columns easily.

                // Let's try to parse the date string. It was created with new Date(t.date).toLocaleDateString().
                // If we assume standard format, we can try new Date(dateStr).

                // Alternative: Calculate colors BEFORE mapping to tableBody? 
                // No, autoTable needs to do the drawing.

                // Let's try to parse the date string.
                const parts = dateStr.split(' ')[0].split('/');
                if (parts.length === 3) {
                    // Assuming D/M/YYYY or M/D/YYYY depending on locale. 
                    // Let's use the raw transaction date if possible? 
                    // We can't access 'transactions' array easily by row index here safely if sorting changes.
                    // BUT, data.row.index corresponds to the body index.
                    const originalTx = transactions[data.row.index];
                    if (originalTx) {
                        const day = new Date(originalTx.date).getDay(); // 0 = Sunday, 1 = Monday...

                        // Pastel Colors for Days
                        const colors = {
                            0: [254, 202, 202], // Sun: Red-200
                            1: [253, 230, 138], // Mon: Amber-200
                            2: [254, 240, 138], // Tue: Yellow-200
                            3: [187, 247, 208], // Wed: Green-200
                            4: [191, 219, 254], // Thu: Blue-200
                            5: [221, 214, 254], // Fri: Violet-200
                            6: [251, 207, 232]  // Sat: Pink-200
                        };

                        if (colors[day]) {
                            data.cell.styles.fillColor = colors[day];
                        }
                    }
                }
            }
        }
    });

    doc.save(`reporte_${dateRange}_${Date.now()}.pdf`);
};
