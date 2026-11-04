# COCO storefront: UX specification (Phase 1)

Status: draft for client review. The live UI kit is at `/design-system` (run `npm run dev`).
Assumptions referenced as A1-A19 are listed in [../ASSUMPTIONS.md](../ASSUMPTIONS.md).

## 1. Principles

1. **Mobile first.** Designed at 390 px wide first; most traffic arrives from Instagram/TikTok on mobile data.
2. **Thumb reach.** Primary actions sit low on the screen: bottom tab bar, sticky add-to-cart bar on product pages, full-width checkout buttons.
3. **Premium calm.** Cream background, burgundy accents, generous spacing, serif display type. One accent colour per screen.
4. **Show the product.** Swipeable photos and videos on every product card. Fragrance is shown with colour swatches and mood lines.
5. **Trust at the point of doubt.** COD, delivery estimate, returns and WhatsApp help appear next to price and checkout, not only in the footer.
6. **Accessible by default.** WCAG 2.2 AA contrast, 44 px touch targets, visible focus, labelled controls, reduced-motion support.

## 2. Breakpoints and grid

| Name | Width | Product grid | Navigation |
|---|---|---|---|
| Mobile | < 640 px | 2 columns, 12 px gap | Hamburger drawer + bottom tab bar |
| Tablet | 640-1023 px | 3 columns | Hamburger drawer + bottom tab bar |
| Desktop | >= 1024 px | 4 columns, max width 1280 px | Inline menu with dropdowns, no tab bar |

## 3. Sitemap

```
/                          Home
/collections               All categories
/collections/[slug]        Category listing (car-scents, hanging-car-diffusers, car-accessories, ...)
/products/[slug]           Product detail
/search?q=                 Search results
/wishlist                  Wishlist (guest: saved on device)
/cart                      Cart page (fallback for the slide-out drawer)
/checkout                  One-page guest checkout
/order/[number]            Order confirmation / status
/track-order               Track by order number + phone
/account                   Sign in (emailed code), orders, addresses
/contact, /faq             Support
/pages/[slug]              Shipping, returns, privacy, terms
/design-system             Internal UI kit (noindex)
/admin                     Owner admin panel
```

## 4. Global elements

- **Announcement bar**: one line, burgundy. Default "Free delivery on orders over Rs 3,000 | Cash on Delivery nationwide" (A2, A3). Editable as a Banner with placement "Announcement".
- **Header** (sticky, 64 px mobile / 80 px desktop): menu (mobile) or category links with sub-category dropdowns (desktop), centred COCO wordmark, search, account and wishlist (tablet up), cart with item count.
- **Mobile tab bar**: Home, Shop, Search, Wishlist, Account. Safe-area aware.
- **WhatsApp button**: floating, bottom right, above the tab bar. Opens chat with a pre-filled message. Hidden until a number is set (A19).
- **Footer**: wave divider, wordmark, tagline, socials; Shop links; Help links; contact; payment methods; legal links.

## 5. Page specifications

### 5.1 Home
1. Hero: full-bleed brand image, eyebrow "Scent your world", headline, two CTAs (Shop car scents / Explore gift sets). Becomes a slider when more than one Hero banner is active.
2. Shop by category: 4 portrait tiles, 2x2 on mobile.
3. Best sellers: product card row, horizontal scroll on mobile, sorted by sales.
4. Fragrance finder strip: the six fragrance swatches with mood lines; each links to a filtered listing.
5. Gift sets feature: split image + copy + CTA.
6. Why COCO: Long lasting, Premium fragrance, Leak-proof, Fits all cars (icons from the label artwork).
7. Reviews strip: approved reviews with customer photos.
8. Newsletter signup with explicit consent checkbox.

### 5.2 Category listing
- Title, short description, product count.
- Sticky toolbar: **Filter** (opens bottom sheet on mobile, sidebar on desktop) and **Sort** (Featured, Newest, Price low-high, Price high-low, Best selling).
- Filters: price range, product type (sub-category), fragrance (swatches), availability (in stock only). Active filters show as removable chips. Filters live in the URL so results can be shared and indexed.
- Grid of product cards; **Load more** button (not infinite scroll) after 12 items, showing "Showing 12 of 30".
- Empty state with "Clear filters".

