// --- Fetch API Wrapper ---
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const url = `${baseUrl}${endpoint}`;

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('systune_admin_token') : null;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Safely merge options.headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers[key] = value as string;
        });
      }
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      let errMsg = `Error ${response.status}: ${response.statusText}`;
      try {
        const errData = await response.clone().json();
        errMsg = errData.error || errMsg;
      } catch(e) {}

      if (response.status === 401) {
        console.error("Authentication Failed. The server rejected the request with:", errMsg);
      }

      throw new Error(errMsg);
    }

    return response.json();
  } catch (err: any) {
    throw err;
  }
}
