#!/usr/bin/env tsx
/**
 * Test Script: Neighborhood Photo Discovery System
 *
 * This script tests the photo discovery and content validation systems.
 *
 * Usage:
 *   npx tsx scripts/test-photo-discovery.ts
 *   npx tsx scripts/test-photo-discovery.ts --neighborhood "Astoria" --city "Queens" --state "NY"
 */

import { BlogRegistry } from '../src/lib/blog-registry';
import {
  discoverNeighborhoodPhotos,
  generateSearchKeywords,
  extractContextFromBrief,
  NeighborhoodContext
} from '../src/lib/enterprise/neighborhood-photo-discovery';
import {
  validateWordCount,
  validateTemplateSelection,
  validateContent,
  MINIMUM_WORD_COUNT
} from '../src/lib/enterprise/content-validation';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
};

async function testPhotoDiscovery() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 NEIGHBORHOOD PHOTO DISCOVERY SYSTEM TEST');
  console.log('='.repeat(70) + '\n');

  const registry = new BlogRegistry();

  // Test contexts
  const testContexts: NeighborhoodContext[] = [
    {
      neighborhood: getArg('neighborhood') || 'Astoria',
      city: getArg('city') || 'Queens',
      state: getArg('state') || 'NY',
      medianPrice: parseInt(getArg('price') || '650000'),
      vibe: 'diverse young professional'
    },
    {
      neighborhood: 'Rittenhouse Square',
      city: 'Philadelphia',
      state: 'PA',
      medianPrice: 650000,
      vibe: 'luxury urban',
      landmarks: ['Rittenhouse Park']
    },
    {
      neighborhood: 'Georgetown',
      city: 'Washington',
      state: 'DC',
      medianPrice: 1200000,
      architecture: 'rowhouse',
      vibe: 'historic upscale'
    },
    {
      neighborhood: 'Back Bay',
      city: 'Boston',
      state: 'MA',
      medianPrice: 1500000,
      architecture: 'brownstone',
      landmarks: ['Commonwealth Avenue']
    }
  ];

  // Test each context
  for (const context of testContexts) {
    console.log('\n' + '-'.repeat(60));
    console.log(`📍 Testing: ${context.neighborhood}, ${context.city}, ${context.state}`);
    console.log('-'.repeat(60));

    // Generate search keywords
    const keywords = generateSearchKeywords(context);
    console.log('\n🔑 Generated Keywords:');
    keywords.slice(0, 5).forEach((k, i) => console.log(`   ${i + 1}. ${k}`));

    // Discover photos
    const photos = await discoverNeighborhoodPhotos(context, registry.getUsedPhotoIds(), 3);

    if (photos.length > 0) {
      console.log('\n📸 Discovered Photos:');
      photos.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.id}`);
        console.log(`      Search: "${p.searchTermUsed}"`);
        console.log(`      Score: ${p.relevanceScore.toFixed(2)}`);
        console.log(`      URL: ${p.url.substring(0, 60)}...`);
      });
    } else {
      console.log('\n⚠️  No photos found - would use curated fallback');
    }

    // Test the integrated method
    console.log('\n🏠 Testing registry.getNeighborhoodPhoto():');
    const photo = await registry.getNeighborhoodPhoto(context);
    if (photo) {
      console.log(`   ✅ Got photo: ${photo.substring(0, 70)}...`);
    } else {
      console.log('   ❌ No photo available');
    }
  }

  console.log('\n');
}

async function testContentValidation() {
  console.log('\n' + '='.repeat(70));
  console.log('📝 CONTENT VALIDATION SYSTEM TEST');
  console.log('='.repeat(70) + '\n');

  // Test word count validation
  console.log('1. Word Count Validation:');
  console.log('-'.repeat(40));

  const testContents = [
    { words: 500, content: 'word '.repeat(500) },
    { words: 1500, content: 'word '.repeat(1500) },
    { words: 2000, content: 'word '.repeat(2000) },
    { words: 2500, content: 'word '.repeat(2500) },
    { words: 3500, content: 'word '.repeat(3500) },
  ];

  for (const test of testContents) {
    const result = validateWordCount(test.content);
    console.log(`   ${test.words} words: ${result.message}`);
  }

  // Test template validation
  console.log('\n2. Template Rotation Validation:');
  console.log('-'.repeat(40));

  const recentHistory = ['COMPASS', 'CATALYST'];
  const testTemplates = ['ATLAS', 'PERSONA', 'COMPASS', 'CATALYST', 'PLAYBOOK', 'BLUEPRINT'];

  console.log(`   Recent history: [${recentHistory.join(', ')}]`);
  console.log(`   Excluded: [${recentHistory.join(', ')}]`);
  console.log('');

  for (const template of testTemplates) {
    const result = validateTemplateSelection(template, recentHistory);
    const icon = result.valid ? '✅' : '❌';
    console.log(`   ${icon} ${template}: ${result.valid ? 'VALID' : 'INVALID'}`);
  }

  // Test comprehensive validation
  console.log('\n3. Comprehensive Content Validation:');
  console.log('-'.repeat(40));

  const sampleContent = `---
title: Test Blog
featuredImage: https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200
---

${'This is a test paragraph with some content. '.repeat(100)}`;

  const fullResult = await validateContent(sampleContent, {
    templateId: 'ATLAS',
    recentTemplates: ['COMPASS', 'CATALYST'],
    coverPhotoUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200'
  });

  console.log(`   Overall Valid: ${fullResult.valid ? '✅ YES' : '❌ NO'}`);
  console.log(`   Word Count: ${fullResult.wordCount.wordCount} (${fullResult.wordCount.rating})`);
  if (fullResult.template) {
    console.log(`   Template: ${fullResult.template.selectedTemplate} (${fullResult.template.valid ? 'valid' : 'invalid'})`);
  }
  if (fullResult.coverPhoto) {
    console.log(`   Cover Photo: ${fullResult.coverPhoto.valid ? 'accessible' : 'NOT accessible'}`);
  }

  if (fullResult.errors.length > 0) {
    console.log('\n   Errors:');
    fullResult.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (fullResult.warnings.length > 0) {
    console.log('\n   Warnings:');
    fullResult.warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log('\n');
}

async function testRegistryStats() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 REGISTRY STATS');
  console.log('='.repeat(70) + '\n');

  const registry = new BlogRegistry();
  const stats = registry.getStats();

  console.log(`   Total Blogs: ${stats.totalBlogs}`);
  console.log(`   Photos Used: ${stats.totalPhotosUsed}`);
  console.log(`   Photos Remaining: ${stats.photosRemaining}`);
  console.log(`   Used Photo IDs: ${registry.getUsedPhotoIds().size}`);
  console.log('\n');
}

// Run all tests
async function main() {
  console.log('\n🚀 Starting Photo Discovery & Content Validation Tests...\n');

  try {
    await testRegistryStats();
    await testPhotoDiscovery();
    await testContentValidation();

    console.log('='.repeat(70));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(70) + '\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

main();
