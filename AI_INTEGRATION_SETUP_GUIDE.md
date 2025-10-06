# 🤖 AI Integration Setup Guide - Complete Implementation

## 📋 Overview

This guide walks you through setting up **AI-powered treatment suggestions** using:
- **Supabase pgvector** - Vector database for medical knowledge
- **OpenAI Embeddings** - text-embedding-3-small (1536 dimensions)
- **OpenAI GPT-4** - Treatment recommendations with RAG
- **LangFlow** - Visual AI workflow orchestration

---

## 🎯 Three AI Features to Implement

### 1. **Diagnosis & Treatment AI** (Medical Knowledge RAG)
- **Where**: FDI Dental Chart → Tooth Diagnosis Dialog
- **Data Source**: Medical textbooks, research papers (vector DB)
- **What**: Evidence-based treatment suggestions with confidence scores

### 2. **Research Projects AI** (Patient Database Query)
- **Where**: Research Projects Dashboard → AI Assistant Tab
- **Data Source**: Patient clinical data (direct SQL queries)
- **What**: Statistical analysis and clinical insights

### 3. **Clinic Analysis AI** (Patient Database Query)
- **Where**: Clinic Analysis Dashboard
- **Data Source**: All appointments, treatments, outcomes (direct SQL)
- **What**: Clinic performance metrics and trends

---

## 🚀 Step-by-Step Setup

### **Step 1: Run Database Migration**

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/pxpfbeqlqqrjpkiqlxmi/sql)
2. Copy the entire SQL from: `lib/db/migrations/add_medical_knowledge_vector_store.sql`
3. Paste and **RUN** in SQL Editor
4. Verify success:
   ```sql
   SELECT COUNT(*) FROM api.medical_knowledge;
   -- Should return 2 (seed data)
   ```

**What This Does:**
- ✅ Enables `pgvector` extension
- ✅ Creates `medical_knowledge` table with vector embeddings
- ✅ Creates `ai_suggestion_cache` table
- ✅ Creates vector search function
- ✅ Sets up RLS policies
- ✅ Inserts 2 sample knowledge entries

---

### **Step 2: Get OpenAI API Key**

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy the key (starts with `sk-...`)
4. Add to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```

**Required Models:**
- `text-embedding-3-small` - For generating vectors (1536 dim)
- `gpt-4` - For treatment recommendations

---

### **Step 3: Option A - Use LangFlow Cloud (Easiest)**

**3A.1 Sign Up for LangFlow**
1. Go to [LangFlow Cloud](https://www.langflow.org/)
2. Create free account
3. Create new project: "ENDOFLOW Treatment AI"

**3A.2 Import Flow**
1. Download your `Vector Store RAG.json` file
2. In LangFlow, click **Import Flow**
3. **Modify the flow**:
   - Delete **AstraDB component**
   - Add **Supabase Vector Store** component
   - Configure connection:
     - Supabase URL: `https://pxpfbeqlqqrjpkiqlxmi.supabase.co`
     - Supabase Key: `your_service_role_key`
     - Table Name: `medical_knowledge`
     - Query Function: `search_treatment_protocols`

**3A.3 Configure OpenAI Components**
- **Embeddings**:
  - Model: `text-embedding-3-small`
  - Dimensions: 1536
- **Chat Model**:
  - Model: `gpt-4`
  - Temperature: 0.3 (for consistent medical advice)

**3A.4 Test the Flow**
1. Click **Playground**
2. Test input: "Irreversible pulpitis in tooth #11"
3. Should return treatment recommendation with sources

**3A.5 Deploy & Get API Credentials**
1. Click **Deploy**
2. Copy **API Endpoint** and **API Key**
3. Add to `.env.local`:
   ```env
   LANGFLOW_API_URL=https://api.langflow.org/api/v1
   LANGFLOW_API_KEY=your_langflow_api_key
   LANGFLOW_TREATMENT_FLOW_ID=your_flow_id
   ```

---

### **Step 3: Option B - Direct OpenAI Integration (Simpler)**

**Skip LangFlow** and call OpenAI directly from Supabase Edge Functions.

**3B.1 Create Edge Function Directory**
```bash
mkdir -p supabase/functions/ai-treatment-suggestion
```

