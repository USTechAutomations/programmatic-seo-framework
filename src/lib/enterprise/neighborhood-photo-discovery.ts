/**
 * Neighborhood-Specific Photo Discovery System
 *
 * This module discovers and selects relevant cover photos for neighborhood blogs
 * using Unsplash API search and intelligent keyword generation based on
 * neighborhood characteristics.
 *
 * @module neighborhood-photo-discovery
 */

import * as fs from 'fs';
import * as path from 'path';

// Unsplash API configuration
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const UNSPLASH_API_BASE = 'https://api.unsplash.com';

/**
 * Neighborhood context for photo discovery
 */
export interface NeighborhoodContext {
  neighborhood: string;
  borough?: string;
  city: string;
  state: string;
  county?: string;
  medianPrice?: number;
  characteristics?: string[];
  landmarks?: string[];
  architecture?: string;
  vibe?: string;
}

/**
 * Photo result from discovery
 */
export interface DiscoveredPhoto {
  id: string;
  url: string;
  fullUrl: string;
  description: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  relevanceScore: number;
  searchTermUsed: string;
}

/**
 * Neighborhood characteristics database for photo keyword generation
 * Maps neighborhood names to relevant visual themes
 */
const NEIGHBORHOOD_VISUAL_THEMES: Record<string, string[]> = {
  // NYC Boroughs
  'manhattan': ['manhattan skyline', 'new york city streets', 'central park', 'brownstone manhattan'],
  'brooklyn': ['brooklyn brownstone', 'brooklyn bridge', 'williamsburg brooklyn', 'brooklyn street'],
  'queens': ['queens new york neighborhood', 'diverse queens neighborhood', 'flushing queens'],
  'bronx': ['bronx new york', 'bronx neighborhood', 'grand concourse'],
  'staten island': ['staten island ferry', 'staten island neighborhood'],

  // NYC Neighborhoods
  'williamsburg': ['williamsburg brooklyn hipster', 'williamsburg loft', 'bedford avenue brooklyn'],
  'park slope': ['park slope brownstone', 'prospect park brooklyn', 'park slope family'],
  'greenpoint': ['greenpoint brooklyn', 'mccarren park', 'polish greenpoint'],
  'bushwick': ['bushwick street art', 'bushwick brooklyn industrial', 'bushwick murals'],
  'bed-stuy': ['bedford stuyvesant brownstone', 'bed stuy brooklyn historic'],
  'crown heights': ['crown heights brooklyn', 'eastern parkway brooklyn'],
  'dumbo': ['dumbo brooklyn bridge', 'dumbo cobblestone', 'brooklyn waterfront'],
  'cobble hill': ['cobble hill brooklyn', 'cobble hill brownstone'],
  'carroll gardens': ['carroll gardens brooklyn', 'smith street brooklyn'],
  'fort greene': ['fort greene brooklyn', 'fort greene park'],
  'prospect heights': ['prospect heights brooklyn', 'barclays center brooklyn'],
  'bay ridge': ['bay ridge brooklyn', 'shore road brooklyn', 'verrazano bridge'],
  'astoria': ['astoria queens', 'steinway street', 'astoria park'],
  'long island city': ['long island city queens', 'lic skyline', 'gantry park'],
  'flushing': ['flushing queens chinatown', 'main street flushing'],
  'jackson heights': ['jackson heights queens diversity', 'roosevelt avenue jackson heights'],
  'forest hills': ['forest hills gardens', 'austin street forest hills'],
  'riverdale': ['riverdale bronx', 'wave hill', 'hudson river bronx'],
  'mott haven': ['mott haven bronx', 'south bronx waterfront'],

  // DC Metro
  'georgetown': ['georgetown dc cobblestone', 'georgetown waterfront', 'georgetown row houses'],
  'dupont circle': ['dupont circle dc', 'embassy row dc'],
  'capitol hill': ['capitol hill dc row houses', 'eastern market dc'],
  'adams morgan': ['adams morgan dc nightlife', '18th street dc'],
  'u street': ['u street corridor dc', 'shaw dc'],
  'logan circle': ['logan circle dc victorian', 'p street dc'],
  'navy yard': ['navy yard dc', 'nationals park dc', 'anacostia waterfront'],
  'alexandria': ['old town alexandria', 'king street alexandria', 'alexandria waterfront'],
  'del ray': ['del ray alexandria', 'mount vernon avenue alexandria'],
  'arlington': ['arlington virginia', 'rosslyn skyline', 'clarendon arlington'],
  'bethesda': ['bethesda maryland downtown', 'bethesda row'],
  'silver spring': ['silver spring maryland', 'downtown silver spring'],
  'reston': ['reston town center', 'reston virginia lake'],
  'tysons': ['tysons corner virginia', 'tysons skyline'],

  // Philadelphia
  'rittenhouse square': ['rittenhouse square philadelphia', 'rittenhouse park'],
  'fishtown': ['fishtown philadelphia', 'frankford avenue', 'fishtown brewery'],
  'society hill': ['society hill philadelphia cobblestone', 'historic philadelphia'],
  'old city': ['old city philadelphia', 'elfreths alley'],
  'northern liberties': ['northern liberties philadelphia', 'piazza philadelphia'],
  'queen village': ['queen village philadelphia', 'fabric row philadelphia'],
  'manayunk': ['manayunk philadelphia', 'main street manayunk'],
  'chestnut hill': ['chestnut hill philadelphia', 'germantown avenue'],
  'graduate hospital': ['graduate hospital philadelphia', 'south street philadelphia'],
  'fairmount': ['fairmount philadelphia', 'eastern state penitentiary'],
  'main line': ['main line philadelphia', 'bryn mawr', 'ardmore suburban'],

  // Boston
  'back bay': ['back bay boston brownstone', 'newbury street', 'commonwealth avenue'],
  'beacon hill': ['beacon hill boston', 'acorn street boston', 'boston brick sidewalk'],
  'south end': ['south end boston', 'tremont street boston'],
  'jamaica plain': ['jamaica plain boston', 'jp pond'],
  'charlestown': ['charlestown boston', 'bunker hill monument'],
  'cambridge': ['harvard square', 'cambridge massachusetts', 'mit cambridge'],
  'somerville': ['davis square somerville', 'union square somerville'],
  'brookline': ['coolidge corner brookline', 'brookline village'],

  // Connecticut
  'greenwich': ['greenwich connecticut', 'greenwich avenue', 'greenwich waterfront'],
  'westport': ['westport connecticut', 'saugatuck river'],
  'stamford': ['stamford connecticut downtown', 'stamford harbor'],
  'new haven': ['new haven connecticut', 'yale university', 'wooster square'],
  'darien': ['darien connecticut', 'noroton bay'],

  // Generic fallbacks by price tier
  'luxury': ['luxury home exterior', 'upscale neighborhood', 'million dollar home'],
  'suburban': ['suburban neighborhood street', 'family neighborhood', 'tree lined street'],
  'urban': ['urban neighborhood', 'city street residential', 'walkable neighborhood'],
  'historic': ['historic neighborhood', 'victorian homes', 'brownstone street'],
  'waterfront': ['waterfront homes', 'harbor neighborhood', 'coastal real estate'],
  'modern': ['modern architecture homes', 'contemporary neighborhood'],
};

