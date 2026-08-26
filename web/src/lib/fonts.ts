import localFont from "next/font/local";

// Body / UI — vendored under src/fonts (SIL Open Font License). Keeping these
// local makes the desktop/offline build deterministic: next/font/google would
// otherwise fetch font files during every new build cache.
export const inter = localFont({
  src: "../fonts/inter-latin-variable.ttf",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

// Editorial display — Instrument Serif. The home uses it for the hero display
// copy and section headings (the "career-ops" editorial voice). Regular +
// italic (pull-quotes) mirror the docs lib/fonts.ts.
export const instrumentSerif = localFont({
  src: "../fonts/instrument-serif-regular.ttf",
  weight: "400",
  style: "normal",
  variable: "--font-instrument-serif",
  display: "swap",
});

export const instrumentSerifItalic = localFont({
  src: "../fonts/instrument-serif-italic.ttf",
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif-italic",
  display: "swap",
});
