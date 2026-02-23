export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    stock: number;
    image_url?: string;
    category?: string;
    created_at?: string;
}

export interface IProductRepository {
    getById(id: string): Promise<Product | null>;
    getAll(filters?: { category?: string; search?: string }): Promise<Product[]>;
    updateStock(id: string, newStock: number): Promise<void>;
}
