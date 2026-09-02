export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function success<T>(data: T, meta?: PaginationMeta) {
  return meta !== undefined ? { data, meta } : { data };
}

export function paginated<T>(data: T[], page: number, limit: number, total: number) {
  const p = Math.max(1, page);
  const l = Math.max(1, limit);
  return {
    data,
    meta: {
      page: p,
      limit: l,
      total,
      hasMore: p * l < total,
    },
  };
}

export function error(code: string, message: string, details?: unknown, requestId?: string) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    ...(requestId ? { requestId } : {}),
  };
}
