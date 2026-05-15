/**
 * Notify clients in the `menu` Socket.IO room that the catalog changed.
 * @param {import("socket.io").Server | undefined} io
 * @param {{ scope?: "items" | "categories" | "all"; action?: string }} [meta]
 */
function broadcastMenuUpdated(io, meta = {}) {
  if (!io) return;
  const payload = {
    scope: meta.scope || "all",
    action: meta.action || "updated",
    at: Date.now(),
  };
  io.to("menu").emit("menu-updated", payload);
}

module.exports = { broadcastMenuUpdated };
