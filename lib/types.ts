export interface Variant {
  articleNumber: string;
  storage: string;
  color: string;
  colorHex: string;
  connectivity: "WiFi" | "WiFi + Cellular" | null;
  imageUrl?: string;
}

export interface Model {
  name: string;
  variants: Variant[];
}

export interface Category {
  name: string;
  models: Model[];
}

export interface ProductCatalog {
  categories: Category[];
}

export interface StoreStock {
  id: string;
  name: string;
  address: string;
  available: boolean;
  pickup: boolean;
  stockLevel: "high" | "low" | "none";
}

export interface OnlineAvailability {
  available: boolean;
  deliveryDays: string;
}

export interface StockResponse {
  product: string;
  articleNumber: string;
  stores: StoreStock[];
  online: OnlineAvailability;
  cachedAt: string;
  _source?: "json-ld" | "graphql" | "html-text";
  _error?: string;
}