/**
 * Architecture style keywords by region
 */
const ARCHITECTURE_KEYWORDS: Record<string, string[]> = {
  'brownstone': ['brownstone', 'brownstone stoop', 'brooklyn brownstone exterior'],
  'victorian': ['victorian house', 'victorian neighborhood', 'painted ladies'],
  'colonial': ['colonial home', 'colonial neighborhood', 'american colonial'],
  'rowhouse': ['row house', 'townhouse street', 'row homes'],
  'tudor': ['tudor home', 'tudor neighborhood', 'english tudor'],
  'craftsman': ['craftsman bungalow', 'arts crafts home'],
  'cape cod': ['cape cod house', 'cape cod style'],
  'ranch': ['ranch home', 'mid century ranch'],
  'condo': ['luxury condo building', 'modern condo exterior'],
  'high-rise': ['residential high rise', 'luxury apartment building'],
};

/**
 * Price tier to visual style mapping
 */
function getPriceTierKeywords(medianPrice: number): string[] {
  if (medianPrice >= 1500000) {
    return ['luxury estate', 'mansion', 'upscale neighborhood', 'prestigious homes'];
  } else if (medianPrice >= 800000) {
    return ['upscale suburban', 'affluent neighborhood', 'beautiful homes'];
  } else if (medianPrice >= 500000) {
    return ['nice neighborhood', 'family homes', 'residential street'];
  } else if (medianPrice >= 300000) {
    return ['starter homes', 'affordable neighborhood', 'first home'];
  } else {
    return ['urban neighborhood', 'city homes', 'residential area'];
  }
}

