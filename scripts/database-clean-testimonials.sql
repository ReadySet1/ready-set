-- Clean setup of testimonials from page.ts
-- This script will clear existing testimonials and add the exact ones needed

-- Step 1: Clear all existing testimonials
DELETE FROM testimonials;

-- Step 2: Insert the 5 testimonials from page.ts (2 clients, 2 drivers, 1 vendor)

-- CLIENT #1: Wendy Sellers
INSERT INTO testimonials (name, role, content, image, rating, category, is_active, sort_order) VALUES (
  'Wendy Sellers',
  'HR and Management Consultant',
  'As a small business owner, my team of virtual assistants makes me feel like I have an entire team behind me. One of their tasks is to transform my PowerPoint presentations into professional, polished files that consistently impress me and my clients. Quick, efficient, and effective, they handle tasks with remarkable speed and precision. Their support has been invaluable to my business and my sanity!',
  '/images/testimonials/author-01.png',
  5,
  'CLIENTS',
  true,
  1
);

-- CLIENT #2: Racheal Gallegos  
INSERT INTO testimonials (name, role, content, image, rating, category, is_active, sort_order) VALUES (
  'Racheal Gallegos',
  'Senior Vice President of Product',
  'Kaleb was an exceptional asset to the company during my tenure there. I would hire him again in a second for any position. Kaleb started his journey with us in customer service and sales, where he quickly showcased his remarkable intelligence and aptitude for learning. His analytical skills and ability to see both the big picture and the finer details set him apart from the beginning. Kaleb dedication and rapid growth led him to transition into product and brand management, where he truly excelled. His innovative approach, strategic thinking, and meticulous attention to detail made a significant impact on the company success. When I left the company, I felt secure knowing that Kaleb was taking over. It was not long before he was leading the team of brand managers, steering the company vision with expertise. Kaleb ability to adapt, learn, and lead with insight and precision is truly commendable. His contributions were instrumental in the company growth, and I am confident that he will continue to achieve great success in any future endeavors. Any organization would be fortunate to have Kaleb on their team.',
  '/images/testimonials/author-03.png',
  5,
  'CLIENTS',
  true,
  2
);

-- DRIVER #1: Chris L.
INSERT INTO testimonials (name, role, content, image, rating, category, is_active, sort_order) VALUES (
  'Chris L.',
  'Delivery Driver',
  'Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.',
  '/images/testimonials/author-06.png',
  5,
  'DRIVERS',
  true,
  1
);

-- DRIVER #2: Emmanuel Cardenas
INSERT INTO testimonials (name, role, content, image, rating, category, is_active, sort_order) VALUES (
  'Emmanuel Cardenas',
  'Delivery Driver',
  'During my two-year tenure as a driver with Ready Set, I experienced a remarkably fulfilling professional chapter. The flexibility of the scheduling system allowed me to maintain an ideal work-life balance, with the freedom to select shifts that complemented my personal commitments. The user-friendly driver app streamlined the entire process, from clocking in to navigating routes and processing deliveries with minimal friction. What truly distinguished Ready Set was its comprehensive driver support system. Whenever I encountered challenges on the road, the responsive dispatch team provided immediate assistance, ensuring I never felt isolated during difficult situations. The companys commitment to driver wellbeing was evident through regular check-ins and a genuine interest in addressing concerns promptly.',
  '/images/testimonials/author-05.png',
  5,
  'DRIVERS',
  true,
  2
);

-- VENDOR #1: John Smith
INSERT INTO testimonials (name, role, content, image, rating, category, is_active, sort_order) VALUES (
  'John Smith',
  'Restaurant Owner',
  'Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.',
  '/images/testimonials/author-07.png',
  5,
  'VENDORS',
  true,
  1
);

-- Verify the results
SELECT 
  category,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as names
FROM testimonials 
WHERE is_active = true
GROUP BY category
ORDER BY category;
