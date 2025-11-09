import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Octave Documentation</h1>
        <p className="text-lg mb-8">
          A local-first AI code editor powered by Claude
        </p>
        <Link
          href="/docs"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
