import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type ArtistInput } from "@shared/routes";

export function useArtists(category?: string) {
  return useQuery({
    queryKey: [api.artists.list.path, category],
    queryFn: async () => {
      const url = category
        ? `${api.artists.list.path}?category=${encodeURIComponent(category)}`
        : api.artists.list.path;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch artists");
      return api.artists.list.responses[200].parse(await res.json());
    },
    staleTime: 30_000,
  });
}

export function useArtist(id: number) {
  return useQuery({
    queryKey: [api.artists.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.artists.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch artist details");
      return api.artists.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateArtist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ArtistInput) => {
      const validated = api.artists.create.input.parse(data);
      const res = await fetch(api.artists.create.path, {
        method: api.artists.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.artists.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create artist");
      }
      return api.artists.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.artists.list.path] });
    },
  });
}
