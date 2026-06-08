# Mohamed Othman — Speaker Notes
## SmartLab Presentation · CISC 818 Milestone 3

**Your Total Speaking Time:** ~7.5 minutes  
**Your Segments:**
- Slide 7: AI Usage — System Design (90 sec)
- Slide 9: AI Usage — Frontend Implementation (60 sec)
- Slide 15–16: Individual Reflection (5 min)

---

## 📝 Slide 7: AI Usage — System Design (90 sec)

**Opening:**
> "For system design, I used Claude Code to generate the architecture description and Google Stitch with Figma for wireframes."

**Prompt:**
> "My prompt to Claude was: *'Describe a three-tier architecture for a lab management system with Node.js backend and vanilla JS frontend.'*"

**Outcome:**
> "Claude produced a correct layered architecture. For UI, Stitch generated initial mockups from text descriptions, which I imported into Figma for refinement."

**Team Decision — KEY POINT:**
> "Our team evaluated **microservices versus monolithic architecture**. We chose monolithic Express because: single server deployment, easier SQLite management, and no DevOps overhead for a 6-week timeline. Microservices would have been over-engineering for our scope."

**Limitation:**
> "The limitation? Stitch produced consumer-style gradients and rounded cards — I manually simplified everything for institutional information density."

**👆 [Action]:** Hand off to Marwan.

---

## 📝 Slide 9: AI Usage — Frontend Implementation (60 sec)

**Opening:**
> "For the frontend, I used Claude Code to generate the RTL Arabic CSS and component structure."

**Prompt:**
> "Prompt: *'Create RTL Arabic CSS layout with right sidebar, status badges, and card-based dashboard for a lab management system.'*"

**Outcome:**
> "The AI produced a base RTL flexbox framework that I could build on."

**Revision — KEY POINT:**
> "But I had to make two key revisions. First, AI used `margin-right: 260px` for sidebar spacing — **I revised this to `margin-inline-end: 260px`** for true logical properties that work across languages. Second, AI generated SVG circles for the lab map nodes — **I replaced them with rectangles** to match actual PC form factors."

**Limitation:**
> "AI struggled with RTL nuances — it uses physical directions like 'left' and 'right' instead of logical properties. Consumer-style designs also needed manual simplification for a professional lab management context."

**👆 [Action]:** Hand off to Manar.

---

## 📝 Slide 15–16: Individual Reflection (5 min)

**Opening:**
> "My specific task was creating the RTL responsive UI and the interactive SVG lab map."

**Tool & Purpose:**
> "I used **Claude Code and Google Stitch/Figma**. I chose AI because RTL CSS is tedious and error-prone to write from scratch, and Stitch accelerated the wireframing process significantly."

**Input & Output:**
> "My prompt was: *'Create RTL Arabic CSS layout with right sidebar, status badges, and card dashboard.'* The AI produced an RTL flexbox layout, sidebar structure, and SVG map node scaffolding."

**How I Revised It — KEY POINT:**
> "I made two critical revisions. First, AI used `margin-right: 260px` — **I replaced this with `margin-inline-end: 260px`** for true logical properties that support true internationalization. Second, AI generated SVG circles for map nodes — **I replaced them with rectangles** to match actual PC form factors."

**What Was Useful:**
> "I got a working base immediately without writing every flexbox rule from scratch."

**What Was Challenging:**
> "The challenge was that AI doesn't truly understand RTL — it thinks in physical directions, not logical properties. I also had to manually simplify consumer-style gradients and rounded cards for an institutional look."

**Limitations:**
> "AI-produced designs were too 'consumer app' — heavy shadows, rounded corners — I had to flatten everything for professional lab management density."

**Future:**
> "Going forward, I'll use AI for layout scaffolding but **budget 30% of UI time for human design polish**. AI doesn't understand institutional aesthetic — it thinks every app should look like Instagram."

**👆 [Action]:** Hand off to Manar.

---

## Your Handoffs

| From | To | Your Script |
|------|-----|------------|
| You (Design) | Marwan | "Our design was ready — Marwan, take us into implementation." |
| You (Frontend) | Manar | "The interface was built. Manar, how did we integrate the AI brain?" |
| You (Reflection) | Manar | "Manar?" |

---

*Practice timing with a stopwatch. Target: 7.5 minutes total.*
