# SEO Project - CLAUDE.md

This file provides guidance for the SEO/Programmatic Content project within the USTA repository.

## Project Overview

This project generates enterprise-grade geographic farming blog posts for real estate agents. The blogs are SEO-optimized and designed to rank in both traditional search and AI answer engines.

## Directory Structure

```
seo/
├── content/
│   ├── blog/           # Published blog posts (auto-publish destination)
│   ├── drafts/         # Draft posts awaiting review
│   ├── briefs/         # Market research briefs
│   └── cities/         # City-level content
├── scripts/
│   └── generate-geofarm-blog.ts  # Main blog generation script
├── src/lib/enterprise/  # Enterprise SEO utilities
└── data/               # Research data and snapshots
```

## Blog Generation Workflow

### Step 1: Generate Blog
```bash
tsx scripts/generate-geofarm-blog.ts --brief content/briefs/location-brief.md
```

### Step 2: Auto-Publish (Automatic)
If validation score >= 8/10, the blog is automatically published to `content/blog/`.

### Step 3: Blog Formatter (AUTOMATIC TRIGGER - CRITICAL)

**MANDATORY BEHAVIOR:** After ANY blog is published to `seo/content/blog/`, Claude MUST:

1. **Change directory** to `/home/gmullins/code/USTA`
2. **Run** the `/blog-formatter` skill
3. **Stay** in `/home/gmullins/code/USTA` until the skill completes
4. **Never** change directory during skill execution

This is triggered automatically when the generate script outputs:
```
---BLOG_FORMATTER_TRIGGER---
```

## Auto-Trigger Detection

When you see any of these patterns in output, IMMEDIATELY trigger the blog-formatter workflow:

1. `---BLOG_FORMATTER_TRIGGER---` in script output
2. `AUTO-TRIGGER: /blog-formatter` message
3. A new `.md` file created in `seo/content/blog/`

### Trigger Response

Upon detecting any trigger, execute this sequence:

```bash
# 1. Change to USTA root (REQUIRED - do not skip)
cd /home/gmullins/code/USTA

# 2. Verify directory
pwd  # Must show /home/gmullins/code/USTA

# 3. Run blog-formatter skill
/blog-formatter

# 4. DO NOT change directory until skill completes
```

## Configuration

### Author Settings
- **Name:** Garrett Mullins
- **Title:** Workflow Specialist at US Tech Automations
- **LinkedIn:** https://www.linkedin.com/in/garrett-mullins-975717105/
- **Avatar:** https://ustechautomations.com/logo.png (company logo)

### Auto-Publish Settings
- **Minimum Score:** 8/10
- **Enabled:** true

### Internal Link Validation
All internal blog links are validated against:
- `/home/gmullins/code/USTA/usta-react/src/website/content/blog/`
- `seo/content/blog/`

## Image Validation (CRITICAL - BEFORE PUBLISHING)

**ALWAYS validate cover photos before publishing.** Invalid Unsplash photo IDs will cause missing images on the website.

### Validation Command
```bash
# Validate all blogs before publishing
npx tsx scripts/validate-blog-images.ts

# Validate registry photos
npx tsx scripts/validate-blog-images.ts --registry

# Validate single file
npx tsx scripts/validate-blog-images.ts --file path/to/blog.md
```

### Quick HTTP Check
```bash
# Manually verify a photo ID works
curl -s -o /dev/null -w "%{http_code}" "https://images.unsplash.com/photo-XXXXX?w=100"
# Should return 200, not 404
```

### Pre-Publish Checklist
1. **Extract photo ID** from coverPhoto/featuredImage URL
2. **Test the URL** returns HTTP 200 (not 404)
3. **If 404**, find a replacement photo from Unsplash
4. **Update** the blog and registry with valid photo

### Programmatic Validation
```typescript
import { validateCoverPhoto } from './src/lib/blog-registry';

const result = await validateCoverPhoto(photoUrl);
if (!result.valid) {
  throw new Error(`Invalid photo URL: ${result.status}`);
}
```

## Neighborhood-Specific Photo Discovery (MANDATORY)

**ALWAYS use the neighborhood photo discovery system** to find relevant cover images. Generic photos are NO LONGER acceptable.

### How It Works

