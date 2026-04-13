import { useQuery } from "@tanstack/react-query";
import { organizationKeys } from "./use-organizations";

interface CompanyProject {
  id: string;
  slug: string;
  title: string;
  status: string;
  subtotal: string | null;
  currency: string;
  type: string;
  startDate: string | null;
  deadline: string | null;
  totalHours: string;
}

interface CompanyRevenue {
  paidAllTime: string;
  outstandingAllTime: string;
  paidCurrentYear: string;
  outstandingCurrentYear: string;
}

interface CompanyHours {
  allTime: string;
  currentYear: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  imageStoragePath: string | null;
  imageSizeBytes: number | null;
  address: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  email: string | null;
  telephone: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetails {
  company: CompanyInfo;
  projects: CompanyProject[];
  revenue: CompanyRevenue;
  hours: CompanyHours;
}

async function fetchCompanyDetails(id: string): Promise<CompanyDetails> {
  const response = await fetch(`/api/organizations/${id}/details`);
  if (!response.ok) {
    throw new Error("Failed to fetch company details");
  }
  return response.json();
}

export function useCompanyDetails(companyId: string) {
  return useQuery({
    queryKey: organizationKeys.detail(companyId),
    queryFn: () => fetchCompanyDetails(companyId),
    enabled: !!companyId,
    staleTime: 0,
  });
}
