"use client";
import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

/** Copies an absolute link for a site path and confirms with a toast. */
export function useCopyLink() {
  const toast = useToast();
  return useCallback(
    async (path: string, message: string) => {
      const url = new URL(path, window.location.origin).toString();
      try {
        await navigator.clipboard.writeText(url);
        toast.show(message);
      } catch {
        toast.show(`Couldn't copy. The link is ${url}`);
      }
    },
    [toast],
  );
}
