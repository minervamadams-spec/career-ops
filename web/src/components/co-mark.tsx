import { instrumentSerif } from "@/lib/fonts";

// Brand mark — lowercase "of" on brand orange in Instrument Serif, for
// Offerly (renamed 2026-08-13 from the career-ops fork this app is built on
// — see TRADEMARK.md upstream for why: the "career-ops" name/mark itself
// isn't ours to redistribute under, only the MIT-licensed code is).
export function CoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`${instrumentSerif.className} inline-flex shrink-0 items-center justify-center rounded-md bg-brand text-white`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.78),
        letterSpacing: "0.01em",
        lineHeight: 1,
        paddingBottom: Math.round(size * 0.08),
      }}
    >
      of
    </span>
  );
}