/**
 * Generate search keywords for a neighborhood
 */
export function generateSearchKeywords(context: NeighborhoodContext): string[] {
  const keywords: string[] = [];
  const neighborhoodLower = context.neighborhood.toLowerCase();
  const cityLower = context.city.toLowerCase();
  const stateLower = context.state.toLowerCase();

  // 1. Direct neighborhood match
  if (NEIGHBORHOOD_VISUAL_THEMES[neighborhoodLower]) {
    keywords.push(...NEIGHBORHOOD_VISUAL_THEMES[neighborhoodLower]);
  }

  // 2. Borough/area match (for NYC)
  if (context.borough) {
    const boroughLower = context.borough.toLowerCase();
    if (NEIGHBORHOOD_VISUAL_THEMES[boroughLower]) {
      keywords.push(...NEIGHBORHOOD_VISUAL_THEMES[boroughLower].slice(0, 2));
    }
  }

  // 3. City + neighborhood combination
  keywords.push(`${context.neighborhood} ${context.city} neighborhood`);
  keywords.push(`${context.neighborhood} ${context.state} homes`);

  // 4. Add landmark-based keywords if available
  if (context.landmarks && context.landmarks.length > 0) {
    keywords.push(...context.landmarks.map(l => `${l} neighborhood`));
  }

  // 5. Architecture style if known
  if (context.architecture) {
    const archLower = context.architecture.toLowerCase();
    if (ARCHITECTURE_KEYWORDS[archLower]) {
      keywords.push(...ARCHITECTURE_KEYWORDS[archLower].slice(0, 2));
    }
  }

  // 6. Price tier fallback
  if (context.medianPrice) {
    keywords.push(...getPriceTierKeywords(context.medianPrice).slice(0, 2));
  }

  // 7. Vibe-based keywords
  if (context.vibe) {
    const vibeLower = context.vibe.toLowerCase();
    if (vibeLower.includes('hip') || vibeLower.includes('trendy')) {
      keywords.push('trendy neighborhood', 'hipster neighborhood');
    }
    if (vibeLower.includes('family')) {
      keywords.push('family friendly neighborhood', 'kids playing street');
    }
    if (vibeLower.includes('historic')) {
      keywords.push('historic neighborhood', 'heritage homes');
    }
    if (vibeLower.includes('diverse')) {
      keywords.push('diverse neighborhood', 'multicultural street');
    }
  }

  // 8. Generic real estate fallbacks (always include as last resort)
  keywords.push(
    'residential neighborhood street',
    'homes for sale neighborhood',
    'real estate neighborhood'
  );

  // Deduplicate and return
  return [...new Set(keywords)];
}

/**
 * Validate that a photo URL is accessible
 */
export async function validatePhotoUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Search Unsplash for photos matching keywords
 */
