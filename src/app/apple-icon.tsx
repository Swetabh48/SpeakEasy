import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090b0f",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #E8A849 0%, #5EEAD4 100%)",
            color: "#090b0f",
            fontSize: 96,
            fontWeight: 700,
            fontFamily: "Georgia, 'Times New Roman', serif",
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
