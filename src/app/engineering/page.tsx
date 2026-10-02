import type { Metadata } from "next";
import { EngineeringDocs } from "@/components/EngineeringDocs";

export const metadata: Metadata = {
  title: "Speakeasy Engineering — Architecture & System Design",
  description:
    "Engineering overview of Speakeasy: architecture, tech stack decisions, high-level design, system flows, data model, and deep dives.",
  robots: { index: true, follow: true },
};

export default function EngineeringPage() {
  return <EngineeringDocs />;
}