async function searchUnsplash(
  query: string,
  perPage: number = 10
): Promise<DiscoveredPhoto[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not set - using fallback photos');
    return [];
  }

  try {
    const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.error(`Unsplash API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return data.results.map((photo: any, index: number) => ({
      id: photo.id,
      url: `https://images.unsplash.com/${photo.id}?w=1200&h=630&fit=crop`,
      fullUrl: photo.urls.full,
      description: photo.description || photo.alt_description || query,
      alt: photo.alt_description || `${query} - real estate neighborhood`,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      relevanceScore: 1 - (index * 0.1), // Higher score for earlier results
      searchTermUsed: query
    }));
  } catch (error) {
    console.error('Unsplash search failed:', error);
    return [];
  }
}

/**
 * Curated fallback photos by category when API is unavailable
 * These are pre-validated, high-quality Unsplash photos
 */
const CURATED_FALLBACK_PHOTOS: Record<string, string[]> = {
  'nyc': [
    'photo-1534430480872-3498386e7856', // NYC brownstone
    'photo-1555952238-2c8a0d3c3e32', // NYC street
    'photo-1518235506717-e1ed3306a89b', // Brooklyn brownstone
    'photo-1570168007204-dfb528c6958f', // NYC architecture
    'photo-1534430480872-3498386e7856', // Brownstone stoop
  ],
  'dc': [
    'photo-1617581629397-a72507c3de9e', // DC rowhouse
    'photo-1558618666-fcd25c85cd64', // Georgetown
    'photo-1565402170291-8491f14678db', // DC neighborhood
  ],
  'philadelphia': [
    'photo-1600566753086-00f18fb6b3ea', // Philadelphia rowhouse
    'photo-1600607687644-aac4c3eac7f4', // Philly street
    'photo-1600573472591-ee6b68d14c68', // Historic Philly
  ],
  'boston': [
    'photo-1572120360610-d971b9d7767c', // Boston brownstone
    'photo-1580587771525-78b9dba3b914', // Boston neighborhood
    'photo-1600585154340-be6161a56a0c', // New England home
  ],
  'connecticut': [
    'photo-1605276374104-dee2a0ed3cd6', // CT colonial
    'photo-1600596542815-ffad4c1539a9', // Suburban CT
    'photo-1600047509807-ba8f99d2cdde', // CT neighborhood
  ],
  'suburban': [
    'photo-1600585154340-be6161a56a0c', // Suburban home
    'photo-1600047509807-ba8f99d2cdde', // Tree-lined street
    'photo-1600566753190-17f0baa2a6c3', // Family neighborhood
  ],
  'urban': [
    'photo-1600607687939-ce8a6c25118c', // Urban townhouse
    'photo-1600585154526-990dced4db0d', // City neighborhood
    'photo-1600573472591-ee6b68d14c68', // Urban street
  ],
  'luxury': [
    'photo-1600596542815-ffad4c1539a9', // Luxury home
    'photo-1600047509807-ba8f99d2cdde', // Upscale neighborhood
    'photo-1613490493576-7fde63acd811', // Mansion exterior
  ],
};

/**
 * Get curated fallback photo for a region
 */
function getCuratedFallback(context: NeighborhoodContext, usedPhotos: Set<string>): DiscoveredPhoto | null {
  const state = context.state.toLowerCase();
  const city = context.city.toLowerCase();

  // Determine category
  let category = 'suburban';
  if (state === 'ny' || city.includes('new york')) category = 'nyc';
  else if (state === 'dc' || state === 'va' || state === 'md') category = 'dc';
  else if (state === 'pa' || city.includes('philadelphia')) category = 'philadelphia';
  else if (state === 'ma' || city.includes('boston')) category = 'boston';
  else if (state === 'ct') category = 'connecticut';

  // Add price-based fallback
  if (context.medianPrice && context.medianPrice >= 1000000) {
    category = 'luxury';
  }

  const photos = CURATED_FALLBACK_PHOTOS[category] || CURATED_FALLBACK_PHOTOS['suburban'];

  // Find unused photo
  for (const photoId of photos) {
    if (!usedPhotos.has(photoId)) {
      return {
        id: photoId,
        url: `https://images.unsplash.com/${photoId}?w=1200&h=630&fit=crop`,
        fullUrl: `https://images.unsplash.com/${photoId}`,
        description: `${context.neighborhood} neighborhood - real estate`,
        alt: `${context.neighborhood}, ${context.city} real estate neighborhood`,
        photographer: 'Unsplash',
        photographerUrl: 'https://unsplash.com',
        relevanceScore: 0.5,
        searchTermUsed: 'curated fallback'
      };
    }
  }

  return null;
}

