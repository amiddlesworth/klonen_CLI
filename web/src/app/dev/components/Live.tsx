"use client";
import { useState } from "react";
import { Bookmark, Copy, Ellipsis, Flag, Forward, Settings2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { MenuDivider, MenuItem } from "@/components/ui/MenuItems";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";

/** Interactive specimens for /dev/components. */

export function LiveSegmented() {
  const [value, setValue] = useState("all");
  return (
    <SegmentedControl
      label="Filter feed"
      value={value}
      onChange={setValue}
      options={[
        { value: "all", label: "All" },
        { value: "moves", label: "Moves" },
        { value: "jobs", label: "Jobs" },
        { value: "milestones", label: "Milestones" },
      ]}
    />
  );
}

export function LiveMenu() {
  const toast = useToast();
  return (
    <Menu
      trigger={<Icon icon={Ellipsis} />}
      triggerLabel="More options"
      tooltip
      triggerClassName={buttonClasses({ variant: "ghost", iconOnly: true })}
      placement="bottom-end"
    >
      <MenuItem icon={Forward} onClick={() => toast.show("Share link copied")}>
        Share profile
      </MenuItem>
      <MenuItem icon={Copy} onClick={() => toast.show("Link copied")}>
        Copy link
      </MenuItem>
      <MenuItem disabled icon={Settings2}>
        Edit (disabled)
      </MenuItem>
      <MenuDivider />
      <MenuItem icon={Flag} onClick={() => toast.show("Thanks. We'll check the source.")}>
        Report an error
      </MenuItem>
    </Menu>
  );
}

export function LiveToast() {
  const toast = useToast();
  return (
    <Button onClick={() => toast.show("Saved job removed", { actionLabel: "Undo", onAction: () => toast.show("Job saved again") })}>Show a toast</Button>
  );
}

export function LiveDialog() {
  return (
    <Dialog
      trigger="Open a dialog"
      title="This is a sample listing"
      description="Applications open when the program posts the job here."
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={close}>
            Got it
          </Button>
        </>
      )}
    >
      <Checkbox label="Email me when it opens" defaultChecked />
    </Dialog>
  );
}

export function LivePopover() {
  return (
    <Popover trigger="Showing Division III" triggerClassName={buttonClasses({ variant: "ghost" })} label="Feed scope" width={260}>
      <p className="text-small font-semibold">Feed scope</p>
      <p className="mt-1 text-caption text-fg-3">Only Division III programs have staff data for now.</p>
    </Popover>
  );
}

export function LiveLoadingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.setTimeout(() => setLoading(false), 1500);
      }}
    >
      Click to load
    </Button>
  );
}

export function LiveToggle() {
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton icon={Bookmark} label={saved ? "Saved" : "Save job"} variant="secondary" pressed={saved} onClick={() => setSaved(!saved)} />
      <Button variant="primary" pressed={following} onClick={() => setFollowing(!following)}>
        {following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
