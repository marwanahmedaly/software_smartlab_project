# Manar Elabsi — Speaker Notes
## SmartLab Presentation · CISC 818 Milestone 3

**Your Total Speaking Time:** ~6.5 minutes  
**Your Segments:**
- Slide 10: AI Usage — AI Integration (90 sec)
- Slide 17–18: Individual Reflection (5 min)

---

## 📝 Slide 10: AI Usage — AI Integration (90 sec)

**Opening:**
> "For AI integration, I used Claude Code to connect our system to Llama 3.2 via OpenRouter."

**Prompt:**
> "My prompt was: *'Create Node.js service calling OpenRouter API for fault diagnosis with device context.'*"

**Outcome:**
> "The AI generated an API wrapper — it's in a file called `deepseek.js`, which is a legacy name from early prototyping. The actual model is Llama 3.2. It also scaffolded the `/api/ai/diagnose` route and the predictive alerts cron job."

**Revision — KEY POINT:**
> "I made two major revisions. First, AI wrote a generic `fetch()` call with a static prompt. **I revised it to dynamically inject device specs and issue history from SQLite** into the prompt, making the diagnosis contextual and useful. Second, AI set the cron job to run every minute — `* * * * *`. **I revised this to daily at midnight** to avoid hitting API rate limits."

**Limitation — KEY POINT:**
> "The key limitation was that AI could write the **code to call the LLM**, but it couldn't design effective **prompts**. Response quality depended entirely on human context engineering — enriching the prompt with device type, OS, and fault history."

**👆 [Action]:** Hand off to Aya.

---

## 📝 Slide 17–18: Individual Reflection (5 min)

**Opening:**
> "My specific task was integrating Llama 3.2 via OpenRouter for AI diagnostics and building the predictive alerts cron job."

**Tool & Purpose:**
> "I used **Claude Code**. I chose AI because API integration and cron job scheduling involve many async and error-handling moving parts that are easy to get wrong."

**Input & Output:**
> "My prompt was: *'Create Node.js service calling OpenRouter API for fault diagnosis with device context.'* The AI produced the `deepseek.js` wrapper — legacy filename — the `/api/ai/diagnose` route, and the `predictive.js` cron job."

**How I Revised It — KEY POINT:**
> "Two major revisions. First, AI wrote a generic fetch with a static prompt. **I revised it to dynamically inject device specs and issue history from SQLite**, making the diagnosis actually useful. Second, AI set the cron to run every minute. **I changed it to daily at midnight** to respect API rate limits."

**What Was Useful:**
> "The AI accelerated my understanding of fetch error boundaries and async patterns."

**What Was Challenging:**
> "The challenge was that **prompt engineering was entirely manual**. AI could write the code to call the LLM, but it couldn't design effective prompts. Response quality depended entirely on human context engineering."

**Limitations:**
> "The file is still named `deepseek.js` from early prototyping — our actual model is Llama 3.2. Also, AI couldn't predict which prompt structures would yield useful diagnostic suggestions."

**Future:**
> "Going forward, I'll **invest more time in prompt design upfront**. AI helps with integration code, but LLM behavior requires human experimentation. I'd prototype prompts before writing any integration code."

**👆 [Action]:** Hand off to Aya.

---

## Your Handoffs

| From | To | Your Script |
|------|-----|------------|
| You (AI Integration) | Aya | "AI was wired in. Aya, how did we test and validate everything?" |
| You (Reflection) | Aya | "Aya, close us out." |

---

*Practice timing with a stopwatch. Target: 6.5 minutes total.*
