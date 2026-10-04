import { ImageResponse } from "next/og";
import { khatamIconElement } from "@/components/brand/khatam-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(khatamIconElement(size.width), { ...size });
}
