export interface Product {
  id: string;
  name: string;
  retailer: string;
  price: string;
  imageUrl: string | null;
  imageCategory?: string | null;
  productUrl?: string | null;
  purchaseUrl?: string | null;
  affiliateUrl?: string | null;
}

export interface AnalysisResult {
  result: string;
  metadata: {
    category: string;
    color: string;
    silhouette: string;
  };
  products: Product[];
}
