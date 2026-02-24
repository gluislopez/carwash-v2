import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateReceiptPDF = async (transaction, serviceName, extras, total, tip, employeeNames = '', reviewLink = '') => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200] // 80mm width (thermal printer standard), adjustable height
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let y = 10; // Start Y position

    // --- LOGO TOP ---
    try {
        // Load logo from public folder
        const logoUrl = '/logo.jpg';
        const img = new Image();
        img.src = logoUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Calculate dimensions to fit/center
        const logoWidth = 40; // 40mm wide
        const logoHeight = logoWidth; // Force square for circle
        const logoX = (pageWidth - logoWidth) / 2;

        // Create a canvas to crop the image to a circle
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw circle clip
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw image centered
        const xOffset = (img.width - size) / 2;
        const yOffset = (img.height - size) / 2;
        ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, size, size);

        const roundLogoData = canvas.toDataURL('image/png');

        // Draw Round Logo
        doc.addImage(roundLogoData, 'PNG', logoX, y, logoWidth, logoHeight);

        // Move Y down
        y += logoHeight + 5;

    } catch (e) {
        console.warn('Could not load logo for receipt:', e);
    }
    // ----------------------

    // Helper for centering text
    const centerText = (text, yPos, size = 10, bold = false, font = 'courier') => {
        doc.setFontSize(size);
        doc.setFont(font, bold ? 'bold' : 'normal');
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

    const brand = (transaction.vehicles?.brand && transaction.vehicles.brand !== 'null' && transaction.vehicles.brand !== 'Generico') ? transaction.vehicles.brand : (transaction.customers?.vehicle_brand || '');
    const model = (transaction.vehicles?.model || transaction.customers?.vehicle_model || (Array.isArray(transaction.extras) ? transaction.extras.find(e => e.vehicle_model)?.vehicle_model : transaction.extras?.vehicle_model) || ' VEHICULO');
    const plate = (transaction.vehicles?.plate || transaction.customers?.vehicle_plate || (Array.isArray(transaction.extras) ? transaction.extras.find(e => e.vehicle_plate)?.vehicle_plate : transaction.extras?.vehicle_plate) || ' SIN PLACA');

    doc.setFontSize(9);
    doc.text(`FECHA: ${dateStr} ${timeStr}`, 5, y);
    y += 5;
    doc.text(`CLIENTE: ${(transaction.customers?.name || 'Cliente Casual').toUpperCase()}`, 5, y);
    y += 5;
    doc.text(`AUTO: ${brand.toUpperCase()} ${model.toUpperCase()}`, 5, y);
    y += 4;
    doc.text(`      (${plate.toUpperCase()})`, 5, y);
    y += 5;

    if (employeeNames) {
        doc.text(`ATENDIDO POR:`, 5, y);
        y += 4;
        // Split long names if needed
        const splitNames = doc.splitTextToSize(employeeNames.toUpperCase(), pageWidth - 10);
        doc.text(splitNames, 10, y);
        y += (splitNames.length * 4) + 1;
    }

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
    row('TOTAL', `$${(parseFloat(total) + parseFloat(tip)).toFixed(2)}`, y, 12);
    y += 10;

    doc.setFontSize(10);
    centerText('¡GRACIAS POR SU VISITA!', y);
    y += 5;
    centerText('Vuelva Pronto', y);
    y += 8;

    // Review Link (Prioritize internal private feedback)
    const feedbackUrl = transaction.id ? `${window.location.origin}/feedback/${transaction.id}` : reviewLink;

    if (feedbackUrl) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        centerText('¡Tu opinión nos importa!', y, 10, true, 'helvetica');
        y += 5;

        centerText('¡Califícanos aquí!', y, 9, false, 'helvetica');
        y += 5;

        doc.setTextColor(0, 0, 255); // Blue color for link
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const splitLink = doc.splitTextToSize(feedbackUrl, pageWidth - 10);
        doc.text(splitLink, pageWidth / 2, y, { align: 'center' });

        // Add a clickable link area (approximate for the block)
        doc.link(5, y - 2, pageWidth - 10, splitLink.length * 4, { url: feedbackUrl });

        doc.setTextColor(0, 0, 0); // Reset color
        y += (splitLink.length * 4) + 4;
    }


    // Footer Note
    doc.setFontSize(8);
    const footerNote = "* Si tiene alguna reclamación sobre el servicio, comuníquese al 787-857-8983.";
    const splitFooter = doc.splitTextToSize(footerNote, pageWidth - 10);
    doc.text(splitFooter, pageWidth / 2, y, { align: 'center' });

    // Save
    const filenamePlate = (transaction.vehicles?.plate || transaction.customers?.vehicle_plate || 'auto').replace(/\s+/g, '');
    const fileName = `recibo_${filenamePlate}_${Date.now()}.pdf`;
    const pdfBlob = doc.output('blob');
    return { blob: pdfBlob, fileName, doc };
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

    const tableBody = transactions.map(t => {
        const dateStr = new Date(t.date || t.created_at).toLocaleDateString() + ' ' + new Date(t.date || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const customerName = t.customers?.name || 'Cliente Casual';
        const serviceName = t.services?.name || 'Servicio';

        const brand = (t.vehicles?.brand && t.vehicles.brand !== 'null' && t.vehicles.brand !== 'Generico') ? t.vehicles.brand : (t.customers?.vehicle_brand || '');
        const model = t.vehicles?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Auto';
        const plate = t.vehicles?.plate || t.customers?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate) || '';
        const vehicleStr = `${brand} ${model}${plate ? ` (${plate})` : ''}`.trim();

        return [
            dateStr,
            `${customerName}\n(${vehicleStr})`, // Combine name and vehicle
            serviceName,
            t.payment_method === 'cash' ? 'Efectivo' : t.payment_method === 'card' ? 'Tarjeta' : 'Ath Móvil',
            `$${(parseFloat(t.price) || 0).toFixed(2)}`
        ];
    });

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

