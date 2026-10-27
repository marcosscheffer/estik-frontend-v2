import { api } from "@/lib/api";
import { cleanParams } from "@/lib/format";
import type {
  CategoryRequest,
  CategoryResponse,
  CategorySummaryResponse,
  ItemRequest,
  ItemResponse,
  ItemSummaryResponse,
  PageParams,
  PageResult,
  UUID,
} from "@/types/api";

export interface CategoryFilters extends PageParams {
  name?: string;
}
export interface ItemFilters extends PageParams {
  name?: string;
  code?: string;
  categoryId?: UUID;
}

export const categoriesService = {
  list: (params: CategoryFilters) =>
    api
      .get<PageResult<CategorySummaryResponse>>("/categories", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<CategoryResponse>(`/categories/${id}`).then((r) => r.data),
  create: (body: CategoryRequest) =>
    api.post<CategoryResponse>("/categories", body).then((r) => r.data),
  update: (id: UUID, body: CategoryRequest) =>
    api.put<CategoryResponse>(`/categories/${id}`, body).then((r) => r.data),
};

export const itemsService = {
  list: (params: ItemFilters) =>
    api
      .get<PageResult<ItemSummaryResponse>>("/items", { params: cleanParams(params) })
      .then((r) => r.data),
  get: (id: UUID) => api.get<ItemResponse>(`/items/${id}`).then((r) => r.data),
  create: (body: ItemRequest) => api.post<ItemResponse>("/items", body).then((r) => r.data),
  update: (id: UUID, body: Partial<ItemRequest>) =>
    api.put<ItemResponse>(`/items/${id}`, body).then((r) => r.data),
};