The system discovers photos relevant to specific neighborhoods by:
1. Generating smart search keywords from neighborhood characteristics
2. Searching Unsplash for matching photos
3. Falling back to curated regional photos if needed
4. Validating URLs before assignment

### Usage in Blog Generation

```typescript
import { BlogRegistry } from './src/lib/blog-registry';

const registry = new BlogRegistry();

// PREFERRED: Get neighborhood-specific photo
const coverPhoto = await registry.getNeighborhoodPhoto({
  neighborhood: 'Astoria',
  city: 'Queens',
  state: 'NY',
  medianPrice: 650000,
  vibe: 'diverse young professional'
});

// Alternative: Get from brief data
const photoFromBrief = await registry.getPhotoFromBrief(brief);

// Fallback: Curated library (only if discovery fails)
const fallbackPhoto = registry.getUniqueCoverPhoto('queens');
```

### Context Fields for Better Photos

Provide as much context as possible for better photo matching:

| Field | Example | Impact |
|-------|---------|--------|
| `neighborhood` | "Astoria" | Primary search term |
| `city` | "Queens" | Regional filtering |
| `state` | "NY" | State-level fallback |
| `medianPrice` | 650000 | Luxury vs affordable imagery |
| `vibe` | "hip creative" | Style matching |
| `landmarks` | ["Steinway Street"] | Specific location photos |
| `architecture` | "brownstone" | Architectural style |

### Unsplash API (Optional)

For enhanced photo discovery, set the `UNSPLASH_ACCESS_KEY` environment variable:
```bash
export UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

Without the API key, the system uses curated fallback photos.

### Photo Discovery Files
- **Discovery Module:** `src/lib/enterprise/neighborhood-photo-discovery.ts`
- **Integration:** `src/lib/blog-registry.ts` → `getNeighborhoodPhoto()`
- **Validation:** `src/lib/enterprise/content-validation.ts`

## Blocked Photos (CRITICAL - NEVER USE)

Some photos have been overused and are **permanently blocked**. The system maintains a blocklist in `src/lib/blog-registry.ts`.

### Currently Blocked Photos
| Photo ID | Reason |
|----------|--------|
| `photo-1560518883-ce09059eeffa` | Overused across 26+ blogs (Bayside, Fordham, Bed-Stuy, etc.) |

### How Blocking Works
1. Blocked photos are defined in `BLOCKED_PHOTO_IDS` array in `blog-registry.ts`
2. `getUniqueCoverPhoto()` automatically skips blocked photos
3. `isPhotoUsed()` returns true for blocked photos (prevents manual selection)

### Before Using Any Photo
```typescript
import { isPhotoBlocked, getBlockedPhotos } from './src/lib/blog-registry';

// Check if a specific photo is blocked
if (isPhotoBlocked('photo-1560518883-ce09059eeffa')) {
  console.error('This photo is permanently blocked!');
}

