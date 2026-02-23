require('dotenv').config();
const { supabase } = require('./src/config/database');

const menuItems = [
    { name: 'Hamburguesa Clásica', price: 500, stock: 100, category: 'Hamburguesas' },
    { name: 'Hamburguesa Doble', price: 700, stock: 100, category: 'Hamburguesas' },
    { name: 'Pizza Muzzarella', price: 800, stock: 100, category: 'Pizzas' },
    { name: 'Pizza Especial', price: 1000, stock: 100, category: 'Pizzas' },
    { name: 'Papas Fritas', price: 300, stock: 100, category: 'Guarniciones' },
    { name: 'Coca Cola / Sprite', price: 200, stock: 100, category: 'Bebidas' }
];

(async () => {
    console.log("Seeding database with menu items...");
    
    const { data, error } = await supabase
        .from('products')
        .insert(menuItems)
        .select();

    if (error) {
        console.error("Error inserting products:", error);
    } else {
        console.log(`Successfully added ${data.length} products:`);
        data.forEach(p => console.log(`- ${p.name} ($${p.price})`));
    }
})();
