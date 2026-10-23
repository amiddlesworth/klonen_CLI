"use server";
import { switchDemoAccount } from "./session";

/*
 * Demo sign-in from the signed-out landing. Each action takes no arguments from the client and
 * redirects to a fixed page, so the landing's forms carry no destination a request could change.
 * There is no role to check (getSession): any visitor may start a demo, as in the Me menu.
 */

/** "Try the demo": signs in as the coach demo account and opens the feed. */
export async function startCoachDemo() {
  await switchDemoAccount("coach", "/feed");
}

/** "Try the athletic director demo": signs in as the athletic director demo account and opens the pipeline. */
export async function startEmployerDemo() {
  await switchDemoAccount("employer", "/employers/pipeline");
}
