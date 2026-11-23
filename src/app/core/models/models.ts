import { UserRole } from '@core/store/auth-store';
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

/** One grade's stock of a product (A, AB or B; T is kept in A). */
export type Stock = {
  id: number;
  product_id: number;
  category_id: StockCategory;
  stock: number;
  booked_stock: number;
};

/** The grades that hold stock. */
export type StockCategory = Category.A | Category.AB | Category.B;

/** A product's stock rows by grade; a grade the product has no row for is missing. */
export type GradedStock = Partial<Record<StockCategory, Stock>>;

export type ProductItems = ProductItem[];

export type ProductItem = {
  product: Product;
  quantity: number;
  price: number;
  category: Category;
  packsNeeded?: number;
  extraPiecesNeeded?: number;
  manualPrice?: boolean;
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
  tva: boolean;
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
  deletedAt?: Date;
  /** true for an offer, false for an order */
  justOffer?: boolean;
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

export type ShipmentStatus = 'draft' | 'validated';

/** A truck delivery. Its lines enter AB stock when it is validated. */
export type Shipment = {
  id: number;
  arrived_on: string;
  name: string;
  comment: string;
  status: ShipmentStatus;
  created_at: string;
  validated_at: string | null;
};

/** One line of a truck delivery, in pieces; always AB. */
export type ShipmentItem = {
  id?: number;
  shipment_id?: number;
  product_id: number;
  quantity: number;
};

export type ShipmentWithItems = Shipment & { shipment_items: ShipmentItem[] };

/** AB pieces sorted into A, B and waste at the sorting ramp. */
export type StockSorting = {
  id: number;
  product_id: number;
  shipment_id: number | null;
  qty_a: number;
  qty_b: number;
  qty_waste: number;
  comment: string;
  created_at: string;
};

export type UsedPricesInOrder = {
  unit: Unit_id;
  category: Category;
  price: number;
  discount: number;
  size: Size_id;
  productId?: number;
}[];

export const M2_QUANTITIES = ['BRUT', 'NET', 'BUC', 'PAC'] as const;
export type M2Quantities = (typeof M2_QUANTITIES)[number];
