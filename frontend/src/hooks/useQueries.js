import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

const api = (path, options = {}) =>
  fetch(path, options).then(r => r.json()).then(r => {
    if (!r.success) throw new Error(r.error || 'Request failed')
    return r.data
  })

export function useDashboardQuery(selectedLocationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (selectedLocationId) params.set('location_id', selectedLocationId)
  if (user?.user_id) params.set('user_id', user.user_id)

  return useQuery({
    queryKey: ['dashboard-summary', user?.usertype, selectedLocationId],
    queryFn: () => api(`/api/dashboard/summary?${params}`),
    staleTime: 15_000,
    enabled: !!user,
  })
}

export function useInventoryQuery(locationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (locationId) params.set('location_id', locationId)
  if (user?.user_id) params.set('user_id', user.user_id)
  params.set('limit', '500')
  params.set('page', '1')

  return useQuery({
    queryKey: ['inventory', user?.usertype, locationId],
    queryFn: () => api(`/api/inventory?${params}`),
    staleTime: 30_000,
    enabled: !!user,
  })
}

export function useInventoryCountsQuery(locationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (locationId) params.set('location_id', locationId)

  return useQuery({
    queryKey: ['inventory-counts', locationId],
    queryFn: () => api(`/api/inventory/counts?${params}`),
    staleTime: 30_000,
    enabled: !!user,
  })
}

export function useProductsQuery(locationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (locationId) params.set('location_id', locationId)
  if (user?.user_id) params.set('user_id', user.user_id)

  return useQuery({
    queryKey: ['products', locationId],
    queryFn: () => api(`/api/products?${params}`),
    staleTime: 60_000,
    enabled: !!user,
  })
}

export function useCategoriesQuery() {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })

  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api(`/api/categories?${params}`),
    staleTime: 5 * 60_000,
    enabled: !!user,
  })
}

export function useLocationsQuery() {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })

  return useQuery({
    queryKey: ['locations'],
    queryFn: () => api(`/api/locations?${params}`),
    staleTime: 5 * 60_000,
    enabled: !!user,
  })
}

export function useOrdersQuery({ page, limit, status, dateFrom, dateTo, search, locationId }) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (user?.user_id) params.set('user_id', user.user_id)
  if (locationId) params.set('location_id', locationId)
  if (status) params.set('status', status)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (search) params.set('q', search)
  params.set('page', page || 1)
  params.set('limit', limit || 20)

  return useQuery({
    queryKey: ['orders', { page, limit, status, dateFrom, dateTo, search, locationId }],
    queryFn: () => api(`/api/orders?${params}`),
    staleTime: 0,
    enabled: !!user,
  })
}

export function useOrderDetailQuery(orderId) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => api(`/api/orders/${orderId}?usertype=${user?.usertype}`),
    enabled: !!orderId && !!user,
  })
}

export function useBranchNeedsQuery(locationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (locationId) params.set('location_id', locationId)

  return useQuery({
    queryKey: ['branch-needs', locationId],
    queryFn: () => api(`/api/inventory/branch-needs?${params}`),
    staleTime: 30_000,
    enabled: !!user,
  })
}

export function usePendingRequestsQuery(locationId) {
  return useQuery({
    queryKey: ['pending-requests', locationId],
    queryFn: () => api(`/api/inventory/pending-requests?location_id=${locationId}`),
    staleTime: 30_000,
    enabled: !!locationId,
  })
}

export function useLowStockQuery(locationId) {
  const { user } = useAuth()
  const params = new URLSearchParams({ usertype: user?.usertype })
  if (locationId) params.set('location_id', locationId)
  if (user?.user_id) params.set('user_id', user.user_id)

  return useQuery({
    queryKey: ['low-stock', locationId],
    queryFn: () => api(`/api/inventory/low-stock?${params}`),
    staleTime: 30_000,
    enabled: !!user,
  })
}

export function useNotificationCountQuery(locationId) {
  return useQuery({
    queryKey: ['notification-count', locationId],
    queryFn: () => api(`/api/notifications/count?location_id=${locationId}`),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!locationId,
  })
}

export function useCreateOrderMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderData) => api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })
}

export function invalidateAll(qc) {
  qc.invalidateQueries()
}
