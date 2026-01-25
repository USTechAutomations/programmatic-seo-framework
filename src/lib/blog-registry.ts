/**
 * Blog Registry - Duplicate Detection & Unique Cover Photo Management
 * =====================================================================
 *
 * This module ensures:
 * 1. No duplicate neighborhood blogs are created
 * 2. Every blog gets a unique cover photo (never reused)
 * 3. Neighborhood-specific photo discovery for relevant imagery
 *
 * Usage:
 *   import { BlogRegistry } from '../src/lib/blog-registry';
 *   const registry = new BlogRegistry();
 *
 *   // Check before generating
 *   if (registry.hasNeighborhood('east-village', 'manhattan', 'ny')) {
 *     throw new Error('This neighborhood blog already exists!');
 *   }
 *
 *   // Get neighborhood-specific cover photo (NEW - preferred method)
 *   const coverPhoto = await registry.getNeighborhoodPhoto({
 *     neighborhood: 'Astoria',
 *     city: 'Queens',
 *     state: 'NY',
 *     medianPrice: 650000
 *   });
 *
 *   // Fallback: Get unique cover photo from curated library
 *   const fallbackPhoto = registry.getUniqueCoverPhoto('queens');
 */

import fs from 'fs';
import path from 'path';
import {
  discoverNeighborhoodPhotos,
  getBestNeighborhoodPhoto,
  extractContextFromBrief,
  validatePhotoUrl,
  NeighborhoodContext,
  DiscoveredPhoto
} from './enterprise/neighborhood-photo-discovery';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'blog-registry.json');
const USTA_BLOG_DIR = '/home/gmullins/code/USTA/usta-react/src/website/content/blog';
const SEO_BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

// =============================================================================
// BLOCKED PHOTOS - NEVER USE THESE AGAIN
// =============================================================================
// These photos have been overused or retired. They are permanently blocked
// from selection regardless of category or availability.
// Add photo IDs here (without 'photo-' prefix) to permanently block them.
// =============================================================================
const BLOCKED_PHOTO_IDS: string[] = [
  'photo-1560518883-ce09059eeffa', // BLOCKED: Overused across 26+ blogs (Bayside, Fordham, etc.)
];

