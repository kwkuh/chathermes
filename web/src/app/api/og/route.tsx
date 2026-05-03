import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "ChatHermes";
  const subtitle = searchParams.get("subtitle") || "The chat that doesn't end when you close the tab";
  const tag = searchParams.get("tag") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #0b0a09 0%, #1a1714 40%, #2B2B29 100%)",
          padding: "72px",
          color: "#FBFAF6",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Top: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: "#2B2B29",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(176,120,32,0.4)",
            position: "relative",
          }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 600, color: "#FBFAF6", lineHeight: 1 }}>C</span>
            <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, background: "#B07820" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>ChatHermes</span>
            <span style={{ fontSize: 13, color: "#7C9A95", textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: "monospace" }}>open agent platform</span>
          </div>
        </div>

        {/* Middle: title + subtitle */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          {tag && (
            <div style={{ display: "flex", marginBottom: 18 }}>
              <span style={{ background: "rgba(176,120,32,0.18)", color: "#E8A547", fontFamily: "monospace", fontSize: 14, padding: "6px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.16em", border: "1px solid rgba(176,120,32,0.3)" }}>
                {tag}
              </span>
            </div>
          )}
          <div style={{ fontSize: 76, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ marginTop: 24, fontSize: 24, color: "rgba(251,250,246,0.62)", maxWidth: 880, lineHeight: 1.4 }}>
            {subtitle}
          </div>
        </div>

        {/* Bottom: meta line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 28, borderTop: "1px solid rgba(124,154,149,0.18)" }}>
          <span style={{ fontFamily: "monospace", fontSize: 16, color: "rgba(251,250,246,0.5)", letterSpacing: "0.1em" }}>chathermes.com</span>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(251,250,246,0.4)", textTransform: "uppercase", letterSpacing: "0.14em" }}>built on Hermes Agent · open source</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
