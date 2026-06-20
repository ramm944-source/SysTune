export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Rewrite the hostname to point to our backend worker
  url.hostname = 'systune-admin.ramm944.workers.dev';
  
  // Proxy the request to the worker
  const backendRequest = new Request(url.toString(), request);
  
  return fetch(backendRequest);
}
