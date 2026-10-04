import { ImageResponse } from "next/og";
import { khatamIconElement } from "@/components/brand/khatam-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(khatamIconElement(size.width), { ...size });
}
