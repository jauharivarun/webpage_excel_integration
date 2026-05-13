/** Normalize LinkedIn cell text into an absolute URL for anchors. */
export function linkedinHref(url: string): string {
  const u = url.trim();
  if (!u) return "#";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
