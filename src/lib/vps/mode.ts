/** Embedded at build time; a VPS build must explicitly opt in. */
export const isVps = import.meta.env['VITE_VPS_MODE'] === 'true';