import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Messaging" };

/** Placeholder: the messaging feature replaces this page. */
export default function MessagingPage() {
  return <PlaceholderPage layout="page" title="Messaging" icon={MessageSquare} message="No messages yet." description="Messages from coaches and employers show up here." />;
}
