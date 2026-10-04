import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "منصة متابعة السكن الطلابي",
    short_name: "منصة السكن",
    description: "متابعة شاملة للطلاب والشقق: الحضور، الصلاة، الورد، النظافة، والمرافق.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafcfc",
    theme_color: "#062d2a",
    dir: "rtl",
    lang: "ar",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
