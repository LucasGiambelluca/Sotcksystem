// Import the existing configured client
const { supabase } = require('../../config/database');
import { SupabaseProductRepository } from './SupabaseProductRepository';

// Initialize repositories with the concrete Supabase client implementation
export const productRepository = new SupabaseProductRepository(supabase);

// Future repositories will go here:
// export const orderRepository = new SupabaseOrderRepository(supabase);
// export const userRepository = new SupabaseUserRepository(supabase);
