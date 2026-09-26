"use client";

import { useEffect, useState } from "react";
import AnalysisScan from "@/components/AnalysisScan";

const PRANK_HOST = "safestore.co.uk";
const PRANK_LIMIT = 5;
const PRANK_KEY = "article6-serge-safestore-prank";

function SergePrank() {
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", background: "#000", color: "#fff", textAlign: "center", padding: "24px" }}>
      <div>
        <pre aria-label="8-bit skull" style={{ fontFamily: "monospace", fontSize: "clamp(14px, 3vw, 28px)", lineHeight: 1, margin: "0 0 32px", whiteSpace: "pre" }}>{`
   █████████
 ██ ▀▀▀▀▀ ██
██  █   █  ██
██  ▀   ▀  ██
██    █    ██
 ██ █████ ██
   ██ █ ██
   ██ █ ██
`}</pre>
        <h1 style={{ margin: 0, fontFamily: "monospace", fontSize: "clamp(22px, 4vw, 48px)", maxWidth: "900px" }}>
          Serge, you are banned from score.article6.org!
        </h1>
      </div>
    </main>
  );
}

export default function AnalysisExperience({ website, hostname }: { website: string; hostname: string }) {
  const [prank, setPrank] = useState<boolean | null>(hostname === PRANK_HOST ? null : false);

  useEffect(() => {
    if (hostname !== PRANK_HOST) return;

    try {
      const used = Number.parseInt(window.localStorage.getItem(PRANK_KEY) ?? "0", 10) || 0;
      if (used < PRANK_LIMIT) {
        window.localStorage.setItem(PRANK_KEY, String(used + 1));
        setPrank(true);
      } else {
        setPrank(false);
      }
    } catch {
      setPrank(false);
    }
  }, [hostname]);

  if (prank === null) return <main style={{ position: "fixed", inset: 0, background: "#000" }} />;
  if (prank) return <SergePrank />;
  return <AnalysisScan website={website} hostname={hostname} />;
}
