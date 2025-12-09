import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/queryClient';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'manager' | 'volunteer';
  permissions: {
    canManageUsers: boolean;
    canManageVoters: boolean;
    canManageLists: boolean;
    canSendEmails: boolean;
    canViewReports: boolean;
  };
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  organizations: Organization[];
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiGet<{ success: boolean; data: AuthState }>('/auth/me'),
    retry: false,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiPost('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      window.location.href = '/login';
    },
  });

  const switchOrgMutation = useMutation({
    mutationFn: (orgId: number) => apiPost('/auth/switch-organization', { organizationId: orgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries(); // Refresh all data for new org context
    },
  });

  return {
    user: data?.data?.user || null,
    organization: data?.data?.organization || null,
    organizations: data?.data?.organizations || [],
    isAuthenticated: !!data?.data?.user,
    isLoading,
    error,
    logout: logoutMutation.mutate,
    switchOrganization: switchOrgMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    isSwitchingOrg: switchOrgMutation.isPending,
  };
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (!isLoading && !isAuthenticated) {
    window.location.href = '/login';
  }
  
  return { isAuthenticated, isLoading };
}

export function usePermission(permission: keyof Organization['permissions']) {
  const { organization } = useAuth();
  return organization?.permissions?.[permission] ?? false;
}

export function useRole() {
  const { organization } = useAuth();
  return organization?.role || null;
}
