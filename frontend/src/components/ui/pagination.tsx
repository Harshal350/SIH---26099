import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of{" "}
        <span className="font-medium">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          className="rounded-md p-1.5 hover:bg-muted disabled:opacity-40"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-sm">
          Page {page + 1} / {pages}
        </span>
        <button
          className="rounded-md p-1.5 hover:bg-muted disabled:opacity-40"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function usePagination(pageSize = 10) {
  return { pageSize };
}
