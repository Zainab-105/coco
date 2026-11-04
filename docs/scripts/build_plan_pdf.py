"""Builds docs/COCO-Development-Plan.pdf.  Run: python docs/scripts/build_plan_pdf.py"""

from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "COCO-Development-Plan.pdf"
LOGO = ROOT / "public" / "brand" / "coco-logo.png"

BURGUNDY = colors.HexColor("#6B1F2A")
BURGUNDY_DARK = colors.HexColor("#4A1620")
ROSE = colors.HexColor("#C99485")
BLUSH = colors.HexColor("#E9CFC2")
NUDE = colors.HexColor("#F3E3D8")
CREAM = colors.HexColor("#FAF4EE")
INK = colors.HexColor("#2B1A1C")
MUTED = colors.HexColor("#6E5A5C")
GOLD = colors.HexColor("#B8945A")

W, H = A4
MARGIN = 18 * mm
CONTENT_W = W - 2 * MARGIN

# ---------------------------------------------------------------- styles
s_body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=5)
s_small = ParagraphStyle("small", parent=s_body, fontSize=8.3, leading=11, spaceAfter=0)
s_cell = ParagraphStyle("cell", parent=s_body, fontSize=8.3, leading=10.8, spaceAfter=0)
s_cell_b = ParagraphStyle("cellb", parent=s_cell, fontName="Helvetica-Bold")
s_head_cell = ParagraphStyle("headcell", parent=s_cell, fontName="Helvetica-Bold", textColor=colors.white)
s_h1 = ParagraphStyle("h1", fontName="Times-Roman", fontSize=22, leading=26, textColor=BURGUNDY, spaceBefore=4, spaceAfter=4)
s_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=BURGUNDY, spaceBefore=10, spaceAfter=4)
s_h3 = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=9.8, leading=13, textColor=INK, spaceBefore=6, spaceAfter=2)
s_kicker = ParagraphStyle("kicker", fontName="Helvetica", fontSize=8, leading=10, textColor=ROSE, spaceAfter=2)
s_bullet = ParagraphStyle("bullet", parent=s_body, leftIndent=11, bulletIndent=2, spaceAfter=2.5)
s_callout = ParagraphStyle("callout", parent=s_body, fontSize=9.3, leading=13, textColor=BURGUNDY_DARK, spaceAfter=0)


def P(text, style=s_body):
    return Paragraph(text, style)


def bullets(items, style=s_bullet):
    return [Paragraph(i, style, bulletText="•") for i in items]


def section(number, title, kicker=None):
    out = []
    if kicker:
        out.append(P(kicker.upper(), s_kicker))
    out.append(P(f"{number}. {title}" if number else title, s_h1))
    out.append(Spacer(1, 2))
    out.append(Table([[""]], colWidths=[28 * mm], rowHeights=[1.6],
                     style=[("BACKGROUND", (0, 0), (-1, -1), GOLD)], hAlign="LEFT"))
    out.append(Spacer(1, 8))
    return out


def table(rows, widths, header=True, zebra=True, bold_first_col=False):
    data = []
    for r, row in enumerate(rows):
        cells = []
        for c, value in enumerate(row):
            if isinstance(value, str):
                if header and r == 0:
                    style = s_head_cell
                elif bold_first_col and c == 0:
                    style = s_cell_b
                else:
                    style = s_cell
                cells.append(Paragraph(value, style))
            else:
                cells.append(value)
        data.append(cells)
    t = Table(data, colWidths=[w * CONTENT_W for w in widths], repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, BLUSH),
    ]
    if header:
        cmds.append(("BACKGROUND", (0, 0), (-1, 0), BURGUNDY))
    if zebra:
        for r in range(1 if header else 0, len(rows)):
            if r % 2 == 0:
                cmds.append(("BACKGROUND", (0, r), (-1, r), CREAM))
    t.setStyle(TableStyle(cmds))
    return t


def callout(text, title=None):
    content = [P(f"<b>{title}</b>", s_callout)] if title else []
    content.append(P(text, s_callout))
    t = Table([[content]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NUDE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, BURGUNDY),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


# ---------------------------------------------------------------- page chrome
def on_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, W, H, stroke=0, fill=1)
    canvas.setFillColor(BURGUNDY)
    canvas.rect(0, 0, W, 70 * mm, stroke=0, fill=1)
    canvas.setFillColor(ROSE)
    p = canvas.beginPath()
    p.moveTo(0, 70 * mm)
    p.curveTo(W * 0.35, 92 * mm, W * 0.6, 52 * mm, W, 78 * mm)
    p.lineTo(W, 70 * mm)
    p.curveTo(W * 0.6, 44 * mm, W * 0.35, 84 * mm, 0, 62 * mm)
    p.close()
    canvas.drawPath(p, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Roman", 14)
    canvas.drawCentredString(W / 2, 34 * mm, "Little Scents. Big Vibes.")
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(BLUSH)
    canvas.drawCentredString(W / 2, 24 * mm, "Prepared by the lead developer  |  30 October 2026  |  Version 1.0")
    canvas.restoreState()


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BLUSH)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, H - 12 * mm, W - MARGIN, H - 12 * mm)
    canvas.setFont("Times-Roman", 10)
    canvas.setFillColor(BURGUNDY)
    canvas.drawString(MARGIN, H - 10 * mm, "C O C O")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(W - MARGIN, H - 10 * mm, "Development Plan  |  Confidential")
    canvas.line(MARGIN, 12 * mm, W - MARGIN, 12 * mm)
    canvas.drawString(MARGIN, 8 * mm, "Prepared 30 October 2026  |  v1.0")
    canvas.drawRightString(W - MARGIN, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


# ---------------------------------------------------------------- diagrams
def box(d, x, y, w, h, title, sub=None, fill=NUDE, stroke=BURGUNDY, tcolor=BURGUNDY_DARK):
    d.add(Rect(x, y, w, h, rx=5, ry=5, fillColor=fill, strokeColor=stroke, strokeWidth=0.8))
    ty = y + h / 2 + (3 if sub else -3)
    d.add(String(x + w / 2, ty, title, fontName="Helvetica-Bold", fontSize=8.2, fillColor=tcolor, textAnchor="middle"))
    if sub:
        for i, line in enumerate(sub.split("\n")):
            d.add(String(x + w / 2, ty - 10 - i * 8.5, line, fontName="Helvetica", fontSize=6.8, fillColor=MUTED, textAnchor="middle"))


def arrow(d, x1, y1, x2, y2, label=None, color=MUTED):
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=0.8))
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    s = 4.5
    d.add(Polygon([x2, y2, x2 - s * math.cos(a - 0.4), y2 - s * math.sin(a - 0.4),
                   x2 - s * math.cos(a + 0.4), y2 - s * math.sin(a + 0.4)], fillColor=color, strokeColor=color))
    if label:
        d.add(String((x1 + x2) / 2 + 3, (y1 + y2) / 2 + 3, label, fontName="Helvetica", fontSize=6.5, fillColor=MUTED))


