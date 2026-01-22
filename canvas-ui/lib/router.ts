import * as React from "react";

function normalizePath(input: string): string {
  if (!input) return "/";
  return input.startsWith("/") ? input : `/${input}`;
}

export function linkTo(path: string): string {
  return `#${normalizePath(path)}`;
}

export function getHashPath(): string {
  const raw = window.location.hash || "";
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  const normalized = normalizePath(withoutHash);
  return normalized === "/#" ? "/" : normalized;
}

export function navigate(path: string, opts?: { replace?: boolean }): void {
  const next = linkTo(path);
  if (opts?.replace) {
    window.history.replaceState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next;
}

export function useHashPath(): string {
  const [path, setPath] = React.useState<string>(() => (typeof window === "undefined" ? "/" : getHashPath()));

  React.useEffect(() => {
    const onChange = () => setPath(getHashPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return path;
}
