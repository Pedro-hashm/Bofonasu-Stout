import { createEffect, JSX, splitProps } from "solid-js";
import { styled } from "styled-system/jsx";

import { MdRipple } from "@material/web/ripple/ripple";
import { useState } from "@revolt/state";
import { Ripple } from "@revolt/ui";
import { SlideState } from "@revolt/ui/components/navigation/SlideDrawer";

/**
 * Sidebar button
 */
export function SidebarButton(
  props: JSX.HTMLAttributes<HTMLAnchorElement> & {
    "aria-selected"?: boolean;
    noDrawer?: boolean;
  },
) {
  const { diagDrawer } = useState();
  const [local, other] = splitProps(props, ["onClick", "noDrawer", "class"]);
  let ripple: MdRipple | undefined;

  createEffect(() => {
    const sPos = diagDrawer()?.state;
    if (sPos === SlideState.SHOWN || sPos === SlideState.HIDDEN)
      //@ts-expect-error private call
      ripple?.endPressAnimation();
  });

  function onClick(e: Event) {
    if (!local.noDrawer) diagDrawer()?.setShown(true);
    // @ts-expect-error callable listener
    if (local.onClick) local.onClick(e);
  }

  return (
    <SidebarButtonBase
      {...other}
      class={"button" + (local.class ? " " + local.class : "")}
      onClick={onClick}
    >
      <Ripple ref={ripple} />
      {props.children}
    </SidebarButtonBase>
  );
}

const SidebarButtonBase = styled("a", {
  base: {
    // for <Ripple />:
    position: "relative",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    padding: "9px 12px",
    borderRadius: "var(--borderRadius-xs)",
    fontWeight: 500,
    marginInlineEnd: "12px",
    fontSize: "13px",
    userSelect: "none",
    transition: "background-color 0.1s ease-in-out",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    background: "unset",

    "& svg": {
      flexShrink: 0,
    },
  },
  variants: {
    "aria-selected": {
      true: {
        background:
          "color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent)",
        color: "var(--md-sys-color-primary)",
      },
    },
  },
});

export const SidebarButtonTitle = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexGrow: 1,
    minWidth: 0,
    paddingInlineEnd: "8px",
  },
});

export const SidebarButtonContent = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

export const SidebarButtonIcon = styled("div", {
  base: {
    display: "flex",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 0,
    gap: "2px",
  },
});
