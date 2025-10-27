"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/SearchBar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Property, SearchFilters } from "@/types";

const mockProperties: Property[] = [
  {
    id: "1",
    title: "Modern Downtown Loft",
    description: "Stylish loft in the heart of downtown with exposed brick and modern amenities.",
    price: 2400,
    beds: 2,
    baths: 2,
    sqft: 1200,
    location: "Downtown",
    images: [],
    amenities: ["Parking", "Gym", "Rooftop"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "2",
    title: "Cozy Suburban House",
    description: "Perfect family home with a large backyard and quiet neighborhood.",
    price: 1800,
    beds: 3,
    baths: 2,
    sqft: 1800,
    location: "Suburbs",
    images: [],
    amenities: ["Garage", "Garden", "School District"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "3",
    title: "Luxury City Apartment",
    description: "High-end apartment with city views and premium finishes.",
    price: 3200,
    beds: 1,
    baths: 1,
    sqft: 900,
    location: "City Center",
    images: [],
    amenities: ["Concierge", "Pool", "City Views"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "4",
    title: "Charming Studio",
    description: "Compact studio perfect for young professionals.",
    price: 1200,
    beds: 1,
    baths: 1,
    sqft: 500,
    location: "Midtown",
    images: [],
    amenities: ["Laundry", "Near Transit"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "5",
    title: "Spacious Townhouse",
    description: "Three-story townhouse with private entrance and modern kitchen.",
    price: 2800,
    beds: 4,
    baths: 3,
    sqft: 2200,
    location: "Residential",
    images: [],
    amenities: ["Private Entrance", "Modern Kitchen", "Storage"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "6",
    title: "Historic Brownstone",
    description: "Renovated brownstone with original character and modern updates.",
    price: 3500,
    beds: 3,
    baths: 2,
    sqft: 2000,
    location: "Historic District",
    images: [],
    amenities: ["Original Features", "Renovated", "Historic"],
    available: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export default function ProductsPage() {
	const [isSearching, setIsSearching] = useState(false);
	const [searchFilters, setSearchFilters] = useState<SearchFilters>({});

	const filteredProperties = useMemo(() => {
		return mockProperties.filter(property => {
			if (searchFilters.location && !property.location.toLowerCase().includes(searchFilters.location.toLowerCase())) {
				return false;
			}
			if (searchFilters.minPrice && property.price < searchFilters.minPrice) {
				return false;
			}
			if (searchFilters.maxPrice && property.price > searchFilters.maxPrice) {
				return false;
			}
			if (searchFilters.beds && property.beds < searchFilters.beds) {
				return false;
			}
			if (searchFilters.baths && property.baths < searchFilters.baths) {
				return false;
			}
			return true;
		});
	}, [searchFilters]);

	const handleSearch = async (filters: SearchFilters) => {
		setIsSearching(true);
		setSearchFilters(filters);
		// Simulate API call delay
		setTimeout(() => setIsSearching(false), 1000);
	};

	return (
		<section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
			<h1 className="text-2xl font-semibold tracking-tight mb-6">Properties</h1>
			<p className="text-black/70 dark:text-white/70 mb-8 max-w-2xl">
				Browse our curated selection of quality rental properties. All listings are verified and regularly updated.
			</p>
			
			<SearchBar onSearch={handleSearch} loading={isSearching} />

			{isSearching ? (
				<div className="flex justify-center py-12">
					<LoadingSpinner size="lg" />
				</div>
			) : (
				<>
					<div className="mb-4">
						<p className="text-sm text-gray-600 dark:text-gray-400">
							Showing {filteredProperties.length} of {mockProperties.length} properties
						</p>
					</div>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{filteredProperties.map((property) => (
							<Card key={property.id} hover className="overflow-hidden">
								<div className="aspect-video bg-gray-200 dark:bg-gray-700" />
								<div className="p-6">
									<h2 className="font-semibold text-lg text-gray-900 dark:text-white">{property.title}</h2>
									<p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{property.description}</p>
									<p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
										{property.beds} bed · {property.baths} bath · {property.sqft} sqft
									</p>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{property.location}</p>
									<div className="flex items-center justify-between mt-4">
										<p className="text-xl font-bold text-blue-600 dark:text-blue-400">${property.price}/month</p>
										<Button size="sm">View Details</Button>
									</div>
								</div>
							</Card>
						))}
					</div>
					{filteredProperties.length === 0 && (
						<div className="text-center py-12">
							<p className="text-gray-500 dark:text-gray-400">No properties found matching your criteria.</p>
						</div>
					)}
				</>
			)}
		</section>
	);
}