def architecture_diagram():
    w = CONTENT_W
    d = Drawing(w, 300)
    # users
    box(d, 10, 255, 130, 34, "Customers", "mobile-first browsers")
    box(d, w - 140, 255, 130, 34, "Owner / Staff", "admin panel /admin")
    # app container
    d.add(Rect(60, 112, w - 120, 120, rx=8, ry=8, fillColor=CREAM, strokeColor=GOLD, strokeWidth=1.2, strokeDashArray=[3, 2]))
    d.add(String(70, 220, "Next.js 16 application  (single deployment)", fontName="Helvetica-Bold", fontSize=8, fillColor=GOLD))
    bw, gap = 112, 15
    x0 = (w - 3 * bw - 2 * gap) / 2
    xs = [x0 + i * (bw + gap) for i in range(3)]
    box(d, xs[0], 140, bw, 66, "Storefront", "React Server Components\nISR product & category pages\ncart, checkout, accounts")
    box(d, xs[1], 140, bw, 66, "Business logic", "Payload hooks + server actions\npricing, stock ledger, CRM\npayment callbacks, jobs")
    box(d, xs[2], 140, bw, 66, "Payload Admin", "products, orders, CRM\ndashboard & reports\nroles, audit log")
    arrow(d, 75, 255, xs[0] + bw / 2, 207)
    arrow(d, w - 75, 255, xs[2] + bw / 2, 207)
    arrow(d, xs[0] + bw, 173, xs[1], 173)
    arrow(d, xs[2], 173, xs[1] + bw, 173)
    # data
    dw, dgap = 140, 15
    d0 = (w - 3 * dw - 2 * dgap) / 2
    ds = [d0 + i * (dw + dgap) for i in range(3)]
    box(d, ds[0], 40, dw, 46, "PostgreSQL 17", "orders, customers, catalog\nnightly + PITR backups", fill=BLUSH)
    box(d, ds[1], 40, dw, 46, "Cloudflare R2 + CDN", "images, videos,\nreview media", fill=BLUSH)
    box(d, ds[2], 40, dw, 46, "Integrations", "JazzCash, Easypaisa, WhatsApp,\nemail, courier, GA4 / GSC", fill=BLUSH)
    mid = xs[1] + bw / 2
    arrow(d, mid - 20, 140, ds[0] + dw / 2, 87)
    arrow(d, mid, 140, ds[1] + dw / 2, 87)
    arrow(d, mid + 20, 140, ds[2] + dw / 2, 87)
    d.add(String(10, 10, "Single codebase: storefront and admin read and write the same database, so orders and customers appear in the admin instantly.",
                 fontName="Helvetica-Oblique", fontSize=7, fillColor=MUTED))
    return d


def order_flow_diagram():
    w = CONTENT_W
    d = Drawing(w, 150)
    steps = [("New", "order saved,\nstock held*"), ("Confirmed", "phone / WA\nconfirmation"), ("Processing", "packing,\ninvoice"),
             ("Shipped", "courier +\ntracking no."), ("Delivered", "COD collected\n= revenue")]
    bw, gap = 88, (w - 5 * 88) / 4
    for i, (t, s) in enumerate(steps):
        x = i * (bw + gap)
        box(d, x, 80, bw, 46, t, s, fill=NUDE)
        if i < 4:
            arrow(d, x + bw, 103, x + bw + gap, 103)
    box(d, 40, 8, 120, 40, "Cancelled", "stock restored", fill=BLUSH)
    box(d, w / 2 - 60, 8, 120, 40, "Returned", "stock restored,\nrefund recorded", fill=BLUSH)
    box(d, w - 160, 8, 120, 40, "Refunded", "excluded from\nnet sales", fill=BLUSH)
    arrow(d, 44, 80, 90, 49)
    arrow(d, 4 * (bw + gap) + 44, 80, w / 2 + 10, 49)
    arrow(d, w / 2 + 60, 28, w - 160, 28)
    d.add(String(0, 136, "* Owner chooses in Store Settings whether stock is held when the order is placed or when it is confirmed.",
                 fontName="Helvetica-Oblique", fontSize=7, fillColor=MUTED))
    return d


def gantt():
    phases = [
        ("0  Project setup (done)", 0, 1),
        ("1  Discovery, UX & design system", 0, 2),
        ("2  Catalog & admin foundations", 1, 3),
        ("3  Storefront: browse & product", 2, 5),
        ("4  Cart, checkout & payments", 4, 7),
        ("5  Orders, CRM & inventory ops", 5, 8),
        ("6  Dashboard, reports & marketing", 7, 10),
        ("7  Reviews, support & accounts", 8, 10),
        ("8  SEO, performance & security", 9, 11),
        ("9  QA, UAT, data entry & launch", 10, 12),
        ("10 Hypercare & handover", 12, 14),
    ]
    weeks = 14
    label_w = 165
    w = CONTENT_W
    row_h = 17
    d = Drawing(w, row_h * (len(phases) + 1) + 6)
    cw = (w - label_w) / weeks
    top = row_h * len(phases)
    for k in range(weeks):
        x = label_w + k * cw
        d.add(Rect(x, 0, cw, top, fillColor=CREAM if k % 2 == 0 else colors.white, strokeColor=None))
        d.add(String(x + cw / 2, top + 5, f"W{k + 1}", fontName="Helvetica-Bold", fontSize=6.5, fillColor=MUTED, textAnchor="middle"))
    for i, (name, start, end) in enumerate(phases):
        y = top - (i + 1) * row_h
        d.add(String(2, y + 5, name, fontName="Helvetica", fontSize=7.4, fillColor=INK))
        fill = GOLD if i == 0 else (BURGUNDY if i < 10 else ROSE)
        d.add(Rect(label_w + start * cw + 1, y + 3, (end - start) * cw - 2, row_h - 6, rx=3, ry=3, fillColor=fill, strokeColor=None))
    d.add(Line(label_w + 12 * cw, 0, label_w + 12 * cw, top, strokeColor=GOLD, strokeWidth=1.2, strokeDashArray=[2, 2]))
    d.add(String(label_w + 12 * cw + 3, top - row_h + 5, "Go-live", fontName="Helvetica-Bold", fontSize=6.5, fillColor=GOLD))
    return d


