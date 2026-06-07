import { useState, useEffect, useRef } from 'react'
import { Avatar, Button } from 'antd'
import {
  CloseOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.jsx'
import { qtyLabel } from '../utils/format.js'

const NotificationModal = ({ open, onClose, onUpdate }) => {
  const { user } = useAuth()
  const [tab, setTab] = useState(null)
  const [requests, setRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (open) {
      setClosing(false)
      setMounted(true)
    } else if (mounted) {
      setClosing(true)
      timerRef.current = setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [open])

  const fetchData = () => {
    if (!open || !user) return
    setLoading(true)
    setNotifLoading(true)
    const params = new URLSearchParams({ usertype: user.usertype, user_id: user.user_id })
    if (user.location_id) params.append('location_id', user.location_id)
    fetch(`/api/inventory/pending-requests?${params}`)
      .then((r) => r.json())
      .then((data) => setRequests(data.success ? data.data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
    if (user.location_id) {
      fetch(`/api/notifications?location_id=${user.location_id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setNotifications(data.data)
        })
        .catch(() => setNotifications([]))
        .finally(() => setNotifLoading(false))
    }
  }

  useEffect(() => {
    fetchData()
  }, [open, user])

  const handleDelete = async (notificationId) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId))
        onUpdate?.()
      }
    } catch {}
  }

  const handleClearAll = async () => {
    if (!user.location_id) return
    try {
      const res = await fetch(`/api/notifications?location_id=${user.location_id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotifications([])
        onUpdate?.()
      }
    } catch {}
  }

  const handleAction = async (requestId, action) => {
    try {
      const res = await fetch(`/api/inventory/request-stock/${requestId}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype }),
      })
      if (!res.ok) { return }
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId))
      onUpdate?.()
    } catch {}
  }

  const timeAgo = (iso) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const fmtQty = (qty, isFabric) => {
    if (isFabric) return qtyLabel(qty)
    return qty
  }

  if (!mounted) return null

  return (
    <>
      <style>{`
        @keyframes nm-drop {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nm-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .nm-backdrop {
          animation: nm-fade 0.2s ease-out both;
        }
        .nm-backdrop.closing {
          animation: nm-fade 0.15s ease-in reverse both;
        }
        .nm-panel {
          animation: nm-drop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .nm-panel.closing {
          animation: nm-drop 0.15s ease-in reverse both;
        }
      `}</style>
      <div
        className={'nm-backdrop' + (closing ? ' closing' : '')}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1049,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      <div
        className={'nm-panel' + (closing ? ' closing' : '')}
        style={{
          position: 'fixed', top: 64, right: 40, zIndex: 1050,
          width: 440, maxHeight: 'calc(100vh - 80px)',
          background: '#fff', borderRadius: 18,
          boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
        }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0a' }}>Notifications</span>
            <Button type="text" onClick={onClose} icon={<CloseOutlined />} style={{ fontSize: 15, color: '#999' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              onClick={() => setTab(tab === 'system' ? null : 'system')}
              style={{
                borderRadius: 8, fontSize: 13, height: 32,
                background: tab === 'system' ? '#1677ff' : '#f0f0f0',
                color: tab === 'system' ? '#fff' : '#333',
                border: 'none', fontWeight: tab === 'system' ? 600 : 400,
              }}
            >
              System
            </Button>
            <Button
              size="small"
              onClick={() => setTab(tab === 'pending' ? null : 'pending')}
              style={{
                borderRadius: 8, fontSize: 13, height: 32,
                background: tab === 'pending' ? '#1677ff' : '#f0f0f0',
                color: tab === 'pending' ? '#fff' : '#333',
                border: 'none', fontWeight: tab === 'pending' ? 600 : 400,
              }}
            >
              Pending
            </Button>
            {(tab === null || tab === 'system') && notifications.length > 0 && (
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                style={{ marginLeft: 'auto', borderRadius: 8, fontSize: 13, height: 32 }}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {(tab === null || tab === 'system') && (
            <>
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={`notif-${n.notification_id}`}
                    style={{ padding: '12px 24px', borderBottom: '1px solid #f5f5f5', background: n.is_read ? 'transparent' : '#f0f5ff' }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0,
                        background: n.type === 'restock_failed' ? '#ff4d4f' : n.type === 'restock_pending' ? '#fa8c16' : '#52c41a',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => handleDelete(n.notification_id)}
                        style={{ color: '#bfbfbf', fontSize: 12, flexShrink: 0, marginTop: 2 }}
                      />
                    </div>
                  </div>
                ))
              ) : null}
            </>
          )}
          {(tab === null || tab === 'pending') && (
            <>
              {requests.length > 0 ? (
                requests.map((r) => (
                  <div
                    key={r.request_id}
                    style={{ padding: '16px 24px', borderBottom: '1px solid #f5f5f5' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Avatar size={44} style={{ background: '#1677ff', fontSize: 19, fontWeight: 600, flexShrink: 0 }}>
                        {r.requester_name?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, color: '#333', lineHeight: 1.4 }}>
                          <strong>{r.requester_name}</strong> requested{' '}
                          <strong>{fmtQty(r.quantity, r.is_fabric)} {r.product_name}</strong>
                        </div>
                        <div style={{ fontSize: 15, color: '#8c8c8c', marginTop: 4 }}>
                          {r.from_location_name} → {r.to_location_name} · {timeAgo(r.created_at)}
                        </div>
                        {r.description && (
                          <div style={{ fontSize: 15, color: '#666', marginTop: 6, fontStyle: 'italic' }}>
                            "{r.description}"
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <Button
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleAction(r.request_id, 'decline')}
                            style={{
                              borderRadius: 8, fontSize: 15, height: 36,
                              border: '1px solid #ff4d4f', color: '#ff4d4f',
                              background: '#fff', padding: '0 18px',
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleAction(r.request_id, 'accept')}
                            style={{
                              borderRadius: 8, fontSize: 15, height: 36,
                              background: '#52c41a', borderColor: '#52c41a',
                              color: '#fff', boxShadow: 'none', padding: '0 18px',
                            }}
                          >
                            Accept
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : null}
            </>
          )}
          {notifications.length === 0 && requests.length === 0 && (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <InboxOutlined style={{ fontSize: 50, color: '#d9d9d9', marginBottom: 12 }} />
              <div style={{ fontSize: 17, color: '#8c8c8c' }}>No notifications</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default NotificationModal
