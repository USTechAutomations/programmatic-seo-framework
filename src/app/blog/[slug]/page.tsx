// =============================================================================
// Individual Blog Post Page - /blog/[slug]
// =============================================================================
// Full blog post with comprehensive SEO, structured data for Article + FAQ,
// and related posts for internal linking.
// =============================================================================

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllSlugs,
  getPostBySlug,
  getRelatedPosts,
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@/lib/blog';

// -----------------------------------------------------------------------------
// STATIC GENERATION
// -----------------------------------------------------------------------------

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

// -----------------------------------------------------------------------------
// DYNAMIC SEO METADATA
// -----------------------------------------------------------------------------

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ustechautomations.com';
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  return {
    title: post.metaTitle || `${post.title} | US Tech Automations Blog`,
    description: post.metaDescription || post.description,
    authors: [{ name: post.author }],
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.lastModified || post.date,
      authors: [post.author],
      tags: post.tags,
      images: post.featuredImage
        ? [{ url: post.featuredImage, alt: post.title }]
        : [],
      url: postUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.featuredImage ? [post.featuredImage] : [],
    },
    alternates: {
      canonical: post.canonical || postUrl,
    },
    robots: post.noindex ? { index: false, follow: true } : undefined,
  };
}

// -----------------------------------------------------------------------------
// PAGE COMPONENT
// -----------------------------------------------------------------------------

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, relatedPosts] = await Promise.all([
    getPostBySlug(slug),
    getRelatedPosts(slug, 3),
  ]);

  if (!post) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ustechautomations.com';

  // Generate structured data
  const articleSchema = generateArticleSchema(post, siteUrl);
  const faqSchema = post.faqItems ? generateFAQSchema(post.faqItems) : null;
  const breadcrumbSchema = generateBreadcrumbSchema(post, siteUrl);

  return (
    <>
      {/* Structured Data - Multiple schemas for rich snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumbs for navigation and SEO */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-blue-600">Home</Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/blog" className="hover:text-blue-600">Blog</Link>
            </li>
            <li>/</li>
            <li>
              <Link
                href={`/blog/category/${encodeURIComponent(post.category.toLowerCase())}`}
                className="hover:text-blue-600"
              >
                {post.category}
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-700 font-medium truncate max-w-[200px]">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* Article Header */}
        <header className="mb-8">
          {/* Category */}
          <Link
            href={`/blog/category/${encodeURIComponent(post.category.toLowerCase())}`}
            className="text-blue-600 text-sm font-semibold uppercase tracking-wide hover:underline"
          >
            {post.category}
          </Link>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {post.author.charAt(0)}
              </div>
              <div>
                <span className="font-medium text-gray-900">{post.author}</span>
              </div>
            </div>
            <span className="text-gray-300">|</span>
            <time dateTime={post.date} className="text-gray-600">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-gray-300">|</span>
            <span>{post.readingTime}</span>
            <span className="text-gray-300">|</span>
            <span>{post.wordCount.toLocaleString()} words</span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${encodeURIComponent(tag.toLowerCase())}`}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImage && (
          <figure className="mb-8">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full rounded-lg shadow-lg"
              loading="eager"
            />
          </figure>
        )}

        {/* Article Content */}
        <article
          className="prose prose-lg max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* FAQ Section (if not in content) */}
        {post.faqItems && post.faqItems.length > 0 && !post.content.includes('## FAQ') && (
          <section className="mt-12 pt-8 border-t">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {post.faqItems.map((faq, index) => (
                <details
                  key={index}
                  className="group bg-gray-50 rounded-lg"
                >
                  <summary className="flex justify-between items-center cursor-pointer p-4 font-semibold">
                    {faq.question}
                    <span className="ml-4 flex-shrink-0 transition-transform group-open:rotate-180">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-4 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Author Bio / CTA */}
        <section className="mt-12 p-6 bg-blue-50 rounded-xl">
          <h2 className="text-xl font-bold mb-2">Ready to Transform Your Business?</h2>
          <p className="text-gray-600 mb-4">
            US Tech Automations helps businesses implement AI-powered automation
            systems that save time and increase revenue.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get a Free Consultation
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-12 pt-8 border-t">
            <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <article key={related.slug} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <span className="text-xs text-blue-600 font-medium uppercase">
                    {related.category}
                  </span>
                  <h3 className="font-semibold mt-1 mb-2 line-clamp-2">
                    <Link href={`/blog/${related.slug}`} className="hover:text-blue-600">
                      {related.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {related.description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Back Link */}
        <footer className="mt-12 pt-8 border-t">
          <Link
            href="/blog"
            className="inline-flex items-center text-blue-600 hover:underline"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to all posts
          </Link>
        </footer>
      </main>
    </>
  );
}
