import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Notifications" };

/** Placeholder: the messaging feature replaces this page. */
export default function NotificationsPage() {
  return <PlaceholderPage title="Notifications" icon={Bell} message="You're all caught up." description="Moves in your tree, job matches and profile views will show up here." />;
}
