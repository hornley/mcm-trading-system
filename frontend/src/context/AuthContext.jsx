import React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'

export const AuthContext = createContext(null);

const PERMISSIONS = {
  1: { list: true, view: true, create: true, delete: true, update: true },
  2: { list: true, view: true, create: false, delete: false, update: true },
  3: { list: true, view: true, create: true, delete: true, update: true },
};

export const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [selectedLocationId, setSelectedLocationId] = useState("all");

    const login = (userData) => {
        setUser(userData);
        if (userData.usertype === 2) {
            setSelectedLocationId(userData.location_id);
        } else {
            setSelectedLocationId("all");
        }
    };

    const logout = () => {
        setUser(null);
        setSelectedLocationId("all");
    };

    const can = (action) => {
      if (!user) return false;
      return PERMISSIONS[user.usertype]?.[action] ?? false;
    };

  return (
    <AuthContext.Provider value={{user, login, logout, can, selectedLocationId, setSelectedLocationId}}>
        {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext);