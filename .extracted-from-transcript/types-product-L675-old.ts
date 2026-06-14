export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export interface Product {
  id: string;
  systemCode: number;
  barcode?: string;
  name: string;
  brand?: string;
  providerId?: string;
  providerName?: string;
  line: string;
  category: string;
  subcategory?: string;
  unit: string;
  salePrice: number;
  costPrice?: number;
  stockAccounting: number;
  stockAvailable: number;
  minStock: number;
  maxStock?: number;
  location?: string;
  status: ProductStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}