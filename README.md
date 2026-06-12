# THREE WAY MATCH
- we upload the three documents namely - PO (purchase order) , GRN (Goods received Note) and Invoice (Tax Invoice) in PDF formats only.
- the three pdfs are parsed with the help of LLM model , Gemini (free - tier ) in this case.
- after parsing i stored it in MongoDB
- Match computed based on rules and demand by poNumber.

# **DATA MODEL**
- each document type has different fields , one collection would mean a mess of tangled data
- although a single collection wouyld've made the fetch queries simpler. But no clarity.
- All the coloumns of the pdfs are in the schema as partial content is not used in production. 

# **Parsing**
- Multer memory storage -> buffer in RAM -> base64 (convert to valid input) -> straight to Gemini
- three combined prompts for strict JSON 

# ***DESIGN CHOICES***

  -> wrapping fixed by gemini generated JSON (```) - we trimmed it.
  
  -> date formatting was inconsistent - '/' and '-' problems.
  
  -> FallBack to multiple API keys as we are using Free tier gemini keys.

# *Matching Engine*

  -> the real problem : PO and GRN both use the buyer SKU (like 11423), but the
     invoice uses the vendor's own code (FG-P-F-0503). so the invoice code matches
     nothing in the other two.

  -> PO and GRN i join directly on itemCode - they literally share the same code,
     no need to guess. only the invoice side needs work.

  -> for the invoice, i ask gemini itself to map each invoice line to the best
     PO itemCode in one batched call. it gets the PO list with codes/descriptions
     + the invoice lines, and returns an array of codes (or null per line). using
     the LLM here is way better than tokenizing because gemini can read past
     missing spaces ("PorkHam"), tell the 24-piece momos from the 10-piece by
     unitRate, and generally handle the noise that a word-overlap function cant.

  -> if gemini fails (quota, garbage output, wrong length, unknown code), the
     code falls back to a hand-rolled fuzzy matcher (tokenize + shared word
     count). so the engine never breaks even if the AI is unavailable. and the
     final fallback for an invoice line that still doesnt map is `item_missing_in_po`.

  -> 4 rules , each gives a reason code :
     - grn qty > po qty  -> grn_qty_exceeds_po_qty
     - invoice qty > total grn qty -> invoice_qty_exceeds_grn_qty
     - invoice qty > po qty -> invoice_qty_exceeds_po_qty
     - invoice date after po date -> invoice_date_after_po_date
     - invoice item not found in po -> item_missing_in_po

  -> status :
     - no reasons = matched
     - some items fine some flagged = partially_matched
     - everything flagged = mismatch
     - any doc missing = insufficient_documents

# **Out of order uploads**
- documents stored independently, only linked by poNumber.
- match is NOT stored anywhere , its recomputed everytime on GET /match/:poNumber from whatever is in the db right now.
- so order doesnt matter. invoice first or po last , same result once all 3 are in. before that it just says insufficient_documents.
- this was the main reason i didnt make a match result collection , stored result would go stale the moment a new doc comes.

# **Assumptions**
- 1 PO per poNumber (unique index, re-upload replaces it). GRN and invoice can be multiple.
- for grn/invoice i replace by their own number so uploading same file twice doesnt make duplicates but different ones pile up.
- rule 4 (invoice date not after po date) i kept exactly as written even though in real life invoice always comes after the po. just followed the assignment.

# **Tradeoffs / whats fragile**
- match endpoint now hits gemini once per call, so its a few seconds slower and uses up free-tier quota. the fuzzy fallback covers when the quota is gone but the result quality drops to "it works, kind of" on the messy lines.
- gemini's output isnt 100% deterministic - same data, same call can give slightly different mappings sometimes. the fallback at least keeps things repeatable when AI is skipped.
- the invoice descriptions are still lossy (PorkPepperoni concatenated, momos missing the piece-count etc). gemini handles most of it but not all - couple of lines still get merged onto the wrong PO item. i kept the unmatched-line reason code so the API still tells you what didnt fit, instead of silently hiding it.
- i didnt try to push accuracy beyond this. its a lossy OCR problem and chasing the last 5% wasnt worth the scope.

# **What i'd improve with more time**
- cache the gemini invoice coz PO mapping inside the invoice doc at upload time so the match endpoint stays fast and doesnt re-burn quota on every GET.
- better extraction prompt to fix the joined words from gemini at parse time itself ("PorkHam" -> "Pork Ham") instead of relying on the matcher to read past them.
- confidence score per item match. flag the low-confidence ones for manual review instead of silently mapping.

# **API**
- POST /documents/upload
- GET  /documents/:id
- GET  /match/:poNumber

# **Run locally**
- npm install
- copy .env.example to .env and put your mongo uri + gemini keys
- npm start

