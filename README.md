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

  -> the real problem : PO and GRN use buyer SKU (like 11423) but invoice uses vendor code (FG-P-F-0503). codes dont match so cant join on them.

  -> so we join on product description instead. its the only field that looks similar across all 3.

  -> description matching - i clean the text (remove brand words like Meatigo, Frozen, units etc), break into words and match on how many words overlap. each invoice/grn line picks its single best PO item then we add up the qtys.

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
- description matching is not bulletproof ofc. couple of real cases i hit :
   - gemini sometimes eats the space ("PorkHam", "PorkPepperoni") so those lines dont match properly.
   - grn and invoice descriptions are shorter than po , they drop the "24 Pieces" vs "10 Pieces" part , so two different products end up looking the same and get merged.
- i didnt try to force 100% accuracy on this , its a lossy ocr problem and chasing it was not worth it for this scope.

# **What i'd improve with more time**
- better prompt / cleanup to fix the joined words from gemini.
- a confidence score per item match , flag the low ones for manual check instead of silently matching wrong.
- maybe use a proper string similarity library instead of my own word overlap thing.

# **API**
- POST /documents/upload
- GET  /documents/:id
- GET  /match/:poNumber

# **Run locally**
- npm install
- copy .env.example to .env and put your mongo uri + gemini keys
- npm start