# ---------------------------------------------------------------- content
def build():
    story = []

    # ----- Cover
    story.append(Spacer(1, 22 * mm))
    if LOGO.exists():
        story.append(Image(str(LOGO), width=88 * mm, height=88 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(P("E-Commerce Platform", ParagraphStyle("c1", fontName="Times-Roman", fontSize=30, leading=34, textColor=BURGUNDY, alignment=TA_CENTER)))
    story.append(P("Technical Analysis &amp; Development Plan", ParagraphStyle("c2", fontName="Helvetica", fontSize=13, leading=18, textColor=MUTED, alignment=TA_CENTER)))
    story.append(Spacer(1, 6 * mm))
    story.append(P("Customer storefront  |  Owner admin panel  |  CRM  |  Inventory  |  Analytics",
                   ParagraphStyle("c3", fontName="Helvetica", fontSize=9, textColor=ROSE, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ----- Contents
    story += section(None, "Contents")
    toc = [
        ("1", "Executive summary"), ("2", "Requirements analysis"), ("3", "Gaps, assumptions &amp; questions for the client"),
        ("4", "Technology stack evaluation &amp; decision"), ("5", "System architecture"), ("6", "Data model"),
        ("7", "Core business workflows"), ("8", "Requirement-to-implementation map"), ("9", "Integrations"),
        ("10", "Security, privacy &amp; backups"), ("11", "SEO &amp; performance"), ("12", "Delivery plan &amp; timeline"),
        ("13", "Sprint-level task breakdown"), ("14", "Testing &amp; acceptance"), ("15", "Costs &amp; recurring fees"),
        ("16", "Risks &amp; mitigations"), ("17", "Handover, ownership &amp; maintenance"), ("18", "Project setup completed"),
    ]
    story.append(table([[n, t] for n, t in toc], [0.08, 0.92], header=False, bold_first_col=True))
    story.append(PageBreak())

    # ----- 1 Executive summary
    story += section(1, "Executive summary", "Overview")
    story.append(P(
        "COCO needs two connected products: a <b>premium, mobile-first storefront</b> for car scents, room diffusers, car "
        "accessories and gift sets, and an <b>owner admin panel</b> that runs the whole business: orders, customer database, "
        "stock, promotions, reviews and growth analytics including profit. The brief is detailed and explicitly asks for "
        "features that standard e-commerce platforms only offer through paid plugins or custom work: swipeable photo/video "
        "galleries on product cards, CRM segmentation, profit reporting with product costs, JazzCash/Easypaisa with real "
        "payment verification, moderated photo/video/voice reviews, and audit logs."))
    story.append(P("<b>Recommendation.</b> Build a custom, owner-controlled platform on <b>Next.js 16 + Payload CMS 3 + PostgreSQL</b>, "
                   "deployed as one application. Payload generates a polished, no-code admin panel from our data model, so the "
                   "owner manages products, orders and content without a developer, while every custom requirement "
                   "(analytics, CRM, payment verification, media galleries) is built natively instead of bolted on with plugins."))
    story.append(Spacer(1, 4))
    kpis = [
        ["Delivery", "Build effort", "Recurring cost", "Ownership"],
        ["~12 weeks to launch<br/>+2 weeks hypercare", "1 senior full-stack dev<br/>+ part-time UI designer &amp; QA",
         "approx. USD 10-70 / month<br/>(no plugin licences)", "100% client-owned code,<br/>data, domain &amp; accounts"],
    ]
    story.append(table(kpis, [0.25, 0.25, 0.25, 0.25]))
    story.append(Spacer(1, 8))
    story.append(callout(
        "Next.js storefront + Payload admin in one TypeScript codebase, PostgreSQL database, Cloudflare R2 for media, "
        "deployed on a low-cost VPS (or Vercel + Neon for a fully managed option). The project skeleton, data model and "
        "core order/CRM/stock logic have already been set up in this repository (see section 18).",
        "Chosen stack in one line"))

    story.append(P("Why not WooCommerce or Shopify?", s_h2))
    story += bullets([
        "<b>WooCommerce</b> covers the basics but needs 12-18 plugins for this brief (analytics, CRM, swipe galleries, review media, "
        "COD rules, invoices, 2FA, backups, exports). Plugin sprawl is what the client explicitly wants to avoid, and it hurts speed on mobile data.",
        "<b>Shopify</b> has no first-party JazzCash/Easypaisa support for Pakistan, charges USD subscriptions plus app fees, "
        "and limits custom analytics, profit reporting and data ownership.",
        "A custom build costs more up front but has the lowest running cost, no licence lock-in, and meets every requirement natively. "
        "Full comparison in section 4.",
    ])
    story.append(PageBreak())

    # ----- 2 Requirements analysis
    story += section(2, "Requirements analysis", "What the client asked for")
    story.append(P("The requirements document was broken down into 13 functional modules. Each was given a priority "
                   "(<b>M</b> = must for launch, <b>S</b> = should for launch, <b>C</b> = could follow after launch) and a complexity rating."))
    req = [
        ["Module", "Key requirements (summarised)", "Priority", "Complexity"],
        ["Brand &amp; catalog", "Categories: Car Scents (hanging diffusers), Car Accessories (ashtrays, front showpieces), Home Scents (room diffusers), Gift Sets. Extensible categories, products, variants.", "M", "Low"],
        ["Design &amp; navigation", "Premium luxury look, mobile-first, sticky mobile nav, header (logo, menu, search, account, cart), footer, fast media.", "M", "Medium"],
        ["Listing pages", "2-col mobile grid, cards with price/sale/discount/stock, <b>swipeable photo+video on cards</b> with dots/arrows, Quick View, Quick Add, wishlist, search suggestions, sort, filters (price, type, fragrance, availability), load more.", "M", "High"],
        ["Product page", "Gallery with video, zoom/full-screen, fragrance notes, variants, quantity, stock &amp; delivery info, reviews with customer media, related products, policies.", "M", "Medium"],
        ["Cart &amp; checkout", "Slide-out cart, no reloads, guest checkout, minimal fields, clear totals, COD, JazzCash/Easypaisa, <b>verified payment status</b>, confirmation page, email/SMS/WhatsApp notifications, WhatsApp help.", "M", "High"],
        ["Accounts &amp; support", "Optional accounts, order history, saved addresses, wishlist, recently viewed, contact, FAQ, newsletter w/ consent, feedback incl. photo/video/voice, moderation.", "S", "Medium"],
        ["Gifts &amp; promotions", "Gift sets/bundles, gift wrap &amp; notes, discount codes, seasonal banners, cross-sell.", "M", "Medium"],
        ["Admin dashboard", "KPIs (sales, orders by status, customers, repeat, low stock, returns, AOV, growth), date filters, live graphs, actual vs estimated labels.", "M", "High"],
        ["Order management", "Auto-saved orders, 8 statuses, search/filter, notes, courier &amp; tracking, invoices &amp; packing slips, CSV/Excel export, refunds/returns history.", "M", "Medium"],
        ["Customer CRM", "Auto-built customer DB, dedupe, order history, LTV/AOV, first/last purchase, segments (new/repeat/high-value/inactive), notes, consent, export, access control.", "M", "Medium"],
        ["Products &amp; inventory", "CRUD/duplicate, media upload, fragrance variants, gift sets, stock with auto-deduction, low-stock alerts, cost prices, adjustment ledger, bulk import/export.", "M", "Medium"],
        ["Analytics &amp; finance", "Sales by period/product/category/fragrance, best &amp; slow sellers, repeat rate, COD vs prepaid, cancellation/delivery rates, coupon performance, gross/net sales, <b>estimated profit</b>, period comparison, exports.", "M", "High"],
        ["Marketing", "Coupons &amp; usage, banners, subscribers, segments, abandoned-cart tracking &amp; recovery, GA4 + Search Console, restock/promote insights, consent-based messaging.", "S", "Medium"],
        ["Reviews &amp; support", "Moderation queue, customer media, voice notes, complaints with status &amp; notes, spam protection.", "S", "Medium"],
        ["Security", "Strong owner auth, 2FA, staff roles, activity logs, SSL, updates, automated &amp; tested backups, secure exports, client owns everything.", "M", "Medium"],
        ["SEO &amp; platform", "SEO URLs/meta, structured data, sitemap, fast mobile, low-cost tools, cost disclosure, handover guide.", "M", "Low"],
    ]
    story.append(table(req, [0.17, 0.61, 0.10, 0.12], bold_first_col=True))
    story.append(Spacer(1, 6))
    story.append(P("Business observations", s_h2))
    story += bullets([
        "The market is <b>Pakistan</b> (JazzCash, Easypaisa, COD, coco.pk on the packaging). Expect a majority of COD orders, so "
        "<b>order confirmation, fake-order reduction and courier tracking</b> matter more than card payments.",
        "Traffic will come mostly from <b>Instagram/TikTok on mobile data</b>. Mobile performance and WhatsApp hand-off directly affect conversion.",
        "The catalogue is small at launch (around 6 fragrances x a few product types), but variants by fragrance are central: fragrance is "
        "a first-class entity (shared across diffusers and gift sets, and used for filters and per-fragrance sales reports).",
        "The owner wants to <b>run the business from the admin</b>: CRM, profit and growth reporting are core requirements, not extras.",
        "Competitors referenced (fieaura.com, colishco.com) use standard Shopify-style themes. Product-card video swiping and a richer "
        "fragrance story are realistic ways for COCO to stand out.",
    ])
    story.append(PageBreak())

    # ----- 3 Gaps & questions
    story += section(3, "Gaps, assumptions &amp; questions for the client", "Clarify before build")
    story.append(P("These items are unspecified or ambiguous in the brief. The assumption shown is what this plan uses until the client confirms otherwise."))
    gaps = [
        ["Topic", "Question", "Working assumption"],
        ["Payments", "Does COCO already hold JazzCash / Easypaisa <b>merchant accounts</b>? (Gateway approval takes 2-6 weeks and needs NTN/business docs.)", "Launch with COD + manual wallet transfer (verified in admin); switch on hosted gateways when merchant IDs arrive."],
        ["Delivery fees", "Flat rate, per-city rates, or free above a threshold?", "Flat rate + free-shipping threshold + optional per-city overrides (all editable)."],
        ["Courier", "Which courier(s)? TCS, Leopards, PostEx, Trax, M&amp;P?", "Manual tracking number entry at launch; API booking for one courier in a later phase."],
        ["Notifications", "Email only, or WhatsApp/SMS too? WhatsApp Business API requires Meta verification and is paid per conversation.", "Email at launch + click-to-WhatsApp. WhatsApp Cloud API order messages as a phase-2 option."],
        ["Stock deduction", "Deduct stock when the order is placed or when confirmed?", "Configurable; default is on placement, restored on cancel/return."],
        ["Gift wrap", "Is gift packaging offered, and is it charged?", "Optional toggle with configurable price, plus gift note."],
        ["Product data", "Who supplies photos, videos, descriptions, fragrance notes, cost prices?", "Client supplies; developer loads launch catalogue (up to 30 SKUs)."],
        ["Voice notes", "Is voice-note feedback a must for launch?", "Phase-2 (browser recording works on most phones, but moderation load is real)."],
        ["Staff", "How many staff users at launch, and what may they see?", "Owner only at launch; Manager/Staff roles are built in (staff cannot see costs or profit)."],
        ["Legal", "Return/exchange window, refund method, privacy policy text?", "Client provides; developer supplies templates to adapt."],
        ["Domain &amp; email", "Is coco.pk registered and in whose name?", "Must be registered to the client (PKNIC). Business email via Zoho/Google Workspace."],
        ["Budget", "Preferred hosting model: lowest cost (VPS) or fully managed?", "VPS for cost; managed option priced in section 15."],
    ]
    story.append(table(gaps, [0.15, 0.45, 0.40], bold_first_col=True))
    story.append(PageBreak())

    # ----- 4 Stack evaluation
    story += section(4, "Technology stack evaluation &amp; decision", "Platform choice")
    story.append(P("Four realistic options were scored against the brief (5 = best). Weighted toward owner control, total cost over 3 years, "
                   "Pakistan payment support and fit with the custom requirements."))
    cmp_rows = [
        ["Criterion", "WooCommerce", "Shopify", "Medusa v2 + Next.js", "Next.js + Payload (chosen)"],
        ["Fit with custom needs (swipe media, CRM, profit, audit)", "2 - many plugins", "2 - apps / limits", "4", "5"],
        ["JazzCash / Easypaisa + payment verification", "3 - 3rd-party plugins", "1 - not supported natively", "4 - custom provider", "5 - custom, full control"],
        ["No-code admin for owner", "4", "5", "3 - commerce admin, CMS separate", "5 - generated from schema, customisable"],
        ["Mobile performance", "2", "4", "5", "5"],
        ["Running cost (3 yrs)", "3 - premium plugins", "2 - USD plans + apps", "4", "5"],
        ["Security surface &amp; maintenance", "2 - plugin updates", "5 - managed", "4", "4"],
        ["Data ownership / portability", "4", "2", "5", "5"],
        ["Time to first version", "5", "5", "3", "4"],
        ["<b>Overall</b>", "<b>Fast start, weak fit</b>", "<b>Fast start, poor PK fit</b>", "<b>Strong; more moving parts</b>", "<b>Best overall fit</b>"],
    ]
    story.append(table(cmp_rows, [0.28, 0.17, 0.17, 0.19, 0.19], bold_first_col=True))
    story.append(Spacer(1, 6))
    story.append(P("Why Payload over Medusa", s_h3))
    story.append(P("Medusa is an excellent commerce engine, but it runs as a separate backend service plus Redis, and its admin covers commerce only "
                   "(banners, policies, FAQs and reviews still need a CMS). Payload runs <i>inside</i> the Next.js app: one deployment, one database, "
                   "one admin for catalogue, orders, CRM, content and reports. For a single-brand store with about 30-200 SKUs, the commerce primitives "
                   "we need (cart, pricing, coupons, stock ledger, order states) are a small, well-tested amount of code, and owning them is "
                   "what makes the custom analytics and PK payment flows straightforward."))
    story.append(P("WooCommerce: built-in vs plugin (as requested in the brief)", s_h3))
    woo = [
        ["Requirement", "WooCommerce status"],
        ["Products, categories, variations, coupons, COD, guest checkout, basic reports", "Built in"],
        ["Swipeable photo + video on product cards, Quick View, AJAX filters", "Premium theme or plugins (e.g. WooCommerce product filters, Quick View) or custom dev"],
        ["JazzCash / Easypaisa", "3rd-party plugins of varying quality; verification logic often weak"],
        ["Customer CRM with segments, LTV, inactivity", "Paid CRM plugin (e.g. Metorik / Jetpack CRM) or custom"],
        ["Profit reporting with product costs", "Paid plugin (Cost of Goods) + custom reports"],
        ["Review photos/videos, moderation", "Paid review plugin"],
        ["Invoices &amp; packing slips, CSV/Excel export", "Free/paid plugins"],
        ["Abandoned cart recovery", "Paid plugin"],
        ["2FA, activity log, backups", "3 separate plugins"],
    ]
    story.append(table(woo, [0.55, 0.45]))
    story.append(Spacer(1, 6))
    story.append(P("Final stack", s_h2))
    stack = [
        ["Layer", "Technology", "Reason"],
        ["Frontend", "Next.js 16 (App Router, React 19 Server Components), TypeScript", "SSR/ISR for SEO and speed; streaming; image optimisation; one language end to end."],
        ["Styling / UI", "Tailwind CSS 4 + brand tokens; Embla Carousel; Radix primitives", "Small CSS, accessible components, smooth touch swiping for cards and galleries."],
        ["Admin &amp; backend", "Payload CMS 3.9x (inside Next.js)", "Auto-generated admin, access control, hooks, uploads, versioning, REST/GraphQL, custom dashboard views."],
        ["Database", "PostgreSQL 17 (Drizzle via Payload)", "Relational integrity for orders/customers; SQL for analytics; mature backups."],
        ["Media", "Cloudflare R2 + CDN; sharp (WebP); optional Bunny Stream for video", "No egress fees, cheap storage, fast delivery of images and short videos."],
        ["Email", "Resend or Brevo (SMTP) via Payload email adapter", "Free tiers cover launch volume; transactional templates."],
        ["Payments", "COD; JazzCash &amp; Easypaisa hosted checkout with server-side hash verification", "Payment marked paid only on verified callback or manual check."],
        ["Analytics", "GA4 + Search Console; first-party reports from PostgreSQL", "Business figures come from our own data, so they always match orders."],
        ["Testing / CI", "Vitest, Playwright, GitHub Actions", "Unit tests for money logic; e2e for checkout and admin flows."],
        ["Hosting", "Hetzner/DigitalOcean VPS with Coolify (Docker) or Vercel + Neon", "Cheap and simple, or fully managed; both keep the same code."],
    ]
    story.append(table(stack, [0.14, 0.38, 0.48], bold_first_col=True))
    story.append(PageBreak())

    # ----- 5 Architecture
    story += section(5, "System architecture", "How it fits together")
    story.append(architecture_diagram())
    story.append(Spacer(1, 6))
    story += bullets([
        "<b>Rendering:</b> category and product pages are statically generated and revalidated on change (ISR + on-demand revalidation from Payload "
        "hooks), so pages load from cache in milliseconds yet reflect price/stock edits immediately.",
        "<b>Cart:</b> client-side store (Zustand, persisted in localStorage) for instant updates; prices and stock are re-validated on the server at checkout.",
        "<b>Checkout:</b> Next.js Server Action -> validates items, recalculates totals, applies coupon, creates the order via Payload Local API inside a "
        "database transaction (order + stock ledger + customer upsert commit together).",
        "<b>Admin:</b> Payload admin at /admin with custom React views for the dashboard, reports, invoice printing and exports.",
        "<b>Background jobs:</b> Payload Jobs queue for emails, WhatsApp messages, abandoned-cart reminders, low-stock alerts and nightly report snapshots.",
        "<b>Environments:</b> local (Docker Postgres), staging (client UAT, sandbox payments) and production.",
    ])
    story.append(PageBreak())

    # ----- 6 Data model
    story += section(6, "Data model", "Collections already scaffolded")
    dm = [
        ["Collection", "Purpose &amp; key fields"],
        ["products", "title, slug, type (simple / variable / bundle), gallery (images + videos, ordered), price, salePrice, <b>costPrice</b> (hidden from staff), stock, low-stock threshold, fragrance variants (each with sku, price, cost, stock, image), bundle items, specs, features, related products, SEO, status, salesCount, rating."],
        ["categories", "title, slug, parent (nested), image, sort order, show in menu. Seeded with the client's 4 categories + sub-categories."],
        ["fragrances", "name, family, mood line, top/heart/base notes, swatch colour. Seeded with Sweet Rose, Citrus Mint, Forest Pine, Vanilla Oud, Lavender Bliss, Cool Ice."],
        ["orders", "order number, status (8 states) + history, line-item snapshots (title, variant, unit price, unit cost), subtotal/discount/shipping/total, coupon, shipping address, payment (method, status, transaction id, proof, gateway response), fulfilment (courier, tracking, dates), refund, internal notes, gift wrap/note, source."],
        ["customers", "name, normalised phone (unique dedupe key), email, addresses, marketing consent (email/WhatsApp + timestamp), notes, automatic stats (orders, total spent, AOV, first/last order, segment), joined order list."],
        ["inventory-adjustments", "Append-only stock ledger: product, variant, change, reason (order, reversal, restock, damage, correction), reference, user."],
        ["coupons", "code, type (% / fixed / free shipping), value, cap, min order, usage limits, dates, categories, usage count."],
        ["banners", "hero slides, announcement bar, category banners with desktop/mobile images and schedule."],
        ["reviews", "product, customer, rating, text, photo/video/voice attachments, verified purchase, status (pending / approved / hidden / spam), admin reply."],
        ["support-tickets", "type (enquiry, complaint, feedback, return), contact, message, attachments, linked order/customer, status, assignee, resolution notes."],
        ["subscribers", "email, status, source, consent and unsubscribe timestamps, unsubscribe token."],
        ["expenses", "non-product costs (ads, packaging, courier...) used in estimated-profit reports."],
        ["users / activity-logs", "admin users with roles (owner, manager, staff), lockout after failed logins; audit trail of create/update/delete actions."],
        ["store-settings (global)", "contact &amp; social, shipping rates, payment toggles, gift wrap, stock deduction rule, CRM thresholds, policies, FAQs."],
        ["Planned additions", "carts (abandoned-cart tracking), customer-accounts (login, linked to customers), wishlists, report-snapshots (daily aggregates)."],
    ]
    story.append(table(dm, [0.2, 0.8], bold_first_col=True))
    story.append(PageBreak())

    # ----- 7 Workflows
    story += section(7, "Core business workflows", "Rules the system enforces")
    story.append(P("Order lifecycle", s_h2))
    story.append(order_flow_diagram())
    story.append(P("Checkout &amp; payment verification", s_h2))
    story += bullets([
        "Customer submits name, phone, city, address (+ optional email, gift note). Phone is normalised to +923XXXXXXXXX.",
        "Server recalculates every price from the database, checks stock and coupon rules, then creates the order. Client-side totals are never trusted.",
        "<b>COD:</b> order = New, payment = Pending. Optional COD limit per order. Staff confirm by phone/WhatsApp to reduce fake orders.",
        "<b>JazzCash / Easypaisa (gateway):</b> customer is redirected to the hosted payment page; the gateway's signed callback is verified server-side "
        "(hash + amount + order reference) before payment = Paid. Failed or tampered callbacks are logged and ignored.",
        "<b>Manual wallet transfer (fallback):</b> customer may upload a screenshot; payment = <i>Awaiting verification</i> until staff confirm the "
        "transaction ID in the merchant app. The screenshot alone never marks an order paid (explicit client requirement).",
        "Confirmation page with order number + summary; email confirmation; click-to-WhatsApp with the order number pre-filled.",
    ])
    story.append(P("Customer database (CRM)", s_h2))
    story += bullets([
        "Each order looks up the customer by normalised phone; if none exists, a profile is created. This removes most duplicates for guest checkout.",
        "After every order change, the customer's order count, total spent, AOV, first/last order and segment are recalculated (cancelled/returned/refunded orders excluded).",
        "Segments: New, Repeat (2+ orders), High value (spend above threshold), Inactive (no order for N days). Thresholds are editable in Store Settings.",
        "Marketing consent is stored with a timestamp; exports and campaigns only include customers who opted in.",
    ])
    story.append(P("Inventory", s_h2))
    story += bullets([
        "Stock is deducted when the order enters a stock-holding status and restored on cancel/return. An idempotency flag prevents double counting.",
        "Every movement writes to the inventory ledger, so stock levels can always be reconstructed and audited.",
        "Low-stock alerts on the dashboard and by email when stock falls to the product's threshold.",
    ])
    story.append(P("Financial figures", s_h2))
    story += bullets([
        "<b>Gross sales</b> = sum of line items; <b>Net sales</b> = gross - discounts - refunds (shipping shown separately).",
        "<b>Estimated profit</b> = net sales - cost of goods (cost snapshot stored on each order line) - recorded expenses. Always labelled 'estimated'.",
        "Revenue counts delivered and in-progress orders; cancelled, returned and refunded orders are excluded and reported separately.",
    ])
    story.append(PageBreak())

    # ----- 8 Requirement map
    story += section(8, "Requirement-to-implementation map", "Nothing left implicit")
    impl = [
        ["Requirement", "Implementation", "Type"],
        ["Swipeable photos/videos on product cards", "Embla carousel per card, lazy-loaded slides, dot indicators, arrows on desktop; videos are muted, autoplay-on-visible MP4/WebM with poster images.", "Custom"],
        ["Quick View / Quick Add", "Modal using the same product component; quick add uses the default variant, or opens a variant picker when a fragrance must be chosen.", "Custom"],
        ["Search with suggestions", "PostgreSQL full-text + trigram search over titles, fragrances and categories; debounced suggestions API.", "Custom"],
        ["Filters &amp; sort", "URL-driven filters (price, type, fragrance, in stock), sorts (price, newest, popularity = salesCount); server-rendered for SEO.", "Custom"],
        ["Zoom &amp; full-screen gallery", "Pinch-zoom lightbox (yet-another-react-lightbox) with video slides.", "Library"],
        ["Wishlist &amp; recently viewed", "localStorage for guests, synced to account when signed in.", "Custom"],
        ["Guest checkout + optional accounts", "Checkout never requires login. Accounts via email magic link / OTP, linked to the CRM customer.", "Custom"],
        ["Discounts, bundles, gift wrap", "Coupons collection + pricing engine (unit-tested); bundle product type; gift wrap price in settings.", "Built (scaffolded)"],
        ["Notifications", "Email templates (React Email) via Resend/Brevo; WhatsApp Cloud API templates (optional); SMS via local provider (optional).", "Integration"],
        ["Admin dashboard &amp; reports", "Custom Payload admin views: KPI cards, Recharts graphs, date presets + custom range, period comparison, CSV/XLSX export.", "Custom"],
        ["Invoices &amp; packing slips", "Printable HTML -> PDF (browser print / server-side) from the order view; bulk print.", "Custom"],
        ["Bulk import/export products", "CSV import with validation preview; export to CSV/XLSX.", "Custom"],
        ["Review &amp; feedback moderation", "Pending-by-default reviews, media upload limits and type checks, Cloudflare Turnstile anti-spam, rate limiting.", "Built (scaffolded) + custom"],
        ["Voice-note feedback", "MediaRecorder API in browser -> audio upload to R2 -> moderation queue.", "Phase 2"],
        ["Abandoned carts", "Cart snapshots for visitors who entered a phone/email; reminder via email/WhatsApp after 1h/24h with consent.", "Custom (phase 2)"],
        ["2FA &amp; roles", "Owner/manager/staff roles (done); TOTP 2FA for admin login.", "Custom"],
        ["Activity log", "Hooks record admin create/update/delete with changed fields (done for products and orders).", "Built (scaffolded)"],
        ["Backups", "Nightly pg_dump + WAL/PITR (managed DB) to R2 with 30-day retention; restore drill before launch.", "Ops"],
        ["SEO", "Payload SEO plugin, JSON-LD Product/Offer/Review/Breadcrumb, sitemap.xml, robots.txt, canonical URLs.", "Built (scaffolded) + custom"],
    ]
    story.append(table(impl, [0.25, 0.58, 0.17], bold_first_col=True))
    story.append(PageBreak())

    # ----- 9 Integrations
    story += section(9, "Integrations", "Third-party services")
    integ = [
        ["Service", "Use", "Launch?", "Notes"],
        ["JazzCash (Hosted Checkout)", "Mobile wallet &amp; card payments", "If merchant account ready", "Requires business merchant account; sandbox first; HMAC-SHA256 secure hash verification."],
        ["Easypaisa (Easypay)", "Mobile wallet payments", "If merchant account ready", "Requires merchant onboarding; callback/IPN verification and status inquiry."],
        ["Cash on Delivery", "Default payment method", "Yes", "Order confirmation step and COD limit to reduce fake orders."],
        ["Resend / Brevo", "Transactional email", "Yes", "Free tier covers launch volume; SPF/DKIM on coco.pk domain."],
        ["WhatsApp", "Help button + order updates", "Button yes; API optional", "Click-to-chat is free. Cloud API needs Meta Business verification and per-conversation fees."],
        ["Couriers (PostEx / Leopards / TCS)", "Tracking &amp; booking", "Manual tracking at launch", "API booking and status sync for one courier in phase 2."],
        ["Google Analytics 4 + Search Console", "Traffic, conversions, indexing", "Yes", "E-commerce events: view_item, add_to_cart, begin_checkout, purchase. Consent banner."],
        ["Meta Pixel / TikTok Pixel", "Ad attribution", "Optional", "Server-side Conversions API recommended later."],
        ["Cloudflare", "DNS, CDN, WAF, R2, Turnstile", "Yes", "Free plan is sufficient."],
    ]
    story.append(table(integ, [0.2, 0.2, 0.17, 0.43], bold_first_col=True))

    # ----- 10 Security
    story.append(Spacer(1, 6))
    story += section(10, "Security, privacy &amp; backups", "Protecting the business")
    story += bullets([
        "<b>Authentication:</b> admin login with strong passwords, lockout after 5 failed attempts (configured), secure HTTP-only cookies, 8-hour sessions, TOTP 2FA for owner and managers.",
        "<b>Authorisation:</b> role-based access is enforced on the server for every collection and field. Staff cannot see cost prices, profit, expenses or audit logs; only the owner manages users and settings.",
        "<b>Data protection:</b> HTTPS everywhere (Cloudflare + Let's Encrypt), secrets only in environment variables, customer PII never sent to analytics, exports restricted and audit-logged.",
        "<b>Input &amp; upload safety:</b> server-side validation, MIME/size limits on uploads, Turnstile on public forms, rate limiting on checkout, reviews and login.",
        "<b>Payments:</b> no card data touches COCO servers (hosted checkout); callbacks verified by signature, amount and order reference; idempotent processing.",
        "<b>Backups:</b> nightly database dumps + media bucket versioning, copied off-site with 30-day retention. Restore is tested before launch and quarterly, following a written runbook.",
        "<b>Updates:</b> monthly dependency updates (Dependabot), security patches within 72 hours. Far smaller attack surface than a plugin-based site.",
        "<b>Ownership:</b> domain, hosting, database, Cloudflare, email, payment and Google accounts are registered in the client's name; the developer is added as a user and removed at handover if requested.",
    ])
    story.append(PageBreak())

    # ----- 11 SEO & performance
    story += section(11, "SEO &amp; performance", "Fast on Pakistani mobile networks")
    perf = [
        ["Metric (mobile, 4G throttled)", "Target"],
        ["Largest Contentful Paint", "&lt; 2.5 s (aim &lt; 1.8 s)"],
        ["Interaction to Next Paint", "&lt; 200 ms"],
        ["Cumulative Layout Shift", "&lt; 0.1"],
        ["JavaScript on category page", "&lt; 170 KB gzipped"],
        ["Lighthouse Performance / SEO / Accessibility", "90+ / 100 / 95+"],
    ]
    story.append(table(perf, [0.6, 0.4]))
    story.append(Spacer(1, 6))
    story += bullets([
        "Images: WebP/AVIF in responsive sizes (320 / 640 / 1400 px), lazy-loaded, focal-point cropping, blur placeholders.",
        "Videos: short (6-15 s), compressed H.264/WebM at 720p and under about 1.5 MB, poster frame, loaded only when the card is visible.",
        "Server Components + ISR to keep client JavaScript small; fonts self-hosted through next/font.",
        "SEO: clean URLs (/collections/car-scents, /products/sweet-rose-hanging-diffuser), editable meta titles and descriptions, Open Graph images, "
        "JSON-LD (Product, Offer, AggregateRating, BreadcrumbList, Organization), XML sitemap, robots.txt, canonical tags, 301 redirect manager.",
        "Accessibility: WCAG 2.2 AA contrast with the brand palette, focus states, labelled controls, at least 44 px touch targets, reduced-motion support.",
    ])

    # ----- 12 Timeline
    story.append(Spacer(1, 6))
    story += section(12, "Delivery plan &amp; timeline", "About 12 weeks to launch")
    story.append(gantt())
    story.append(Spacer(1, 4))
    story.append(P("Team: 1 senior full-stack developer (lead), UI/UX designer (~25% for weeks 1-4), QA tester (~30% for weeks 9-12). "
                   "Phases overlap where dependencies allow. A demo is held on staging at the end of every second week.", s_small))
    story.append(PageBreak())

    # ----- 13 Sprint breakdown
    story += section(13, "Sprint-level task breakdown", "What gets built, in order")
    phases = [
        ("Phase 0 - Project setup (complete)", [
            "Next.js 16 + Payload 3 + PostgreSQL project, TypeScript strict, ESLint, Prettier, Vitest, Playwright.",
            "Full data model (15 collections + Store Settings), roles &amp; access control, order hooks (order numbers, CRM upsert, stock ledger, customer stats), activity log.",
            "Brand tokens (burgundy / blush / cream / gold), fonts, header/footer shell, admin KPI widget, seed script, Docker Postgres, env template.",
        ]),
        ("Phase 1 - Discovery, UX &amp; design system (W1-2)", [
            "Workshop to close the open questions in section 3; confirm payment accounts, courier and delivery fees.",
            "Wireframes (mobile first): home, category, product card states, Quick View, PDP, cart drawer, checkout, confirmation, account.",
            "High-fidelity UI in Figma from the brand board; component library (buttons, chips, price, badges, rating, fragrance swatch).",
        ]),
        ("Phase 2 - Catalog &amp; admin foundations (W2-3)", [
            "Admin UX: grouped navigation, list columns, filters, product duplicate action, media guidelines, live preview.",
            "R2 media storage + image sizes; video upload rules and poster frames; staging environment and CI pipeline.",
            "Load sample catalogue (6 fragrances x diffusers, accessories, 2 gift sets) for design and testing.",
        ]),
        ("Phase 3 - Storefront browse &amp; product (W3-5)", [
            "Home (hero banners, categories, best sellers, new arrivals, gift sets, reviews strip, Instagram band).",
            "Category pages: 2-column mobile grid, <b>swipeable media cards</b>, filters, sort, load more, empty states.",
            "Product page: gallery with video + zoom, fragrance selector &amp; notes, stock &amp; delivery info, specs, policies, related products.",
            "Search with suggestions, Quick View, wishlist, recently viewed, sticky mobile nav, WhatsApp button.",
        ]),
        ("Phase 4 - Cart, checkout &amp; payments (W5-7)", [
            "Slide-out cart, quantity edits, coupon field, free-shipping progress bar, gift wrap/note.",
            "One-page guest checkout; server-side pricing; order creation in a transaction; confirmation page.",
            "COD flow and limits; JazzCash and Easypaisa hosted checkout + callback verification (sandbox to live); manual transfer fallback.",
            "Order emails (confirmation, shipped, delivered); WhatsApp click-to-chat with order number.",
        ]),
        ("Phase 5 - Orders, CRM &amp; inventory operations (W6-8)", [
            "Order list views by status, quick status actions, courier/tracking entry, internal notes, refunds/returns.",
            "Invoice and packing slip printing (single and bulk); CSV/XLSX export for orders, customers and products.",
            "Customer profile view (history, LTV, segment, consent), segment filters, notes; dedupe merge tool.",
            "Manual stock adjustments, low-stock alerts, bulk product CSV import/export with preview.",
        ]),
        ("Phase 6 - Dashboard, reports &amp; marketing (W8-10)", [
            "Dashboard: KPI cards, order-status funnel, revenue and orders graphs, date presets, custom range and comparison.",
            "Reports: sales by product/category/fragrance, best and slow sellers, AOV, repeat rate, COD vs prepaid, cancellation/return/delivery rates, coupon performance, inventory.",
            "Finance: gross, discounts, refunds, net, COGS, expenses, <b>estimated profit</b> with clear labels; exports.",
            "Marketing: coupons UI, banners scheduling, subscribers and unsubscribe, abandoned-cart capture.",
        ]),
        ("Phase 7 - Reviews, support &amp; accounts (W9-10)", [
            "Review submission with photo/video, moderation queue, rating aggregation on products, verified-purchase badge.",
            "Contact form and complaints to support tickets with status and resolution notes; FAQ and policy pages from settings.",
            "Optional customer accounts (OTP / magic link), order history, saved addresses, wishlist sync.",
        ]),
        ("Phase 8 - SEO, performance &amp; security hardening (W10-11)", [
            "Structured data, sitemap, redirects, OG images; GA4 e-commerce events; Search Console verification.",
            "Performance budget enforcement, image/video audits, Lighthouse CI.",
            "2FA, rate limits, Turnstile, security headers (CSP, HSTS), dependency audit; backup automation + restore drill.",
        ]),
        ("Phase 9 - QA, UAT &amp; launch (W11-12)", [
            "Cross-device testing (real Android/iOS phones, Chrome, Safari, Edge, Firefox), accessibility pass, regression e2e suite.",
            "Client UAT on staging with acceptance checklist; final catalogue entry; live payment test transactions.",
            "DNS cut-over, monitoring (uptime, error tracking with Sentry), go-live checklist, admin training session.",
        ]),
        ("Phase 10 - Hypercare &amp; handover (W13-14)", [
            "Bug-fix priority window, analytics review after 2 weeks of real traffic, handover pack (section 17).",
        ]),
    ]
    for title, items in phases:
        block = [P(title, s_h3)] + bullets(items)
        story.append(KeepTogether(block))
    story.append(PageBreak())

    # ----- 14 Testing
    story += section(14, "Testing &amp; acceptance", "Definition of done")
    story += bullets([
        "<b>Unit tests</b> (Vitest) for all money and rule logic: pricing, coupons, shipping, stock holding, phone normalisation, segments. 18 tests already pass.",
        "<b>Integration tests</b> against a real PostgreSQL: order creation transaction, stock ledger, CRM stats, payment callback verification.",
        "<b>End-to-end tests</b> (Playwright, mobile and desktop viewports): browse, swipe card media, Quick View, add to cart, checkout (COD and gateway sandbox), admin order update, export.",
        "<b>Report reconciliation:</b> dashboard figures are compared against raw SQL for fixed date ranges (client requirement: graphs must match saved data).",
        "<b>Manual QA:</b> real devices, slow-network throttling, accessibility (axe + keyboard), content proofing.",
    ])
    acc = [
        ["Client acceptance item", "Verified by"],
        ["Browse all categories on mobile and desktop", "E2E + manual device matrix"],
        ["Swipe photos/videos on product cards", "E2E (touch emulation) + real phones"],
        ["Quick View and Quick Add work", "E2E"],
        ["Checkout works and orders are saved accurately", "E2E + integration test of totals"],
        ["Owner can find and update orders", "E2E admin flow + UAT"],
        ["Customer profiles &amp; histories saved and searchable", "Integration + UAT"],
        ["Products, media, prices, stock editable in admin", "UAT"],
        ["Dashboard graphs match saved data", "Reconciliation script vs SQL"],
        ["Sales and profit calculated &amp; labelled correctly", "Unit tests + reconciliation"],
        ["Reports can be exported", "E2E download test"],
        ["Backups and recovery tested", "Restore drill, signed off in runbook"],
        ["Paid tools, limits and costs disclosed", "Section 15 + handover pack"],
        ["Tested on real mobiles and common browsers", "QA matrix report"],
    ]
    story.append(table(acc, [0.6, 0.4]))
    story.append(PageBreak())

    # ----- 15 Costs
    story += section(15, "Costs &amp; recurring fees", "Full disclosure, as requested")
    story.append(P("Indicative prices as of October 2026; confirm at signing. No paid plugins or licences are required: Next.js, Payload, PostgreSQL and the libraries used are open source (MIT/PostgreSQL licences)."))
    costs = [
        ["Item", "Option A: lowest cost", "Option B: fully managed", "Notes"],
        ["Application hosting", "VPS 2-4 vCPU / 4-8 GB (Hetzner, DigitalOcean): USD 6-25 / mo", "Vercel Pro: USD 20 / mo per seat", "Option A runs app + DB via Coolify/Docker."],
        ["Database", "Included on VPS (+ off-site backups)", "Neon / Supabase: USD 0-25 / mo", "Managed DB adds point-in-time recovery."],
        ["Media storage (R2)", "Free up to 10 GB, then USD 0.015 / GB", "Same", "No bandwidth (egress) charges."],
        ["Domain coco.pk", "PKNIC: approx. PKR 2,500-3,000 / 2 yrs", "Same", "Must be in client's name."],
        ["Cloudflare (DNS, CDN, SSL, WAF)", "Free", "Free", ""],
        ["Transactional email", "Resend/Brevo free tier (about 3,000 / mo)", "Same", "Paid plans from about USD 20 / mo if volume grows."],
        ["Business mailbox", "Zoho Mail free / Google Workspace about USD 7 / user / mo", "Same", "Optional."],
        ["WhatsApp Cloud API", "Click-to-chat: free", "Template messages: per-conversation Meta fees", "Only if automated WhatsApp messages are wanted."],
        ["Error monitoring / uptime", "Sentry free + UptimeRobot free", "Same", ""],
        ["Payment gateways", "JazzCash / Easypaisa: per-transaction MDR set in merchant agreement", "Same", "Rates are negotiated; typically a low single-digit percentage. Get written quotes."],
        ["Courier", "Per-parcel and COD handling fees per courier contract", "Same", "Outside the website budget."],
        ["<b>Typical monthly total</b>", "<b>about USD 10-30</b>", "<b>about USD 45-70</b>", "Excludes gateway and courier fees."],
    ]
    story.append(table(costs, [0.18, 0.3, 0.26, 0.26], bold_first_col=True))
    story.append(Spacer(1, 6))
    story.append(callout("Development cost is quoted separately per phase. Maintenance retainer (optional): updates, backups monitoring, "
                         "minor changes. Typically 6-10 hours per month.", "Development &amp; maintenance"))

    # ----- 16 Risks
    story.append(Spacer(1, 6))
    story += section(16, "Risks &amp; mitigations", "What could go wrong")
    risks = [
        ["Risk", "Impact", "Mitigation"],
        ["Merchant accounts for JazzCash/Easypaisa delayed", "High", "Start applications in week 1; launch with COD + verified manual transfer; gateway code built against sandbox."],
        ["Product photos/videos not ready", "High", "Shot list and specs delivered in week 1; placeholder catalogue for development; content freeze in week 10."],
        ["Fake / unconfirmed COD orders", "Medium", "Confirmation workflow, COD limit, phone validation, blacklist flag on customer profile."],
        ["Scope creep from 'nice-to-haves'", "Medium", "MoSCoW priorities (section 2), change requests estimated separately, phase-2 backlog."],
        ["Heavy videos slow mobile pages", "Medium", "Size limits and compression guide, lazy loading, poster-first, performance budget in CI."],
        ["Single-developer dependency", "Medium", "Typed codebase, README and architecture docs, CI tests, client owns repo and all accounts."],
        ["Data loss", "High", "Nightly off-site backups, tested restores, append-only stock ledger and audit logs."],
        ["Framework upgrades (Payload 4 currently in beta)", "Low", "Launch on stable Payload 3.x; plan upgrade after 4.0 is GA and stable; pinned versions."],
    ]
    story.append(table(risks, [0.32, 0.1, 0.58], bold_first_col=True))
    story.append(PageBreak())

    # ----- 17 Handover
    story += section(17, "Handover, ownership &amp; maintenance", "Client independence")
    story += bullets([
        "<b>Owner manual</b> (PDF + short screen recordings): add/edit products and fragrances, upload media, manage stock, process orders, print invoices, "
        "issue refunds, manage coupons and banners, moderate reviews, read reports, export data.",
        "<b>Operations runbook:</b> deployment, environment variables, backup and restore procedure (tested), rotating credentials, adding staff users, incident checklist.",
        "<b>Asset register:</b> every account (domain, hosting, Cloudflare, R2, email, Google, Meta, payment gateways, GitHub) with owner, login holder and renewal date.",
        "<b>Source code</b> in the client's GitHub organisation; developer access removable at any time.",
        "<b>Disclosure list</b> of all third-party services, limitations and recurring costs (section 15, kept up to date).",
        "One live training session (60-90 min) for the owner and staff, plus 2 weeks of hypercare after launch.",
    ])

    # ----- 18 Setup done
    story.append(Spacer(1, 6))
    story += section(18, "Project setup completed", "Already in this repository")
    setup = [
        ["Area", "What is in place"],
        ["Framework", "Next.js 16.3 + React 19.2 + Payload 3.92 + PostgreSQL adapter, TypeScript strict; type check passes."],
        ["Data model", "15 collections + Store Settings global (section 6), generated TypeScript types, admin grouped into Sales, Catalog, Marketing, Customers &amp; Support, Reports, Settings."],
        ["Business logic", "Pricing engine, PK phone normalisation, order-status rules, customer segmentation (src/lib); order hooks for numbering, CRM upsert, stock ledger, customer stats; activity logging."],
        ["Access control", "Owner / manager / staff roles; cost and profit fields hidden from staff; public reads limited to published products and approved reviews."],
        ["Admin", "KPI widget above the dashboard (30-day revenue, orders, AOV, new orders, customers, live products)."],
        ["Storefront shell", "Tailwind 4 with COCO brand tokens, Cormorant Garamond + Jost fonts, header, footer and home page reading categories."],
        ["Plugins", "SEO plugin (products and categories), S3/R2 storage (enabled by environment variable)."],
        ["Tooling", "ESLint, Prettier, Vitest (18 unit tests passing), Playwright, Docker Compose for Postgres, seed script (categories + 6 fragrances), .env.example."],
        ["Docs", "README, this plan (regenerate with npm run plan:pdf), client requirements and brand references in docs/."],
    ]
    story.append(table(setup, [0.2, 0.8], bold_first_col=True))
    story.append(Spacer(1, 8))
    story.append(callout("Install Node.js 24.22+ (Payload 3.92 requires it), provide a PostgreSQL database (Docker or Neon), then run "
                         "<font face='Courier'>npm run dev</font> and <font face='Courier'>npm run seed</font>. Close the questions in section 3 with the client "
                         "and begin Phase 1.", "Next steps"))

    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=18 * mm, bottomMargin=18 * mm,
                            title="COCO - Development Plan", author="COCO development team", subject="E-commerce technical analysis and development plan")
    doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
