import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { User } from "lucide-react";
import { getPhotoUrl } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export function usePhotoUrl(path: string | null | undefined) {
  const fetchUrl = useServerFn(getPhotoUrl);
  return useQuery({
    queryKey: ["photo", path],
    queryFn: () => fetchUrl({ data: { path: path ?? "" } }),
    enabled: !!path,
    staleTime: 8 * 60_000,
  });
}

export function PhotoThumb({
  path,
  className,
  size = "sm",
  onClick,
}: {
  path: string | null | undefined;
  className?: string;
  size?: "sm" | "lg";
  onClick?: () => void;
}) {
  const { data } = usePhotoUrl(path);
  const base = size === "sm" ? "size-11 rounded-full" : "aspect-square w-full rounded-2xl";
  if (!path) {
    return (
      <div className={cn(base, "grid shrink-0 place-items-center bg-muted text-muted-foreground", className)}>
        <User className={size === "sm" ? "size-5" : "size-12"} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, "shrink-0 overflow-hidden bg-muted ring-1 ring-border", onClick && "cursor-zoom-in", className)}
    >
      {data?.url ? (
        <img src={data.url} alt="Foto do cliente" className="size-full object-cover" />
      ) : (
        <div className="size-full animate-pulse bg-muted" />
      )}
    </button>
  );
}
