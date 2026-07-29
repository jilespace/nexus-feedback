import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiRequest, setToken, clearToken } from '@/api/client';
import type { OrgMember, Organization } from '@/types';

type LoginParams = { email: string; password: string; org_slug: string };
type RegisterParams = { name: string; slug: string; email: string; password: string; display_name: string };

type LoginResponse = {
  token: string;
  member: OrgMember;
  organization: Organization;
};

type AuthState = {
  token: string | null;
  isAuthenticated: boolean;
  member: OrgMember | null;
  organization: Organization | null;
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function loadStoredJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem('admin_token'),
  );
  const [member, setMember] = useState<OrgMember | null>(
    () => loadStoredJSON<OrgMember>('org_member'),
  );
  const [organization, setOrganization] = useState<Organization | null>(
    () => loadStoredJSON<Organization>('org_info'),
  );

  const saveSession = useCallback((data: LoginResponse) => {
    setToken(data.token);
    setTokenState(data.token);
    localStorage.setItem('org_member', JSON.stringify(data.member));
    localStorage.setItem('org_info', JSON.stringify(data.organization));
    setMember(data.member);
    setOrganization(data.organization);
  }, []);

  const login = useCallback(async (params: LoginParams) => {
    const data = await apiRequest<LoginResponse>(
      '/org/login',
      { method: 'POST', body: JSON.stringify(params) },
    );
    saveSession(data);
  }, [saveSession]);

  const register = useCallback(async (params: RegisterParams) => {
    await apiRequest<unknown>(
      '/org/register',
      { method: 'POST', body: JSON.stringify(params) },
    );
    // Auto-login after successful registration
    const loginData = await apiRequest<LoginResponse>(
      '/org/login',
      { method: 'POST', body: JSON.stringify({ email: params.email, password: params.password, org_slug: params.slug }) },
    );
    saveSession(loginData);
  }, [saveSession]);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem('org_member');
    localStorage.removeItem('org_info');
    setTokenState(null);
    setMember(null);
    setOrganization(null);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setTokenState(localStorage.getItem('admin_token'));
      setMember(loadStoredJSON<OrgMember>('org_member'));
      setOrganization(loadStoredJSON<Organization>('org_info'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, member, organization, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