/**
 * Main function: Discover relevant photos for a neighborhood
 */
export async function discoverNeighborhoodPhotos(
  context: NeighborhoodContext,
  usedPhotos: Set<string> = new Set(),
  maxResults: number = 5
): Promise<DiscoveredPhoto[]> {
  const results: DiscoveredPhoto[] = [];
  const keywords = generateSearchKeywords(context);

  console.log(`\n📸 Discovering photos for ${context.neighborhood}, ${context.city}`);
  console.log(`   Search keywords: ${keywords.slice(0, 3).join(', ')}...`);

  // Try Unsplash API first
  if (UNSPLASH_ACCESS_KEY) {
    for (const keyword of keywords.slice(0, 5)) { // Try top 5 keywords
      const photos = await searchUnsplash(keyword, 5);

      for (const photo of photos) {
        // Skip if already used
        if (usedPhotos.has(photo.id)) continue;

        // Validate URL is accessible
        const isValid = await validatePhotoUrl(photo.url);
        if (!isValid) continue;

        results.push(photo);

        if (results.length >= maxResults) break;
      }

      if (results.length >= maxResults) break;

      // Rate limiting - small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // If not enough results, use curated fallbacks
  if (results.length < maxResults) {
    console.log('   Using curated fallback photos...');
    const fallback = getCuratedFallback(context, usedPhotos);
    if (fallback) {
      results.push(fallback);
    }
  }

  // Sort by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(`   Found ${results.length} relevant photos`);

  return results.slice(0, maxResults);
}

/**
 * Get the best photo for a neighborhood (single result)
 */
export async function getBestNeighborhoodPhoto(
  context: NeighborhoodContext,
  usedPhotos: Set<string> = new Set()
): Promise<DiscoveredPhoto | null> {
  const photos = await discoverNeighborhoodPhotos(context, usedPhotos, 3);
  return photos.length > 0 ? photos[0] : null;
}

/**
 * Extract neighborhood context from a blog brief
 */
export function extractContextFromBrief(brief: any): NeighborhoodContext {
  // Parse location string "Neighborhood, Borough/City, State"
  const locationParts = (brief.location || '').split(',').map((s: string) => s.trim());

  let neighborhood = locationParts[0] || brief.neighborhood || '';
  let borough = '';
  let city = '';
  let state = '';

  if (locationParts.length === 3) {
    borough = locationParts[1];
    state = locationParts[2];
    city = borough; // For NYC, borough is city
  } else if (locationParts.length === 2) {
    city = locationParts[1].split(' ')[0]; // Get city before state
    state = locationParts[1].split(' ').slice(-1)[0] || '';
  }

  // Override with explicit brief fields
  if (brief.borough) borough = brief.borough;
  if (brief.city) city = brief.city;
  if (brief.state) state = brief.state;

  return {
    neighborhood,
    borough: borough || undefined,
    city: city || brief.city || 'Unknown',
    state: state || brief.state || '',
    county: brief.county,
    medianPrice: brief.medianPrice || brief.median_price,
    characteristics: brief.characteristics || [],
    landmarks: brief.landmarks || [],
    architecture: brief.architecture || brief.housing_stock,
    vibe: brief.vibe || brief.market_type_descriptor
  };
}

// Export for testing
export { NEIGHBORHOOD_VISUAL_THEMES, CURATED_FALLBACK_PHOTOS };
