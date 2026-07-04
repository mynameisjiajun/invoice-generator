import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JJ Visuals Invoices",
    short_name: "Invoices",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F9FC",
    theme_color: "#1A1A2E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
