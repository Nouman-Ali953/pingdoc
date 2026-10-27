import { ImageResponse } from "next/og";

export const alt = "Pingdoc, a checkup for any API endpoint";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f4f7fb", color: "#0b1220" }}>
        <svg width="1040" height="120" viewBox="0 0 1200 120">
          <path d="M0 60 H380 l20 -8 l20 8 H500 l14 -52 l22 100 l16 -70 l10 22 H700 l20 -10 l20 10 H1200" fill="none" stroke="#3347ff" strokeWidth="6" strokeLinejoin="round" />
        </svg>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 24 }}>Pingdoc</div>
        <div style={{ fontSize: 40, marginTop: 12, color: "#3b4660" }}>A checkup for any API endpoint. Free.</div>
      </div>
    ),
    size,
  );
}
