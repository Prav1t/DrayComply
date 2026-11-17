// What server-rendered pages use to learn who is asking. Pages call the same data functions as the API routes.
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SESSION_COOKIE, listOrganizations, resolveSession, type Session } from './auth';
import { contextFor, type Ctx } from './context';
import { AppError } from './errors';
import { isUuid } from './http';

export async function pageSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  return resolveSession(token, new Date());
}

export interface PageContext { readonly ctx: Ctx; readonly session: Session; readonly organizations: Awaited<ReturnType<typeof listOrganizations>> }

export async function pageContext(): Promise<PageContext> {
  const session = await pageSession();
  if (session === null) redirect('/login');
  try {
    const ctx = await contextFor(session, new Date());
    return { ctx, session, organizations: await listOrganizations(session.userId) };
  } catch (e) {
    if (e instanceof AppError && e.code === 'no_organization') redirect('/no-organization');
    throw e;
  }
}

// A row that is missing, or belongs to another organization, is a plain 404 page.
export async function load<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
export const pageId = (v: string): string => (isUuid(v) ? v : notFound());
