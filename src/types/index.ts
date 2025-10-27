export interface ContactForm {
  name: string;
  email: string;
  message: string;
}

// Product-related types removed as the products listing feature was deleted

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