// Curated Unsplash photos for real estate/neighborhood content
// Each category has unique photos that will only be used once
const COVER_PHOTO_LIBRARY: Record<string, string[]> = {
  // NYC neighborhoods - iconic city shots
  'nyc': [
    'photo-1534430480872-3498386e7856', // NYC skyline
    'photo-1555529669-e69e7aa0ba9a', // NYC street
    'photo-1496442226666-8d4d0e62e6e9', // NYC buildings
    'photo-1499092346589-b9b6be3e94b2', // NYC architecture
    'photo-1518391846015-55a9cc003b25', // Manhattan view
    'photo-1543716091-a840c05249ec', // Brooklyn bridge
    'photo-1485871981521-5b1fd3805eee', // NYC aerial
    'photo-1522083165195-3424ed129620', // NYC brownstones
    'photo-1480714378408-67cf0d13bc1b', // NYC downtown
    'photo-1534270804882-6b5048b1c1fc', // NYC residential
    'photo-1570168007204-dfb528c6958f', // NYC urban
    'photo-1582407947304-fd86f028f716', // City real estate
    'photo-1560520653-9e0e4c89eb11', // NYC neighborhood
    'photo-1555109307-f7d9da25c244', // NYC living
    'photo-1502672260266-1c1ef2d93688', // Urban apartment
    'photo-1512917774080-9991f1c4c750', // Modern condo
    'photo-1600596542815-ffad4c1539a9', // Luxury home
    'photo-1600607687939-ce8a6c25118c', // House exterior
    'photo-1600585154340-be6161a56a0c', // Property front
    'photo-1600573472550-8090b5e0745e', // Residential street
    'photo-1568605114967-8130f3a36994', // Single family home
    'photo-1523217582562-09d0def993a6', // Brownstone
    'photo-1580587771525-78b9dba3b914', // Townhouse
    'photo-1564013799919-ab600027ffc6', // Modern house
  ],
  // Brooklyn specific
  'brooklyn': [
    'photo-1558981403-c5f9899a28bc', // Brooklyn street
    'photo-1555992336-03a23f37e571', // Brooklyn brownstones
    'photo-1580137197581-df2bb346a786', // Brooklyn park
    'photo-1567684014761-b65e2e59b9eb', // Brooklyn buildings
    'photo-1595880500386-4b33823094d0', // Brooklyn neighborhood
    'photo-1611348586804-61bf6c080437', // Brooklyn view
  ],
  // Manhattan specific
  'manhattan': [
    'photo-1534430480872-3498386e7856', // Manhattan skyline
    'photo-1555883006-0f5a0915a80f', // Manhattan buildings
    'photo-1568515387631-8b650bbcdb90', // Manhattan street
    'photo-1558618666-fcd25c85cd64', // Manhattan aerial
    'photo-1513635269975-59663e0ac1ad', // Times Square area
    'photo-1722030670436-3df19cd72050', // Manhattan waterfront (Battery Park City)
  ],
  // Queens specific
  'queens': [
    'photo-1570168007204-dfb528c6958f', // Queens urban
    'photo-1583608205776-bfd35f0d9f83', // Residential Queens
    'photo-1600047509358-9dc75507daeb', // Queens neighborhood
    'photo-1600566753190-17f0baa2a6c4', // Queens homes
  ],
  // Seattle/Pacific Northwest
  'seattle': [
    'photo-1502175353174-a7a70e73b362', // Seattle skyline
    'photo-1558452919-08ae4aca8571', // Seattle homes
    'photo-1548248823-ce16a73b6d49', // Pacific NW
    'photo-1515694590244-e4c8d2e5d10e', // Seattle neighborhood
    'photo-1416339306562-f3d12fefd36f', // Seattle view
  ],
  // General real estate
  'real-estate': [
    // REMOVED: 'photo-1560518883-ce09059eeffa' - BLOCKED (overused)
    'photo-1582407947304-fd86f028f716', // Property showing
    'photo-1560520653-9e0e4c89eb11', // House hunting
    'photo-1560185007-c5ca9d2c014d', // Real estate deal
    'photo-1560184897-ae75f418493e', // Property investment
    'photo-1600585154340-be6161a56a0c', // Home exterior
    'photo-1600573472550-8090b5e0745e', // Residential area
    'photo-1600566753086-00f18fb6b3ea', // Neighborhood homes
    'photo-1600607687920-4e2a09cf159d', // Suburban street
    'photo-1605276374104-dee2a0ed3cd6', // Modern homes
  ],
};

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

interface PublishedBlog {
  slug: string;
  neighborhood: string;
  borough?: string;
  city?: string;
  state: string;
  publishedAt: string;
  coverPhotoId: string;
  source: 'seo' | 'usta-react';
}

interface BlogRegistryData {
  version: string;
  lastUpdated: string;
  publishedBlogs: PublishedBlog[];
  usedCoverPhotos: string[];
}

// -----------------------------------------------------------------------------
// BLOG REGISTRY CLASS
// -----------------------------------------------------------------------------

export class BlogRegistry {
  private data: BlogRegistryData;
  private dirty: boolean = false;

  constructor() {
    this.data = this.loadRegistry();
    // Auto-sync with filesystem on initialization
    this.syncWithFilesystem();
  }

