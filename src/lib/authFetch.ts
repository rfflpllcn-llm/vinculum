import { signIn } from "next-auth/react";

/**
 * Wrapper around fetch that automatically redirects to sign-in on 401 errors
 * Use this for all API calls that require authentication
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // If unauthorized, trigger automatic re-authentication
  if (response.status === 401) {
    console.log('Session expired, redirecting to sign in...');
    // Redirect to sign in with callback to current page
    signIn('google', { callbackUrl: window.location.pathname });

    // Throw error to prevent further processing
    throw new Error('Authentication required. Redirecting to sign in...');
  }

  return response;
}