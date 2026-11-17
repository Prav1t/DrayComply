import type { MetadataRoute } from 'next';

// Nothing behind sign-in is for search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: ['/app/', '/api/'] }] };
}