  /**
   * Load registry from JSON file or create new one
   */
  private loadRegistry(): BlogRegistryData {
    if (fs.existsSync(REGISTRY_PATH)) {
      try {
        const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('Warning: Could not parse registry file, creating new one');
      }
    }

    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      publishedBlogs: [],
      usedCoverPhotos: [],
    };
  }

  /**
   * Save registry to JSON file
   */
  save(): void {
    this.data.lastUpdated = new Date().toISOString();

    // Ensure directory exists
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(this.data, null, 2));
    this.dirty = false;
    console.log(`Registry saved to ${REGISTRY_PATH}`);
  }

  /**
   * Sync registry with actual files on filesystem
   * Scans both usta-react and seo blog directories
   */
  syncWithFilesystem(): void {
    const existingBlogs: PublishedBlog[] = [];
    const existingPhotos: string[] = [];

    // Scan usta-react blog directory
    if (fs.existsSync(USTA_BLOG_DIR)) {
      const files = fs.readdirSync(USTA_BLOG_DIR).filter(f => f.endsWith('.md') && !f.includes('TEMPLATE') && !f.includes('README'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(USTA_BLOG_DIR, file), 'utf8');
        const blogInfo = this.extractBlogInfo(content, file, 'usta-react');
        if (blogInfo) {
          existingBlogs.push(blogInfo);
          if (blogInfo.coverPhotoId) {
            existingPhotos.push(blogInfo.coverPhotoId);
          }
        }
      }
    }

    // Scan seo blog directory
    if (fs.existsSync(SEO_BLOG_DIR)) {
      const files = fs.readdirSync(SEO_BLOG_DIR).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(SEO_BLOG_DIR, file), 'utf8');
        const blogInfo = this.extractBlogInfo(content, file, 'seo');
        if (blogInfo) {
          // Only add if not already in usta-react (avoid duplicates)
          if (!existingBlogs.some(b => b.slug === blogInfo.slug)) {
            existingBlogs.push(blogInfo);
          }
          if (blogInfo.coverPhotoId && !existingPhotos.includes(blogInfo.coverPhotoId)) {
            existingPhotos.push(blogInfo.coverPhotoId);
          }
        }
      }
    }

    // Update registry
    this.data.publishedBlogs = existingBlogs;
    this.data.usedCoverPhotos = [...new Set(existingPhotos)]; // Deduplicate
    this.dirty = true;
    this.save();

    console.log(`Registry synced: ${existingBlogs.length} blogs, ${this.data.usedCoverPhotos.length} unique photos tracked`);
  }

  /**
   * Extract blog info from markdown content
   */
  private extractBlogInfo(content: string, filename: string, source: 'seo' | 'usta-react'): PublishedBlog | null {
    // Only track geo-farming blogs
    if (!content.includes('geographic-farming') && !filename.includes('geographic-farming')) {
      return null;
    }

    const slugMatch = content.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
    const locationMatch = content.match(/^location:\s*["']?([^"'\n]+)["']?/m);
    const dateMatch = content.match(/^(?:date|publishedAt):\s*["']?([^"'\n]+)["']?/m);
    const imageMatch = content.match(/^featuredImage:\s*["']?([^"'\n]+)["']?/m);

    if (!slugMatch) return null;

    const slug = slugMatch[1].trim();
    const location = locationMatch ? locationMatch[1].trim() : '';

    // Parse location (e.g., "East Village, Manhattan" or "Harlem, Manhattan, NY")
    const locationParts = location.split(',').map(p => p.trim());
    const neighborhood = locationParts[0] || this.extractNeighborhoodFromSlug(slug);
    const borough = locationParts[1] || '';
    const state = locationParts[2] || this.extractStateFromSlug(slug);

    // Extract Unsplash photo ID from URL
    let coverPhotoId = '';
    if (imageMatch) {
      const photoIdMatch = imageMatch[1].match(/photo-[a-zA-Z0-9_-]+/);
      if (photoIdMatch) {
        coverPhotoId = photoIdMatch[0];
      }
    }

    return {
      slug,
      neighborhood,
      borough,
      state,
      publishedAt: dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0],
      coverPhotoId,
      source,
    };
  }

  /**
   * Extract neighborhood name from slug
   */
  private extractNeighborhoodFromSlug(slug: string): string {
    // Remove common suffixes
    const cleaned = slug
      .replace(/-geographic-farming-guide$/, '')
      .replace(/-ny$/, '')
      .replace(/-wa$/, '')
      .replace(/-manhattan$/, '')
      .replace(/-brooklyn$/, '')
      .replace(/-queens$/, '');

    // Convert to title case
    return cleaned.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Extract state from slug
   */
  private extractStateFromSlug(slug: string): string {
    if (slug.includes('manhattan') || slug.includes('brooklyn') || slug.includes('queens')) {
      return 'NY';
    }
    if (slug.includes('seattle') || slug.includes('capitol-hill')) {
      return 'WA';
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API - DUPLICATE DETECTION
  // ---------------------------------------------------------------------------

  /**
   * Check if a neighborhood blog already exists
   * @param neighborhood - e.g., "East Village", "Harlem"
   * @param borough - e.g., "Manhattan", "Brooklyn" (optional)
   * @param state - e.g., "NY", "WA" (optional)
   */
  hasNeighborhood(neighborhood: string, borough?: string, state?: string): boolean {
    const normalizedNeighborhood = neighborhood.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedBorough = borough?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const normalizedState = state?.toLowerCase() || '';

    return this.data.publishedBlogs.some(blog => {
      const blogNeighborhood = blog.neighborhood.toLowerCase().replace(/[^a-z0-9]/g, '');
      const blogBorough = blog.borough?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      const blogState = blog.state?.toLowerCase() || '';

      // Match on neighborhood name
      if (blogNeighborhood !== normalizedNeighborhood) return false;

      // If borough specified, must match
      if (normalizedBorough && blogBorough && blogBorough !== normalizedBorough) return false;

      // If state specified, must match
      if (normalizedState && blogState && blogState !== normalizedState) return false;

      return true;
    });
  }

  /**
   * Check if a slug already exists
   */
  hasSlug(slug: string): boolean {
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return this.data.publishedBlogs.some(
      blog => blog.slug.toLowerCase().replace(/[^a-z0-9-]/g, '') === normalizedSlug
    );
  }

  /**
   * Get all published neighborhoods for a given area
   * Also checks if the slug contains the borough/area name to handle cases
   * where borough isn't explicitly stored
   */
  getPublishedNeighborhoods(borough?: string, state?: string): string[] {
    const normalizedBorough = borough?.toLowerCase() || '';

    return this.data.publishedBlogs
      .filter(blog => {
        // Filter by state if provided
        if (state && blog.state?.toLowerCase() !== state.toLowerCase()) return false;

        // If borough is specified, check both the borough field AND the slug
        if (normalizedBorough) {
          const hasBorough = blog.borough?.toLowerCase() === normalizedBorough;
          const slugContainsBorough = blog.slug.toLowerCase().includes(normalizedBorough);
          if (!hasBorough && !slugContainsBorough) return false;
        }

        return true;
      })
      .map(blog => blog.neighborhood);
  }

  /**
   * Get list of all published geo-farming blog slugs
   */
  getAllPublishedSlugs(): string[] {
    return this.data.publishedBlogs.map(blog => blog.slug);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API - UNIQUE COVER PHOTOS
  // ---------------------------------------------------------------------------

  /**
   * Check if a cover photo has been used OR is blocked
   */
  isPhotoUsed(photoId: string): boolean {
    return this.data.usedCoverPhotos.includes(photoId) || BLOCKED_PHOTO_IDS.includes(photoId);
  }

  /**
   * Check if a cover photo is permanently blocked
   */
  isPhotoBlocked(photoId: string): boolean {
    return BLOCKED_PHOTO_IDS.includes(photoId);
  }

  /**
   * Get list of all blocked photo IDs
   */
  getBlockedPhotos(): string[] {
    return [...BLOCKED_PHOTO_IDS];
  }

  /**
   * Get a unique cover photo that hasn't been used before
   * @param category - Photo category ('nyc', 'brooklyn', 'manhattan', 'queens', 'seattle', 'real-estate')
   * @returns Full Unsplash URL for the photo, or null if no unique photos available
   */
  getUniqueCoverPhoto(category: string = 'nyc'): string | null {
    // Normalize category
    const normalizedCategory = category.toLowerCase().replace(/[^a-z-]/g, '');

    // Get photos from requested category, fallback to 'nyc', then 'real-estate'
    const categories = [normalizedCategory, 'nyc', 'real-estate'];

    for (const cat of categories) {
      const photos = COVER_PHOTO_LIBRARY[cat] || [];

      for (const photoId of photos) {
        // Skip if photo is blocked (permanently retired)
        if (BLOCKED_PHOTO_IDS.includes(photoId)) {
          continue;
        }
        // Skip if photo has been used before
        if (!this.data.usedCoverPhotos.includes(photoId)) {
          return `https://images.unsplash.com/${photoId}?w=1200&auto=format&fit=crop`;
        }
      }
    }

    // If all photos are used, log warning and return a random NON-BLOCKED one from library
    console.warn('Warning: All cover photos have been used! Consider adding more to the library.');
    const allPhotos = Object.values(COVER_PHOTO_LIBRARY).flat()
      .filter(p => !BLOCKED_PHOTO_IDS.includes(p)); // Filter out blocked photos
    const randomPhoto = allPhotos[Math.floor(Math.random() * allPhotos.length)];
    return `https://images.unsplash.com/${randomPhoto}?w=1200&auto=format&fit=crop`;
  }

  /**
   * Reserve a cover photo (mark as used)
   * Call this after generating a blog to ensure the photo won't be reused
   */
  reserveCoverPhoto(photoUrl: string): void {
    const photoIdMatch = photoUrl.match(/photo-[a-zA-Z0-9_-]+/);
    if (photoIdMatch) {
      const photoId = photoIdMatch[0];
      if (!this.data.usedCoverPhotos.includes(photoId)) {
        this.data.usedCoverPhotos.push(photoId);
        this.dirty = true;
      }
    }
  }

  /**
   * Register a newly published blog
   */
  registerBlog(blog: Omit<PublishedBlog, 'source'>): void {
    // Reserve the cover photo
    if (blog.coverPhotoId) {
      if (!this.data.usedCoverPhotos.includes(blog.coverPhotoId)) {
        this.data.usedCoverPhotos.push(blog.coverPhotoId);
      }
    }

    // Add to published blogs if not already there
    if (!this.hasSlug(blog.slug)) {
      this.data.publishedBlogs.push({
        ...blog,
        source: 'seo',
      });
    }

    this.dirty = true;
  }

  /**
   * Get statistics about the registry
   */
  getStats(): { totalBlogs: number; totalPhotosUsed: number; photosRemaining: number } {
    const totalPhotos = Object.values(COVER_PHOTO_LIBRARY).flat().length;
    const uniquePhotosUsed = this.data.usedCoverPhotos.length;

    return {
      totalBlogs: this.data.publishedBlogs.length,
      totalPhotosUsed: uniquePhotosUsed,
      photosRemaining: totalPhotos - uniquePhotosUsed,
    };
  }

  /**
   * Get the category for a location
   */
  static getCategoryForLocation(location: string): string {
    const loc = location.toLowerCase();
    if (loc.includes('brooklyn')) return 'brooklyn';
    if (loc.includes('manhattan')) return 'manhattan';
    if (loc.includes('queens')) return 'queens';
    if (loc.includes('seattle') || loc.includes('capitol hill')) return 'seattle';
    if (loc.includes('new york') || loc.includes('nyc') || loc.includes('ny')) return 'nyc';
    return 'real-estate';
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API - NEIGHBORHOOD-SPECIFIC PHOTO DISCOVERY
  // ---------------------------------------------------------------------------

  /**
   * Get the set of all used photo IDs (for passing to discovery system)
   */
  getUsedPhotoIds(): Set<string> {
    return new Set([...this.data.usedCoverPhotos, ...BLOCKED_PHOTO_IDS]);
  }

  /**
   * Discover and get a neighborhood-specific cover photo
   * This is the PREFERRED method for getting cover photos - uses AI-powered
   * discovery to find images relevant to the specific neighborhood.
   *
   * @param context - Neighborhood context (name, city, state, characteristics)
   * @returns Promise<string | null> - Unsplash URL or null if none found
   */
  async getNeighborhoodPhoto(context: NeighborhoodContext): Promise<string | null> {
    const usedPhotos = this.getUsedPhotoIds();

    console.log(`\n🔍 Finding neighborhood-specific photo for ${context.neighborhood}, ${context.city}...`);

    // Try to discover neighborhood-specific photo
    const photo = await getBestNeighborhoodPhoto(context, usedPhotos);

    if (photo) {
      console.log(`   ✅ Found: ${photo.searchTermUsed} (score: ${photo.relevanceScore.toFixed(2)})`);
      return photo.url;
    }

    // Fallback to curated library
    console.log('   ⚠️ No neighborhood-specific photo found, using curated fallback...');
    const category = BlogRegistry.getCategoryForLocation(`${context.city}, ${context.state}`);
    return this.getUniqueCoverPhoto(category);
  }

  /**
   * Discover multiple photo options for a neighborhood
   * Useful for giving users choices or for batch operations
   *
   * @param context - Neighborhood context
   * @param maxResults - Maximum number of photos to return
   * @returns Promise<DiscoveredPhoto[]>
   */
  async discoverNeighborhoodPhotos(context: NeighborhoodContext, maxResults: number = 5): Promise<DiscoveredPhoto[]> {
    const usedPhotos = this.getUsedPhotoIds();
    return discoverNeighborhoodPhotos(context, usedPhotos, maxResults);
  }

  /**
   * Get a neighborhood photo from a blog brief
   * Extracts context from the brief and finds a relevant photo
   *
   * @param brief - Blog brief object with location data
   * @returns Promise<string | null>
   */
  async getPhotoFromBrief(brief: any): Promise<string | null> {
    const context = extractContextFromBrief(brief);
    return this.getNeighborhoodPhoto(context);
  }

  /**
   * Validate that a photo URL is accessible
   * Wrapper around the validation function for convenience
   */
  async validatePhoto(photoUrl: string): Promise<boolean> {
    return validatePhotoUrl(photoUrl);
  }
}

// -----------------------------------------------------------------------------
// STANDALONE FUNCTIONS (for use in scripts)
// -----------------------------------------------------------------------------

/**
 * Check if a neighborhood blog already exists
 * Standalone function for quick checks
 */
export function neighborhoodExists(neighborhood: string, borough?: string, state?: string): boolean {
  const registry = new BlogRegistry();
  return registry.hasNeighborhood(neighborhood, borough, state);
}

/**
 * Get a unique cover photo URL
 * Standalone function for quick access
 */
export function getUniqueCoverPhoto(category?: string): string | null {
  const registry = new BlogRegistry();
  return registry.getUniqueCoverPhoto(category);
}

/**
 * Check if a photo ID is permanently blocked
 * Use this to verify a photo can be used before assignment
 */
export function isPhotoBlocked(photoId: string): boolean {
  return BLOCKED_PHOTO_IDS.includes(photoId);
}

/**
 * Get all blocked photo IDs
 * Returns list of photos that should NEVER be used
 */
export function getBlockedPhotos(): string[] {
  return [...BLOCKED_PHOTO_IDS];
}

/**
 * Validate a brief before generation
 * Returns errors if the neighborhood already exists
 */
export function validateBriefForGeneration(briefPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(briefPath)) {
    errors.push(`Brief file not found: ${briefPath}`);
    return { valid: false, errors };
  }

  const content = fs.readFileSync(briefPath, 'utf8');

  // Extract location from brief
  const titleMatch = content.match(/# Geographic Farming Analysis: (.+?), (\w+)/);
  if (!titleMatch) {
    errors.push('Could not extract location from brief title');
    return { valid: false, errors };
  }

  const neighborhood = titleMatch[1];
  const stateOrBorough = titleMatch[2];

  const registry = new BlogRegistry();

  // Determine if stateOrBorough is a state or borough
  const isBorough = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].includes(stateOrBorough);

  if (isBorough) {
    if (registry.hasNeighborhood(neighborhood, stateOrBorough, 'NY')) {
      errors.push(`DUPLICATE DETECTED: A blog for "${neighborhood}, ${stateOrBorough}" already exists!`);
      errors.push(`Published neighborhoods in ${stateOrBorough}: ${registry.getPublishedNeighborhoods(stateOrBorough).join(', ')}`);
    }
  } else {
    if (registry.hasNeighborhood(neighborhood, undefined, stateOrBorough)) {
      errors.push(`DUPLICATE DETECTED: A blog for "${neighborhood}, ${stateOrBorough}" already exists!`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that a cover photo URL is accessible (returns 200)
 * USE THIS BEFORE PUBLISHING to catch invalid Unsplash photo IDs!
 */
export async function validateCoverPhoto(photoUrl: string): Promise<{ valid: boolean; status: number; error?: string }> {
  try {
    // Use small width for faster validation
    const testUrl = photoUrl.split('?')[0] + '?w=100';
    const response = await fetch(testUrl, { method: 'HEAD' });
    return {
      valid: response.status === 200,
      status: response.status,
    };
  } catch (error) {
    return {
      valid: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate all photos in the registry
 * Run this periodically to ensure all stored photos are still valid
 */
export async function validateAllRegistryPhotos(): Promise<{ valid: string[]; invalid: string[] }> {
  const registry = new BlogRegistry();
  const stats = registry.getStats();

  console.log(`Validating ${stats.totalPhotosUsed} photos in registry...`);

  const valid: string[] = [];
  const invalid: string[] = [];

  // Get all used photo IDs from registry file
  const registryData = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const photoIds: string[] = registryData.usedCoverPhotos || [];

  for (const photoId of photoIds) {
    const url = `https://images.unsplash.com/${photoId}?w=100`;
    const result = await validateCoverPhoto(url);

    if (result.valid) {
      valid.push(photoId);
    } else {
      invalid.push(photoId);
      console.warn(`  INVALID: ${photoId} (status: ${result.status})`);
    }
  }

  console.log(`Validation complete: ${valid.length} valid, ${invalid.length} invalid`);
  return { valid, invalid };
}

// Export default instance for convenience
export default BlogRegistry;
