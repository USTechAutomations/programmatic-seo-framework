# Programmatic SEO Playbook

## What Makes Programmatic SEO Work

Programmatic SEO succeeds when it provides **unique, relevant data** in formats that serve users' immediate needs. It fails when it produces thin, templated content that offers no real value.

---

## The Zapier Model (App Integration Pages)

### Strategy
- Generate pages for every app integration combination
- Target transactional keywords: "Connect {App1} to {App2}"
- Each page shows actual automation templates users can use

### Why It Works
1. **Genuine Utility**: Users get real, working automation recipes
2. **Perfect Intent Match**: Captures users at decision point
3. **Scalable Uniqueness**: Each combination is genuinely different

### Implementation Pattern
```
/integrations/{app-slug}/
/integrations/{app1}/{app2}/
/apps/{app-slug}/integrations/
```

---

## The Canva Model (Template Pages)

### Strategy
- Create pages for every design use case
- Target: "{type} template", "free {type} templates"
- Show actual templates users can use immediately

### Why It Works
1. **Visual Proof**: Users see exactly what they'll get
2. **Search Intent Alignment**: Meta titles match search queries exactly
3. **Free Value First**: Users can use templates before converting

### Implementation Pattern
```
/templates/{category}/
/templates/{category}/{subcategory}/
/create/{design-type}/
```

---

## The Wise Model (Data-Driven Pages)

### Strategy
- Currency conversion pages with real-time data
- SWIFT/BIC code lookup pages
- Localized for every language/region

### Why It Works
1. **Real-Time Value**: Dynamic data users can't get elsewhere
2. **Structured Data**: Rich snippets in search results
3. **Global Scale**: Automatic localization multiplies reach

### Implementation Pattern
```
/{currency1}-to-{currency2}/
/swift-codes/{country}/{bank}/
/{language}/currency-converter/
```

---

## Content Quality Framework

### The "Would This Page Exist Without SEO?" Test
Ask: If search engines didn't exist, would this page still provide value?
- YES = Good programmatic content
- NO = Thin content risk

### Minimum Content Requirements

| Element | Purpose | Example |
|---------|---------|---------|
| Unique Data | Differentiation | Real-time prices, stats, reviews |
| Structured Info | Scannable value | Tables, lists, specs |
| Expert Context | Authority signals | Analysis, recommendations |
| User Actions | Conversion path | CTAs, tools, templates |
| Internal Links | Discoverability | Related pages, hub navigation |

---

## Technical Implementation Checklist

### URL Structure
- [ ] Clean, keyword-rich URLs
- [ ] Logical hierarchy (category/subcategory/page)
- [ ] Canonical tags for duplicate prevention
- [ ] Hreflang for multi-language

### Page Template
- [ ] Dynamic meta title (under 60 chars)
- [ ] Dynamic meta description (under 155 chars)
- [ ] H1 matches search intent
- [ ] Schema markup (Article, FAQ, HowTo, Product as appropriate)
- [ ] Open Graph + Twitter cards
- [ ] Fast loading (<3s LCP)

### Internal Linking
- [ ] Hub pages link to all related pages
- [ ] Related pages link to each other
- [ ] Breadcrumbs for navigation
- [ ] Sitemap includes all pages

### Content Generation
- [ ] Unique intro paragraph per page
- [ ] Data-driven middle sections
- [ ] Clear value proposition
- [ ] Specific CTAs
- [ ] FAQ section (structured for AI Overviews)

---

## AI Content Generation Best Practices

### Prompt Engineering for SEO Content

```markdown
## System Prompt Template

You are an expert content writer for [NICHE]. Write content that:
1. Directly answers the user's search intent
2. Provides unique insights not found elsewhere
3. Uses structured formatting (headers, lists, tables)
4. Includes specific examples and data points
5. Naturally incorporates the target keyword
6. Answers related questions users might have

Target keyword: {keyword}
Search intent: {intent}
Audience: {audience}
Content length: {word_count}
```

### Quality Gates
1. **Factual Accuracy**: Verify all claims and statistics
2. **Originality Check**: Ensure no direct copying
3. **Readability**: Flesch-Kincaid score appropriate for audience
4. **SEO Compliance**: Keyword usage, meta data, structure
5. **Human Review**: Final approval before publish

---

## Answer Engine Optimization (AEO)

### What is AEO?
Optimizing content to be cited by AI systems (ChatGPT, Google AI Overviews, Perplexity).

### AEO Best Practices
1. **Clear, Direct Answers**: First paragraph should answer the query
2. **Structured Data**: Schema markup helps AI parse content
3. **FAQ Format**: Question-answer pairs are easily extracted
4. **Authoritative Tone**: AI favors confident, expert content
5. **Citations**: Link to authoritative sources
6. **Recency**: Keep content updated with dates

### Content Structure for AI Extraction
```markdown
## [Question as H2]

[Direct answer in first sentence]. [Supporting context]. [Additional details].

Key points:
- Point 1
- Point 2
- Point 3
```

---

## Scaling Strategy

### Phase 1: Foundation (0-1,000 pages)
- Manual keyword research
- Template development
- Quality baseline establishment
- Technical infrastructure

### Phase 2: Automation (1,000-10,000 pages)
- Automated keyword clustering
- AI content generation with human review
- Batch publishing workflows
- Performance monitoring

### Phase 3: Scale (10,000+ pages)
- Fully automated pipelines
- Anomaly detection for quality
- Dynamic content updates
- International expansion

---

## Sources

- [Backlinko: Programmatic SEO Guide](https://backlinko.com/programmatic-seo)
- [Zapier Case Study](https://practicalprogrammatic.com/examples/zapier/)
- [Canva Case Study](https://practicalprogrammatic.com/examples/canva)
- [Rock The Rankings: pSEO for SaaS](https://www.rocktherankings.com/programmatic-seo/)
- [Surfer SEO: Salesforge Case Study](https://surferseo.com/blog/salesforge-seo-growth-study/)
- [GrackerAI: pSEO Examples 2025](https://gracker.ai/blog/10-programmatic-seo-case-studies--examples-in-2025)
