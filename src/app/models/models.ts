import { UserRole } from '../services/store/auth-store';
import { Category, ClientType, Size_id, Unit_id } from './enums';

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

export type Stock = {
  id: number;
  product_id: number;
  stock: number;
  booked_stock: number;
};

export type ProductWithStock = {
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
  stock: Stock;
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

export type ExactOrderItem = {
  product_id: number;
  order_id: number;
  quantity: number;
  category_id: Category;
  price: number;
  item_status?: boolean;
  packs_pieces?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  approved: boolean;
  role: UserRole;
};

export type Client = {
  id: number;
  type: ClientType;
  name: string;
  address: string | null;
  code: string | null;
  other_details: string | null;
  client_phones?: ClientPhones;
};

export type ClientPhones = {
  id: number;
  client_id: number;
  phone: string;
  label: string;
}[];

export type Operators = {
  id: string;
  updated: Date;
  name: string;
};

export type OrderItems = {
  id: number;
  productId: number;
  orderId: number;
  quantity: number;
  categoryId: Category;
  price: number;
  item_status: boolean;
};

export type OrderItemsResponse = {
  id: number;
  product: {
    id: number;
    name: string;
    unit_id: number;
    thickness: number;
    width: number;
    length: number;
  };
  orderId: number;
  quantity: number;
  category: { name: string };
  price: number;
  itemStatus: boolean;
  packsPieces?: string;
};

export type Order = {
  id: number;
  sortOrder: number;
  clientId: number;
  dateOrderPlaced: Date;
  expectedDelivery: Date;
  dateOrderDelivered: Date;
  untilDeliveryDate: boolean;
  forFirstHour: boolean;
  totalAmount: number;
  operatorId: string;
  totalAmountFinal: number;
  totalQuantity: number;
  paidAmount: number;
  deliveryFee: number;
  comment: string;
  voucher: string;
};

export type OrderResponse = {
  id: number;
  sortOrder: number;
  clientId: number;
  dateOrderPlaced: Date;
  expectedDelivery: Date;
  dateOrderDelivered: Date;
  untilDeliveryDate: boolean;
  forFirstHour: boolean;
  totalAmount: number;
  totalAmountFinal: number;
  totalQuantity: number;
  paidAmount: number;
  deliveryFee: number;
  comment: string;
  voucher: string;
  operator: { id: string; name: string };
  delivery_address: string;
};

export type Price2 = {
  id: number;
  unit_id: Unit_id;
  category_id: Category;
  size_id: Size_id;
  price: number;
  product_id: number;
};

export type PriceResponse2 = {
  id: number;
  unit_id: Unit_id;
  category_id: Category;
  size_id: Size_id;
  price: number;
  product: { id: number; name: string };
};

export type ComingWares = {
  id: number;
  expected_delivery: Date;
  name: string;
  total_quantity: number;
  all_for_order: boolean;
  comment: string;
  verified: boolean;
};

export type ComingWaresItems = ComingWaresItem[];

export type ComingWaresItem = {
  id?: number;
  order_id: number;
  product_id: number;
  category: Category;
  quantity: number;
  for_order: boolean;
  is_correct?: boolean | null;
  comment: string;
};

export type ComingWaresItemResponse = {
  id: number;
  order_id: number;
  product: { id: number; name: string; unit_id: Unit_id };
  category: { name: string };
  quantity: number;
  for_order: boolean;
  is_correct?: boolean | null;
  comment: string;
};
