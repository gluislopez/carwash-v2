const fs = require('fs');
const file = './src/pages/CustomerPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update Portal Header: Hola, [Nombre] -> Hola, [Nombre] #0001
// Find: <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b' }}>Hola, {customer.name}</h2>
/* Replace with:
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Hola, {customer.name}</h2>
    <span style={{ fontSize: '0.9rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '600' }}>#{customer.id.toString().padStart(4, '0')}</span>
</div>
*/
content = content.replace(
    /<h2 style={{ fontSize: '1\.4rem', fontWeight: 'bold', color: '#1e293b' }}>Hola, {customer\.name}<\/h2>/g,
    `<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Hola, {customer.name}</h2>
                            <span style={{ fontSize: '0.9rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '600' }}>#{customer.id.toString().padStart(4, '0')}</span>
                        </div>`
);

fs.writeFileSync(file, content);
console.log("CustomerPortal.jsx updated");
