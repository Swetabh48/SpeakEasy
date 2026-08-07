import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #E8A849 0%, #5EEAD4 100%)",
            color: "#090b0f",
            fontSize: 34,
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