export const generateMembershipTermsPDF = async (customerName = '', membershipName = '', vehicleInfo = '', startDate = '') => {
    // Carta size (Letter): 215.9 x 279.4 mm
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter' // Standard Letter size for documents
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // --- LOGO TOP ---
    try {
        const logoUrl = '/logo.jpg';
        const img = new Image();
        img.src = logoUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const logoWidth = 35;
        const logoHeight = logoWidth;
        const logoX = margin;

        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const xOffset = (img.width - size) / 2;
        const yOffset = (img.height - size) / 2;
        ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, size, size);

        const roundLogoData = canvas.toDataURL('image/png');

        doc.addImage(roundLogoData, 'PNG', logoX, y, logoWidth, logoHeight);

        // Header Text aligned next to logo
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text('Términos y Condiciones', logoX + logoWidth + 10, y + 15);

        doc.setFontSize(14);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text('Programa de Membresías', logoX + logoWidth + 10, y + 23);

        y += Math.max(logoHeight, 30) + 15;

    } catch (e) {
        console.warn('Could not load logo for T&C:', e);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Términos y Condiciones - Membresías', margin, y + 10);
        y += 25;
    }

    doc.setLineWidth(0.5);
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.line(margin, y - 5, pageWidth - margin, y - 5);
    y += 5;

    // Optional: Personalization
    if (customerName || membershipName || vehicleInfo || startDate) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text('Detalles de membresías:', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        if (customerName) {
            doc.text(`Cliente: ${customerName}`, margin, y);
            y += 6;
        }
        if (membershipName) {
            let planText = `Plan Seleccionado: ${membershipName}`;
            if (startDate) {
                planText += ` (Inicio: ${startDate})`;
            }
            doc.text(planText, margin, y);
            y += 6;
        }
        if (vehicleInfo) {
            doc.text(`Vehículo Suscrito: ${vehicleInfo}`, margin, y);
            y += 6;
        }
        y += 5;
        doc.line(margin, y - 5, pageWidth - margin, y - 5);
        y += 5;
    }

    // --- Content Details ---
    const sections = [
        {
            title: '1. Condiciones Generales',
            content: 'La membresía de Express CarWash es un acuerdo de servicio prepagado que otorga beneficios exclusivos al cliente suscrito. La membresía está ligada a un (1) solo vehículo especificado al momento de la inscripción a través de su tablilla (placa).'
        },
        {
            title: '2. Uso y Transferencia',
            content: 'Los beneficios de la membresía (lavados limitados o ilimitados según el plan) son intransferibles y no pueden ser aplicados a un vehículo diferente al registrado originalmente. Cualquier intento de usar la membresía en un vehículo no autorizado resultará en la cancelación inmediata del servicio sin derecho a reembolso.'
        },
        {
            title: '3. Condiciones del Vehículo (Suciedad Extrema)',
            content: 'Los planes de membresía cubren un nivel de suciedad regular generado por el uso cotidiano. En situaciones donde el vehículo presente condiciones de suciedad extrema (tales como lodo excesivo, derrames severos, exceso de pelo de mascota o acumulación profunda de residuos), Express CarWash se reserva el derecho de aplicar un cargo adicional por reacondicionamiento. Dicho cargo será evaluado e informado al cliente previo a comenzar el servicio.'
        },
        {
            title: '4. Pagos y Ciclo de Facturación',
            content: 'El cargo de la membresía se realiza de manera anticipada. El ciclo de beneficios es mensual o anual, dependiendo del acuerdo. No se emitirán reembolsos parciales o totales por meses no utilizados o por cancelación a mitad del ciclo.'
        },
        {
            title: '5. Renovación Automática de Lavados (Límites)',
            content: 'Para los planes con límite de lavados (Ej. "Plan Smart"), el sistema restablecerá la cantidad de usos disponibles automáticamente a los 30 días de su fecha de corte original. Los lavados no utilizados durante un mes no son acumulables ni se transfieren al mes siguiente.'
        },
        {
            title: '6. Cancelación de Membresía',
            content: 'El cliente puede cancelar su membresía en cualquier momento solicitándolo directamente a la administración. La cancelación detendrá futuras renovaciones o facturaciones, pero el cliente podrá seguir disfrutando de sus beneficios restantes hasta que finalice el ciclo pre-pagado actual.'
        },
        {
            title: '7. Limitaciones de Responsabilidad',
            content: 'Express CarWash se reserva el derecho de cerrar sus facilidades temporalmente debido a inclemencias del tiempo, mantenimiento de equipos, o días feriados. Estos cierres no otorgan derecho a prórrogas o devoluciones sobre el pago de la membresía.'
        },
        {
            title: '8. Modificaciones a los Términos',
            content: 'Express CarWash se reserva el derecho de modificar las tarifas, planes o estos términos y condiciones. Cualquier cambio será notificado al cliente con al menos 15 días de anticipación.'
        }
    ];

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate-700
    doc.setFont('helvetica', 'normal');

    sections.forEach(sec => {
        // Check Page break before Title
        if (y > pageHeight - margin - 20) {
            doc.addPage();
            y = margin;
        }

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text(sec.title, margin, y);
        y += 5;

        // Content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105); // Slate-600

        const splitText = doc.splitTextToSize(sec.content, contentWidth);
        const textHeight = splitText.length * 5; // Approx 5mm per line

        // Check page break during content
        if (y + textHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        doc.text(splitText, margin, y);
        y += textHeight + 6; // Add space between sections
    });

    y += 10;

    // Check page break for signatures
    if (y + 40 > pageHeight - margin) {
        doc.addPage();
        y = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Al recibir este documento o activar su suscripción, usted acepta los términos y condiciones estipulados.', margin, y);

    y += 30;

    // Signature Lines
    doc.setLineWidth(0.3);
    doc.setDrawColor(148, 163, 184); // Slate-400

    const signatureWidth = 70;
    const centerGap = 20;
    const adminSigX = (pageWidth / 2) - signatureWidth - (centerGap / 2);
    const clientSigX = (pageWidth / 2) + (centerGap / 2);

    doc.line(adminSigX, y, adminSigX + signatureWidth, y);
    doc.line(clientSigX, y, clientSigX + signatureWidth, y);

    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Express CarWash', adminSigX + (signatureWidth / 2), y, { align: 'center' });
    doc.text('Firma del Cliente', clientSigX + (signatureWidth / 2), y, { align: 'center' });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(`Generado: ${new Date().toLocaleDateString('es-PR')}`, margin, pageHeight - 10);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    const nameForFile = customerName ? customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'generico';
    const fileName = `TyC_Membresia_${nameForFile}.pdf`;
    const blob = doc.output('blob');

    return { blob, fileName, doc };
};
