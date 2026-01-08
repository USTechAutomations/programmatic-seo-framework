import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'US Tech Automations - AI Automation for Business Growth',
  description: 'Expert AI automation solutions for real estate professionals and businesses. Lead nurturing, content generation, and intelligent automation systems.',
};

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-16">
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-6">
          AI-Powered Business Automation
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Transform your business with intelligent automation systems.
          From lead nurturing to content generation, we help you scale efficiently.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/blog"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Read Our Blog
          </Link>
          <a
            href="https://www.ustechautomations.com"
            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-8">
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Geographic Farming Guides</h2>
          <p className="text-gray-600 mb-4">
            Data-driven strategies for real estate agents to dominate their local markets.
          </p>
          <Link href="/blog" className="text-blue-600 font-medium hover:underline">
            Explore Guides →
          </Link>
        </div>
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">AI Automation Insights</h2>
          <p className="text-gray-600 mb-4">
            Learn how to leverage AI for lead nurturing, content creation, and more.
          </p>
          <Link href="/blog" className="text-blue-600 font-medium hover:underline">
            Read Articles →
          </Link>
        </div>
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Market Analysis</h2>
          <p className="text-gray-600 mb-4">
            Verified census data and market insights for informed decision-making.
          </p>
          <Link href="/blog" className="text-blue-600 font-medium hover:underline">
            View Analysis →
          </Link>
        </div>
      </section>
    </main>
  );
}
