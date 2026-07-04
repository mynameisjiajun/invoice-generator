// Camera autofocus-reticle corners — the app's one signature visual motif.
// Wraps a hero figure (an amount, an empty-state icon) the way a viewfinder
// locks focus onto its subject. Used sparingly: hero money figures and
// empty states only, never as generic decoration.
export default function FocusFrame({
  children,
  size = 14,
  color = "money",
}: {
  children: React.ReactNode;
  size?: number;
  color?: "money" | "accent";
}) {
  const varColor = color === "money" ? "var(--money)" : "var(--accent)";
  const corner: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    borderColor: varColor,
  };
  return (
    <span style={{ position: "relative", display: "inline-block", padding: size * 0.6 }}>
      <span style={{ ...corner, top: 0, left: 0, borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 3 }} />
      <span style={{ ...corner, top: 0, right: 0, borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 3 }} />
      <span style={{ ...corner, bottom: 0, left: 0, borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 3 }} />
      <span style={{ ...corner, bottom: 0, right: 0, borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 3 }} />
      {children}
    </span>
  );
}
