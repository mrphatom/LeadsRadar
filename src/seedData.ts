import { BusinessLead } from './types';

export const PREPOPULATED_LEADS: BusinessLead[] = [
  {
    id: 'lead_seed_1',
    name: "Golden Grain Bakery",
    country: "USA",
    city: "Austin",
    address: "1402 S Congress Ave, Austin, TX 78704",
    category: "Bakery",
    phone: "+1 (512) 555-0143",
    email: "info@goldengrainaustin.local",
    status: "new",
    notes: "A beloved local sourdough bakery with strong foot traffic but only a Yelp page with no online ordering or menu.",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: "log_seed_1_1",
        type: "note",
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Seed Lead Enrolled",
        detail: "Prospect found on local business registers matching webless criteria."
      }
    ]
  },
  {
    id: 'lead_seed_2',
    name: "Schulz Kfz-Meisterbetrieb",
    country: "Germany",
    city: "Munich",
    address: "Dachauer Str. 182, 80992 München",
    category: "Auto Mechanic",
    phone: "+49 89 55518290",
    email: "kontakt@schulz-kfz.local",
    status: "negotiating",
    notes: "Independent BMW/Audi specialist. Fully-booked through local reputation, looking to systematize client intake and list pricing online.",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: "log_seed_2_1",
        type: "note",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Initial Search Audit",
        detail: "Found listing lacking direct website. Social ratings are high but lacks brand domain."
      },
      {
        id: "log_seed_2_2",
        type: "call",
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Pitched Custom Booking System",
        detail: "Called Meister Schulz. Offered a free landing page mockup showing self-booking calendar. He expressed high interest."
      }
    ]
  },
  {
    id: 'lead_seed_3',
    name: "Maple Ridge Plumbing",
    country: "Canada",
    city: "Toronto",
    address: "421 Bay St, Toronto, ON M5H 2Y4",
    category: "Plumbing",
    phone: "+1 (416) 555-8931",
    email: "service@mapleridgeplumbing.local",
    status: "contacted",
    notes: "Family-owned emergency repair plumbers. Doing well but struggling to rank in local Google Search against competitors with SEO-optimized sites.",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: "log_seed_3_1",
        type: "note",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Discovered via Search Grounding",
        detail: "Identified list registration lack. Highlighted localized search volume for Toronto Plumbers."
      }
    ]
  },
  {
    id: 'lead_seed_4',
    name: "Oxford Garden Care",
    country: "UK",
    city: "Oxford",
    address: "94 Banbury Rd, Oxford OX2 6JT",
    category: "Landscaping",
    phone: "+44 1865 559401",
    email: "hello@oxfordgardens.local",
    status: "new",
    notes: "Premium garden design and hedge pruning services. Currently relies on flyers and local community boards. Needs a portfolio website to showcase work.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: "log_seed_4_1",
        type: "note",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Lead Created",
        detail: "Prospect profile matched via landscape niche crawler."
      }
    ]
  },
  {
    id: 'lead_seed_5',
    name: "The London Barbershop",
    country: "UK",
    city: "London",
    address: "88 Kingsland Rd, London E2 8DP",
    category: "Barber",
    phone: "+44 20 7555 9018",
    email: "bookings@londonbarbers.local",
    status: "won",
    notes: "Vintage barbering and beard styling spot. Booking is done exclusively via phone calls or walk-ins. Needs custom web booking calendar.",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: "log_seed_5_1",
        type: "note",
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Lead Discovered",
        detail: "Barbershop listing with substantial reviews but empty website link."
      },
      {
        id: "log_seed_5_2",
        type: "email",
        timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Cold Email Dispatched",
        detail: "Sent B2B layout design template offering unified schedule booking system."
      },
      {
        id: "log_seed_5_3",
        type: "status_change",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        title: "Deposit Paid / Deal Won",
        detail: "Agreement signed. Client paid 50% deposit for development of responsive web calendar."
      }
    ]
  }
];
