const customers = [
    { id: 1, name: "Geraldo", customer_number: 5, vehicle_plate: null },
    { id: 2, name: "Maria", customer_number: 14, vehicle_plate: "OLD-123" }
];

const allVehicles = {
    1: [{ plate: "KFK-035", brand: "Toyota", model: "Corolla" }]
};

function testSearch(searchTerm) {
    return customers.filter(c => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;

        const matchesNumber = c.customer_number && (c.customer_number.toString().padStart(2, '0') === term || c.customer_number.toString() === term || `#${c.customer_number.toString().padStart(2, '0')}`.includes(term));
        const matchesName = c.name && c.name.toLowerCase().includes(term);
        const matchesPhone = c.phone && c.phone.includes(term);

        let matchesVehicle = (c.vehicle_plate && c.vehicle_plate.toLowerCase().includes(term)) ||
            (c.vehicle_model && c.vehicle_model.toLowerCase().includes(term));

        if (!matchesVehicle && allVehicles[c.id]) {
            matchesVehicle = allVehicles[c.id].some(v =>
                (v.plate && v.plate.toLowerCase().includes(term)) ||
                (v.model && v.model.toLowerCase().includes(term)) ||
                (v.brand && v.brand.toLowerCase().includes(term))
            );
        }

        return matchesNumber || matchesName || matchesPhone || matchesVehicle;
    }).map(c => c.name);
}

console.log("Search '05' ->", testSearch("05")); // Should match Geraldo
console.log("Search '5' ->", testSearch("5")); // Should match Geraldo
console.log("Search '#05' ->", testSearch("#05")); // Should match Geraldo
console.log("Search 'KFK' ->", testSearch("KFK")); // Should match Geraldo
console.log("Search 'kfk' ->", testSearch("kfk")); // Should match Geraldo
console.log("Search '123' ->", testSearch("123")); // Should match Maria
console.log("Search '#14' ->", testSearch("#14")); // Should match Maria
