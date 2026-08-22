# Copy to Clipboard

Copies text to the user's clipboard and communicates the result clearly. The component should provide both a short-lived toast and persistent inline feedback so the interaction remains understandable across desktop, mobile, and assistive-technology workflows.

## Basic Usage

```tsx
<CopyToClipboard value="npm install @acme/ui">
  Copy install command
</CopyToClipboard>
```

## Toast Feedback

Use a toast for immediate confirmation after a successful copy. Keep the message concise and do not make the toast the only success signal.

```tsx
<CopyToClipboard
  value="npm install @acme/ui"
  toast={{
    success: "Copied to clipboard",
    error: "Could not copy text"
  }}
>
  Copy command
</CopyToClipboard>
```

The toast should:

- appear only after the clipboard operation resolves;
- announce success and failure through the application's toast/live-region system;
- avoid exposing the copied value when it may contain sensitive data;
- disappear automatically without stealing focus.

## Inline Feedback

Inline feedback gives the control a stable state that remains visible after the toast disappears.

```tsx
<CopyToClipboard
  value="npm install @acme/ui"
  feedback={{
    success: "Copied",
    error: "Copy failed",
    resetAfter: 2000
  }}
>
  Copy command
</CopyToClipboard>
```

The feedback should:

- expose a text status such as `Copied` or `Copy failed`;
- use an `aria-live="polite"` status region;
- preserve the control's accessible name and keyboard behavior;
- reset after a short delay only when doing so does not hide an error;
- leave focus on the triggering control.

## Combined Behavior

Use both channels for a polished interaction:

1. The user activates the control with a pointer, keyboard, or touch.
2. The component attempts `navigator.clipboard.writeText(value)`.
3. On success, it shows the success toast and inline `Copied` status.
4. On failure, it shows the error toast and inline `Copy failed` status.
5. The control remains usable for another copy operation.

The component must handle unavailable clipboard permissions and insecure contexts as a normal failure state. It must not claim that text was copied before the clipboard promise resolves.
