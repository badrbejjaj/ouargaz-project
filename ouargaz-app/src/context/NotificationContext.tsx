'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

export interface Notification {
  id: number
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface Toast {
  id: string
  title: string
  message: string
}

interface NotificationContextProps {
  notifications: Notification[]
  unreadCount: number
  loadNotif: () => Promise<void>
  markRead: (id?: number) => Promise<void>
  initSession: (user: any) => void
  user: any
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [user, setUserState] = useState<any>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userRef = useRef<any>(null)
  const lastToastRef = useRef<{ title: string; message: string; time: number } | null>(null)

  const addToast = useCallback((title: string, message: string) => {
    const now = Date.now()
    if (
      lastToastRef.current &&
      lastToastRef.current.title === title &&
      lastToastRef.current.message === message &&
      now - lastToastRef.current.time < 1000
    ) {
      return
    }
    lastToastRef.current = { title, message, time: now }

    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const loadNotif = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications')
      if (r.ok) {
        const d = await r.json()
        setNotifications(d.notifications || [])
      }
    } catch (e) {
      console.error('[NotificationProvider] Failed to load notifications:', e)
    }
  }, [])

  const markRead = useCallback(async (id?: number) => {
    try {
      const body = id ? { id } : {}
      // Optimistic update
      setNotifications(prev =>
        id
          ? prev.map(n => n.id === id ? { ...n, read: true } : n)
          : prev.map(n => ({ ...n, read: true }))
      )
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (e) {
      console.error('[NotificationProvider] Failed to mark as read:', e)
      // Rollback
      loadNotif()
    }
  }, [loadNotif])

  const connectWS = useCallback((role: string) => {
    if (socketRef.current) {
      socketRef.current.onclose = null
      socketRef.current.close()
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const hostname = window.location.hostname || 'localhost'
      const wsUrl = `${protocol}//${hostname}:3001`

      console.log('[WS Context] Connecting to:', wsUrl)
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        console.log('[WS Context] Connected')
        socket.send(JSON.stringify({ type: 'subscribe', role }))
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'CAMION_UPDATE') {
            window.dispatchEvent(new CustomEvent('ouargaz-camions-updated'))
          } else if (data.type === 'NOTIFICATION_UPDATE') {
            loadNotif()
            const notif = data.data
            const currentUserRole = userRef.current?.role
            if (notif && notif.title && notif.role === currentUserRole) {
              addToast(notif.title, notif.message)
            }
            window.dispatchEvent(new CustomEvent('ouargaz-notifications-updated', { detail: data.data }))
          }
        } catch (e) {
          console.error('[WS Context] Error processing message:', e)
        }
      }

      socket.onclose = () => {
        console.log('[WS Context] Disconnected')
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userRef.current) {
            connectWS(userRef.current.role)
          }
        }, 5000)
      }

      socket.onerror = (err) => {
        console.error('[WS Context] Error:', err)
      }
    } catch (err) {
      console.error('[WS Context] Failed to connect:', err)
    }
  }, [loadNotif, addToast])

  const initSession = useCallback((newUser: any) => {
    if (newUser) {
      const hasChanged = !userRef.current || userRef.current.username !== newUser.username || userRef.current.role !== newUser.role
      if (hasChanged) {
        console.log('[NotificationProvider] User session initialized/changed:', newUser)
        userRef.current = newUser
        setUserState(newUser)
        loadNotif()
        connectWS(newUser.role)
      }
    } else {
      if (userRef.current) {
        console.log('[NotificationProvider] User logged out, cleaning up')
        userRef.current = null
        setUserState(null)
        setNotifications([])
        if (socketRef.current) {
          socketRef.current.onclose = null
          socketRef.current.close()
          socketRef.current = null
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }
    }
  }, [loadNotif, connectWS])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loadNotif, markRead, initSession, user }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none" style={{ zIndex: 9999 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="toaster pointer-events-auto flex gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl animate-slide-in"
            style={{
              background: 'rgba(10, 15, 30, 0.85)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div className="flex-shrink-0 text-xl">🔔</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white">{t.title}</div>
              <div className="text-xs text-slate-300 mt-1 leading-relaxed">{t.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
