# TanStack Query Migration Guide

## Why TanStack Query?

TanStack Query (React Query) provides significant benefits for reducing egress:

1. **Request Deduplication**: If multiple components request the same data simultaneously, only one request is made
2. **Client-Side Caching**: Data is cached in memory, reducing redundant API calls
3. **Automatic Background Refetching**: Keeps data fresh without manual refresh
4. **Optimistic Updates**: Update UI immediately, sync with server in background
5. **Better Loading/Error States**: Built-in handling reduces boilerplate

## Installation

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

## Setup

The provider is already set up in `src/lib/react-query.tsx` and added to `src/app/layout.tsx`.

## Migration Example: HourRegistrationsTable

### Before (Current Implementation)

```typescript
const [registrations, setRegistrations] = useState<HourRegistration[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchRegistrations(1);
}, []);

const fetchRegistrations = async (page: number = 1) => {
  try {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: "100",
      paginate: "true",
    });
    const response = await fetch(`/api/hour-registrations?${params}`);
    if (response.ok) {
      const result = await response.json();
      setRegistrations(result.data || []);
    }
  } catch (error) {
    console.error("Error fetching hour registrations:", error);
  } finally {
    setLoading(false);
  }
};
```

### After (With TanStack Query)

```typescript
import { useHourRegistrations, useDeleteHourRegistration } from "@/hooks/use-hour-registrations";

export function HourRegistrationsTable() {
  const { data, isLoading, error } = useHourRegistrations(1, undefined, true);
  const deleteMutation = useDeleteHourRegistration();

  const registrations = data?.data || [];
  const loading = isLoading;

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this hour registration?")) {
      return;
    }
    deleteMutation.mutate(id);
  };

  // ... rest of component
}
```

## Benefits for Your Use Case

### 1. Request Deduplication
If `HourRegistrationsTable`, `HourStatsCards`, and `HourChart` all fetch hour registrations:
- **Before**: 3 separate API calls
- **After**: 1 API call, shared across all components

### 2. Automatic Caching
- Data cached for 30 seconds (matches your API cache)
- Navigating away and back won't trigger new requests if data is fresh
- Background refetch keeps data up-to-date

### 3. Optimistic Updates
When creating/updating/deleting:
- UI updates immediately
- Server sync happens in background
- Automatic rollback on error

### 4. Reduced Egress
- Fewer redundant requests
- Better cache utilization
- Automatic request deduplication

## Migration Strategy

1. **Start with one component** (e.g., `HourRegistrationsTable`)
2. **Create hooks** for that component's data (see `src/hooks/use-hour-registrations.ts`)
3. **Migrate gradually** - TanStack Query works alongside existing fetch calls
4. **Monitor egress** - You should see immediate reduction

## Example Hooks to Create

- `use-hour-registrations.ts` ✅ (created)
- `use-invoices.ts`
- `use-expenses.ts`
- `use-projects.ts`
- `use-users.ts`

## Next Steps

1. Install TanStack Query: `pnpm add @tanstack/react-query @tanstack/react-query-devtools`
2. Test the setup with one component
3. Gradually migrate other components
4. Monitor Supabase egress to see the improvement
