interface Props {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pageCount} · {total} {total === 1 ? "product" : "products"}
      </span>
      <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
