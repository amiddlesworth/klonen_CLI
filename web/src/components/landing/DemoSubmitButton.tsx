"use client";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";

/**
 * Submit button for the demo sign-in forms: shows the loading state (spinner, aria-busy, same
 * width) while the landing's demo server action (lib/actions/landing) runs.
 */
export function DemoSubmitButton(props: Omit<ButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