**3B.2 Create Edge Function** (`supabase/functions/ai-treatment-suggestion/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { diagnosis, toothNumber } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Generate embedding for the diagnosis
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: `Diagnosis: ${diagnosis}. Tooth: ${toothNumber}`
      })
    })

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // 2. Search medical knowledge base
    const { data: relevantKnowledge } = await supabase
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3
      })

    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      return new Response(JSON.stringify({
        error: 'No relevant medical knowledge found. Please upload textbooks/papers first.'
      }), { status: 404 })
    }

    // 3. Build context from retrieved documents
    const context = relevantKnowledge.map(doc =>
      `Title: ${doc.title}\n` +
      `Source: ${doc.journal} (${doc.publication_year})\n` +
      `Content: ${doc.content.substring(0, 1000)}...\n` +
      `Similarity: ${(doc.similarity * 100).toFixed(1)}%`
    ).join('\n\n---\n\n')

    // 4. Call GPT-4 for treatment recommendation
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert endodontist AI assistant. Based on evidence from research papers and textbooks, provide treatment recommendations.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "treatment": "Treatment name",
  "confidence": 85,
  "reasoning": "Evidence-based explanation",
  "sources": [
    {"title": "Paper title", "journal": "Journal", "year": 2023}
  ]
}`
          },
          {
            role: 'user',
            content: `Based on this medical evidence:\n\n${context}\n\nProvide treatment recommendation for:\nDiagnosis: ${diagnosis}\nTooth Number: ${toothNumber}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    const chatData = await chatResponse.json()
    const suggestion = JSON.parse(chatData.choices[0].message.content)

    return new Response(JSON.stringify({ success: true, suggestion }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

**3B.3 Deploy Edge Function**
```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref pxpfbeqlqqrjpkiqlxmi

# Deploy with secrets
npx supabase functions deploy ai-treatment-suggestion \
  --secret OPENAI_API_KEY=sk-your-key-here
```

**3B.4 Add to .env.local**
```env
# No LangFlow needed - using direct Edge Function
NEXT_PUBLIC_SUPABASE_URL=https://pxpfbeqlqqrjpkiqlxmi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-your-key-here
```

---

### **Step 4: Test the AI Integration**

**4.1 Test Vector Search Directly**

In Supabase SQL Editor:
```sql
-- Test: Search for treatment protocols
SELECT
  title,
  similarity,
  journal,
  publication_year
FROM api.search_treatment_protocols(
  (SELECT embedding FROM api.medical_knowledge LIMIT 1),
  ARRAY['irreversible_pulpitis'],
  NULL,
  NULL,
  0.5,
  3
);
```

**4.2 Test Edge Function** (if using Option B)

```bash
curl -X POST https://pxpfbeqlqqrjpkiqlxmi.supabase.co/functions/v1/ai-treatment-suggestion \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"diagnosis": "Irreversible Pulpitis", "toothNumber": "#11"}'
```

---

### **Step 5: Upload Medical Knowledge**

**IMPORTANT**: The AI needs medical knowledge to work!

**Option A: Manual Upload via SQL**

```sql
INSERT INTO api.medical_knowledge (
  title,
  content,
  source_type,
  specialty,
  topics,
  diagnosis_keywords,
  treatment_keywords,
  uploaded_by
) VALUES (
  'Your Textbook Title',
  'Full text content here...',
  'textbook',
  'endodontics',
  ARRAY['root_canal', 'pulpitis'],
  ARRAY['irreversible_pulpitis', 'pulp_necrosis'],
  ARRAY['rct', 'root_canal_treatment'],
  (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com')
);
```

**Option B: Use Medical Knowledge Uploader UI** (implemented in Phase 4)

---

### **Step 6: Update Research Projects AI** (Patient Database)

For Research Projects and Clinic Analysis, the AI should query **actual patient data**, not medical papers.

**Modify** `app/api/research/ai-query/route.ts`:

```typescript
// Instead of sending cohort data to LangFlow,
// Let GPT-4 generate SQL queries to analyze patient database

const prompt = `
You are a clinical research analyst. Based on this question: "${query}"
And this patient cohort data: ${JSON.stringify(cohortData)}

Analyze the data and provide:
1. Statistical insights
2. Clinical trends
3. Treatment outcomes
4. Evidence-based recommendations
`

// Send directly to OpenAI (no need for RAG here)
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a clinical research analyst...' },
      { role: 'user', content: prompt }
    ]
  })
})
```

---

## 📊 Complete Environment Variables

Add ALL of these to `.env.local`:

```env
# OpenAI API
OPENAI_API_KEY=sk-your-actual-key-here

# LangFlow (Option A - if using LangFlow)
LANGFLOW_API_URL=https://api.langflow.org/api/v1
LANGFLOW_API_KEY=your_langflow_key
LANGFLOW_TREATMENT_FLOW_ID=your_flow_id

# Supabase (already have these)
NEXT_PUBLIC_SUPABASE_URL=https://pxpfbeqlqqrjpkiqlxmi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ✅ Verification Checklist

- [ ] Database migration completed successfully
- [ ] pgvector extension enabled
- [ ] medical_knowledge table created with 2 seed entries
- [ ] OpenAI API key configured
- [ ] Edge Function deployed OR LangFlow configured
- [ ] Test query returns AI suggestions
- [ ] At least 5-10 medical documents uploaded

---

## 🎯 Next Steps

1. **Upload More Knowledge**: Add 10-20 endodontic textbooks/papers
2. **Test in UI**: Implement Endo-AI Co-Pilot component (next phase)
3. **Fine-tune Prompts**: Adjust confidence scores based on feedback
4. **Monitor Costs**: Track OpenAI API usage

---

## 💡 Cost Estimation

**Per AI Suggestion:**
- Embedding: ~$0.00001 (text-embedding-3-small)
- Vector Search: Free (Supabase)
- GPT-4: ~$0.03 (with context)
- **Total**: ~$0.03 per suggestion

**With Cache (7-day TTL):**
- Same diagnosis = cached = $0
- Estimated: ~$5-10/month for 300 suggestions

---

## 🐛 Troubleshooting

**Error: "No relevant medical knowledge found"**
- Upload more textbooks/papers to vector database
- Lower match_threshold from 0.7 to 0.5

**Error: "OpenAI API rate limit"**
- Upgrade OpenAI plan
- Implement request queuing

**Error: "pgvector extension not found"**
- Run: `CREATE EXTENSION vector;` in SQL Editor
- Check Supabase plan supports extensions

---

## 📚 Resources

- [Supabase pgvector Docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [LangFlow Documentation](https://docs.langflow.org/)

---

**Ready to implement frontend components next!** 🚀
