"use client";

export default function JournalError({ reset }: { reset: () => void }) {
  return <section className="journal-index"><h1>Journal unavailable</h1><p className="journal-intro">The posts could not be loaded. Please try again.</p><button className="blog-button" onClick={reset}>Try again</button></section>;
}
