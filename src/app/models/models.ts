import { Category, ClientType, OrderStatus, Size_id, Unit_id } from './enums';

export type Products = Product[];

export type Product = {
  id: number;
  name: string;
  unit_id: Unit_id;
  size_id: Size_id;
  thickness: number;
  width: number;
  length: number;
  m2_util: number;
  m2_brut: number;
  piece_per_pack: number;
};

export type ProductItems = ProductItem[];

export type ProductItem = {
  product: Product;
  quantity: number;
  price: number;
  category: Category;
  packsNeeded?: number;
  extraPiecesNeeded?: number;
};

export type Client = {
  id: number;
  type: ClientType;
  name: string;
  address: string | null;
  code: string | null;
  phone: string;
  other_details: string | null;
  delivery_address: string | null;
};

export type Operators = {
  id: string;
  updated: Date;
  name: string;
};

export type OrderItems = {
  id: number;
  productId: number;
  orderId: number;
  statusCode: OrderStatus;
  quantity: number;
  categoryId: Category;
  price: number;
};

export type Order = {
  id: number;
  clientId: number;
  status: OrderStatus;
  dateOrderPlaced: Date;
  expectedDelivery: Date;
  dateOrderDelivered: Date;
  totalAmount: number;
  operatorId: string;
  totalAmountFinal: number;
  comment: string;
};

export type Price = {
  id: number;
  unit_id: Unit_id;
  category_id: Category;
  size_id: Size_id;
  price: number;
  product_id: number;
};
