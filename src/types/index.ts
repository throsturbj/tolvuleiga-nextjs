export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  location: string;
  images: string[];
  amenities: string[];
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactForm {
  name: string;
  email: string;
  message: string;
}

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  location?: string;
  amenities?: string[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

