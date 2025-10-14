// TypeScript interface for restaurant data
interface Restaurant {
  name: string;
  address: string;
}

// Restaurant addresses extracted from CSV
const restaurantAddresses: Restaurant[] = [
  {
    "name": "WHOLLY_COW_BURGERS",
    "address": "3010 South Lamar Boulevard, Building: 3010, Austin, TX 78704"
  },
  {
    "name": "Iku Sushi & Bento",
    "address": "121 S Maple Ave unit 3, South San Francisco, CA 94080"
  },
  {
    "name": "Thai Chili Express",
    "address": "304 E Santa Clara st, S 7th St D San Jose 95113 California"
  },
  {
    "name": "Pasta Fresca",
    "address": "87 N San Pedro St, San Jose, CA 95110"
  },
  {
    "name": "Great Indian Cuisine",
    "address": "2026 Agnew Rd, Santa Clara, CA 95054"
  },
  {
    "name": "Ben's Fast Food",
    "address": "949 Ruff Dr, San Jose, CA 95110"
  },
  {
    "name": "BENTO_DELI",
    "address": "8650 Spicewood Springs Rd. , #115 , Austin , TX 78759"
  },
  {
    "name": "NANCYS_KITCHEN",
    "address": "5610 I35 North Unit 6, Austin, TX 78751"
  },
  {
    "name": "GRATAS_PIZZERIA",
    "address": "2700 S Lamar Blvd, Austin, Texas 78704"
  },
  {
    "name": "BAOD_UP",
    "address": "5207 Brodie Ln Ste 115,, Sunset Valley, TX 78745"
  },
  {
    "name": "KISMET_CAFE",
    "address": "1000 E 41st St Suite 200, Austin , TX 78751"
  },
  {
    "name": "Dumpling Capital",
    "address": "5075 Stevens Creek Blvd #10, Santa Clara, CA 95051"
  },
  {
    "name": "Sam & Curry",
    "address": "1751 N First St #40, San Jose, CA, 95112"
  },
  {
    "name": "Sourdough & Co",
    "address": "809 Cuesta Dr Suite A, Mountain View, CA, 94040"
  },
  {
    "name": "Korean House",
    "address": "2589 North 1st Street, San Jose, CA, 95131"
  },
  {
    "name": "Pokeworks",
    "address": "55 River Oaks Pl #30, San Jose, CA, 95134"
  },
  {
    "name": "Grace Deli & Cafe",
    "address": "303 S Almaden Blvd, San Jose, CA 95110"
  },
  {
    "name": "HAPPY_CHICKS_BURNET_RD",
    "address": "6425 Burnet Road, Austin, TX 78757"
  },
  {
    "name": "MR_PIMENTO_FOOD_WAGONS",
    "address": "7221 mcneil drive, Austin, TX 78729"
  },
  {
    "name": "Gulzaar Halal Restaurant",
    "address": "1880 W San Carlos St, San Jose, CA, 95128"
  },
  {
    "name": "Jiwa",
    "address": "3060 Olsen Drive Suite 20, San Jose, CA, 95128"
  },
  {
    "name": "Campbell Pizza",
    "address": "3393 Winchester Blvd, Campbell, CA, 95008"
  },
  {
    "name": "World Wrapps",
    "address": "1875 S Bascom Ave #165, Campbell, CA 95008"
  },
  {
    "name": "On A Roll",
    "address": "87 N San Pedro St, San Jose, CA 95110"
  },
  {
    "name": "Golden Boy Pizza",
    "address": "1119 N Amphlett Blvd San Mateo, CA 94401"
  },
  {
    "name": "Grace Deli & Cafe",
    "address": "303 Almaden Blvd Ste 160, San Jose, CA 95110"
  },
  {
    "name": "The Gurkha Kitchen",
    "address": "1342 S Mary Ave, Sunnyvale, CA 94087"
  },
  {
    "name": "Starbird Chicken",
    "address": "1088 E Brokaw Rd #10, San Jose, CA 95131"
  },
  {
    "name": "Taqueria Parranga",
    "address": "300 Santana Row Ste 110, San Jose, CA 95128 ·"
  },
  {
    "name": "Kasa Indian Eatery",
    "address": "1356 Polk St, San Francisco, CA 94109"
  },
  {
    "name": "Sa By Thai",
    "address": "62 W Santa Clara ST, Santa Clara, CA, 95113"
  },
  {
    "name": "Great Khan's Mongolian BBQ",
    "address": "2200 Eastridge Loop, San Jose, CA, 95122"
  },
  {
    "name": "Umami Express",
    "address": "949 Ruff Dr, San Jose, CA 95110"
  },
  {
    "name": "POKEWORKS_AUSTIN_RIVERSIDE",
    "address": "1920 E Riverside Dr, Austin, Texas 78741"
  },
  {
    "name": "RAW Superfood Kitchen",
    "address": "1679 N Milpitas Blvd, Milpitas, CA, 95035"
  },
  {
    "name": "Asian Box (Campbell)",
    "address": "1875 S Bascom Ave, Campbell, CA, 95008"
  },
  {
    "name": "Togo's",
    "address": "1683 Hollenbeck Ave, Sunnyvale, CA, 94087"
  },
  {
    "name": "LEFTYS_PIZZA_KITCHEN",
    "address": "4323 South Congress, Suite 110, Austin, TX  78745"
  },
  {
    "name": "MOONBOWLS__ATX",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "LULUBOWLS__ATX",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "THE_DIRDIE_BIRDIE",
    "address": "10910 Domain Drive, Building: 10910, Austin, TX 78758"
  },
  {
    "name": "Paper Platez",
    "address": "2135 Old Middlefield Way, Mountain View, CA, 94043"
  },
  {
    "name": "Destino",
    "address": "103 Horne Avenue, San Francisco, CA, 94124"
  },
  {
    "name": "KALE_ME_CRAZY__AUSTIN",
    "address": "8300 North FM 620, Building: 8300, Austin, TX 78726"
  },
  {
    "name": "SAVERY__ATX",
    "address": "1300 E Anderson Ln Building D , Austin, TX  78752"
  },
  {
    "name": "NG_CAFE",
    "address": "13000 North Interstate 35, #200, Austin, TX 78753"
  },
  {
    "name": "LAZEEZ_MEDITERRANEAN_CAFE",
    "address": "6812 N FM 620,, Austin, TX 78732"
  },
  {
    "name": "Chennai Tiffins Indian",
    "address": "2690 El Camino Real, Santa Clara, CA, 95051"
  },
  {
    "name": "Towers Cafe",
    "address": "111 N Market St #120, San Jose, CA, 95113"
  },
  {
    "name": "Asian Street Eatery",
    "address": "1146 W El Camino Real, Sunnyvale, CA, 94087"
  },
  {
    "name": "Cocina Dona Maria",
    "address": "2215 Tasman Dr, Santa Clara, CA 95054"
  },
  {
    "name": "Shan Restaurant",
    "address": "3739 El Camino Real, Santa Clara, CA, 95051"
  },
  {
    "name": "Flor De Pineapple",
    "address": "3334 Victor Ct, Santa Clara, CA, 95054"
  },
  {
    "name": "iGrill Kababs and Biryani",
    "address": "3170 De La Cruz Blvd #131, Santa Clara, CA 95054"
  },
  {
    "name": "Starbird Chicken (San Jose)",
    "address": "1088 E Brokaw Rd #10, San Jose, CA 95131"
  },
  {
    "name": "ROYAL_BLUE_GROCERY",
    "address": "2500 S Highway 183 #540, Austin, TX 78744"
  },
  {
    "name": "LA_SPEZIA",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "MAMA_NOYS",
    "address": "8309 Research Blvd Ste B, Manon's Shared Kitchen,  Austin, TX 78758"
  },
  {
    "name": "Mahalo Hawaii BBQ",
    "address": "4750 Almaden Expy Suite 120, San Jose, CA 95118"
  },
  {
    "name": "STONE_OAK_CATERING",
    "address": "1300 E Anderson Ln Building D , Austin, TX 78752"
  },
  {
    "name": "EL_CHILE_ON_MANOR",
    "address": "1900 Manor Rd, Austin, TX 78722"
  },
  {
    "name": "BIRD_BIRD_BISCUIT_MANOR_RD",
    "address": "2701 Manor Rd, Austin, TX 78722"
  },
  {
    "name": "GREENS_N_GRILLS",
    "address": "31804 Alvarado Blvd, Union City, CA 94587"
  },
  {
    "name": "HAMBURGER_STAND",
    "address": "5333 Adeline St, Oakland, CA 94608"
  },
  {
    "name": "HIBACHI_SHAK",
    "address": "5333 Adeline St, Oakland, CA 94608"
  },
  {
    "name": "KITAVA__TEMESCAL",
    "address": "375 40th St , Oakland, CA  94609"
  },
  {
    "name": "JAYNA_GYRO",
    "address": "5959 Shellmound St., Emeryville, CA 94608"
  },
  {
    "name": "SALS_BURGERS",
    "address": "3158 Campus Dr, San Mateo, CA 94403"
  },
  {
    "name": "BROOKLYN_BREAKFAST_SHOP",
    "address": "1505 town creek drive, Austin, TX 78741"
  },
  {
    "name": "ATX_PIZZA_CO",
    "address": "5610 North Interstate HWY 35, Austin, TX 78751"
  },
  {
    "name": "ROMANOS_MACARONI_GRILL__MLPTS",
    "address": "110 Ranch Dr, Milpitas, CA 95035"
  },
  {
    "name": "SMOKED_OUT_BBQ",
    "address": "807 Aldo Ave, Suite 106, Santa Clara, CA 95054"
  },
  {
    "name": "SCARBROUGH_CAFE_AND_LOUNGE",
    "address": "5012 E 7th street, Austin, TX 78702"
  },
  {
    "name": "MARISCOS_COSTA_DEL_SOL",
    "address": "2135 Old Middlefield Way, Building: 2135, Mountain View, CA 94043"
  },
  {
    "name": "SALAD_MONDE",
    "address": "1301 Sixth Ave, Belmont, CA 94002"
  },
  {
    "name": "Punjab Cafe",
    "address": "322-324 E Santa Clara St, San Jose, CA 95113"
  },
  {
    "name": "Chika",
    "address": "3060 Olsen Drive Suite 20, San Jose, CA, 95128"
  },
  {
    "name": "STARBIRD_CHICKEN_CAMPBELL",
    "address": "1875 S Bascom Ave Ste 112, Campbell, CA 95008"
  },
  {
    "name": "Habana Cuba",
    "address": "387 S 1st St Suite 109, San Jose, CA 95113"
  },
  {
    "name": "Kathmandu Cuisine",
    "address": "138 S Main St, Milpitas, CA 95035"
  },
  {
    "name": "Starbird Chicken (San Jose)",
    "address": "1088 E Brokaw Rd #10, San Jose"
  },
  {
    "name": "AREPA_WORLD",
    "address": "1720 Barton Springs Rd, Austin, TX 78704"
  },
  {
    "name": "CHEF_ALVINS_BURGERS__REDWOOD",
    "address": "200 Redwood Shores Pkwy,, Redwood City, CA  94065"
  },
  {
    "name": "Urban Momo (San Jose)",
    "address": "100 N Almaden Ave #176, San Jose, CA 95110"
  },
  {
    "name": "Bolitful Kitchen",
    "address": "1078 E Brokaw Rd #40, San Jose, CA, 95131"
  },
  {
    "name": "Starbird (San Jose)",
    "address": "1088 E Brokaw Rd #10, San Jose"
  },
  {
    "name": "The Kebab Guys",
    "address": "1727 Berryessa Rd A, San Jose 95133"
  },
  {
    "name": "INDUSTRY",
    "address": "1211 East 5th Street  , Building: 1211, Austin, TX 78702"
  },
  {
    "name": "AUSTIN_SOUP__SANDWICH_TH_ST",
    "address": "214 E 6th St, Austin, TX 78701"
  },
  {
    "name": "CHILANTRO",
    "address": "1509 S Lamar Blvd, Austin, TX 78704"
  },
  {
    "name": "TODOS_BUENOS",
    "address": "2315 Valdez St, , Oakland, CA  94612"
  },
  {
    "name": "CHICKN__TAYA",
    "address": "5333 Adeline St, Oakland, CA 94608"
  },
  {
    "name": "THE_GURKHA_KITCHEN",
    "address": "1342 S Mary Ave, Sunnyvale, CA 94087"
  },
  {
    "name": "ORANGE_SQUARE",
    "address": "20343 Stevens Creek Blvd, Cupertino, CA  95014"
  },
  {
    "name": "BBQ Korean Lover Steak",
    "address": "3278 El Camino Real, Santa Calra, CA, 95051"
  },
  {
    "name": "Iniburger",
    "address": "3555 Monroe St #75, Santa Clara, CA 95051"
  },
  {
    "name": "AERION_TEXAS_GREEK",
    "address": "3400 Comsouth Dr, austin , tx 78744"
  },
  {
    "name": "AA_SICHUAN",
    "address": "8650 Spicewood Springs Rd, Ste 133D, Austin, TX 78759"
  },
  {
    "name": "AKITA__SUSHI",
    "address": "5353 Almaden Expressway, Suite M-22, San Jose,  CA 95118"
  },
  {
    "name": "Bun Me Up",
    "address": "23 N Market St, San Jose, CA 95113"
  },
  {
    "name": "Starbird (San Jose)",
    "address": "1088 E Brokaw Rd #10, San Jose, CA 95131"
  },
  {
    "name": "Burma Bay",
    "address": "47966 Warm Springs Blvd, Fremont, CA 94539"
  },
  {
    "name": "Kasa Indian Eatery",
    "address": "4001 18th St, San Francisco, CA 94114"
  },
  {
    "name": "Togo's Sandwiches",
    "address": "1683 Hollenbeck Ave, Sunnyvale, CA, 94087"
  },
  {
    "name": "BIG_DADDYS_HAWAIIAN_BBQ_ATX",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "Tarim Garden",
    "address": "2135 El Camino Real, Santa Clara, CA, 95050"
  },
  {
    "name": "The Don's Deli",
    "address": "620 E Evelyn Ave, Sunnyvale, CA, 94086"
  },
  {
    "name": "ABVE The Basics",
    "address": "2705 Union Ave, San Jose, CA, 95124"
  },
  {
    "name": "Mahalo Hawaiian BBQ",
    "address": "4750 Almaden Expy Suite 120, San Jose, CA 95118"
  },
  {
    "name": "HAPPY_CHICKS_TH_ST__AUSTIN",
    "address": "214 East 6th Street , Austin, TX 78701"
  },
  {
    "name": "HAWAIIAN_BROS_ISLAND_GRILL_COMSOUTH",
    "address": "3400 Comsouth Drive, Austin, TX 78744"
  },
  {
    "name": "TIGERS_DEN",
    "address": "1321 South Congress Avenue, Building: 1321, Austin, TX 78704"
  },
  {
    "name": "MEDITERRANEAN_WRAPS",
    "address": "433 California Avenue, Building: 433, Palo Alto, CA 94306"
  },
  {
    "name": "Pupusa Time",
    "address": "949 Ruff Drive San Jose, CA 95110"
  },
  {
    "name": "MIRANDAS_CAF",
    "address": "301 Congress Avenue, Building: 301, Austin, TX 78701"
  },
  {
    "name": "TU_PEPITO",
    "address": "13343 US-183, #270, Austin, TX 78750"
  },
  {
    "name": "SARAS_KITCHEN",
    "address": "66 21st Ave , San Mateo, ca 95051"
  },
  {
    "name": "On a Roll",
    "address": "87 N San Pedro St, San Jose, CA 95110"
  },
  {
    "name": "Via Mia Pizza",
    "address": "5251 Camden Ave, San Jose, CA, 95124"
  },
  {
    "name": "INFERNILLO",
    "address": "3400 Comsouth Dr, Austin , TX  78744"
  },
  {
    "name": "TX_SHAWARMA",
    "address": "601 West Live Oak Street , Austin, TX 78704"
  },
  {
    "name": "Seto Restaurant",
    "address": "511 Borregas Ave, Sunnyvale, CA 94085"
  },
  {
    "name": "Great Indian Cuisine",
    "address": "2026 Agnew Rd, Santa Clara, CA, 95054"
  },
  {
    "name": "Una Mas Mexican Grill",
    "address": "548 Lawrence Expy, Sunnyvale, CA, 94085"
  },
  {
    "name": "BIJOU_CATERING",
    "address": "25037 Clawiter Road, Hayward , CA 94545"
  },
  {
    "name": "BAY_AREA_PIZZA",
    "address": "2898 Homestead Road, Building: 2898, Santa Clara, CA 95051"
  },
  {
    "name": "TOGOS_SANTA_CLARA",
    "address": "5350 Great America Pkwy , Santa Clara, CA 95054"
  },
  {
    "name": "Cocina Dona Maria",
    "address": "2215 Tasman Dr, Santa Clara, CA 9505"
  },
  {
    "name": "Greens N Grills",
    "address": "3334 Victor Ct, Santa Clara, CA 95054"
  },
  {
    "name": "Taqueria Cazadores",
    "address": "3763 Lafayette St, Santa Clara, CA, 95054"
  },
  {
    "name": "MOONBOWLS__SAN_JOSE",
    "address": "949 Ruff Dr., San Jose, CA 95110"
  },
  {
    "name": "Red Chili",
    "address": "2538 Berryessa Rd, San Jose, CA 95132"
  },
  {
    "name": "Sourdough & Co.",
    "address": "809 Cuesta Dr Suite A, Mountain View, CA, 94040"
  },
  {
    "name": "Pho #1",
    "address": "568 E El Camino Real B, Sunnyvale, CA, 94087"
  },
  {
    "name": "Banh Mi Oven",
    "address": "1143 Story Rd Suite #196, San Jose, CA, 95122"
  },
  {
    "name": "CON_MADRE_COCINA",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "BANH_MI_PHO_WINGS",
    "address": "510 West Oltorf Street, Austin, TX 78704"
  },
  {
    "name": "MANGIA_LA_PASTA",
    "address": "1300 E. Anderson Lane, Suite 1204, Austin, Texas 78752"
  },
  {
    "name": "BURI_BURI",
    "address": "407 old county rd , Belmont, CA 94002"
  },
  {
    "name": "Sam & Curry",
    "address": "1477 Berryessa Rd Unit 15 San Jose, CA 95133"
  },
  {
    "name": "Jiwa (San Jose)",
    "address": "3060 Olsen Dr Suite 20, San Jose, CA 95128"
  },
  {
    "name": "Chika",
    "address": "3060 Olsen Dr Suite 20, San Jose, CA 95128"
  },
  {
    "name": "Palmita (San Jose)",
    "address": "949 Ruff Dr, San Jose, CA, 95110"
  },
  {
    "name": "YAYAS",
    "address": "8309 Research blvd, Austin, TX 78758, Austin, TX 78758"
  },
  {
    "name": "REGINAS_ITALIAN_BOWLS__PIADINAS",
    "address": "5610 N Interstate Hwy 35, Austin, TX 78751"
  },
  {
    "name": "STERRATO_ITALIAN_SPECIALTIES",
    "address": "3400 Comsouth Drive, Austin , TX 78744"
  },
  {
    "name": "PHONATIC_VIETNAMESE",
    "address": "2525 W anderson Ln, Austin, TX 78757"
  },
  {
    "name": "Kasa Indian Eatery",
    "address": "1356 Polk St.San Francisco, CA, 94114"
  },
  {
    "name": "Cocina Doña Maria",
    "address": "2215 Tasman Dr, Santa Clara, CA 9505"
  },
  {
    "name": "Udon Mugizo",
    "address": "1072 Saratoga Ave, San Jose, CA 95129"
  },
  {
    "name": "Urban Momo - San Jose",
    "address": "100 N Almaden Ave #176, San Jose, CA 95110"
  },
  {
    "name": "Kasa Indian Eatery",
    "address": "4001 18th St, San Francisco, CA"
  }
];

// Export for use in your application
export type { Restaurant };
export { restaurantAddresses };