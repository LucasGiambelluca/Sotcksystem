export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category?: string;
  created_at: string;
}

export interface Movement {
  id: string;
  client_id: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  description: string | null;
  created_at: string;
}
