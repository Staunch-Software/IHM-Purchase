import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api.js";

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase-orders", "all"],
    queryFn: () => api.get("/po?all=true"),
  });
}

export function usePurchaseOrderDetail(poNumber) {
  return useQuery({
    queryKey: ["purchase-order", poNumber],
    queryFn: () => api.get(`/po/${encodeURIComponent(poNumber)}`),
    enabled: !!poNumber,
  });
}
