import SectionTitle from "../Common/SectionTitle";
import SingleBlog from "./SingleBlog";
import { client, getPosts } from "@/sanity/lib/client";
import { postPathsQuery } from "@/sanity/lib/queries";
import { SimpleBlogCard } from "@/types/simple-blog-card";

export const revalidate = 30;

// Prepare Next.js to know which routes already exist
export async function generateStaticParams() {
  // Important, use the plain Sanity Client here
  const posts = await client.fetch(postPathsQuery);
  return posts;
}

async function getData(): Promise<SimpleBlogCard[]> {
  try {
    // Use our typed function to get posts
    return await getPosts();
  } catch (error) {
    console.error("Error fetching blog posts for home section:", error);
    return []; // Return empty array on error
  }
}

const HomeBlogSection = async () => {
  const data: SimpleBlogCard[] = await getData();

  return (
    <section className="bg-white pb-10 pt-20 dark:bg-dark lg:pb-20 lg:pt-[120px]">
      <div className="container mx-auto">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Our Blog"
            title="Our Recent News"
            paragraph="You can find valuable information about our services."
            width="640px"
            center
          />
        </div>

        <div className="pb-10 pt-20 lg:pb-20 lg:pt-[120px]">
          <div className="container mx-auto">
            <div className="-mx-4 flex flex-wrap justify-center">
            <SingleBlog data={data} basePath="blog" />
            </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default HomeBlogSection;