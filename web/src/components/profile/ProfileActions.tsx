"use client";
import { useState, useTransition } from "react";
import { Ellipsis, Flag, Forward, LayoutGrid, Lock, Mail, Send, ShieldCheck, UserPlus } from "lucide-react";
import type { DemoAccountOption } from "@/components/shell/types";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { MenuDivider, MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { requestConnection } from "@/lib/actions/profile";
import { cn } from "@/lib/cn";
import { InviteSheet, ReportSheet, SignInSheet, type InviteReason, type ProfilePerson } from "./ProfileDialogs";

/** Who is looking: the coach on their own profile, a signed-in demo account, or a visitor. */
export type ProfileViewer = "owner" | "coach" | "employer" | "visitor";

type ProfileActionsProps = {
  person: ProfilePerson;
  viewer: ProfileViewer;
  accounts: DemoAccountOption[];
  /** The coach session's connection with this person (claimed profiles only). */
  connection: "none" | "pending" | "accepted";
  /** A fictional demo candidate: nobody to connect with, message or invite to claim. */
  demo?: boolean;
  className?: string;
};

/** Copies the profile URL (or opens the share sheet on touch devices). */
export function useShareProfile(name: string) {
  const toast = useToast();
  return async () => {
    const url = window.location.href.split("#")[0];
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: name, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Profile link copied");
    } catch {
      toast.show("Couldn't copy the link. Copy it from the address bar.");
    }
  };
}

// Header actions: 32px desktop, one full-width 44px row on phone (Connect and Message flex, More 44×44).
const FLEX = "max-md:flex-1";

/**
 * Header actions (§8.4). Unclaimed profiles (every real profile today): Connect and Message open
 * the "Invite {first} to claim" sheet. Claimed: Connect creates a pending request for the coach
 * session, Message goes to /messaging. Visitors get the demo sign-in prompt. The owner view (the
 * coach demo on their own profile) swaps in claim and share affordances.
 */
