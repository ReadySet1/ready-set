#!/bin/bash

API_URL="http://localhost:3000/api/testimonials"

echo "Updating testimonials via API..."

# Create Dennis Ngai testimonial (CLIENT)
echo "Creating Dennis Ngai testimonial..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dennis Ngai",
    "content": "These guys came through for me and built a solid business along the way. A few years back, pre-covid, my lunch catering business was taking off to a point where I had to turn down orders. Ready Set always had drivers available and helped me scale so I did not have to turn down orders. They are reliable and trustworthy.",
    "category": "CLIENTS",
    "image": "/images/testimonials/author-01.png",
    "rating": 5,
    "sortOrder": 1
  }'

echo ""

# Create Rachael Gallegos testimonial (CLIENT)
echo "Creating Rachael Gallegos testimonial..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rachael Gallegos",
    "role": "Senior Vice President of Product",
    "content": "Kaleb was an exceptional asset to the company during my tenure there. I would hire him again in a second for any position. Kaleb started his journey with us in customer service and sales, where he quickly showcased his remarkable intelligence and aptitude for learning. His analytical skills and ability to see both the big picture and the finer details set him apart from the beginning. Kaleb dedication and rapid growth led him to transition into product and brand management, where he truly excelled. His innovative approach, strategic thinking, and meticulous attention to detail made a significant",
    "category": "CLIENTS",
    "image": "/images/testimonials/author-02.png",
    "rating": 5,
    "sortOrder": 2
  }'

echo ""

# Create Emmanuel Cardenas testimonial (DRIVER)
echo "Creating Emmanuel Cardenas testimonial..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emmanuel Cardenas",
    "role": "Delivery Driver",
    "content": "During my two-year tenure as a driver with Ready Set, I experienced a remarkably fulfilling professional chapter. The flexibility of the scheduling system allowed me to maintain an ideal work-life balance, with the freedom to select shifts that complemented my personal commitments. The user-friendly driver app streamlined the entire process, from clocking in to navigating routes and processing deliveries with minimal friction. What truly",
    "category": "DRIVERS",
    "image": "/images/testimonials/author-03.png",
    "rating": 5,
    "sortOrder": 1
  }'

echo ""

# Create Chris L. testimonial (DRIVER)
echo "Creating Chris L. testimonial..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chris L.",
    "role": "Delivery Driver",
    "content": "Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I'\''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.",
    "category": "DRIVERS",
    "image": "/images/testimonials/author-04.png",
    "rating": 5,
    "sortOrder": 2
  }'

echo ""

# Create John Smith testimonial (VENDOR)
echo "Creating John Smith testimonial..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "role": "Restaurant Owner",
    "content": "Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I'\''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.",
    "category": "VENDORS",
    "image": "/images/testimonials/author-05.png",
    "rating": 5,
    "sortOrder": 1
  }'

echo ""
echo "Testimonials update complete!"
echo ""
echo "Fetching updated testimonials..."
curl -s "$API_URL" | jq '.testimonials[] | {name, category, role}'
