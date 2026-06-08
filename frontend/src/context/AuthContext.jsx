import React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'

export const AuthContext = createContext({ user: null, login: () => {}, logout: () => {}, can: () => false, isStorehouse: false, setIsStorehouse: () => {} });

const PERMISSIONS = {
  1: { list: true, view: true, create: true, delete: true, update: true },
  2: { list: true, view: true, create: false, delete: false, update: true },
  3: { list: true, view: true, create: true, delete: true, update: true },
};

export const AuthProvider = ({children}) => {
    const [user, setUser] = useState(() => {
      const stored = localStorage.getItem('mcm_user');
      return stored ? JSON.parse(stored) : null;
    });
    const [selectedLocationId, setSelectedLocationId] = useState(() => {
      const stored = localStorage.getItem('mcm_user');
      if (stored) {
        const userData = JSON.parse(stored);
        if (userData.usertype === 2) return userData.location_id;
      }
      return "all";
    });
    const [isStorehouse, setIsStorehouse] = useState(() => {
      const stored = localStorage.getItem('mcm_user');
      if (stored) {
        const userData = JSON.parse(stored);
        return userData.usertype === 2 ? !!userData.is_storehouse : false;
      }
      return false;
    });
    const [theme, setThemeState] = useState(() => localStorage.getItem('mcm_theme') || 'light');
    const [fontSize, setFontSizeState] = useState(() => localStorage.getItem('mcm_fontsize') || 'medium');

    const login = (userData) => {
      localStorage.setItem('mcm_user', JSON.stringify(userData));
      setUser(userData);
      setIsStorehouse(!!userData.is_storehouse);
      if (userData.usertype === 2) {
        setSelectedLocationId(userData.location_id);
      } else {
        setSelectedLocationId("all");
      }
        fetch(`/api/settings?user_id=${userData.user_id}&usertype=${userData.usertype}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.theme) {
        localStorage.setItem('mcm_theme', data.theme);
        setThemeState(data.theme);
      }
      if (data.fontsize) {
        localStorage.setItem('mcm_fontsize', data.fontsize);
        setFontSizeState(data.fontsize);
      }
    })
    .catch(() => {});
    };

    const logout = () => {
      localStorage.removeItem('mcm_user');
      setUser(null);
      setSelectedLocationId("all");
      setIsStorehouse(false);
    };

    const can = (action) => {
      if (!user) return false;
      return PERMISSIONS[user.usertype]?.[action] ?? false;
    };

    const setTheme = (t) => {
      localStorage.setItem('mcm_theme', t);
      setThemeState(t);
    };

    const setFontSize = (s) => {
      localStorage.setItem('mcm_fontsize', s);
      setFontSizeState(s);
    };

  return (
    <AuthContext.Provider value={{user, login, logout, can, selectedLocationId, setSelectedLocationId, isStorehouse, setIsStorehouse, theme, fontSize, setTheme, setFontSize}}>
        {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext);
