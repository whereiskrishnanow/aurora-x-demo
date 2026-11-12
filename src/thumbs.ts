/**
 * Real photos for result thumbnails, one set per kind of business.
 *
 * The businesses in this demo are fictional, so these are category photos,
 * not photos of the businesses. All are freely licensed images from
 * Wikimedia Commons (licence noted beside each), shown from Wikimedia's servers.
 */

const PHOTOS: Record<string, string[]> = {
  pharmacy: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/HK_TKO_%E5%B0%87%E8%BB%8D%E6%BE%B3_Tseung_Kwan_O_%E7%99%BD%E5%8B%9D%E8%A7%92_Pak_Shing_Kok_%E9%A6%99%E6%B8%AF%E4%B8%AD%E9%86%AB%E9%86%AB%E9%99%A2_The_Chinese_Medicine_Hospital_of_Hong_Kong_%E8%97%A5%E6%88%BF_pharmacy_room_December_2025_N13P_03.jpg/250px-thumbnail.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // HK TKO 將軍澳 Tseung Kwan O 白勝角 Pak Shing Kok 香港中醫醫院 The Chinese Med (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/HK_TKO_%E5%B0%87%E8%BB%8D%E6%BE%B3_Tseung_Kwan_O_%E7%99%BD%E5%8B%9D%E8%A7%92_Pak_Shing_Kok_%E9%A6%99%E6%B8%AF%E4%B8%AD%E9%86%AB%E9%86%AB%E9%99%A2_The_Chinese_Medicine_Hospital_of_Hong_Kong_%E8%97%A5%E6%88%BF_pharmacy_room_December_2025_N13P_01.jpg/250px-thumbnail.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // HK TKO 將軍澳 Tseung Kwan O 白勝角 Pak Shing Kok 香港中醫醫院 The Chinese Med (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/HK_TKO_%E5%B0%87%E8%BB%8D%E6%BE%B3_Tseung_Kwan_O_%E7%99%BD%E5%8B%9D%E8%A7%92_Pak_Shing_Kok_%E9%A6%99%E6%B8%AF%E4%B8%AD%E9%86%AB%E9%86%AB%E9%99%A2_The_Chinese_Medicine_Hospital_of_Hong_Kong_%E8%97%A5%E6%88%BF_pharmacy_room_December_2025_N13P_02.jpg/250px-thumbnail.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // HK TKO 將軍澳 Tseung Kwan O 白勝角 Pak Shing Kok 香港中醫醫院 The Chinese Med (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/Pharmacy_counter_six%2C_plus_Influx_of_volunteers_help_keep_Rader_pharmacy_at_full_speed_150831-A-DZ999-002.jpg/250px-Pharmacy_counter_six%2C_plus_Influx_of_volunteers_help_keep_Rader_pharmacy_at_full_speed_150831-A-DZ999-002.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Pharmacy counter six, plus Influx of volunteers help keep Rader p (Public domain)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/The_Counter_of_Bo_Ren_Tang_Chinese_Medicine_Store.jpg/250px-The_Counter_of_Bo_Ren_Tang_Chinese_Medicine_Store.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // The Counter of Bo Ren Tang Chinese Medicine Store.jpg (CC0)
  ],
  florist: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Bouquet_of_red_and_yellow_roses.jpg/250px-Bouquet_of_red_and_yellow_roses.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Bouquet of red and yellow roses.jpg (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Bouquet_of_red_roses.jpg/250px-Bouquet_of_red_roses.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Bouquet of red roses.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Red_roses_from_bouquet_2.jpg/250px-Red_roses_from_bouquet_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Red roses from bouquet 2.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Bouquets_of_red_roses.jpg/250px-Bouquets_of_red_roses.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Bouquets of red roses.jpg (CC BY 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Bouquet_of_roses_of_various_colours.jpg/250px-Bouquet_of_roses_of_various_colours.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Bouquet of roses of various colours.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Red_roses_from_bouquet.jpg/250px-Red_roses_from_bouquet.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Red roses from bouquet.jpg (CC BY-SA 4.0)
  ],
  plumber: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Handyman_photos_Fix_Barber_Wilson_diverter_valve_18.JPG/250px-Handyman_photos_Fix_Barber_Wilson_diverter_valve_18.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Handyman photos Fix Barber Wilson diverter valve 18.JPG (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Handyman_photos_Fix_Barber_Wilson_diverter_valve_17.JPG/250px-Handyman_photos_Fix_Barber_Wilson_diverter_valve_17.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Handyman photos Fix Barber Wilson diverter valve 17.JPG (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Handyman_photos_Fix_Barber_Wilson_diverter_valve_1.JPG/250px-Handyman_photos_Fix_Barber_Wilson_diverter_valve_1.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Handyman photos Fix Barber Wilson diverter valve 1.JPG (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Handyman_photos_Fix_Barber_Wilson_diverter_valve_15.JPG/250px-Handyman_photos_Fix_Barber_Wilson_diverter_valve_15.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Handyman photos Fix Barber Wilson diverter valve 15.JPG (CC0)
  ],
  bakery: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/18th_birthday_chocolate_cake.jpg/250px-18th_birthday_chocolate_cake.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // 18th birthday chocolate cake.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Chocolate_birthday_cake.jpg/250px-Chocolate_birthday_cake.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Chocolate birthday cake.jpg (CC BY 2.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Happy_Birthday_Chocolate_cake_with_cream_floral_designs.jpg/250px-Happy_Birthday_Chocolate_cake_with_cream_floral_designs.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Happy Birthday Chocolate cake with cream floral designs.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Chocolate_birthday_cake%2C_Brisbane%2C_2015.jpg/250px-Chocolate_birthday_cake%2C_Brisbane%2C_2015.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Chocolate birthday cake, Brisbane, 2015.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Chocolate_Topping_on_top_and_around_the_side_of_a_Birthday_Cake.jpg/250px-Chocolate_Topping_on_top_and_around_the_side_of_a_Birthday_Cake.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Chocolate Topping on top and around the side of a Birthday Cake.j (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Chocolate_Topping_and_Icing_with_Sprinkle_Elements_on_top_of_a_Birthday_Cake.jpg/250px-Chocolate_Topping_and_Icing_with_Sprinkle_Elements_on_top_of_a_Birthday_Cake.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Chocolate Topping and Icing with Sprinkle Elements on top of a Bi (CC0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Rectangular_Chocolate_Cake_with_Icing_and_Baked_Elements.jpg/250px-Rectangular_Chocolate_Cake_with_Icing_and_Baked_Elements.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Rectangular Chocolate Cake with Icing and Baked Elements.jpg (CC0)
  ],
  ac: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Panasonic_AIR_CONDITIONER_INDOOR_UNIT_CS-C10KJ2_%282%29.jpg/250px-Panasonic_AIR_CONDITIONER_INDOOR_UNIT_CS-C10KJ2_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Panasonic AIR CONDITIONER INDOOR UNIT CS-C10KJ2 (2).jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Sanyo_SAP-KRV-93EH.jpg/250px-Sanyo_SAP-KRV-93EH.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Sanyo SAP-KRV-93EH.jpg (CC BY-SA 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Air_conditioner_repair%2C_Nigeria.jpg/250px-Air_conditioner_repair%2C_Nigeria.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Air conditioner repair, Nigeria.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/A_Maddie_age_men_is_repairing_a_air_conditioner_in_the_food_court.jpg/250px-A_Maddie_age_men_is_repairing_a_air_conditioner_in_the_food_court.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // A Maddie age men is repairing a air conditioner in the food court (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Air_conditioning_and_refrigeration_repair.jpg/250px-Air_conditioning_and_refrigeration_repair.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Air conditioning and refrigeration repair.jpg (CC0)
  ],
  catering: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Catering_%28in_Macau%29.jpg/250px-Catering_%28in_Macau%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Catering (in Macau).jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Wikimania_2019_by_Marios_Magioladitis_11.jpg/250px-Wikimania_2019_by_Marios_Magioladitis_11.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Wikimania 2019 by Marios Magioladitis 11.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/Qdoba_Catering.jpg/250px-Qdoba_Catering.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Qdoba Catering.jpg (CC BY 2.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Catering_Juntas_en_Internet_2024_05.jpg/250px-Catering_Juntas_en_Internet_2024_05.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Catering Juntas en Internet 2024 05.jpg (CC BY 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Wikimania_Afternoon_Food_-_Day_2.jpg/250px-Wikimania_Afternoon_Food_-_Day_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Wikimania Afternoon Food - Day 2.jpg (CC BY-SA 4.0)
  ],
  rental: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Apartment_Block%2C_West_India_Dock_Road%2C_Limehouse%2C_London_-_geograph.org.uk_-_3621602.jpg/250px-Apartment_Block%2C_West_India_Dock_Road%2C_Limehouse%2C_London_-_geograph.org.uk_-_3621602.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Apartment Block, West India Dock Road, Limehouse, London - geogra (CC BY-SA 2.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Vaibhav_Apartment%2C_Manikonda.jpg/250px-Vaibhav_Apartment%2C_Manikonda.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Vaibhav Apartment, Manikonda.jpg (CC BY-SA 4.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/An_Apartment_park_area_in_Miyapur.jpg/250px-An_Apartment_park_area_in_Miyapur.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // An Apartment park area in Miyapur.jpg (CC BY-SA 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Street_Scene_with_Kids_and_Apartment_Block_-_Fort_District_-_Mumbai_-_Maharashtra_-_India_%2826151790460%29.jpg/250px-Street_Scene_with_Kids_and_Apartment_Block_-_Fort_District_-_Mumbai_-_Maharashtra_-_India_%2826151790460%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Street Scene with Kids and Apartment Block - Fort District - Mumb (CC BY-SA 2.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Apartment_Building_Under_Construction_-_14_Ajay_Nagar_-_Dum_Dum_-_Kolkata_2017-08-08_4114.JPG/250px-Apartment_Building_Under_Construction_-_14_Ajay_Nagar_-_Dum_Dum_-_Kolkata_2017-08-08_4114.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Apartment Building Under Construction - 14 Ajay Nagar - Dum Dum - (CC BY 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Aparna_Zenon%2C_Hyderabad_-_Symmetric_framing_of_the_high-rise_apartment_towers_facade.jpg/250px-Aparna_Zenon%2C_Hyderabad_-_Symmetric_framing_of_the_high-rise_apartment_towers_facade.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Aparna Zenon, Hyderabad - Symmetric framing of the high-rise apar (CC BY-SA 4.0)
  ],
  general: [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Grocery_Shop_in_a_small_Town_in_South_India_%281%29.JPG/250px-Grocery_Shop_in_a_small_Town_in_South_India_%281%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Grocery Shop in a small Town in South India (1).JPG (CC BY-SA 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Grocery_Shop_in_a_small_Town_in_South_India_%282%29.JPG/250px-Grocery_Shop_in_a_small_Town_in_South_India_%282%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Grocery Shop in a small Town in South India (2).JPG (CC BY-SA 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Small_bread_shop_on_Guttahalli_Main_Road_-_panoramio.jpg/250px-Small_bread_shop_on_Guttahalli_Main_Road_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Small bread shop on Guttahalli Main Road - panoramio.jpg (CC BY 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Small_Market_%ED%9E%8C%EB%91%90%EC%82%AC%EC%9B%90_Huma_temple%2C_Orissa%2C_India_-_panoramio.jpg/250px-Small_Market_%ED%9E%8C%EB%91%90%EC%82%AC%EC%9B%90_Huma_temple%2C_Orissa%2C_India_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // Small Market 힌두사원 Huma temple, Orissa, India - panoramio.jpg (CC BY-SA 3.0)
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/India_-_Kolkata_two-story_shop_-_3221.jpg/250px-India_-_Kolkata_two-story_shop_-_3221.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", // India - Kolkata two-story shop - 3221.jpg (CC BY-SA 3.0)
  ],
}

const KINDS: [RegExp, string][] = [
  [/pharma|chemist|medic|insulin|tablet|drug/i, 'pharmacy'],
  [/flor|rose|flower|bouquet/i, 'florist'],
  [/plumb|leak|tap|pipe/i, 'plumber'],
  [/cake|bak|dessert/i, 'bakery'],
  [/\bac\b|air ?con|cooling/i, 'ac'],
  [/cater|food for|guests|thali|buffet/i, 'catering'],
  [/bhk|rent|flat|apartment|\bpg\b|room|house|studio|villa/i, 'rental'],
]

/** A photo for this business: picked by the kind of request, fixed per name. */
export function photoFor(brief: string, name: string): string {
  const kind = KINDS.find(([re]) => re.test(brief))?.[1] ?? 'general'
  const set = PHOTOS[kind]
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return set[hash % set.length]
}
