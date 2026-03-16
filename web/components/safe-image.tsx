// ABOUTME: Client wrapper around next/image that hides broken images gracefully.
// ABOUTME: Falls back to hidden state on load error (e.g. expired media URLs from X).

"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

export function SafeImage(props: ImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) return null;

  return <Image {...props} onError={() => setErrored(true)} />;
}
