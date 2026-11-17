// Error tracking hook for anything a page or route throws that was not already handled.
export async function onRequestError(error: unknown, request: { readonly method: string }, context: { readonly routePath: string }): Promise<void> {
  const { reportError } = await import('./server/errors');
  // routePath is the route pattern, such as /app/runs/[id], never the URL a person typed.
  await reportError(error, { route: `${request.method} ${context.routePath}`, requestId: 'page' });
}
