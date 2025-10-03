#!/bin/bash

API_URL="http://localhost:3000/api/testimonials"

echo "🎯 FINAL TESTIMONIALS SETUP FROM PAGE.TS"
echo "============================================"
echo "Target: 2 Clients + 2 Drivers + 1 Vendor = 5 total testimonials"
echo ""

echo "📊 Current state:"
curl -s "$API_URL" | jq '{count: .count, breakdown: (.testimonials | group_by(.category) | map({category: .[0].category, count: length}))}'
echo ""

echo "🧹 Step 1: Clearing ALL existing testimonials..."
DELETE_RESULT=$(curl -s -X DELETE "$API_URL")
echo "Delete result: $(echo $DELETE_RESULT | jq '.success')"
echo ""

echo "🚀 Step 2: Adding testimonials from page.ts..."

# CLIENT #1: Wendy Sellers
echo "✨ Creating Wendy Sellers (CLIENT #1)..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wendy Sellers",
    "role": "HR and Management Consultant",
    "content": "As a small business owner, my team of virtual assistants makes me feel like I have an entire team behind me. One of their tasks is to transform my PowerPoint presentations into professional, polished files that consistently impress me and my clients. Quick, efficient, and effective, they handle tasks with remarkable speed and precision. Their support has been invaluable to my business and my sanity!",
    "category": "CLIENTS",
    "image": "/images/testimonials/author-01.png",
    "rating": 5,
    "sortOrder": 1
  }' | jq '.success'

# CLIENT #2: Racheal Gallegos  
echo "✨ Creating Racheal Gallegos (CLIENT #2)..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Racheal Gallegos",
    "role": "Senior Vice President of Product",
    "content": "Kaleb was an exceptional asset to the company during my tenure there. I would hire him again in a second for any position. Kaleb started his journey with us in customer service and sales, where he quickly showcased his remarkable intelligence and aptitude for learning. His analytical skills and ability to see both the big picture and the finer details set him apart from the beginning. Kaleb dedication and rapid growth led him to transition into product and brand management, where he truly excelled. His innovative approach, strategic thinking, and meticulous attention to detail made a significant impact on the company success. When I left the company, I felt secure knowing that Kaleb was taking over. It was not long before he was leading the team of brand managers, steering the company vision with expertise. Kaleb ability to adapt, learn, and lead with insight and precision is truly commendable. His contributions were instrumental in the company growth, and I am confident that he will continue to achieve great success in any future endeavors. Any organization would be fortunate to have Kaleb on their team.",
    "category": "CLIENTS",
    "image": "/images/testimonials/author-03.png",
    "rating": 5,
    "sortOrder": 2
  }' | jq '.success'

# DRIVER #1: Chris L.
echo "✨ Creating Chris L. (DRIVER #1)..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chris L.",
    "role": "Delivery Driver",
    "content": "Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I'\''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.",
    "category": "DRIVERS",
    "image": "/images/testimonials/author-06.png",
    "rating": 5,
    "sortOrder": 1
  }' | jq '.success'

# DRIVER #2: Emmanuel Cardenas
echo "✨ Creating Emmanuel Cardenas (DRIVER #2)..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emmanuel Cardenas",
    "role": "Delivery Driver",
    "content": "During my two-year tenure as a driver with Ready Set, I experienced a remarkably fulfilling professional chapter. The flexibility of the scheduling system allowed me to maintain an ideal work-life balance, with the freedom to select shifts that complemented my personal commitments. The user-friendly driver app streamlined the entire process, from clocking in to navigating routes and processing deliveries with minimal friction. What truly distinguished Ready Set was its comprehensive driver support system. Whenever I encountered challenges on the road, the responsive dispatch team provided immediate assistance, ensuring I never felt isolated during difficult situations. The companys commitment to driver wellbeing was evident through regular check-ins and a genuine interest in addressing concerns promptly.",
    "category": "DRIVERS",
    "image": "/images/testimonials/author-05.png",
    "rating": 5,
    "sortOrder": 2
  }' | jq '.success'

# VENDOR #1: John Smith
echo "✨ Creating John Smith (VENDOR #1)..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "role": "Restaurant Owner",
    "content": "Working with Ready Set has been life-changing for me. The support from the team is unmatched—they always ensure I have all the information I need to complete my deliveries efficiently. I'\''ve also gained access to great opportunities and flexible hours, which allow me to balance work with my personal life. I feel respected and valued every step of the way, and that motivates me to give my best every day. Ready Set is not just a job; it feels like a community that genuinely cares about its drivers.",
    "category": "VENDORS",
    "image": "/images/testimonials/author-07.png",
    "rating": 5,
    "sortOrder": 1
  }' | jq '.success'

echo ""
echo "🎉 TESTIMONIALS SETUP COMPLETE!"
echo "================================="
echo ""
echo "📊 Final verification:"
curl -s "$API_URL" | jq '{
  total_count: .count,
  testimonials: .testimonials | map({name, category, role, image}) | sort_by(.category),
  breakdown: (.testimonials | group_by(.category) | map({
    category: .[0].category, 
    count: length,
    names: [.[].name]
  }))
}'

echo ""
echo "🌟 Perfect! Your testimonials from page.ts are now set up correctly!"
echo "🔗 Visit: http://localhost:3000 to see them in action!"
