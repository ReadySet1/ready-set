// src/sanity/lib/queries.ts

import { groq } from "next-sanity";
import { 
  client, 
  getPostBySlug as fetchPostBySlug, 
  getPosts as fetchPosts,
  getGuideBySlug as fetchGuideBySlug,
  getGuides as fetchGuides
} from "./client";

// SEO field fragments
export const imageFields = groq`
  _type,
  crop{
    _type, 
    right, 
    top, 
    left, 
    bottom
  },
  hotspot{
    _type,
    x,
    y,
    height,
    width
  },
  asset->{
    _id,
    _ref,
    url,
    metadata {
      dimensions {
        width,
        height
      }
    }
  }
`;

export const openGraphQuery = groq`
  _type,
  siteName,
  url,
  description,
  title,
  image{
    ${imageFields}
  }
`;

export const twitterQuery = groq`
  _type,
  site,
  creator,
  cardType,
  handle
`;

export const metaAttributesQuery = groq`
  _type,
  attributeValueString,
  attributeType,
  attributeKey,
  attributeValueImage{
    ${imageFields}
  }
`;

export const seoFields = groq`
  _type,
  metaTitle,
  metaDescription,
  metaImage{
    ${imageFields}
  },
  nofollowAttributes,
  seoKeywords,
  openGraph{
    ${openGraphQuery}
  },
  twitter{
    ${twitterQuery}
  },
  additionalMetaTags[]{
    _type,
    metaAttributes[]{
      ${metaAttributesQuery}
    }
  }
`;

// Updated queries with SEO fields
export const postsQuery = groq`
  *[_type == "post" && defined(slug.current)] | order(_updatedAt desc) {
    _id,
    _type,
    title,
    "slug": slug.current,
    mainImage,
    smallDescription,
    _updatedAt, 
    seo{
      ${seoFields}
    }
  }
`;

export const postQuery = groq`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    _type,
    title,
    "slug": slug.current,
    mainImage,
    smallDescription,
    _updatedAt, 
    body,
    seo{
      ${seoFields}
    }
  }
`;

export const postPathsQuery = groq`
  *[_type == "post" && defined(slug.current)][]{
    "params": { 
      "slug": slug.current 
    }
  }
`;

export const guideQuery = groq`
  *[_type == "guide" && slug.current == $slug][0]{
    _id,
    _type,
    _updatedAt,
    title,
    subtitle,
    slug,
    
    // CONTENIDO PRINCIPAL - Campos exactos de Sanity
    introduction,
    mainContent[] {
      title,
      content
    },
    listSections[] {
      title,
      items[] {
        title,
        content
      }
    },
    
    // CTAs y otros campos
    callToAction,
    calendarUrl,
    downloadCtaText,
    consultationCtaText,
    
    // Archivos descargables
    downloadableFiles[] {
      _key,
      asset-> {
        _id,
        url,
        originalFilename
      }
    },
    
    // Imagen de portada COMPLETA (con crop y hotspot)
    coverImage {
      ${imageFields}
    },
    
    // Categoría
    category-> {
      _id,
      title,
      slug
    },
    
    // SEO
    seo{
      ${seoFields}
    }
  }
`;

export const categoryGuidesQuery = groq`
  *[_type == "category" && slug.current == $slug][0]{
    title,
    description,
    "guides": *[_type == "guide" && references(^._id)]{
      title,
      subtitle,
      "slug": slug.current,
      coverImage {
        ${imageFields}
      },
      seo{
        ${seoFields}
      }
    }
  }
`;

export const allCategoriesQuery = groq`
  *[_type == "category"]{
    title,
    "slug": slug.current,
    description,
    "guideCount": count(*[_type == "guide" && references(^._id)])
  }
`;

export const guidesQuery = groq`
  *[_type == "guide" && defined(slug.current)]{
    _id,
    _type,
    title,
    subtitle,
    "slug": slug.current,
    coverImage {
      ${imageFields}
    },
    "category": category->{
      title,
      "slug": slug.current
    },
    seo{
      ${seoFields}
    }
  }
`;

export const guidePathsQuery = groq`
  *[_type == "guide" && defined(slug.current)]{
    "slug": slug.current
  }
`;

// Helper functions for fetching
export async function getPostWithSEO(slug: string) {
  return await fetchPostBySlug(slug);
}

export async function getAllPosts() {
  return await fetchPosts();
}

export async function getGuides() {
  return await fetchGuides();
}


export async function getGuideBySlug(slug: string) {
  try {
    
    const guide = await client.fetch(guideQuery, { slug });
    
    if (!guide) {
      console.warn(`🔥🔥🔥 [queries.ts] No guide found with slug: ${slug}`);
      return null;
    }
    
    return guide;
  } catch (error) {
    console.error(`🔥🔥🔥 [queries.ts] Error fetching guide with slug ${slug}:`, error);
    return null;
  }
}