// =============================================================================
// Blog Listing Page - /blog
// =============================================================================
// SEO-optimized blog listing with structured data and filtering capabilities.
// Statically generated at build time for optimal performance.
// =============================================================================

import { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, getAllTags, getAllCategories } from '@/lib/blog';

// -----------------------------------------------------------------------------
// SEO METADATA
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Blog | US Tech Automations - AI Automation Insights',
  description: 'Expert insights on AI automation, lead nurturing, and business efficiency. Learn how to scale your business with intelligent automation systems.',
  openGraph: {
    title: 'Blog | US Tech Automations',
    description: 'Expert insights on AI automation for real estate and business',
    type: 'website',
    url: '/blog',
  },
  alternates: {
    canonical: '/blog',
  },
};

// -----------------------------------------------------------------------------
// PAGE COMPONENT
// -----------------------------------------------------------------------------

export default async function BlogPage() {
  const [posts, tags, categories] = await Promise.all([
    getAllPosts(),
    getAllTags(),
    getAllCategories(),
  ]);

  // Generate JSON-LD for blog listing
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'US Tech Automations Blog',
    description: 'Expert insights on AI automation and business efficiency',
    url: process.env.NEXT_PUBLIC_SITE_URL + '/blog',
    blogPost: posts.slice(0, 10).map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: {
        '@type': 'Organization',
        name: post.author,
      },
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${post.slug}`,
    })),
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Page Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4">
            AI Automation Insights
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Expert guides, case studies, and practical strategies for scaling your
            business with intelligent automation.
          </p>
        </header>

        {/* Category/Tag Filter */}
        <nav className="mb-8" aria-label="Blog categories">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 mr-2">Categories:</span>
            {categories.map((category) => (
              <Link
                key={category}
                href={`/blog/category/${encodeURIComponent(category.toLowerCase())}`}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full hover:bg-blue-200 transition-colors"
              >
                {category}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 mr-2">Topics:</span>
            {tags.slice(0, 8).map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${encodeURIComponent(tag.toLowerCase())}`}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </nav>

        {/* Featured Post */}
        {posts.length > 0 && (
          <section className="mb-12">
            <article className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white">
              <div className="flex items-center gap-4 text-blue-100 text-sm mb-3">
                <span className="bg-blue-500 px-2 py-1 rounded">Featured</span>
                <time dateTime={posts[0].date}>
                  {new Date(posts[0].date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>{posts[0].readingTime}</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <Link href={`/blog/${posts[0].slug}`} className="hover:underline">
                  {posts[0].title}
                </Link>
              </h2>
              <p className="text-blue-100 text-lg mb-4 max-w-2xl">
                {posts[0].description}
              </p>
              <Link
                href={`/blog/${posts[0].slug}`}
                className="inline-flex items-center text-white font-semibold hover:underline"
              >
                Read More
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </article>
          </section>
        )}

        {/* Blog Post Grid */}
        <section>
          <h2 className="sr-only">All Posts</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.slice(1).map((post) => (
              <article
                key={post.slug}
                className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white"
              >
                {/* Category Badge */}
                <div className="mb-3">
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                    {post.category}
                  </span>
                </div>

                {/* Post Meta */}
                <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                  <span>·</span>
                  <span>{post.readingTime}</span>
                </div>

                {/* Post Title */}
                <h3 className="text-xl font-semibold mb-2 line-clamp-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {post.title}
                  </Link>
                </h3>

                {/* Post Description */}
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {post.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-xs rounded text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Empty State */}
        {posts.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Coming Soon
            </h2>
            <p className="text-gray-500">
              Our first blog posts are on the way. Check back soon!
            </p>
          </div>
        )}

        {/* Load More / Pagination would go here */}
      </main>
    </>
  );
}
