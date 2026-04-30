import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

function getComponentDisplayName(type: unknown): string | undefined {
  if (typeof type === "string" || typeof type === "number" || type === null || type === undefined) {
    return undefined;
  }
  if (typeof type === "object" || typeof type === "function") {
    const maybeNamed = type as { displayName?: unknown; name?: unknown };
    if (typeof maybeNamed.displayName === "string") return maybeNamed.displayName;
    if (typeof maybeNamed.name === "string") return maybeNamed.name;
  }
  return undefined;
}

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Check if children already include a DialogTitle
  let hasTitle = false;
  React.Children.forEach(children, (child) => {
    const childName = React.isValidElement(child) ? getComponentDisplayName(child.type) : undefined;
    if (
      childName === "DialogHeader" ||
      childName === "DialogTitle"
    ) {
      hasTitle = true;
    }
    // If DialogHeader, check its children for DialogTitle
    if (
      React.isValidElement(child) &&
      getComponentDisplayName(child.type) === "DialogHeader"
    ) {
      const headerChild = child as React.ReactElement<{ children?: React.ReactNode }>;
      React.Children.forEach(headerChild.props.children, (subChild) => {
        if (
          React.isValidElement(subChild) &&
          getComponentDisplayName(subChild.type) === "DialogTitle"
        ) {
          hasTitle = true;
        }
      });
    }
  });
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-1rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 shadow-lg duration-200 max-h-[92dvh] overflow-y-auto overflow-x-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:p-6 sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {!hasTitle && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              margin: -1,
              padding: 0,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              border: 0,
            }}
          >
            <DialogTitle>Dialog</DialogTitle>
          </span>
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-4 sm:top-4">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
