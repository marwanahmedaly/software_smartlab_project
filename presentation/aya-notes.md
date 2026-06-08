# Aya Abdelmonem — Speaker Notes
## SmartLab Presentation · CISC 818 Milestone 3

**Your Total Speaking Time:** ~9.5 minutes  
**Your Segments:**
- Slide 5: AI Methodology Intro (30 sec)
- Slide 6: AI Usage — Planning & Requirements (90 sec)
- Slide 11: AI Usage — Testing & QA (90 sec)
- Slide 19–20: Individual Reflection (5 min)
- Slide 21: Closing (30 sec)

---

## 📝 Slide 5: AI Methodology Intro (30 sec)

**Opening:**
> "Before we dive into specifics, let me share our team's AI methodology."

**Core Principle:**
> "Our principle was **'AI as reviewer > generator.'** We used AI to identify gaps and scaffold structure, but we critically evaluated every output."

**Stats:**
> "Our stats: 40% of AI output was accepted with minor edits, 45% was substantially rewritten, and 15% was discarded entirely."

**Logging:**
> "Every team member maintained a personal AI Usage Log documenting the tool, SDLC phase, prompt, output, and reflection. This is the evidence base for what you're about to hear."

**👆 [Action]:** Hand off to Mohamed.

---

## 📝 Slide 6: AI Usage — Planning & Requirements (90 sec)

**Opening:**
> "For planning and requirements, I used Claude Code to review our Assignment 1 proposal before we started coding."

**Prompt:**
> "Prompt: *'Review our lab management proposal and identify scope gaps: AI model specifics, offline behavior, feature prioritization.'*"

**Outcome:**
> "Claude flagged three critical gaps: we hadn't specified which Llama model to use, we were missing offline behavior handling, and the interactive lab map was misclassified as a Core feature when it should have been Non-Core."

**Team Decision — KEY POINT:**
> "Based on this analysis, our team made a deliberate decision: **we downgraded the interactive map from Core to Non-Core** to protect our MVP timeline under the 6-week constraint. This ensured the core fault-reporting and diagnostic workflows remained functional."

**Limitation:**
> "The limitation? Claude also proposed push notifications and a PWA — we discarded these as out of scope."

**👆 [Action]:** Hand off to Mohamed.

---

## 📝 Slide 11: AI Usage — Testing & QA (90 sec)

**Opening:**
> "For testing and QA, I used Claude Code and Copilot to generate test cases and SQL queries."

**Prompt:**
> "Prompt: *'Write test cases for role-based access control and SQLite queries for maintenance summary reports with date filtering.'*"

**Outcome:**
> "The AI generated test scaffolding and report queries."

**Revision — KEY POINT:**
> "But I found a subtle bug. The AI query used `BETWEEN '2024-01-01' AND '2024-01-31'` for date filtering. **I revised this to `>= '2024-01-01' AND < '2024-02-01'`** because SQLite's `BETWEEN` is inclusive and misses time-of-day boundaries — a classic gotcha."

**Limitation:**
> "AI tests covered happy paths only. I had to add edge cases manually: expired JWT tokens, duplicate email handling, and SQL injection attempts."

**👆 [Action]:** Hand off to Marwan for Deployment.

---

## 📝 Slide 19–20: Individual Reflection (5 min)

**Opening:**
> "My specific task was building the reports dashboard with Chart.js, writing analytics SQL queries, and maintaining project documentation."

**Tool & Purpose:**
> "I used **Claude Code and GitHub Copilot**. I chose AI because documentation and SQL aggregations are structured but tedious — tasks where AI excels at boilerplate generation."

**Input & Output:**
> "My prompt was: *'Write SQLite queries for maintenance summary with date filtering, including average repair time and most-faulted device.'* The AI produced Chart.js configuration, SQL aggregation queries, and README.md and PLAN.md drafts."

**How I Revised It — KEY POINT:**
> "Two revisions. First, the AI query used `BETWEEN` for date filtering, which misses boundaries in SQLite. **I revised it to use `>=` and `<` operators**. Second, the AI README had placeholder `.env` values like `your_secret_here`. **I replaced these with actual `.env.example` content** so new developers could get started immediately."

**What Was Useful:**
> "Documentation scaffolding saved hours of formatting and structure planning."

**What Was Challenging:**
> "The challenge was that AI-generated SQL had subtle date boundary bugs — queries returned wrong aggregates until I tested them against real seed data."

**Limitations:**
> "AI suggested complex nested JOINs that performed poorly on SQLite — I simplified them to targeted queries. The documentation also included features we hadn't built yet, which I had to remove."

**Future:**
> "Going forward, I'll use AI for **structure and drafts**, but always **run queries against real data and benchmark performance** before accepting. For documentation: generate the skeleton, then fill in only implemented features."

**👆 [Action]:** Transition to closing.

---

## 📝 Slide 21: Closing (30 sec)

**Opening:**
> "To close, our key takeaway is this: AI accelerated our 6-week development cycle significantly, but **human judgment remained essential at every stage**."

**Evidence:**
> "Every AI interaction was logged in our personal AI Usage Logs. The system you saw today is runnable, demonstrable, and requirement-complete per Assignment 2."

**Closing:**
> "Thank you — we're happy to take questions."

**👆 [Action]:** Open palms to audience, invite questions.

---

## Your Handoffs

| From | To | Your Script |
|------|-----|------------|
| You (Methodology) | Mohamed | "That's how AI helped us plan. Mohamed will now explain how it shaped our system design." |
| You (Testing) | Marwan | "We tested thoroughly. Marwan, how did we deploy?" |
| You (Reflection) | Audience | "Thank you — we're happy to take questions." |

---

*Practice timing with a stopwatch. Target: 9.5 minutes total. Keep methodology and closing tight to save time.*
