# Programmatic SEO Framework

Enterprise-grade AI-powered blog generation system with automatic publishing, uniqueness validation, and SEO optimization.

## Overview

This framework enables you to:
- Generate high-quality, unique blog content at scale using AI
- Ensure each piece of content is genuinely differentiated (not template variations)
- Automatically validate content quality and uniqueness before publishing
- Deploy to production via GitHub Actions
- Track metrics and optimize over time

## Key Features

### Content Uniqueness Engine
Unlike simple template-based systems, this framework ensures **genuine differentiation**:
- **Angle Tracking**: Each topic can only use each content angle once
- **Phrase Fingerprinting**: Detects similarity to existing content
- **Data Point Validation**: Ensures unique facts and statistics per article
- **Quality Scoring**: Multi-factor quality assessment before publishing

### SEO Optimization
- **Answer Engine Optimization (AEO)**: Structured for AI Overviews/Featured Snippets
- **Schema Markup**: Article, FAQ, and Breadcrumb structured data
- **Dynamic Meta Tags**: Unique titles and descriptions per page
- **Internal Linking**: Automatic related posts and category navigation

### Automated Pipeline
- **Content Generation**: AI-powered with human review option
- **Validation**: Automatic quality and uniqueness checks
- **Deployment**: GitHub Actions with multiple hosting options
- **Monitoring**: Metrics tracking and optimization recommendations

## Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd programmatic-seo-framework
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Generate Your First Post
```bash
npm run generate -- --topic "AI Lead Nurturing" --keyword "ai lead nurturing"
```

### 4. Validate Content
```bash
npm run validate:content
```

### 5. Run Locally
```bash
npm run dev
# Visit http://localhost:3000/blog
```

## Project Structure

```
programmatic-seo-framework/
├── content/
│   ├── blog/          # Published blog posts (markdown)
│   └── drafts/        # Content awaiting review
├── src/
│   ├── app/           # Next.js App Router pages
│   │   └── blog/      # Blog listing and post pages
│   ├── lib/           # Core libraries
│   │   ├── blog.ts    # Markdown processing
│   │   └── content-generator.ts  # AI generation engine
│   └── components/    # React components
├── scripts/           # CLI tools
│   ├── generate-content.ts    # Single post generation
│   ├── batch-generate.ts      # Bulk generation
│   └── validate-content.ts    # Quality validation
├── config/
│   └── content-calendar.json  # Scheduled topics
├── knowledge-base/    # Project tracking
│   ├── PROJECT_TRACKER.md
│   ├── research/      # Strategy documentation
│   ├── errors-solutions/  # Issue resolution log
│   └── experiments/   # A/B test results
└── .github/workflows/ # CI/CD pipelines
```

## Content Generation

### Single Post
```bash
npm run generate -- \
  --topic "Email Marketing Automation" \
  --keyword "email marketing automation best practices" \
  --intent informational \
  --audience "small business owners"
```

### Batch Generation
```bash
# Edit config/content-calendar.json with your topics
npm run generate:batch -- --max 5
```

### Content Calendar Format
```json
[
  {
    "topic": "AI Lead Nurturing",
    "keyword": "ai lead nurturing automation",
    "intent": "informational",
    "audience": "real estate professionals",
    "priority": "high",
    "status": "pending"
  }
]
```

## Uniqueness System

The framework prevents duplicate/similar content through:

1. **Content Angles**: 10+ distinct angles per intent type
   - `beginner-guide`, `expert-deep-dive`, `case-study`
   - `comparison`, `step-by-step`, `common-mistakes`
   - `future-trends`, `data-analysis`, `contrarian-view`

2. **Similarity Detection**:
   - Key phrase extraction and comparison
   - Maximum 40% overlap threshold
   - Automatic regeneration if threshold exceeded

3. **Unique Data Requirements**:
   - Minimum 3 unique data points per article
   - Source verification tracking
   - Data point registry to prevent reuse

## Validation Checks

Every piece of content is validated for:

| Check | Requirement | Severity |
|-------|-------------|----------|
| Word Count | Minimum 1,500 words | Error |
| Title Length | Under 60 characters | Warning |
| Description | 50-160 characters | Warning |
| Structure | 3+ H2s, 2+ H3s, 3+ lists | Warning |
| Uniqueness | <40% similarity to existing | Error |
| Data Points | 5+ statistics/facts | Warning |
| FAQ Section | 3+ Q&A pairs | Warning |
| Actionability | 10+ action indicators | Warning |
| First Paragraph | Answers search intent | Error |

## Deployment

### Vercel (Recommended)
```bash
# Set up secrets in GitHub:
# VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
```

### Netlify
```bash
# Set DEPLOY_TARGET=netlify in GitHub variables
# Set NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID secrets
```

### AWS S3/CloudFront
```bash
# Set DEPLOY_TARGET=aws in GitHub variables
# Set AWS credentials as secrets
```

## Metrics & Optimization

Track these key metrics in `knowledge-base/metrics/`:

**Content Quality**
- Average uniqueness score
- Validation pass rate
- Human review acceptance rate

**SEO Performance**
- Indexed pages
- Keyword rankings
- AI Overview citations

**Business Impact**
- Organic traffic
- Lead generation
- Conversion rates

## Research Sources

This framework is built on strategies from:

- [Zapier](https://zapier.com): 590K+ programmatic pages, 5.8M monthly visits
- [Canva](https://canva.com): 190K+ template pages, 100M+ monthly visits
- [Wise](https://wise.com): Currency/SWIFT pages, 60M+ monthly visits

Key insights integrated:
- Template-based scaling with genuine unique value
- Data-driven differentiation
- Answer Engine Optimization (AEO)
- Hybrid approach: programmatic + editorial content

## Contributing

1. Add topics to `config/content-calendar.json`
2. Run generation and review drafts
3. Move approved content to `content/blog/`
4. Commit and push to trigger deployment

## License

MIT

---

Built by [US Tech Automations](https://www.ustechautomations.com)
