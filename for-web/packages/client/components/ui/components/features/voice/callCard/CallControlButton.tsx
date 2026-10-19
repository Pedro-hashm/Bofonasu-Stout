import type { JSX } from "solid-js";
import "./callControls.css";

/** Shared by the full call, picture-in-picture and local design preview. */
export function CallControlButton(props: {
  label: string;
  children: JSX.Element;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  tone?: "muted" | "active" | "disconnect";
}) {
  return (
    <button
      type="button"
      class="call-control"
      data-tone={props.tone}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}
