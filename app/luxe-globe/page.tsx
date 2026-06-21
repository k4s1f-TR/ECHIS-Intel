import type { Metadata } from "next";
import { LuxeGlobe } from "@/components/luxe/LuxeGlobe";

export const metadata: Metadata = {
  title: "Luxe Globe",
  description: "Premium Three.js globe — deep-red ocean, black continents.",
};

export default function LuxeGlobePage() {
  return <LuxeGlobe />;
}