### 5.3 Product card (built: `ProductCard`)
- 4:5 media area, swipeable; dots always shown when more than one item; arrows on desktop hover; videos autoplay muted only while visible.
- Badges top-left: sale %, New, Sold out. Wishlist heart top-right.
- Mobile: round "+" quick-add. Desktop: "Add to cart" (or "Choose fragrance") + Quick View eye, revealed on hover/focus.
- Below: category/mood eyebrow, name, fragrance swatches (when multiple), price with strikethrough, stock line.
- Quick add on a product that needs a fragrance opens Quick View instead of adding a random variant.

### 5.4 Quick View (built: `QuickView`)
Bottom sheet on mobile, modal on desktop. Gallery, name, rating, price, stock, fragrance picker, quantity, Add to cart, "View full details".

### 5.5 Product detail
1. Gallery: swipe on mobile with thumbnails strip below; desktop two-column with vertical thumbnails. Tap opens full-screen viewer with pinch zoom; videos inline.
2. Info: eyebrow, name, rating (jumps to reviews), price, stock line, fragrance picker with mood line and notes, quantity, Add to cart, "Order on WhatsApp" secondary.
3. Trust row: COD available, delivery estimate (A5), easy exchanges.
4. Accordions: Description, Features & specifications, Fragrance notes (top/heart/base), Shipping & returns.
5. Reviews: average, distribution, photo/video gallery, list, "Write a review" (moderated).
6. "Complete the gift" and related products rows.
7. Mobile sticky bar appears after scrolling past the main button: price + Add to cart.

### 5.6 Cart drawer (built: `CartDrawer`)
Free-delivery progress bar, line items with image, variant, quantity stepper, remove, line total; subtotal, delivery, total; Checkout button; COD reassurance. Empty state with CTA.

### 5.7 Checkout (single page, guest)
Order of fields chosen for the Pakistani COD flow:
1. Contact: full name, mobile number (03XX XXXXXXX, validated), email (optional, needed for e-receipt).
2. Delivery: city (searchable list), complete address, optional landmark.
3. Gift options (A9): gift wrap toggle (+Rs 150), gift note.
4. Payment: Cash on Delivery (default), JazzCash, Easypaisa (A1). Disabled methods show why.
5. Discount code field (collapsed link).
6. Order summary: collapsible on mobile, sticky right column on desktop.
7. Marketing consent checkbox (unchecked by default).
8. "Place order" with total. Server re-validates prices and stock.

### 5.8 Order confirmation
Order number, summary, payment status, what happens next (call/WhatsApp confirmation for COD), WhatsApp button pre-filled with the order number, link to track order.

### 5.9 Account (optional)
Sign in with an emailed one-time code. Orders list with status, saved addresses, wishlist, marketing preferences.

## 6. Interaction and motion rules
- Drawers slide in 280 ms; modals fade/pop 200 ms; respect `prefers-reduced-motion`.
- Add to cart opens the cart drawer (confirmation + upsell), never navigates away.
- Errors appear inline under the field, in plain language, and are announced to screen readers.
- No pop-ups on first visit; newsletter prompt only in the footer and checkout.

## 7. Content specifications
| Asset | Spec |
|---|---|
| Product images | 4:5 portrait, min 1600 x 2000 px, plain or styled background, first image = hero shot |
| Product videos | 4:5 or 9:16, 6-15 s, 720p, H.264 MP4, < 1.5 MB, no audio required |
| Category tiles | 4:5, 1200 x 1500 px |
| Hero banners | Desktop 2400 x 1200 px; mobile 1200 x 1500 px |
| Product name | Max 40 characters |
| Mood line | Max 24 characters, e.g. "Floral & Romantic" |

## 8. Phase 1 sign-off checklist
- [ ] Colours, fonts and logo usage approved (A16, A17)
- [ ] Product card behaviour approved (swipe, badges, quick add/view)
- [ ] Header, mobile tab bar and menu approved
- [ ] Page structures in section 5 approved
- [ ] Checkout fields and order approved
- [ ] Assumptions A1-A19 confirmed or corrected
