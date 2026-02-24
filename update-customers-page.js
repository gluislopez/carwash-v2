const fs = require('fs');
const file = './src/pages/Customers.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the search filter logic to include customer ID
// Find: c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
// Replace with: c.id.toString() === searchTerm.trim() || c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
content = content.replace(
    /c\.name\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\) \|\|/g,
    `c.id.toString() === searchTerm.trim() ||\n        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||`
);

// 2. Add the Customer ID badge to the customer card header
// Find: <h3 style={{ fontWeight: 'bold' }}>{customer.name}</h3>
// Replace with: <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>{customer.name}</span><span style={{ fontSize: '0.8rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'normal' }}>#{customer.id.toString().padStart(4, '0')}</span></h3>
content = content.replace(
    /<h3 style={{ fontWeight: 'bold' }}>{customer\.name}<\/h3>/g,
    `<h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>{customer.name}</span><span style={{ fontSize: '0.8rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'normal' }}>#{customer.id.toString().padStart(4, '0')}</span></h3>`
);

// 3. Add the Customer ID to the Edit Customer Modal Title
// Find: <h3 style={{ marginBottom: '1.5rem' }}>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
// Replace with: <h3 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</span>{editingCustomer && <span style={{ fontSize: '1rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>#{editingCustomer.id.toString().padStart(4, '0')}</span>}</h3>
content = content.replace(
    /<h3 style={{ marginBottom: '1\.5rem' }}>{editingCustomer \? 'Editar Cliente' : 'Nuevo Cliente'}<\/h3>/g,
    `<h3 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</span>{editingCustomer && <span style={{ fontSize: '1rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>#{editingCustomer.id.toString().padStart(4, '0')}</span>}</h3>`
);

// 4. Update the Search Bar Placeholder
// Find: placeholder="Buscar por nombre, tablilla o teléfono..."
// Replace with: placeholder="Buscar por # cliente, nombre, tablilla o teléfono..."
content = content.replace(
    /placeholder="Buscar por nombre, tablilla o teléfono\.\.\."/g,
    `placeholder="Buscar por # cliente, nombre, tablilla o teléfono..."`
);

fs.writeFileSync(file, content);
console.log("Customers.jsx updated");
