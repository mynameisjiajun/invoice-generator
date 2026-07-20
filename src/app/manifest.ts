import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JJ Visuals Invoices",
    short_name: "Invoices",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F0E4",
    theme_color: "#251F19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
