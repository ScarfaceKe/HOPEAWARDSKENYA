import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES, type AwardCategoryOption } from "@shared/schema";

/**
 * The built-in list, shaped like the API response. It is what the first paint
 * renders while the live list is in flight, and what the site falls back to if
 * the API cannot be reached, so nothing regresses on a slow or offline load.
 */
const SEED: AwardCategoryOption[] = CATEGORIES.map(({ id, name, group }) => ({ id, name, group }));

/**
 * The award categories, including any an admin added in the panel.
 *
 * The list lives in the database (`/api/categories`), not in the bundle: a
 * category added at 9pm has to be nominable at 9:01pm without a redeploy.
 */
export function useCategories() {
  const query = useQuery<AwardCategoryOption[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load categories");
      const body: unknown = await res.json();
      if (!Array.isArray(body) || body.length === 0) throw new Error("Failed to load categories");
      return body as AwardCategoryOption[];
    },
    staleTime: 60_000,
  });

  const categories = query.data && query.data.length > 0 ? query.data : SEED;
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  return {
    categories,
    /** True once the list came from the server rather than the built-in fallback. */
    isLive: !!query.data && query.data.length > 0,
    isLoading: query.isLoading,
    getCategory: (id: string) => byId.get(id),
    categoryName: (id: string) => byId.get(id)?.name ?? id,
  };
}
