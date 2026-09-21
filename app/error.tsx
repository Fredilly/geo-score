"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="state-page">
      <div>
        <p className="eyebrow">Signal interrupted</p>
        <h1>Something went wrong.</h1>
        <p className="lede">The page could not finish loading.</p>
        <button className="secondary-button" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
