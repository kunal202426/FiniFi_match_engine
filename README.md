**THREE WAY MATCH**
- we upload the three documents namely - PO (purchase order) , GRN (Goods received Note) and Invoice (Tax Invoice) in PDF formats only.
- the three pdfs are parsed with the help of LLM model , Gemini (free - tier ) in this case.
- after parsing i stored it in MongoDB
- Match computed based on rules and demand by poNumber.

**DATA MODEL**
- each document type has different fields , one collection would mean a mess of tangled data
- although a single collection wouyld've made the fetch queries simpler. But no clarity.
- All the coloumns of the pdfs are in the schema as partial content is not used in production. 

**Parsing**
- Multer memory storage -> buffer in RAM -> base64 (convert to valid input) -> straight to Gemini
- three combined prompts for strict JSON 

***DESIGN CHOICES***
  -> wrapping fixed by gemini generated JSON (```) - we trimmed it.
  
  -> date formatting was inconsistent - '/' and '-' problems.
  
  -> FallBack to multiple API keys as we are using Free tier gemini keys.

