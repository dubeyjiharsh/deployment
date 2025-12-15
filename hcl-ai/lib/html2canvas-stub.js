// Minimal stub for html2canvas to satisfy bundler in server-only contexts.
module.exports = async function html2canvas() {
  throw new Error("html2canvas is not available in this server build.");
};
