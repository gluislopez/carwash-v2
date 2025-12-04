import jsPDF from 'jspdf';

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
    centerText('Vuelva Pronto', y, 9);

    return doc;
};
