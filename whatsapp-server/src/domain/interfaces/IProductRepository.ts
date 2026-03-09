export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    stock: number;         // Current Warehouse Stock
    production_stock: number; // Current Production Stock
    min_stock: number;     // Minimum stock threshold for Warehouse
    image_url?: string;
    category?: string;
    is_special?: boolean;
    special_price?: number;
    offer_label?: string;
    created_at?: string;
}

export interface IProductRepository {
    getById(id: string): Promise<Product | null>;
    getAll(filters?: { category?: string; search?: string }): Promise<Product[]>;
    updateStock(id: string, newStock: number): Promise<void>;
}
