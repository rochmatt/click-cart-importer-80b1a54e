import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import p5 from "@/assets/p5.jpg";
import p6 from "@/assets/p6.jpg";
import p7 from "@/assets/p7.jpg";
import p8 from "@/assets/p8.jpg";

import p1a from "@/assets/p1a.jpg";
import p1b from "@/assets/p1b.jpg";
import p2a from "@/assets/p2a.jpg";
import p2b from "@/assets/p2b.jpg";
import p3a from "@/assets/p3a.jpg";
import p3b from "@/assets/p3b.jpg";
import p4a from "@/assets/p4a.jpg";
import p4b from "@/assets/p4b.jpg";
import p5a from "@/assets/p5a.jpg";
import p5b from "@/assets/p5b.jpg";
import p6a from "@/assets/p6a.jpg";
import p6b from "@/assets/p6b.jpg";
import p7a from "@/assets/p7a.jpg";
import p7b from "@/assets/p7b.jpg";
import p8a from "@/assets/p8a.jpg";
import p8b from "@/assets/p8b.jpg";

export interface Product {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  category: string;
  rating: number;
  reviews: number;
  images: string[];
  links: { shopee: string; tokopedia: string; tiktok: string };
  description: string;
  specs: string[];
  detailedSpecs?: { label: string; value: string }[];
}

const links = {
  shopee: "https://shopee.co.id",
  tokopedia: "https://www.tokopedia.com",
  tiktok: "https://www.tiktok.com/shop",
};

