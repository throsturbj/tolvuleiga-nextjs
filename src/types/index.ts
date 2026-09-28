export interface ContactForm {
  name: string;
  email: string;
  message: string;
}

// Shared catalog types live in src/lib/products.ts

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

