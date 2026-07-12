"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[90] min-w-[10rem] rounded-md border border-slate-200 bg-surface p-1 shadow-overlay",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownContent.displayName = "DropdownContent";

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100",
      className,
    )}
    {...props}
  />
));
DropdownItem.displayName = "DropdownItem";

export const DropdownSeparator = () => (
  <DropdownPrimitive.Separator className="my-1 h-px bg-slate-200" />
);

export const DropdownLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2.5 py-1.5 text-xs font-medium text-slate-400">{children}</div>
);
