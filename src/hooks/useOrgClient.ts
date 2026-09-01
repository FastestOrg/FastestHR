import { useBYOS } from '@/contexts/BYOSContext';

/**
 * Hook to access the active organization Supabase client.
 * Returns either the customer's dedicated BYOS client (if active)
 * or the centralized FastestHR Platform client.
 */
export function useOrgClient() {
  const {
    orgClient,
    isBYOS,
    byosStatus,
    healthStatus,
    isLoading,
    byosUrl,
    connection,
    refetch,
  } = useBYOS();

  return {
    orgClient,
    isBYOS,
    byosStatus,
    healthStatus,
    isBYOSLoading: isLoading,
    byosUrl,
    connection,
    refreshBYOS: refetch,
  };
}
