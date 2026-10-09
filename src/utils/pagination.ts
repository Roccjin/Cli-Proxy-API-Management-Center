export interface Pagination<T> {
  pageItems: T[];
  currentPage: number;
  totalPages: number;
}

/** Clamp an out-of-range page onto the last page instead of an empty one. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Pagination<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
  };
}