export const products: Product[] = [
  {
    id: "1",
    title: "Classic Low-Top Leather Sneakers — Everyday Comfort Edition",
    category: "Fashion",
    price: "Rp 549.000",
    oldPrice: "Rp 799.000",
    rating: 4.8,
    reviews: 1204,
    images: [p1, p1a, p1b],
    links,
    description:
      "Versatile everyday sneakers built for all-day comfort. Features a premium faux-leather upper, breathable mesh lining, and a cushioned insole that keeps every step light.",
    specs: [
      "Upper: synthetic leather",
      "Lining: breathable mesh",
      "Sole: durable rubber outsole",
      "Closure: classic lace-up",
      "Weight: approx. 780g per pair",
    ],
    detailedSpecs: [
      { label: "Model", value: "Everyday Comfort Edition" },
      { label: "Upper Material", value: "Premium synthetic leather" },
      { label: "Lining", value: "Breathable mesh" },
      { label: "Outsole", value: "Durable rubber with anti-slip tread" },
      { label: "Closure", value: "Classic lace-up" },
      { label: "Insole", value: "Cushioned memory foam" },
      { label: "Weight", value: "Approx. 780g per pair" },
      { label: "Available Sizes", value: "38 – 44 EU" },
      { label: "Care Instructions", value: "Wipe clean with damp cloth" },
      { label: "Warranty", value: "7-day return guarantee" },
    ],
  },
  {
    id: "2",
    title: "Studio Wireless Over-Ear Headphones with Active Noise Cancelling",
    category: "Electronics",
    price: "Rp 1.249.000",
    oldPrice: "Rp 1.699.000",
    rating: 4.7,
    reviews: 892,
    images: [p2, p2a, p2b],
    links,
    description:
      "Immerse yourself in rich, detailed audio with hybrid active noise cancelling, plush memory-foam ear cushions, and up to 30 hours of wireless playback.",
    specs: [
      "Driver: 40mm dynamic drivers",
      "ANC: hybrid active noise cancelling",
      "Battery: up to 30 hours playback",
      "Connectivity: Bluetooth 5.2",
      "Charging: USB-C fast charging",
    ],
    detailedSpecs: [
      { label: "Model", value: "Studio Wireless ANC" },
      { label: "Driver Unit", value: "40mm dynamic drivers" },
      { label: "Frequency Response", value: "20Hz – 20kHz" },
      { label: "Active Noise Cancelling", value: "Hybrid ANC with ambient mode" },
      { label: "Battery Life", value: "Up to 30 hours (ANC on)" },
      { label: "Fast Charge", value: "10 min = 4 hours playback" },
      { label: "Connectivity", value: "Bluetooth 5.2, 3.5mm wired" },
      { label: "Microphone", value: "Dual beamforming mics" },
      { label: "Weight", value: "Approx. 250g" },
      { label: "In the Box", value: "Headphones, USB-C cable, 3.5mm cable, carrying pouch" },
    ],
  },
  {
    id: "3",
    title: "Handmade Stoneware Mug 350ml, Matte Glaze Finish",
    category: "Kitchen",
    price: "Rp 129.000",
    rating: 4.9,
    reviews: 342,
    images: [p3, p3a, p3b],
    links,
    description:
      "An artisan-made stoneware mug finished with a soft matte glaze. Microwave and dishwasher safe, it brings a warm, handcrafted feel to your morning routine.",
    specs: [
      "Material: stoneware ceramic",
      "Capacity: 350ml",
      "Finish: matte glaze",
      "Care: dishwasher & microwave safe",
      "Dimensions: 9 x 9 x 10 cm",
    ],
    detailedSpecs: [
      { label: "Material", value: "High-fired stoneware ceramic" },
      { label: "Capacity", value: "350ml" },
      { label: "Finish", value: "Matte glaze, food-safe coating" },
      { label: "Dimensions", value: "9 x 9 x 10 cm" },
      { label: "Weight", value: "Approx. 320g" },
      { label: "Microwave Safe", value: "Yes" },
      { label: "Dishwasher Safe", value: "Yes" },
      { label: "Origin", value: "Handmade in Indonesia" },
      { label: "Care", value: "Avoid sudden temperature changes" },
      { label: "Packaging", value: "Recycled kraft gift box" },
    ],
  },
  {
    id: "4",
    title: "Brightening Vitamin C Face Serum 30ml for Dull & Uneven Skin",
    category: "Beauty",
    price: "Rp 189.000",
    oldPrice: "Rp 249.000",
    rating: 4.6,
    reviews: 2310,
    images: [p4, p4a, p4b],
    links,
    description:
      "A lightweight, fast-absorbing serum powered by stabilized vitamin C and niacinamide to brighten dull skin, even out tone, and boost hydration.",
    specs: [
      "Volume: 30ml",
      "Key ingredients: vitamin C, niacinamide, hyaluronic acid",
      "Skin type: suitable for all skin types",
      "Use: morning and evening",
      "Free from: parabens, sulfates, artificial fragrance",
    ],
    detailedSpecs: [
      { label: "Volume", value: "30ml / 1 fl. oz." },
      { label: "Key Ingredients", value: "15% Vitamin C, Niacinamide, Hyaluronic Acid" },
      { label: "Skin Type", value: "All skin types, including sensitive" },
      { label: "Texture", value: "Lightweight, fast-absorbing serum" },
      { label: "pH Level", value: "Balanced at 6.0 – 6.5" },
      { label: "How to Use", value: "Apply 2-3 drops to clean face, AM and PM" },
      { label: "Free From", value: "Parabens, sulfates, artificial fragrance" },
      { label: "Shelf Life", value: "12 months after opening" },
      { label: "Certifications", value: "Dermatologically tested, BPOM registered" },
      { label: "Storage", value: "Keep in a cool, dry place away from sunlight" },
    ],
  },
  {
    id: "5",
    title: "Minimalist Hybrid Smart Watch with Woven Fabric Strap",
    category: "Electronics",
    price: "Rp 899.000",
    rating: 4.5,
    reviews: 517,
    images: [p5, p5a, p5b],
    links,
    description:
      "A classic analog look meets smart functionality. Track steps, sleep, and notifications with a discreet sub-dial and up to two weeks of battery life.",
    specs: [
      "Display: analog hands + smart sub-dial",
      "Tracking: steps, sleep, calories",
      "Battery: up to 14 days",
      "Connectivity: Bluetooth 5.0",
      "Strap: woven fabric, 20mm quick-release",
    ],
    detailedSpecs: [
      { label: "Model", value: "Hybrid Smart Watch" },
      { label: "Display", value: "Analog hands + smart sub-dial" },
      { label: "Tracking", value: "Steps, sleep, calories, distance" },
      { label: "Notifications", value: "Calls, messages, app alerts" },
      { label: "Battery Life", value: "Up to 14 days" },
      { label: "Connectivity", value: "Bluetooth 5.0" },
      { label: "Water Resistance", value: "5ATM (swim-proof)" },
      { label: "Strap", value: "Woven fabric, 20mm quick-release" },
      { label: "Compatibility", value: "iOS 12+ and Android 8+" },
      { label: "In the Box", value: "Watch, extra strap, magnetic charger, manual" },
    ],
  },
  {
    id: "6",
    title: "Full-Grain Leather Crossbody Bag, Compact Daily Carry",
    category: "Fashion",
    price: "Rp 675.000",
    oldPrice: "Rp 899.000",
    rating: 4.8,
    reviews: 731,
    images: [p6, p6a, p6b],
    links,
    description:
      "A compact crossbody bag crafted from full-grain leather with an adjustable strap and secure zip pockets. Designed for effortless daily carry.",
    specs: [
      "Material: full-grain leather",
      "Dimensions: 22 x 16 x 6 cm",
      "Strap: adjustable 120–140 cm",
      "Pockets: 1 zip main compartment, 1 front zip pocket",
      "Hardware: YKK zippers",
    ],
    detailedSpecs: [
      { label: "Material", value: "Full-grain cowhide leather" },
      { label: "Dimensions", value: "22 x 16 x 6 cm" },
      { label: "Strap Length", value: "Adjustable 120 – 140 cm" },
      { label: "Strap Width", value: "2.5 cm" },
      { label: "Main Compartment", value: "Zip closure with 2 slip pockets" },
      { label: "Front Pocket", value: "Zippered quick-access pocket" },
      { label: "Hardware", value: "YKK zippers, antique brass finish" },
      { label: "Capacity", value: "Fits phone, wallet, keys, small tablet" },
      { label: "Weight", value: "Approx. 380g" },
      { label: "Care", value: "Condition leather every 3 months" },
    ],
  },
  {
    id: "7",
    title: "Adjustable LED Desk Lamp with Warm Dimming Control",
    category: "Home & Living",
    price: "Rp 359.000",
    rating: 4.4,
    reviews: 268,
    images: [p7, p7a, p7b],
    links,
    description:
      "A sleek desk lamp with warm-to-cool dimming, a flexible gooseneck arm, and an eye-care LED panel that reduces glare during long work sessions.",
    specs: [
      "Light source: eye-care LED panel",
      "Color temperature: 2700K–6500K",
      "Brightness: stepless dimming",
      "Power: 7W, USB-C powered",
      "Flexibility: 180° arm rotation",
    ],
    detailedSpecs: [
      { label: "Model", value: "LED Desk Lamp Pro" },
      { label: "Light Source", value: "Eye-care LED panel, flicker-free" },
      { label: "Color Temperature", value: "2700K – 6500K" },
      { label: "Brightness Levels", value: "Stepless dimming" },
      { label: "Power Consumption", value: "7W" },
      { label: "Power Input", value: "USB-C 5V/2A" },
      { label: "Arm Rotation", value: "180° vertical, 90° horizontal" },
      { label: "Controls", value: "Touch-sensitive panel" },
      { label: "Base", value: "Anti-slip silicone pad" },
      { label: "Warranty", value: "1 year limited warranty" },
    ],
  },
  {
    id: "8",
    title: "Polarized Acetate Sunglasses UV400 Protection, Unisex Frame",
    category: "Fashion",
    price: "Rp 299.000",
    oldPrice: "Rp 419.000",
    rating: 4.7,
    reviews: 456,
    images: [p8, p8a, p8b],
    links,
    description:
      "Timeless unisex sunglasses with polarized TAC lenses and lightweight acetate frames. Offers full UV400 protection for everyday wear.",
    specs: [
      "Lens: polarized TAC, UV400 protection",
      "Frame: lightweight acetate",
      "Fit: unisex",
      "Hinges: spring metal",
      "Weight: approx. 28g",
    ],
    detailedSpecs: [
      { label: "Lens Material", value: "Polarized TAC" },
      { label: "UV Protection", value: "UV400" },
      { label: "Frame Material", value: "Lightweight acetate" },
      { label: "Frame Fit", value: "Unisex" },
      { label: "Lens Width", value: "52 mm" },
      { label: "Bridge Width", value: "20 mm" },
      { label: "Temple Length", value: "145 mm" },
      { label: "Hinges", value: "Spring metal for flexible fit" },
      { label: "Weight", value: "Approx. 28g" },
      { label: "Included", value: "Soft microfiber pouch and cleaning cloth" },
    ],
  },
];