export function ProfileActions({ person, viewer, accounts, connection: initialConnection, demo, className }: ProfileActionsProps) {
  const toast = useToast();
  const share = useShareProfile(person.fullName);
  const [invite, setInvite] = useState<InviteReason | null>(null);
  const [signIn, setSignIn] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [connection, setConnection] = useState(initialConnection);
  const [pending, start] = useTransition();
  const first = person.firstName;

  /** Unclaimed: invite; visitor: sign in. */
  const gate = (reason: InviteReason, signInTitle: string) => () => {
    if (viewer === "visitor") setSignIn(signInTitle);
    else setInvite(reason);
  };

  const connect = () => {
    if (connection !== "none") return;
    start(async () => {
      const res = await requestConnection(person.id);
      if (res.ok) {
        setConnection(res.status);
        toast.show(`Connection request sent to ${first}`);
      } else toast.show(res.error);
    });
  };

  const more = (
    <Menu
      trigger={<Icon icon={Ellipsis} size={16} />}
      triggerLabel="More actions"
      tooltip
      triggerClassName={buttonClasses({ variant: "secondary", iconOnly: true, phone: "large" })}
      sheetOnPhone
      minWidth={220}
    >
      {viewer === "owner" ? (
        <MenuLink href="/settings/availability" icon={Lock} description="Never shown on your public profile">
          Open to opportunities
        </MenuLink>
      ) : (
        <MenuItem icon={Forward} onClick={share}>
          Share profile
        </MenuItem>
      )}
      {!person.claimed && !demo && viewer !== "owner" && (
        <MenuItem icon={Send} onClick={gate("invite", `Sign in to invite ${first}`)}>
          Invite {first} to claim
        </MenuItem>
      )}
      {!demo && <MenuDivider />}
      {!demo && (
        <MenuItem icon={Flag} onClick={() => setReport(true)}>
          Report an error
        </MenuItem>
      )}
    </Menu>
  );

  let buttons;
  // A fictional demo candidate: no one can receive a connection, a message or a claim invite, and there
  // is no record to report. Everyone but the athletic director gets one labelled Share button (a lone
  // "···" with a one-item menu reads like a control that failed to load).
  const demoShareOnly = demo && viewer !== "employer";
  if (demoShareOnly) {
    buttons = (
      <Button icon={Forward} phone="large" className={FLEX} onClick={share}>
        Share profile
      </Button>
    );
  } else if (demo) {
    // The athletic director demo arrives here from the hiring pipeline; give them the way back.
    buttons = (
      <ButtonLink href="/employers/pipeline" icon={LayoutGrid} phone="large" className={FLEX}>
        Hiring pipeline
      </ButtonLink>
    );
  } else if (viewer === "owner") {
    buttons = (
      <>
        <ButtonLink href={`/claim/${person.slug}`} variant="primary" icon={ShieldCheck} phone="large" className={FLEX}>
          Claim and edit
        </ButtonLink>
        <Button icon={Forward} phone="large" className={FLEX} onClick={share}>
          Share profile
        </Button>
      </>
    );
  } else if (!person.claimed || viewer === "visitor") {
    buttons = (
      <>
        <Button variant="primary" icon={UserPlus} phone="large" className={FLEX} onClick={gate("connect", `Sign in to connect with ${first}`)}>
          Connect
        </Button>
        <Button icon={Mail} phone="large" className={FLEX} onClick={gate("message", `Sign in to message ${first}`)}>
          Message
        </Button>
      </>
    );
  } else if (viewer === "employer") {
    buttons = (
      <ButtonLink href="/messaging" variant="primary" icon={Mail} phone="large" className={FLEX}>
        Message
      </ButtonLink>
    );
  } else {
    buttons = (
      <>
        <Button
          variant="primary"
          icon={UserPlus}
          phone="large"
          className={FLEX}
          loading={pending}
          pressed={connection === "none" ? undefined : true}
          onClick={connect}
        >
          {connection === "accepted" ? "Connected" : connection === "pending" ? "Pending" : "Connect"}
        </Button>
        <ButtonLink href="/messaging" icon={Mail} phone="large" className={FLEX}>
          Message
        </ButtonLink>
      </>
    );
  }

  return (
    <div className={cn("flex items-start gap-2", className)}>
      {buttons}
      {!demoShareOnly && more}
      {!person.claimed && !demo && viewer !== "owner" && viewer !== "visitor" && (
        <InviteSheet person={person} reason={invite ?? "invite"} open={invite !== null} onOpenChange={(v) => !v && setInvite(null)} />
      )}
      {viewer === "visitor" && <SignInSheet accounts={accounts} title={signIn ?? "Sign in"} open={signIn !== null} onOpenChange={(v) => !v && setSignIn(null)} />}
      {!demo && <ReportSheet person={person} open={report} onOpenChange={setReport} />}
    </div>
  );
}

/**
 * Connect icon button for a person row in the rail (§8.4 Same tree). Unclaimed people get the invite
 * sheet, visitors the sign-in prompt. `sm` secondary, 44px hit area on touch.
 */
export function RowConnectButton({ person, signedIn, accounts }: { person: ProfilePerson; signedIn: boolean; accounts: DemoAccountOption[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const onClick = () => {
    if (signedIn && person.claimed) {
      if (sent) return;
      start(async () => {
        const res = await requestConnection(person.id);
        if (res.ok) setSent(true);
        toast.show(res.ok ? `Connection request sent to ${person.firstName}` : res.error);
      });
    } else setOpen(true);
  };
  return (
    <>
      <IconButton
        icon={UserPlus}
        label={`Connect with ${person.fullName}`}
        variant="secondary"
        size="sm"
        loading={pending}
        pressed={sent ? true : undefined}
        onClick={onClick}
      />
      {person.claimed && signedIn ? null : signedIn ? (
        <InviteSheet person={person} reason="connect" open={open} onOpenChange={setOpen} />
      ) : (
        <SignInSheet accounts={accounts} title={`Sign in to connect with ${person.firstName}`} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
