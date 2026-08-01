/** Shared inline styles for PasarPilih emails (email clients need inline CSS). */
export const brand = {
  primary: "#0f97ac",
  primaryDark: "#0b7c8e",
  text: "#101828",
  muted: "#667085",
  border: "#e4e7ec",
  surface: "#f7fafb",
};

export const main = {
  backgroundColor: "#ffffff",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  color: brand.text,
};

export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "24px",
};

export const header = {
  fontSize: "18px",
  fontWeight: 700,
  color: brand.primary,
  letterSpacing: "0.02em",
  margin: "0 0 16px",
};

export const heading = {
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 8px",
  color: brand.text,
};

export const paragraph = {
  fontSize: "14px",
  lineHeight: "22px",
  color: brand.muted,
  margin: "0 0 12px",
};

export const card = {
  border: `1px solid ${brand.border}`,
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: brand.surface,
  margin: "16px 0",
};

export const button = {
  display: "inline-block",
  backgroundColor: brand.primary,
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
};

export const buttonOutline = {
  display: "inline-block",
  backgroundColor: "#ffffff",
  color: brand.primary,
  padding: "10px 18px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: 700,
  textDecoration: "none",
  border: `2px solid ${brand.primary}`,
};

export const label = {
  fontSize: "12px",
  color: brand.muted,
  margin: "0",
};

export const value = {
  fontSize: "14px",
  fontWeight: 600,
  color: brand.text,
  margin: "0 0 10px",
};

export const muted = {
  fontSize: "12px",
  lineHeight: "18px",
  color: brand.muted,
  margin: "0 0 12px",
};

export const footer = {
  fontSize: "12px",
  color: brand.muted,
  lineHeight: "18px",
  margin: "16px 0 0",
};

export function formatIdr(amount: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(amount)))}`;
}
