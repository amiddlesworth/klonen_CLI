import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer, SidebarLayout, SingleColumnLayout, ThreeColumnLayout, TwoColumnLayout } from "./Layouts";

type PlaceholderPageProps = {
  /** The page's h1. */
  title: string;
  icon: LucideIcon;
  /** Empty-state sentence. */
  message: string;
  description?: string;
  action?: ReactNode;
  layout?: "page" | "two" | "three" | "sidebar" | "single";
  /** Left rail content for the three-column layout. */
  left?: ReactNode;
};

/** A route that exists in the shell but whose screen is not built yet: an EmptyState inside a card. */
export function PlaceholderPage({ title, icon, message, description, action, layout = "two", left }: PlaceholderPageProps) {
  const card = (
    <Card padding="main">
      <CardHeader as="h1" title={title} />
      <EmptyState icon={icon} title={message} description={description} action={action} spacing="lg" />
    </Card>
  );
  switch (layout) {
    case "three":
      return (
        <ThreeColumnLayout left={left} hideRightOnPhone>
          {card}
        </ThreeColumnLayout>
      );
    case "sidebar":
      return <SidebarLayout>{card}</SidebarLayout>;
    case "single":
      return <SingleColumnLayout>{card}</SingleColumnLayout>;
    case "page":
      return <PageContainer>{card}</PageContainer>;
    default:
      return <TwoColumnLayout>{card}</TwoColumnLayout>;
  }
}
