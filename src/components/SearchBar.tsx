"use client";

import { useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { SearchFilters } from "@/types";

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

export default function SearchBar({ onSearch, loading = false }: SearchBarProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    location: "",
    minPrice: undefined,
    maxPrice: undefined,
    beds: undefined,
    baths: undefined
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleInputChange = (field: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === "" ? undefined : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          label="Location"
          placeholder="City, neighborhood..."
          value={filters.location || ""}
          onChange={(e) => handleInputChange("location", e.target.value)}
        />
        <Input
          label="Min Price"
          type="number"
          placeholder="$0"
          value={filters.minPrice || ""}
          onChange={(e) => handleInputChange("minPrice", parseInt(e.target.value) || 0)}
        />
        <Input
          label="Max Price"
          type="number"
          placeholder="$5000"
          value={filters.maxPrice || ""}
          onChange={(e) => handleInputChange("maxPrice", parseInt(e.target.value) || 0)}
        />
        <Input
          label="Bedrooms"
          type="number"
          placeholder="Any"
          value={filters.beds || ""}
          onChange={(e) => handleInputChange("beds", parseInt(e.target.value) || 0)}
        />
        <Input
          label="Bathrooms"
          type="number"
          placeholder="Any"
          value={filters.baths || ""}
          onChange={(e) => handleInputChange("baths", parseInt(e.target.value) || 0)}
        />
      </div>
      <div className="flex justify-end mt-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>
    </form>
  );
}
