// Minimal stub for html2canvas to satisfy bundler in server-only contexts.
export default async function html2canvas(): Promise<void> {
  throw new Error("html2canvas is not available in this server build.");
}
