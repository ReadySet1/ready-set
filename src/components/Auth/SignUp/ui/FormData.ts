// FormData.ts

export interface Option {
  label: string;
  value: string;
}

// Define the constants for enum-like fields
export const COUNTIES: readonly Option[] = [
  { label: "Alameda", value: "Alameda" },
  { label: "Contra Costa", value: "Contra Costa" },
  { label: "Marin", value: "Marin" },
  { label: "Napa", value: "Napa" },
  { label: "San Francisco", value: "San Francisco" },
  { label: "San Mateo", value: "San Mateo" },
  { label: "Santa Clara", value: "Santa Clara" },
  { label: "Solano", value: "Solano" },
  { label: "Sonoma", value: "Sonoma" },
] as const;

export const US_STATES: readonly Option[] = [
  { label: "Alabama", value: "AL" },
  { label: "Alaska", value: "AK" },
  { label: "Arizona", value: "AZ" },
  { label: "Arkansas", value: "AR" },
  { label: "California", value: "CA" },
  { label: "Colorado", value: "CO" },
  { label: "Connecticut", value: "CT" },
  { label: "Delaware", value: "DE" },
  { label: "Florida", value: "FL" },
  { label: "Georgia", value: "GA" },
  { label: "Hawaii", value: "HI" },
  { label: "Idaho", value: "ID" },
  { label: "Illinois", value: "IL" },
  { label: "Indiana", value: "IN" },
  { label: "Iowa", value: "IA" },
  { label: "Kansas", value: "KS" },
  { label: "Kentucky", value: "KY" },
  { label: "Louisiana", value: "LA" },
  { label: "Maine", value: "ME" },
  { label: "Maryland", value: "MD" },
  { label: "Massachusetts", value: "MA" },
  { label: "Michigan", value: "MI" },
  { label: "Minnesota", value: "MN" },
  { label: "Mississippi", value: "MS" },
  { label: "Missouri", value: "MO" },
  { label: "Montana", value: "MT" },
  { label: "Nebraska", value: "NE" },
  { label: "Nevada", value: "NV" },
  { label: "New Hampshire", value: "NH" },
  { label: "New Jersey", value: "NJ" },
  { label: "New Mexico", value: "NM" },
  { label: "New York", value: "NY" },
  { label: "North Carolina", value: "NC" },
  { label: "North Dakota", value: "ND" },
  { label: "Ohio", value: "OH" },
  { label: "Oklahoma", value: "OK" },
  { label: "Oregon", value: "OR" },
  { label: "Pennsylvania", value: "PA" },
  { label: "Rhode Island", value: "RI" },
  { label: "South Carolina", value: "SC" },
  { label: "South Dakota", value: "SD" },
  { label: "Tennessee", value: "TN" },
  { label: "Texas", value: "TX" },
  { label: "Utah", value: "UT" },
  { label: "Vermont", value: "VT" },
  { label: "Virginia", value: "VA" },
  { label: "Washington", value: "WA" },
  { label: "West Virginia", value: "WV" },
  { label: "Wisconsin", value: "WI" },
  { label: "Wyoming", value: "WY" },
] as const;

export const TIME_NEEDED: readonly Option[] = [
  { label: "Breakfast", value: "Breakfast" },
  { label: "Lunch", value: "Lunch" },
  { label: "Dinner", value: "Dinner" },
  { label: "All Day", value: "All Day" },

  // Add other time options
] as const;

export const CATERING_BROKERAGE: readonly Option[] = [
  { label: "Foodee", value: "Foodee" },
  { label: "Ez Cater", value: "Ez Cater" },
  { label: "Grubhub", value: "Grubhub" },
  { label: "Cater Cow", value: "Cater Cow" },
  { label: "Cater2me", value: "Cater2me" },
  { label: "Zero Cater", value: "Zero Cater" },
  { label: "Platterz", value: "Platterz" },
  { label: "Direct Delivery", value: "Direct Delivery" },
  { label: "Other", value: "Other" },
] as const;

export const FREQUENCY = [
  { label: "1-5 per week", value: "1-5 per week" },
  { label: "6-15 per week", value: "6-15 per week" },
  { label: "16-25 per week", value: "16-25 per week" },
  { label: "over 25 per week", value: "over 25 per week" },
] as const;

export const PROVISIONS: readonly Option[] = [
  { label: "Utensils", value: "Utensils" },
  { label: "Labels", value: "Labels" },
  { label: "Napkins", value: "Napkins" },
  { label: "Serving Utensils", value: "Serving Utensils" },
  { label: "Place Settings", value: "Place Settings" },
  // Add other provisions
] as const;

export const HEAD_COUNT: Option[] = [
  { value: "1-24", label: "1-24" },
  { value: "25-49", label: "25-49" },
  { value: "50-74", label: "50-74" },
  { value: "75-99", label: "75-99" },
  { value: "100-124", label: "100-124" },
  { value: "125-149", label: "125-149" },
  { value: "150-174", label: "150-174" },
  { value: "175-199", label: "175-199" },
  { value: "200-249", label: "200-249" },
  { value: "250-299", label: "250-299" },
  { value: "+300", label: "+300" },
];

// Define the form data structure
export interface FormData {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  userType: "vendor" | "client" | "driver" | "helpdesk";
  company: string;
  parking?: string;
  countiesServed?: (typeof COUNTIES)[number][];
  countyLocation?: (typeof COUNTIES)[number][];
  timeNeeded: (typeof TIME_NEEDED)[number][];
  cateringBrokerage?: (typeof CATERING_BROKERAGE)[number][];
  frequency: (typeof FREQUENCY)[number];
  provisions?: (typeof PROVISIONS)[number][];
  head_count?: (typeof HEAD_COUNT)[number];
  contact_name?: string;
  contact_number?: string;
  website?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  location_number?: string;
}

export interface VendorFormData {
  userType: "vendor";
  contact_name: string;
  email: string;
  phoneNumber: string;
  password: string;
  company: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  parking?: string;
  countiesServed: string[];
  timeNeeded: string[];
  cateringBrokerage?: string[];
  frequency: string;
  provisions?: string[];
  website?: string;
  days_per_week: string;
  service_type: string;
  total_staff: string;
  deliveries_per_day: string;
  partnered_services: string;
  multiple_locations: boolean;
  delivery_radius: string;
}
export interface ClientFormData {
  userType: "client";
  contact_name: string;
  email: string;
  phoneNumber: string;
  password: string;
  company: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  timeNeeded: string[];
  frequency: (typeof FREQUENCY)[number]["value"];  
  parking?: string;
  countiesServed: string[];
  head_count: string;
  website?: string;
}

export interface DriverFormData extends FormData {
  userType: "driver";
  name: string;  // Make sure this is included
}

export interface HelpDeskFormData extends FormData {
  userType: "helpdesk";
  name: string;  // Make sure this is included
}