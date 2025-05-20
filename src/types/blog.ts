interface Author {
  _id: string;
  name: string;
}

interface MainImage {
  alt: string;
  asset: any; // You might want to create a separate interface for the 'image' type
  _type: string;
}

export interface SimpleBlogCard {
  smallDescription?: string;
  author: Author;
  _id: string;
  _updatedAt: string;
  title: string;
  slug?: {
    current: string;
    _type: string;
  };
  mainImage?: MainImage;
}

export interface FullPost {
  currentSlug: string;
  title: string;
  body: Block[];
  mainImage: {
    _type: 'image';
    asset: {
      _ref: string;
      _type: 'reference';
    };
  };
}

interface Block {
  markDefs: any[];
  children: Child[];
  _type: 'block';
  style: 'normal';
  _key: string;
}

interface Child {
  _type: 'span';
  text: string;
  marks: any[];
  _key: string;
}
