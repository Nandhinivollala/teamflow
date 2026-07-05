from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "TeamFlow_Submission.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#121A31")
INDIGO = colors.HexColor("#6557DC")
TEAL = colors.HexColor("#169E8A")
INK = colors.HexColor("#202A3C")
MUTED = colors.HexColor("#667085")
PALE = colors.HexColor("#F3F4F8")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=34, leading=38, textColor=NAVY, alignment=TA_CENTER, spaceAfter=14))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontSize=13, leading=20, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=NAVY, spaceAfter=13))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=INDIGO, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.4, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=7.5, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="TableHeader", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontSize=10, leading=15, textColor=NAVY, borderColor=colors.HexColor("#D8D4FA"), borderWidth=0.8, borderPadding=10, backColor=colors.HexColor("#F4F2FF"), spaceAfter=12))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#E4E7EC"))
    canvas.line(18*mm, 14*mm, 192*mm, 14*mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(18*mm, 9*mm, "TEAMFLOW - SYSTEMS ENGINEERING SUBMISSION")
    canvas.drawRightString(192*mm, 9*mm, str(doc.page))
    canvas.restoreState()

def box(d, x, y, w, h, title, subtitle="", fill=PALE):
    d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=fill, strokeColor=colors.HexColor("#D5D9E3")))
    d.add(String(x+w/2, y+h-15, title, fontName="Helvetica-Bold", fontSize=8, textAnchor="middle", fillColor=NAVY))
    if subtitle:
        d.add(String(x+w/2, y+10, subtitle, fontName="Helvetica", fontSize=6.3, textAnchor="middle", fillColor=MUTED))

def architecture():
    d = Drawing(500, 245)
    box(d, 190, 198, 120, 36, "Next.js UI", "Server components + actions", colors.HexColor("#EEEAFE"))
    box(d, 155, 125, 190, 50, "Modular Monolith", "Auth | Projects | Tasks | RCA | Notifications | Reports", colors.HexColor("#E9F7F4"))
    box(d, 30, 38, 120, 42, "PostgreSQL", "Prisma migrations + audit", colors.HexColor("#EEF3FC"))
    box(d, 190, 38, 120, 42, "Object Storage", "S3-compatible adapter", colors.HexColor("#FFF7E6"))
    box(d, 350, 38, 120, 42, "Email Provider", "Replaceable adapter", colors.HexColor("#FFF0F0"))
    for x1,y1,x2,y2 in [(250,198,250,175),(215,125,95,80),(250,125,250,80),(285,125,410,80)]:
        d.add(Line(x1,y1,x2,y2,strokeColor=INDIGO,strokeWidth=1.4))
    return d

def erd():
    d = Drawing(500, 310)
    nodes = {
        "User":(15,245), "Membership":(150,245), "Project":(310,245),
        "Task":(15,145), "TaskProject":(150,145), "Dependency":(310,145),
        "RCA":(15,45), "Review":(150,45), "Notification":(310,45), "Audit":(420,145)
    }
    edges=[("User","Membership"),("Membership","Project"),("Task","TaskProject"),("TaskProject","Project"),("Task","Dependency"),("RCA","Review"),("Review","User"),("Notification","User"),("Audit","User"),("RCA","Project")]
    for a,b in edges:
        ax,ay=nodes[a]; bx,by=nodes[b]
        d.add(Line(ax+45,ay+19,bx+45,by+19,strokeColor=colors.HexColor("#AAB1C2"),strokeWidth=1))
    for name,(x,y) in nodes.items():
        box(d,x,y,90,38,name,"relational entity", colors.white)
    return d

def decision_table(rows):
    data=[[Paragraph("Decision",styles["TableHeader"]),Paragraph("Alternative",styles["TableHeader"]),Paragraph("Tradeoff / rationale",styles["TableHeader"])]]
    for row in rows:
        data.append([Paragraph(c,styles["Smallx"]) for c in row])
    t=Table(data,colWidths=[40*mm,39*mm,91*mm],repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#D8DCE5")),
        ("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),6),
        ("RIGHTPADDING",(0,0),(-1,-1),6),("TOPPADDING",(0,0),(-1,-1),6),
        ("BOTTOMPADDING",(0,0),(-1,-1),6),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,PALE])
    ]))
    return t

story=[]
story += [Spacer(1,35*mm), Paragraph("TEAMFLOW",styles["CoverTitle"]), Paragraph("Systems Engineering Assignment",styles["CoverSub"]), Spacer(1,9*mm), Paragraph("Architecture, Domain Model, Service Interactions<br/>and Design Decisions",styles["CoverSub"]), Spacer(1,35*mm), Paragraph("<b>Prepared:</b> 5 July 2026<br/><b>Implementation:</b> Next.js 16, TypeScript, PostgreSQL, Prisma<br/><b>Architecture:</b> Extensible modular monolith",styles["Callout"]), Spacer(1,25*mm), Paragraph("A unified workspace for engineering delivery, dependency-aware task execution, structured RCA review, notifications, and live reporting.",styles["CoverSub"]), PageBreak()]

story += [Paragraph("1. Architecture",styles["H1x"]), Paragraph("TeamFlow is one deployable Next.js application organized around explicit domain modules. Core writes are synchronous and transactional. Secondary effects are recorded as outbox events so delivery can later move to a queue without rewriting domain behavior.",styles["Bodyx"]), architecture(), Paragraph("Key properties",styles["H2x"]), Paragraph("Server-side authorization protects every mutation. PostgreSQL provides relational integrity for memberships, multi-project tasks, dependencies, review assignments, notification deduplication, and audit history. Binary files remain behind an object-storage interface.",styles["Bodyx"]), Paragraph("Service interaction",styles["H2x"]), Paragraph("<b>Browser request -> Server action -> Session + permission check -> Domain validation -> Prisma transaction -> Aggregate + audit + outbox -> Response.</b> Notification delivery consumes the event record and creates recipient/channel records using a unique deduplication key.",styles["Callout"]), PageBreak()]

