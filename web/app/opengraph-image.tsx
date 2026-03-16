import { ImageResponse } from "next/og";

export const alt = "xbook — X Bookmarks Organizer & Newsletter Digest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 700,
              color: "#0a0a0a",
            }}
          >
            xb
          </div>
          <span
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            xbook
          </span>
        </div>
        <p
          style={{
            fontSize: "28px",
            color: "#a1a1aa",
            maxWidth: "600px",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Your X bookmarks, organized. Newsletter digest included.
        </p>
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "40px",
            color: "#71717a",
            fontSize: "18px",
          }}
        >
          <span>Sync</span>
          <span>·</span>
          <span>Search</span>
          <span>·</span>
          <span>Organize</span>
          <span>·</span>
          <span>Digest</span>
        </div>
        <p
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "16px",
            color: "#52525b",
          }}
        >
          github.com/joedanz/xbook — Open Source
        </p>
      </div>
    ),
    { ...size }
  );
}
