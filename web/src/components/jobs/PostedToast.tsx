"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/** After publishing, the job page shows a success toast once and drops `?posted=1` from the URL. */
export function PostedToast({ message }: { message: string }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    toast.show(message);
    router.replace(pathname, { scroll: false });
  }, [message, pathname, router, toast]);
  return null;
}