story += [Paragraph("2. Domain Model",styles["H1x"]), Paragraph("Tasks retain one identity while being tracked in several projects through TaskProject. TaskDependency is a directed edge. RCA review authority comes from explicit assignments, not project role alone.",styles["Bodyx"]), erd(), Paragraph("Important constraints",styles["H2x"]), Paragraph("Composite membership and task-project keys prevent duplicates. Dependencies reject direct self-reference. Comments and attachments belong to exactly one task or RCA. Completed reviews require a decision, comment, and completion time. Notification deduplication keys are globally unique.",styles["Bodyx"]), Paragraph("Workflow rules",styles["H2x"]), Paragraph("Dependency conflicts and assignee overload are warnings and never block saves. An RCA cannot close while a reviewer is outstanding; unanimous approval permits closure, while any rejection produces Changes Required. Exact task transition names and unavailable-reviewer reassignment remain configurable because the supplied material does not define them.",styles["Callout"]), PageBreak()]

story += [Paragraph("3. API and Interaction Overview",styles["H1x"]), decision_table([
    ("Sign in","External identity provider","Local scrypt credentials create a signed HTTP-only session; provider integration remains replaceable."),
    ("Create/update task","Direct client database access","Server actions enforce membership, then write task, audit, outbox, and notification records transactionally."),
    ("RCA decision","UI-only validation","The server verifies assignment authority and requires Approved/Rejected plus a non-empty comment."),
    ("Notifications","Inline email call","One event creates deduplicated in-app/email delivery records; email opt-out preserves in-app alerts."),
    ("Reporting","Precomputed warehouse","Live PostgreSQL queries keep v1 simple and current; projections can be added at scale."),
    ("CSV export","Unfiltered database dump","Export applies the active project, status, assignee, and search filters before serialization.")
]), Spacer(1,8*mm), Paragraph("Implemented routes",styles["H2x"]), Paragraph("<b>/login</b> credentials and session creation; <b>/</b> live dashboard; <b>/tasks</b> Kanban/list/calendar, CRUD, dependencies, comments, mentions and CSV; <b>/rcas</b> structured review; <b>/notifications</b> inbox; <b>/reports</b> live analytics; <b>/settings</b> membership and preferences.",styles["Bodyx"]), PageBreak()]

story += [Paragraph("4. Design Decision Log",styles["H1x"]), decision_table([
    ("Modular monolith","Microservices","Lower delivery and operating cost; explicit modules preserve later extraction."),
    ("PostgreSQL + Prisma","NoSQL","Transactions, joins, constraints, migrations, and auditability fit the domain."),
    ("Synchronous core writes","Fully asynchronous","Users receive immediate validation and authoritative outcomes."),
    ("Domain events + outbox","Inline side effects","Adds a table and dispatcher boundary but decouples successful writes from providers."),
    ("Object storage adapter","Database blobs / local disk","Scalable binaries with metadata and ownership retained in PostgreSQL."),
    ("Non-blocking dependency warnings","Reject conflicting saves","Keeps planning flexible while surfacing delivery risk."),
    ("Unanimous RCA approval","Majority / first approval","Slower closure, but every assigned reviewer is accountable."),
    ("Server-enforced permissions","Client-only controls","Mutations remain safe regardless of browser behavior.")
]), Spacer(1,7*mm), Paragraph("Future deployment scenarios",styles["H2x"]), Paragraph("<b>Offline-first:</b> local command queue, aggregate versions, idempotency keys. <b>Compliance:</b> immutable audit export, retention and customer-managed keys. <b>High scale:</b> read replicas, partitioned audit/outbox data and reporting projections. <b>Multi-region:</b> tenant home regions and replicated reads. <b>Extreme low cost:</b> one application instance, managed PostgreSQL, and in-process outbox delivery.",styles["Bodyx"]), PageBreak()]

story += [Paragraph("5. Delivery Status and Evidence",styles["H1x"]), Paragraph("The repository includes two PostgreSQL migrations, deterministic seed data, protected server-rendered screens, adapter interfaces, architecture documentation, and automated tests for the highest-risk rules.",styles["Bodyx"]), decision_table([
    ("Schema","Validated","Prisma client generated; migrations applied to PostgreSQL 17."),
    ("Build","Passing","Next.js production build and TypeScript checks pass."),
    ("Lint","Passing","ESLint reports no errors or warnings."),
    ("Domain tests","15 passing","Sessions, mentions, notification policy, RCA decisions, CSV filtering, and dependency warnings."),
    ("Security","Implemented","Scrypt password hashes, signed HTTP-only cookies, server permission checks, no committed secrets."),
    ("Known limits","Documented","Task transitions, reviewer reassignment, attachment limits, external email/storage providers, and deployment remain open.")
]), Spacer(1,8*mm), Paragraph("Demonstration journey",styles["H2x"]), Paragraph("Sign in as the seeded Project Manager; review live dashboard metrics; create and edit a task; add blockers and observe warnings; comment with @mentions; inspect notifications; submit an RCA review; view reports; manage project membership.",styles["Callout"]), Paragraph("Repository setup and environment variables are documented in README.md. The .env file is ignored by Git; .env.example contains placeholders only.",styles["Bodyx"])]

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=19*mm,title="TeamFlow Systems Engineering Submission",author="TeamFlow")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
