'use client'

import { useState, useEffect } from 'react'

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export function useGitHubAuth() {
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    checkAuthStatus()
  }, [])
  
  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/github/auth/status')
      const data = await res.json()
      setUser(data.authenticated ? data.user : null)
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }
  
  const login = () => {
    window.location.href = '/api/github/auth/login'
  }
  
  const logout = async () => {
    try {
      await fetch('/api/github/auth/logout', { method: 'POST' })
      setUser(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }
  
  return { 
    user, 
    loading, 
    authenticated: !!user, 
    login, 
    logout,
    refresh: checkAuthStatus
  }
}
