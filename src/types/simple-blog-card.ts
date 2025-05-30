// src/types/simple-blog-card.ts

import { SeoType } from "@/sanity/schemaTypes/seo";

interface MainImage {
  alt: string;
  asset: any; 
  _type: string;
}

interface Category {
  title: string;
  _id?: string;
}

export interface SimpleBlogCard {
  _id: string;
  _updatedAt: string;
  title: string;
  slug: { 
    current: string;
    _type: string;
  };
  mainImage?: MainImage;
  categories?: Category[];
  smallDescription?: string | null; 
}

export interface FullPost {
  seo: SeoType | null;
  currentSlug: string;
  _updaAt: string; 
  title: string;
  body: Block[];
  mainImage: {
    _type: "image";
    asset: {
      _ref: string;
      _type: "reference";
    };
  };
}

interface Block {
  markDefs: any[];
  children: Child[];
  _type: "block";
  style: "normal";
  _key: string;
}

interface Child {
  _type: "span";
  text: string;
  marks: any[];
  _key: string;
}