// Get all blocked photos
const blocked = getBlockedPhotos();
```

### Adding New Blocked Photos
To permanently block a photo, add it to `BLOCKED_PHOTO_IDS` array at the top of `src/lib/blog-registry.ts`:
```typescript
const BLOCKED_PHOTO_IDS: string[] = [
  'photo-1560518883-ce09059eeffa', // BLOCKED: Overused across 26+ blogs
  'photo-NEW-ID-HERE',              // BLOCKED: [reason]
];
```

## Content Length Requirements (CRITICAL)

**Hard Minimum:** 2,000 words per blog
**Target Range:** 2,000 - 4,000 words
**Blogs under 2,000 words are NOT acceptable for publishing**

### Pre-Publish Word Count Check
```bash
# Check word count before publishing
wc -w path/to/blog.md
# Must show 2000+ words (excluding frontmatter)
```

### Why This Matters
- SEO: Google favors comprehensive, in-depth content
- E-E-A-T: Longer content demonstrates expertise
- User Value: Agents need actionable, detailed guides
- Competition: Top-ranking content averages 2,500+ words

### If Word Count Is Low
1. Expand market analysis sections with more data
2. Add detailed neighborhood sub-sections
3. Include more specific strategies and tactics
4. Add FAQ section (5-10 questions)
5. Expand financial projections with scenarios

## Critical Rules

### ⚠️ NON-NEGOTIABLE REQUIREMENTS (Claude MUST enforce these automatically)

1. **NEVER** generate fake statistics - use real, verifiable data sources
2. **ALWAYS** include author E-E-A-T block with LinkedIn link
3. **ALWAYS** run /blog-formatter from USTA root after publishing
4. **NEVER** change directory during /blog-formatter execution
5. **ALWAYS** validate internal blog links before publishing
6. **ALWAYS** validate cover photo URLs return HTTP 200 before publishing
7. **NEVER** include internal/inline images in blog content - ONLY the cover photo in frontmatter
8. **ALWAYS** use the 6-template structural diversity system for ALL geo-farming blogs
9. **NEVER** use blocked photos - check `BLOCKED_PHOTO_IDS` in `src/lib/blog-registry.ts`
10. **ALWAYS** use unique cover photos - every blog MUST have a different image
11. **ALWAYS** verify 2,000+ word count before publishing ANY blog
12. **NEVER** publish blogs under 2,000 words - expand content first
13. **ALWAYS** use neighborhood-specific photo discovery for relevant cover images
14. **ALWAYS** check blog-pipeline.json before generating any batch

### Automatic Enforcement

Claude MUST automatically enforce these rules WITHOUT being reminded:
- **Word Count**: Check `countWords()` from `src/lib/enterprise/content-validation.ts`
- **Template Rotation**: Use `getNextTemplateId()` from `src/lib/enterprise/template-tracker.ts`
- **Photo Discovery**: Use `getNeighborhoodPhoto()` from `src/lib/blog-registry.ts`
- **Pipeline Check**: Read `content/blog-pipeline.json` at session start

## 6-Template Structural Diversity System (MANDATORY)

**CRITICAL:** ALL geo-farming blogs MUST use one of the 6 structural templates to defeat Google's SpamBrain pattern detection. NEVER generate blogs without first selecting the appropriate template.

### The 6 Templates

| ID | Name | Theme | Title Pattern | Slug Pattern |
|----|------|-------|---------------|--------------|
| 1 | **ATLAS** | Market Discovery | "[Location] Real Estate Farming: Market Analysis & Agent Opportunity Guide [Year]" | `[location]-real-estate-farming-market-analysis` |
| 2 | **PERSONA** | Human-Centric | "Who Lives in [Location]? A Real Estate Agent's Guide to Farming [Neighborhood]" | `[location]-homeowner-demographics-farming-guide` |
| 3 | **CATALYST** | Investment/ROI | "[Location] Farming ROI: Commission Potential & Investment Analysis for Agents" | `[location]-farming-roi-commission-analysis` |
| 4 | **PLAYBOOK** | Action/Strategy | "The [Location] Farming Playbook: Proven Marketing Strategies for Real Estate Agents" | `[location]-farming-playbook-marketing-strategies` |
| 5 | **COMPASS** | Navigation/Warning | "Avoid These [Location] Farming Mistakes: What [Region] Agents Get Wrong" | `[location]-farming-mistakes-to-avoid` |
| 6 | **BLUEPRINT** | Planning/Architecture | "Your [Location] Farming Blueprint: A Strategic Guide for [Region] Agents" | `[location]-farming-blueprint-strategic-guide` |

### Template Rotation Rules (CRITICAL)
1. **NEVER** use the same template twice in a row
2. **NEVER** use any template from the last 2 blogs
3. **PREFER** templates with lowest usage count
4. **ALWAYS** check `content-registry.json` → `structuralTemplates.recentHistory` before selection

### Before Generating ANY Blog
1. Read `content-registry.json` to check `structuralTemplates.recentHistory`
2. Identify which templates are EXCLUDED (last 2 in history)
3. Select from remaining templates, preferring lowest `usageCount`
4. Generate blog following the selected template's structure
5. Update `content-registry.json` after generation

### Template Files
- **Definitions:** `src/lib/enterprise/structural-templates.ts`
- **Tracker:** `src/lib/enterprise/template-tracker.ts`
- **State:** `content-registry.json` (structuralTemplates section)
- **Documentation:** `docs/STRUCTURAL_TEMPLATE_DIVERSITY_PLAN.md`

## Image Policy (CRITICAL)

**ONLY the cover/featured image is allowed.** No internal images within blog content.

### What IS allowed:
- `featuredImage` in frontmatter (Unsplash URL)
- Cover photo for social sharing and blog header

### What is NOT allowed:
- `![alt text](/images/...)` - NO local image references
- `![alt text](https://...)` - NO inline images in content
- `<img src="...">` - NO HTML image tags in content
- Infographics, charts, or any embedded images

### Why:
Internal image links break (404 errors) because:
- Local `/images/` paths don't exist in production
- Generated image URLs become invalid over time
- Maintaining image assets is error-prone

### Enforcement:
When generating or reviewing blogs, **strip all image markdown** except the frontmatter `featuredImage`. Replace image references with descriptive text or tables where data visualization was intended.

## Blog Pipeline System (MANDATORY - CHECK EVERY SESSION)

The blog pipeline tracks all planned and published blogs. **This file MUST be checked at the start of every blog generation session.**

### Pipeline File Location
```
seo/content/blog-pipeline.json
```

### Automatic Pipeline Check (REQUIRED)

**Before generating ANY blogs, Claude MUST:**

1. **Read the pipeline file:**
   ```bash
   cat seo/content/blog-pipeline.json
   ```

2. **Check metadata:**
   - `nextBlogId`: The next ID to use
   - `templateRotation.lastUsed`: Last 3 templates used (avoid first 2)
   - `totalPlanned`: How many blogs are in the pipeline
   - `totalPublished`: How many blogs have been published

3. **Find next neighborhoods to write:**
   - Look for `"status": "pending"` entries
   - Prioritize by ring (inner rings first)
   - Check metro priority if specified

### When User Asks "What are the next blogs?"

Claude MUST:
1. Read `blog-pipeline.json`
2. Find all pending neighborhoods
3. Present the next batch (typically 20-25) with:
   - Metro area
   - Ring number
   - Neighborhood name
   - State
   - Estimated median price
   - Suggested template (based on rotation)

### After Publishing a Batch

Claude MUST update `blog-pipeline.json`:

1. **Update each published neighborhood:**
   ```json
   {
     "id": 213,
     "name": "Hoboken",
     "status": "published",
     "template": "ATLAS",
     "publishedDate": "2026-01-24"
   }
   ```

2. **Update metadata:**
   ```json
   {
     "nextBlogId": 233,
     "totalPublished": 232,
     "templateRotation": {
       "lastUsed": ["BLUEPRINT", "PLAYBOOK", "ATLAS"]
     }
   }
   ```

3. **Update ring status if complete:**
   ```json
   {
     "ring": 1,
     "status": "complete"
   }
   ```

### Pipeline Structure

```json
{
  "metadata": {
    "lastUpdated": "2026-01-24",
    "totalPlanned": 250,
    "totalPublished": 212,
    "nextBlogId": 213
  },
  "templateRotation": {
    "lastUsed": ["COMPASS", "CATALYST", "PERSONA"],
    "templates": ["ATLAS", "PERSONA", "CATALYST", "PLAYBOOK", "COMPASS", "BLUEPRINT"]
  },
  "pipeline": {
    "metro_key": {
      "name": "Metro Name",
      "population": "X.XM",
      "rings": [
        {
          "ring": 1,
          "name": "Ring Description",
          "status": "pending|in_progress|complete",
          "neighborhoods": [
            {
              "id": null,
              "name": "Neighborhood",
              "state": "XX",
              "county": "County",
              "medianPrice": 500000,
              "status": "pending|published",
              "template": null
            }
          ]
        }
      ]
    }
  },
  "published": {
    "count": 212,
    "lastPublishedId": 212
  }
}
```

### Adding New Research to Pipeline

When user provides new neighborhoods to research:

1. **Add to appropriate metro** in `blog-pipeline.json`
2. **Create new ring** if needed
3. **Include all required fields:**
   - name, state, county, medianPrice
   - status: "pending"
   - id: null (assigned when published)
   - template: null (assigned when written)

4. **Update totalPlanned** in metadata

### Session Limits

| Blogs per Session | Quality | Recommendation |
|-------------------|---------|----------------|
| 5-10 | Excellent | Quick sessions |
| 15-20 | Very Good | **Optimal** |
| 25-30 | Good | Max recommended |
| 35+ | Risky | Split into sessions |

### Quick Commands

```bash
# Check pipeline status
cat seo/content/blog-pipeline.json | jq '.metadata'

# Count pending blogs
cat seo/content/blog-pipeline.json | jq '[.pipeline[].rings[].neighborhoods[] | select(.status == "pending")] | length'

# See next 10 pending
cat seo/content/blog-pipeline.json | jq '[.pipeline[].rings[].neighborhoods[] | select(.status == "pending")][0:10]'
```

## Pre-Generation Checklist (MANDATORY)

**Claude MUST complete this checklist before generating ANY blog:**

### ✅ Step 1: Check Pipeline
```bash
cat seo/content/blog-pipeline.json | jq '.metadata, .templateRotation'
```
- [ ] Note `nextBlogId`
- [ ] Note last 2 templates in `lastUsed` (these are EXCLUDED)

### ✅ Step 2: Select Template
- [ ] Identify excluded templates (last 2 used)
- [ ] Select from: ATLAS, PERSONA, CATALYST, PLAYBOOK, COMPASS, BLUEPRINT
- [ ] Prefer template with lowest usage count

### ✅ Step 3: Get Neighborhood Photo
```typescript
const photo = await registry.getNeighborhoodPhoto({
  neighborhood: "[name]",
  city: "[city]",
  state: "[state]",
  medianPrice: [price]
});
```
- [ ] Use neighborhood-specific discovery
- [ ] Validate photo URL returns 200
- [ ] Ensure photo is not blocked or used

### ✅ Step 4: Generate Content
- [ ] Follow selected template structure
- [ ] Include all required sections
- [ ] Target 2,500-3,500 words

### ✅ Step 5: Validate Before Publishing
```typescript
import { validateContent } from './src/lib/enterprise/content-validation';

const result = await validateContent(content, {
  templateId: 'ATLAS',
  recentTemplates: ['COMPASS', 'CATALYST'],
  coverPhotoUrl: photoUrl
});

if (!result.valid) {
  // FIX ERRORS BEFORE PUBLISHING
}
```

- [ ] Word count ≥ 2,000 words
- [ ] Template rotation valid
- [ ] Cover photo accessible
- [ ] No internal images in content
- [ ] Internal links validated

### ✅ Step 6: Post-Publishing
- [ ] Update blog-pipeline.json with published status
- [ ] Update templateRotation.lastUsed
- [ ] Increment nextBlogId
- [ ] Run /blog-formatter from USTA root

## Validation Module

Use the content validation module for automated checks:

```typescript
import {
  validateWordCount,
  validateTemplateSelection,
  validateCoverPhoto,
  validateContent,
  MINIMUM_WORD_COUNT  // 2000
} from './src/lib/enterprise/content-validation';

// Word count check
const wc = validateWordCount(content);
console.log(wc.message);
// ✅ Excellent! 3245 words (optimal range)
// ❌ REJECTED: 1500 words is far below minimum 2000

// Template check
const template = validateTemplateSelection('ATLAS', ['COMPASS', 'CATALYST']);
console.log(template.message);
// ✅ Template ATLAS is valid (excluded: COMPASS, CATALYST)

// Full validation
const result = await validateContent(content, {
  templateId: 'ATLAS',
  recentTemplates: ['COMPASS', 'CATALYST'],
  coverPhotoUrl: 'https://images.unsplash.com/photo-xxx?w=1200'
});

if (!result.valid) {
  console.error('ERRORS:', result.errors);
  // DO NOT PUBLISH
}
```

## Related Files

- **Main USTA CLAUDE.md:** `/home/gmullins/code/USTA/CLAUDE.md`
- **Blog Formatter Skill:** `/home/gmullins/code/USTA/.claude/commands/blog-formatter.md`
- **SEO Requirements:** `SEO_BLOG_REQUIREMENTS.md`
- **Blog Pipeline:** `seo/content/blog-pipeline.json`
- **Photo Discovery:** `src/lib/enterprise/neighborhood-photo-discovery.ts`
- **Content Validation:** `src/lib/enterprise/content-validation.ts`
- **Template Tracker:** `src/lib/enterprise/template-tracker.ts`
