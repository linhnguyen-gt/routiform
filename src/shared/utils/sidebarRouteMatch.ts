type SidebarLikeItem = {
  href: string;
  exact?: boolean;
  external?: boolean;
};

export function matchesSidebarHref(
  pathname: string | null | undefined,
  href: string,
  exact = false
): boolean {
  if (!pathname || pathname === "") return false;

  // Normalize trailing slashes for consistent matching
  const normalizedHref = href.endsWith("/") && href !== "/" ? href.slice(0, -1) : href;
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  if (exact) return normalizedPath === normalizedHref;
  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

export function getActiveSidebarHref(
  pathname: string | null | undefined,
  items: SidebarLikeItem[]
): string | null {
  let bestMatch: SidebarLikeItem | null = null;

  for (const item of items) {
    if (item.external) continue;
    if (!matchesSidebarHref(pathname, item.href, item.exact === true)) continue;

    if (!bestMatch) {
      bestMatch = item;
      continue;
    }

    if (item.href.length > bestMatch.href.length) {
      bestMatch = item;
      continue;
    }

    if (item.href.length === bestMatch.href.length && item.exact && !bestMatch.exact) {
      bestMatch = item;
    }
  }

  return bestMatch?.href || null;
}
