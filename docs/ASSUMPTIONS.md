# Working assumptions (pending client confirmation)

The client asked development to continue before the open questions in the plan (section 3) are answered.
These are the defaults the build uses. Every value marked **editable** can be changed in the admin
(Store Settings) without code changes. Update this file as the client confirms or changes each item.

| # | Topic | Assumption used | Where it lives | Status |
|---|---|---|---|---|
| A1 | Payments at launch | Cash on Delivery + manual JazzCash/Easypaisa transfer, verified by staff in the admin. Hosted gateways switched on when merchant IDs arrive. | Store Settings > Payments (editable) | Pending |
| A2 | Delivery fee | Flat **Rs 250** nationwide. | Store Settings > Shipping (editable) | Pending |
| A3 | Free delivery | Orders of **Rs 3,000** or more. | Store Settings > Shipping (editable) | Pending |
| A4 | COD limit | Max **Rs 25,000** per COD order; larger orders must prepay. | Store Settings > Payments (editable) | Pending |
| A5 | Delivery estimate | "2-5 working days". | Store Settings > Shipping (editable) | Pending |
| A6 | Courier | Tracking number entered manually; courier list: TCS, Leopards, PostEx, Trax, M&P. | Orders > Fulfilment | Pending |
| A7 | Notifications | Email confirmations + click-to-WhatsApp. No WhatsApp Business API at launch. | Phase 4 | Pending |
| A8 | Stock deduction | Deducted when the order is **placed**, restored on cancel/return. | Store Settings > Inventory (editable) | Pending |
| A9 | Gift wrap | Offered, **Rs 150**, with optional gift note. | Store Settings > Gift wrap (editable) | Pending |
| A10 | Launch fragrances | Sweet Rose, Citrus Mint, Forest Pine, Vanilla Oud, Lavender Bliss, Cool Ice (from the client's label artwork). | Seed script | Pending |
| A11 | Prices | Mock prices only (diffuser Rs 1,450). Real prices come from the client. | Products | Pending |
| A12 | Staff | Owner account only at launch; Manager/Staff roles available. | Users | Pending |
| A13 | Customer accounts | Optional; login by email magic link / OTP. Guest checkout always available. | Phase 7 | Pending |
| A14 | Voice-note feedback | Deferred to after launch. | Phase 7 backlog | Pending |
| A15 | Domain | coco.pk, registered in the client's name. | Ops | Pending |
| A16 | Brand fonts | Cormorant Garamond (display, closest free match to the logo serif) + Jost (body/UI). Replace if the client has licensed brand fonts. | `src/app/(frontend)/layout.tsx` | Pending |
| A17 | Brand colours | Burgundy #6B1F2A, Blush #E9CFC2, Nude #F3E3D8, Cream #FAF4EE, Gold #B8945A, sampled from the packaging board. | `styles.css` `@theme` | Pending |
| A18 | Product imagery | Portrait 4:5 for all product media; videos 6-15 s, 720p, under 1.5 MB. Mock images in `public/mock` are crops of the brand boards and must be replaced. | Media guidelines | Pending |
| A20 | Gift set stock | Gift sets are pre-packed and have their **own stock**; selling one does not reduce the stock of the diffusers inside it. | Products (bundle) | Pending |
| A21 | Overselling | Orders that exceed available stock are rejected unless "Allow backorders" is switched on. | Store Settings > Inventory (editable) | Pending |
| A22 | Checkout fields | Name, mobile, optional email, city, address, optional landmark, gift wrap/note, payment, marketing consent (unticked by default). | Checkout | Pending |
| A23 | Coupons | Discount applies to the subtotal of eligible categories; free delivery threshold uses the subtotal before discount; one coupon per order. | Checkout | Pending |
| A24 | Online payment | A verified JazzCash/Easypaisa payment moves a "New" order to "Confirmed" automatically; COD orders still need a confirmation call. | Payments | Pending |
| A25 | Failed payment | The order is kept; the customer can retry or switch to Cash on Delivery from the order page. | Order page | Pending |
| A26 | COD collection | Marking a Cash on Delivery order "Delivered" marks its payment Paid (the courier collected it). | Order hooks | Pending |
| A27 | Bulk import | CSV import updates existing products/variants by SKU (price, sale, cost, stock, status). New products are still created in the admin. | Admin > Bulk update | Pending |
| A28 | Stock alerts | Low/out-of-stock emails go to Store Settings > Support email (or `LOW_STOCK_ALERT_EMAIL`). | Products | Pending |
| A19 | WhatsApp number | Not known yet; the floating WhatsApp button stays hidden until `whatsappNumber` is set in Store Settings (or `NEXT_PUBLIC_WHATSAPP_NUMBER`). | Store Settings | Pending |
| A29 | Revenue & profit definitions | Net sales = item value after discounts, excluding cancelled/returned/refunded orders. Estimated profit = net sales + delivery + gift wrap - cost of goods - recorded expenses (courier bills must be entered as expenses). | `src/lib/reports/compute.ts` | Pending |
| A30 | Report access | Staff see sales, customer and marketing reports; Finance and Inventory (cost, profit, stock value, expenses) are manager/owner only. | Reports | Pending |
| A31 | Report time zone | Days, weeks (Monday start) and months are Pakistan time (UTC+5). | `src/lib/reports/range.ts` | Pending |
| A32 | Abandoned-cart capture | A checkout is saved once the visitor types a valid phone or email (disclosed under the phone field). It counts as recovered when that visitor, or the same phone within 14 days, places an order. Follow-up is manual (WhatsApp button); automatic reminders wait for WhatsApp API / consent decision (A7). | Marketing > Abandoned carts | Pending |
| A33 | Newsletter | Footer sign-up and the checkout opt-in (with an email) add to Subscribers. Unsubscribe needs a button press on `/unsubscribe` and also withdraws customer email consent. Campaigns are sent from an external tool using the CSV export. | Marketing > Subscribers | Pending |
| A34 | Who can review | Anyone can submit; everything waits for moderation. The Verified purchase badge needs a **delivered** order containing the product (order link, order number + phone, or signed-in account). One review per customer per product once verified. | Reviews | Pending |
| A35 | Review media | Up to 4 photos (8 MB each) or videos (25 MB each; MP4/WebM, no iPhone .mov). Private until the review is approved. Voice notes stay in the backlog (A14). | Reviews | Pending |
| A36 | Account sign-in | Email + 6-digit code only (no passwords). SMS codes would need a paid provider. Customers without email keep using guest checkout and Track order. Replaces "magic link / OTP" in A13. | `/account` | Pending |
| A37 | Order history | An account shows orders placed with its verified email, including earlier guest orders with that email. Orders placed with only a phone number are not shown. | `/account` | Pending |
| A38 | Account deletion | Customers can delete their login, addresses and wishlist. Orders stay for business records. | `/account` | Pending |
| A39 | Complaint priority | Complaints start as High priority; alerts go to Store Settings > Support email. | Support Tickets | Pending |
| A40 | Two-factor | Authenticator-app codes, available to all admin users. Strongly prompted, not forced: the dashboard warns owners and managers until they turn it on. | `/admin/security` | Pending |
| A41 | Analytics consent | GA4 loads only after a visitor accepts the cookie banner, so visitors who decline are not counted. Reports in the admin are unaffected. | Storefront | Pending |
| A42 | Turnstile | Applies to checkout, reviews, contact, newsletter and sign-in once keys are set. A visitor who cannot complete it cannot submit, and is pointed to WhatsApp. | Environment | Pending |
| A43 | Purchase event | GA4 counts a Cash on Delivery sale when placed, even if later cancelled, so its revenue will read higher than Reports. Reports are the source of truth. | GA4 | Pending |
| A44 | Performance targets | Measured on simulated slow 4G with sample images, no CDN: Lighthouse performance 84-90 (plan: 90+), accessibility and SEO 100, JavaScript 208-235 KB (plan: 170 KB on category pages; React and Next are about 118 KB). Budgets guard against regressions at today's values. Re-measure on staging behind Cloudflare with real product images. | `scripts/check-budget.mjs`, `lighthouserc.json` | Pending |
| A45 | Restock and promote suggestions | Restock: products that sold in the period and are low, out of stock, or have 14 days of stock or less. Promote: live in-stock products that sold nothing or have over 60 days of stock. Suggestions only; nothing changes automatically. | `src/lib/reports/compute.ts` (Reports > Inventory) | Pending |

