export const PUBLIC_SITE_ORIGIN = 'https://rudhraprarthananovels.com';

export function buildPublicShareUrl(contentId) {
  const shareUrl = new URL('/share', PUBLIC_SITE_ORIGIN);
  if (contentId !== undefined && contentId !== null && String(contentId).length > 0) {
    shareUrl.searchParams.set('id', String(contentId));
  }
  return shareUrl.toString();
}
