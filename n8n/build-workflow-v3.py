#!/usr/bin/env python3
"""
Build email-pda-v3.json from email-pda-v2.0-source.json.

Transformations applied to v2.0:

1. Remove dead nodes
   - Schedule Trigger (orphan)
   - Create Internal Note (orphan)
   - Get a message1 (duplicate API call — trigger already downloads with output=raw)

2. Fix Excel/Word/CSV crash
   - Extract from File was pinned to pdf mode. Replace with a Switch by
     extractType so .xlsx/.docx/.csv/.txt no longer hit the PDF extractor.

3. Store attachments properly
   - NEW: Upload each doc attachment to Supabase Storage 'pdfs' bucket
   - NEW: Insert row in email_attachments linking file to email.id
   - NEW: Insert email row FIRST (with cc/bcc/subject/body/from) so we have
     an email.id to link attachments to before downstream runs.

4. CC/BCC and full metadata
   - Rewrite 'Attachment Handling' to emit cc_recipients, bcc_recipients
     and receivedAt so the email row insert can use them.

5. Better classification
   - Add deterministic pre-filter JS node before the LLM:
     * location check on Curaçao keywords
     * reply-chain + LBH-sender detection
   - Replace AI Agent1 prompt with slim version + JSON response_format
   - Add confidence threshold routing to 'needs_review' state

6. Remove duplicate classification in OWNERS_AGENT tak
   - 'Classify Request Type' + 'Route by Request Type' removed; routing
     now flows directly from the main classifier.

Downstream PDA sub-workflows (Call 'PDA 1 vessel from email' and friends)
stay UNCHANGED — we only replace the inbound / classification pipeline.
"""

from __future__ import annotations
import copy
import json
import sys
import uuid
from pathlib import Path

SRC = Path(__file__).parent / "workflows" / "email-pda-v2.0-source.json"
DST = Path(__file__).parent / "workflows" / "email-pda-v3.json"

# --- Nodes to delete entirely (orphans + duplicates) ---
DELETE_NODES = {
    "Schedule Trigger",
    "Create Internal Note",
    "Get a message1",
    # Duplicate classification — the main classifier already decides
    # OWNERS_AGENT vs LOADING_DISCHARGE. The second classification inside the
    # OWNERS_AGENT branch added nothing but token cost.
    "Classify Request Type",
    "GPT-4o Mini Classifier",
    "Classification Parser",
    "Route by Request Type",
}


def nid() -> str:
    return str(uuid.uuid4())


def find_node(nodes, name):
    for n in nodes:
        if n["name"] == name:
            return n
    raise KeyError(name)


def remove_from_connections(connections: dict, node_name: str) -> None:
    """Delete a node from the connections graph, both as source and as target."""
    connections.pop(node_name, None)
    for src, outs in list(connections.items()):
        for conn_type, branches in outs.items():
            for i, branch in enumerate(branches or []):
                if branch is None:
                    continue
                branches[i] = [t for t in branch if t.get("node") != node_name]


def connect(connections: dict, src: str, dst: str, src_idx: int = 0, dst_idx: int = 0,
            conn_type: str = "main") -> None:
    connections.setdefault(src, {}).setdefault(conn_type, [])
    outs = connections[src][conn_type]
    while len(outs) <= src_idx:
        outs.append([])
    outs[src_idx].append({"node": dst, "type": conn_type, "index": dst_idx})


def disconnect(connections: dict, src: str, dst: str, conn_type: str = "main") -> None:
    outs = connections.get(src, {}).get(conn_type, [])
    for i, branch in enumerate(outs):
        if branch is None:
            continue
        outs[i] = [t for t in branch if t.get("node") != dst]


# -------------------------------------------------------------------
# Node factories
# -------------------------------------------------------------------

SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co"


def node_attachment_handling(pos: list[int]) -> dict:
    """
    Updated version of the 'Attachment Handling' code node.

    Changes vs v2.0:
    - Preserves cc_recipients / bcc_recipients / to_recipients as clean arrays
    - Adds received_at (ISO string)
    - Adds subject/from/fromName consistently even when missing
    - Still filters out inline images / signatures
    """
    code = r"""// Attachment Handling v3 — same shape as v2.0 but richer metadata
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function parseSize(fs) {
  // n8n exposes b.fileSize as a human-readable string like "280 kB".
  // email_attachments.file_size is bigint, so convert to raw bytes here.
  if (fs == null) return null;
  if (typeof fs === 'number') return fs;
  const m = String(fs).match(/^([\d.]+)\s*([KMGT]?i?B)?$/i);
  if (!m) return null;
  const unit = (m[2] || 'B').toUpperCase();
  const mult = {
    B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776,
    KIB: 1024, MIB: 1048576, GIB: 1073741824, TIB: 1099511627776,
  }[unit] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

const SKIP_MIMES = ['image/'];
const SKIP_EXTS  = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.tiff','.ico'];
const DOC_MIMES  = ['pdf','word','excel','spreadsheet','text/plain','text/csv','officedocument','opendocument'];
const DOC_EXTS   = ['.pdf','.doc','.docx','.xls','.xlsx','.csv','.txt'];

const results = [];

for (const item of $input.all()) {
  const j = item.json;
  const rawBody = j.body?.content || (typeof j.body === 'string' ? j.body : '') || j.bodyPreview || '';
  const cleanText = sanitize(rawBody);

  const binaryKeys = item.binary ? Object.keys(item.binary) : [];
  const docKeys = binaryKeys.filter(k => {
    const b = item.binary[k];
    if (!b) return false;
    const mime = (b.mimeType || '').toLowerCase();
    const name = (b.fileName || '').toLowerCase();
    if (SKIP_MIMES.some(m => mime.startsWith(m))) return false;
    if (SKIP_EXTS.some(e => name.endsWith(e))) return false;
    return DOC_MIMES.some(m => mime.includes(m)) || DOC_EXTS.some(e => name.endsWith(e));
  });

  const attachments = docKeys.map(k => {
    const b = item.binary[k];
    const name = (b.fileName || k).toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    let extractType = 'skip';
    if (ext === 'pdf') extractType = 'pdf';
    else if (ext === 'csv') extractType = 'csv';
    else if (ext === 'xlsx' || ext === 'xls') extractType = 'xlsx';
    else if (ext === 'docx' || ext === 'doc') extractType = 'docx';
    else if (ext === 'txt') extractType = 'text';
    return {
      binaryKey: k,
      filename: b.fileName || k,
      mimeType: b.mimeType || 'application/octet-stream',
      extractType,
      size: parseSize(b.fileSize),
    };
  });

  const mapAddr = (arr) => (arr || []).map(r => r.emailAddress?.address || r).filter(Boolean);

  results.push({
    json: {
      text: cleanText,
      subject: j.subject || 'No subject',
      emailId: j.id,
      from: j.from?.emailAddress?.address || 'unknown',
      fromName: j.from?.emailAddress?.name || '',
      toRecipients: mapAddr(j.toRecipients),
      ccRecipients: mapAddr(j.ccRecipients),
      bccRecipients: mapAddr(j.bccRecipients),
      receivedAt: j.receivedDateTime || j.createdDateTime || new Date().toISOString(),
      hasAttachmentsFlag: !!j.hasAttachments,
      attachmentExists: attachments.length > 0,
      attachmentCount: attachments.length,
      attachments,
      binaryKeys: docKeys,
    },
    binary: item.binary,
  });
}

return results;
"""
    return {
        "parameters": {"jsCode": code},
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
        "id": nid(),
        "name": "Attachment Handling",
    }


def node_insert_email_row(pos: list[int]) -> dict:
    """Insert initial email row so we have email.id for attachment foreign keys."""
    return {
        "parameters": {
            "tableId": "email",
            "fieldsUi": {
                "fieldValues": [
                    {"fieldId": "status", "fieldValue": "inbound"},
                    {"fieldId": "email_to_person", "fieldValue": "={{ $json.toRecipients?.[0] || 'agency@lbhcuracao.com' }}"},
                    {"fieldId": "subject", "fieldValue": "={{ $json.subject }}"},
                    {"fieldId": "body", "fieldValue": "={{ $json.text }}"},
                    {"fieldId": "original_email", "fieldValue": "={{ $json.text }}"},
                    {"fieldId": "contact_name", "fieldValue": "={{ $json.fromName || null }}"},
                    {"fieldId": "company_name", "fieldValue": "={{ $json.from }}"},
                    {"fieldId": "cc_recipients", "fieldValue": "={{ $json.ccRecipients }}"},
                    {"fieldId": "bcc_recipients", "fieldValue": "={{ $json.bccRecipients }}"},
                    {"fieldId": "received_at", "fieldValue": "={{ $json.receivedAt }}"},
                ]
            },
        },
        "type": "n8n-nodes-base.supabase",
        "typeVersion": 1,
        "position": pos,
        "id": nid(),
        "name": "Insert Email Row",
        "credentials": {
            # User must already have this credential — same one the other Supabase nodes use
            "supabaseApi": {"id": "VA7km8hKLFMCwCFf", "name": "Tim supabse"}
        },
    }


def node_split_attachments(pos: list[int]) -> dict:
    """Fan out one item per attachment so we can upload each to Storage."""
    code = r"""// Fan out: one item per doc attachment, keeping email_id for linking.
// Only reached when 'Has Attachments?' is true, so the list is non-empty.
//
// Reach back to 'Attachment Handling' for the binary — the Supabase Insert
// node strips binary data from its output, so $input.first() would give us
// json-only and the Upload to Storage HTTP node would fail with
// "binary file 'attachment_X' not found".
const parent = $('Attachment Handling').first();
const emailId = $('Insert Email Row').first().json.id;
const meta = $('Attachment Handling').item.json;
const attachments = meta.attachments || [];

return attachments.map(a => ({
  json: {
    email_id: emailId,
    activeAttachment: a,
    activePdfKey: a.binaryKey,
    extractType: a.extractType,
    filename: a.filename,
    mimeType: a.mimeType,
    storagePath: `email-attachments/${emailId}/${Date.now()}-${a.filename.replace(/[^\w.\-]/g, '_')}`,
  },
  binary: parent.binary,
}));
"""
    return {
        "parameters": {"jsCode": code},
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
        "id": nid(),
        "name": "Split Attachments",
    }


def node_upload_to_storage(pos: list[int]) -> dict:
    """HTTP upload to Supabase Storage via the Storage REST API.
    URL hardcoded — the previous $env.SUPABASE_URL fallback produced
    'undefined' when the env var wasn't set. Body is sent as binary from
    the attachment key that Split Attachments fanned out per file.
    """
    return {
        "parameters": {
            "method": "POST",
            "url": f"={SUPABASE_URL}/storage/v1/object/pdfs/{{{{ $json.storagePath }}}}",
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "Content-Type", "value": "={{ $json.mimeType }}"},
                    {"name": "x-upsert", "value": "true"},
                ]
            },
            "sendBody": True,
            "contentType": "binaryData",
            "inputDataFieldName": "={{ $json.activePdfKey }}",
            "options": {},
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": pos,
        "id": nid(),
        "name": "Upload to Storage",
        "credentials": {
            "httpHeaderAuth": {"id": "bRvSu0VlQdvQ5ZVg", "name": "lbh supabas"}
        },
    }


def node_has_attachments_if(pos: list[int]) -> dict:
    """IF gate: only go through the upload chain when there are actual
    attachments. No-attachment emails bypass Split/Upload/Insert and flow
    straight to Has PDF? (which also flows to data setter for classification)."""
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                "conditions": [{
                    "id": nid(),
                    "leftValue": "={{ $('Attachment Handling').item.json.attachmentExists }}",
                    "rightValue": "",
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                }],
                "combinator": "and",
            },
            "options": {},
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos,
        "id": nid(),
        "name": "Has Attachments?",
    }


def node_insert_attachment_row(pos: list[int]) -> dict:
    # $json here is the Supabase Storage HTTP response ({Key, Id}), not the
    # upstream data. Reach back to Split Attachments for the original fields.
    # .item is safe here — Split → Upload → Insert is a linear 1-to-1 chain.
    return {
        "parameters": {
            "tableId": "email_attachments",
            "fieldsUi": {
                "fieldValues": [
                    {"fieldId": "email_id", "fieldValue": "={{ $('Split Attachments').item.json.email_id }}"},
                    {"fieldId": "file_name", "fieldValue": "={{ $('Split Attachments').item.json.filename }}"},
                    {"fieldId": "file_path", "fieldValue": "={{ $('Split Attachments').item.json.storagePath }}"},
                    {"fieldId": "file_size", "fieldValue": "={{ $('Split Attachments').item.json.activeAttachment?.size || null }}"},
                ]
            },
        },
        "type": "n8n-nodes-base.supabase",
        "typeVersion": 1,
        "position": pos,
        "id": nid(),
        "name": "Insert email_attachments row",
        "credentials": {
            "supabaseApi": {"id": "VA7km8hKLFMCwCFf", "name": "Tim supabse"}
        },
    }


def node_switch_extract_type(pos: list[int]) -> dict:
    """Route extraction by file type. xlsx/docx route to dedicated extractors
    that the user can add, OR skip extraction and rely on filename/preview."""
    return {
        "parameters": {
            "rules": {
                "values": [
                    {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                                    "conditions": [{"leftValue": "={{ $json.extractType }}", "rightValue": "pdf",
                                                    "operator": {"type": "string", "operation": "equals"},
                                                    "id": nid()}],
                                    "combinator": "and"},
                     "outputKey": "pdf"},
                    {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                                    "conditions": [{"leftValue": "={{ $json.extractType }}", "rightValue": "xlsx",
                                                    "operator": {"type": "string", "operation": "equals"},
                                                    "id": nid()}],
                                    "combinator": "and"},
                     "outputKey": "xlsx"},
                    {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                                    "conditions": [{"leftValue": "={{ $json.extractType }}", "rightValue": "csv",
                                                    "operator": {"type": "string", "operation": "equals"},
                                                    "id": nid()}],
                                    "combinator": "and"},
                     "outputKey": "csv"},
                    {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                                    "conditions": [{"leftValue": "={{ $json.extractType }}", "rightValue": "text",
                                                    "operator": {"type": "string", "operation": "equals"},
                                                    "id": nid()}],
                                    "combinator": "and"},
                     "outputKey": "text"},
                ]
            },
            "options": {"fallbackOutput": "extra"},
        },
        "type": "n8n-nodes-base.switch",
        "typeVersion": 3.3,
        "position": pos,
        "id": nid(),
        "name": "Route by File Type",
    }


def node_extract_xlsx(pos: list[int]) -> dict:
    return {
        "parameters": {
            "operation": "xlsx",
            "binaryPropertyName": "={{ $json.activePdfKey }}",
            "options": {},
        },
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1.1,
        "position": pos,
        "id": nid(),
        "name": "Extract XLSX",
    }


def node_extract_csv(pos: list[int]) -> dict:
    return {
        "parameters": {
            "operation": "csv",
            "binaryPropertyName": "={{ $json.activePdfKey }}",
            "options": {},
        },
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1.1,
        "position": pos,
        "id": nid(),
        "name": "Extract CSV",
    }


def node_extract_text(pos: list[int]) -> dict:
    return {
        "parameters": {
            "operation": "text",
            "binaryPropertyName": "={{ $json.activePdfKey }}",
            "options": {},
        },
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1.1,
        "position": pos,
        "id": nid(),
        "name": "Extract Text",
    }


def node_prefilter(pos: list[int]) -> dict:
    """Deterministic pre-filter. Cheap, fast, catches 30-50% of noise before
    the LLM sees it."""
    code = r"""// Deterministic pre-filter — runs BEFORE the LLM classifier.
// Returns: { passed: boolean, reason?: string }
// If passed=false, downstream should set status='out_of_scope' and skip LLM.

const src = $('Attachment Handling').first().json;
const text = src.text || '';
const ccs = (src.ccRecipients || []).join(' ').toLowerCase();
const from = (src.from || '').toLowerCase();
const fromName = (src.fromName || '').toLowerCase();
const subject = (src.subject || '').toLowerCase();

const CURACAO_LOCATIONS = [
  'curacao', 'curaçao', 'willemstad', 'bullen bay', 'bullenbaai',
  'isla terminal', 'isla refinery', 'caracasbaai', 'caracas bay',
  'megapier', 'fuik', "st. michiels", 'prins hendrikkade', 'motet',
  'cru terminal', ' cw ', 'cw.', 'cw,',
];
const NON_CURACAO = [
  'bonaire', 'aruba', 'uruguay', 'montevideo', 'nueva palmira',
  'npalmira', 'paramaribo', 'colombia', 'houston', 'rotterdam',
];

const lower = text.toLowerCase();
const hasCW = CURACAO_LOCATIONS.some(k => lower.includes(k));
const hasOther = NON_CURACAO.some(k => lower.includes(k));

// Location logic: if another port is mentioned AND Curacao is NOT, reject.
if (hasOther && !hasCW) {
  return [{ json: { passed: false, reason: 'non_curacao_location', detected: NON_CURACAO.filter(k => lower.includes(k))[0] } }];
}

// LBH already involved? Check sender list + reply markers.
const LBH_MARKERS = [
  'agency@lbhcuracao.com',
  'lbh-group.com',
  'lbh curacao',
  'pda_',
];
const replyCount = (text.match(/-{5,}original message-{5,}|^from:\s/gmi) || []).length;
const lbhMentions = LBH_MARKERS.filter(m => lower.includes(m)).length;

if (replyCount >= 2 && lbhMentions >= 2) {
  return [{ json: { passed: false, reason: 'existing_case_lbh_already_responded' } }];
}

// Post-operation report indicators (SOF, final time sheet, completed)
const REPORT_MARKERS = [
  /\bstatement of facts\b/i, /\bsof\b/i, /\bfinal time sheet\b/i,
  /operation (is )?complete/i, /completed on/i, /please revert with sof/i,
];
const hasReport = REPORT_MARKERS.some(rx => rx.test(text));
// Also past-tense timestamps like "0840H Barge alongside"
const timestamps = (text.match(/\b\d{4}h\s+[a-z]/gi) || []).length;
if (hasReport || timestamps >= 2) {
  return [{ json: { passed: false, reason: 'post_operation_report' } }];
}

return [{ json: { passed: true } }];
"""
    return {
        "parameters": {"jsCode": code},
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
        "id": nid(),
        "name": "Pre-filter (deterministic)",
    }


def node_prefilter_gate(pos: list[int]) -> dict:
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                "conditions": [
                    {"id": nid(),
                     "leftValue": "={{ $json.passed }}",
                     "rightValue": "",
                     "operator": {"type": "boolean", "operation": "true", "singleValue": True}}
                ],
                "combinator": "and"
            },
            "options": {}
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos,
        "id": nid(),
        "name": "Pre-filter Passed?",
    }


def node_update_out_of_scope(pos: list[int]) -> dict:
    return {
        "parameters": {
            "operation": "update",
            "tableId": "email",
            "filterType": "manual",
            "matchType": "allFilters",
            "filters": {
                "conditions": [{"keyName": "id", "condition": "eq",
                                "keyValue": "={{ $('Insert Email Row').first().json.id }}"}]
            },
            "fieldsUi": {
                "fieldValues": [
                    {"fieldId": "status", "fieldValue": "out_of_scope"},
                    {"fieldId": "classification_reasoning", "fieldValue": "={{ $json.reason }}"},
                ]
            },
        },
        "type": "n8n-nodes-base.supabase",
        "typeVersion": 1,
        "position": pos,
        "id": nid(),
        "name": "Mark Out of Scope",
        "credentials": {
            "supabaseApi": {"id": "VA7km8hKLFMCwCFf", "name": "Tim supabse"}
        },
    }


def node_update_classification(pos: list[int]) -> dict:
    """Write classification result + status back to email row."""
    return {
        "parameters": {
            "operation": "update",
            "tableId": "email",
            "filterType": "manual",
            "matchType": "allFilters",
            "filters": {
                "conditions": [{"keyName": "id", "condition": "eq",
                                "keyValue": "={{ $('Insert Email Row').first().json.id }}"}]
            },
            "fieldsUi": {
                "fieldValues": [
                    {"fieldId": "status", "fieldValue": "={{ $json.output.status }}"},
                    {"fieldId": "Email Type", "fieldValue": "={{ $json.output.email_type }}"},
                    {"fieldId": "classification_confidence", "fieldValue": "={{ $json.output.confidence }}"},
                    {"fieldId": "classification_reasoning", "fieldValue": "={{ $json.output.reasoning }}"},
                ]
            },
        },
        "type": "n8n-nodes-base.supabase",
        "typeVersion": 1,
        "position": pos,
        "id": nid(),
        "name": "Save Classification",
        "credentials": {
            "supabaseApi": {"id": "VA7km8hKLFMCwCFf", "name": "Tim supabse"}
        },
    }


# -------------------------------------------------------------------
# New classifier prompt (slimmer, structured JSON output)
# -------------------------------------------------------------------

CLASSIFIER_SYSTEM_PROMPT = """You are LBH Curaçao's email triage classifier.

LBH Curaçao is a maritime shipping agency. You receive an email and must decide:
1. Is this a NEW REQUEST for services or cargo operations (not a report / reply / acknowledgment)?
2. Is it for Curaçao (or location unspecified)?
3. If yes to both, which category does it fall in?

CATEGORIES:
- OWNERS_AGENT: crew change, spares, medical, cash-to-master, garbage, fresh water, provisions, bunkering request (NEW), launch boat, hotel/airport transfer, PDA/EDA for SERVICES.
- LOADING_DISCHARGE_AGENT: cargo operations — loading, discharging, STS, PDA/EDA for CARGO, bulk cargo (wheat, corn, bitumen, HFO) with quantities in MT.
- OUT_OF_SCOPE: reports, SOF, completed ops, thank-you notes, existing case follow-ups, non-Curaçao, anything not a new request.

REQUEST INDICATORS (push toward a real category):
- "Please quote" / "RFQ" / "Request for quotation"
- "We need" / "Please arrange" / "Can you provide"
- Future tense, planning language, upcoming ETA, "intend to"

OUT_OF_SCOPE INDICATORS (push toward OUT_OF_SCOPE):
- SOF / Final Time Sheet / completed operations with past timestamps ("0840H Barge alongside")
- "Please revert with SOF" / "Thank you and best regards" / pure closing statements
- Thread where agency@lbhcuracao.com already replied (LBH already handling)
- Another port specified (Bonaire, Aruba, Uruguay, etc.)

OUTPUT (JSON only — no prose):
{
  "status": "processing" | "out_of_scope" | "needs_review",
  "email_type": "OWNERS_AGENT" | "LOADING_DISCHARGE_AGENT" | "OUT_OF_SCOPE",
  "confidence": 0.00 to 1.00,
  "reasoning": "One short sentence on why."
}

Rules:
- If confident it is OUT_OF_SCOPE → status="out_of_scope", email_type="OUT_OF_SCOPE".
- If confident it is a real request → status="processing", email_type=the category.
- If confidence < 0.70 → status="needs_review" and use your best guess for email_type.
"""


def patch_classifier(wf: dict) -> None:
    """Update AI Agent1 system prompt and LLM response_format."""
    agent = find_node(wf["nodes"], "AI Agent1")
    agent["parameters"]["messages"]["messageValues"] = [{"message": CLASSIFIER_SYSTEM_PROMPT}]
    agent["parameters"]["text"] = "=Email to classify:\n\n{{ $json.text }}"

    # Force JSON response from the LLM model node
    model = find_node(wf["nodes"], "OpenAI Chat Model3")
    model["parameters"].setdefault("options", {})["responseFormat"] = "json_object"


def patch_classification_parser(wf: dict) -> None:
    """Harden the JSON parser so malformed output doesn't crash the workflow."""
    parser = find_node(wf["nodes"], "Code in JavaScript")
    parser["parameters"]["jsCode"] = r"""// Robust JSON parse for classifier output.
// Falls back to 'needs_review' + low confidence if LLM returns non-JSON.
const raw = ($input.first().json.text || $input.first().json.output || '').toString();
const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  parsed = {
    status: 'needs_review',
    email_type: 'OUT_OF_SCOPE',
    confidence: 0.0,
    reasoning: `Classifier returned invalid JSON: ${e.message}. Raw: ${raw.slice(0, 200)}`,
  };
}

// Coerce confidence to number, clamp to [0,1]
const c = Number(parsed.confidence);
parsed.confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;

// Low confidence → needs_review regardless of what LLM said
if (parsed.confidence < 0.70 && parsed.status === 'processing') {
  parsed.status = 'needs_review';
}

return [{ json: { output: parsed } }];
"""


def patch_switch(wf: dict) -> None:
    """Switch routes by output.email_type — same as v2.0, but now status
    has already been written to the email row so the downstream branches
    can focus on their domain logic."""
    sw = find_node(wf["nodes"], "Switch")
    # keep existing rules — v2.0 already routes OWNERS_AGENT / LOADING_DISCHARGE / OUT_OF_SCOPE
    # just ensure pointers are sane
    for rule in sw["parameters"]["rules"]["values"]:
        for cond in rule["conditions"]["conditions"]:
            cond["leftValue"] = "={{ $json.output.email_type }}"


# -------------------------------------------------------------------
# Build
# -------------------------------------------------------------------

def main() -> int:
    src = json.loads(SRC.read_text())
    wf = copy.deepcopy(src)

    # 1. Remove dead / duplicate nodes
    wf["nodes"] = [n for n in wf["nodes"] if n["name"] not in DELETE_NODES]
    for name in DELETE_NODES:
        remove_from_connections(wf["connections"], name)

    # 2. Rewire: Outlook Trigger → Attachment Handling directly
    #    (previously Trigger → Get a message1 → Attachment Handling)
    wf["connections"].setdefault("Microsoft Outlook Trigger", {})
    wf["connections"]["Microsoft Outlook Trigger"]["main"] = [[
        {"node": "Attachment Handling", "type": "main", "index": 0}
    ]]

    # 3. Replace Attachment Handling with v3 code + richer metadata
    idx = next(i for i, n in enumerate(wf["nodes"]) if n["name"] == "Attachment Handling")
    wf["nodes"][idx] = node_attachment_handling(wf["nodes"][idx]["position"])

    # 4. Insert new nodes between 'Attachment Handling' and 'Has PDF?'
    #    Flow becomes:
    #      Attachment Handling
    #        → Insert Email Row
    #        → Split Attachments  (fan-out per doc)
    #        → Upload to Storage  (per attachment)
    #        → Insert email_attachments row (per attachment)
    #        → (aggregate back to single item)
    #        → Has PDF?  (existing branch stays)
    ax = find_node(wf["nodes"], "Attachment Handling")["position"]
    ox, oy = ax[0], ax[1]
    insert_email = node_insert_email_row([ox + 224, oy])
    has_att = node_has_attachments_if([ox + 384, oy])
    split_att = node_split_attachments([ox + 560, oy - 80])
    upload = node_upload_to_storage([ox + 784, oy - 80])
    insert_att = node_insert_attachment_row([ox + 1008, oy - 80])

    wf["nodes"].extend([insert_email, has_att, split_att, upload, insert_att])

    # Wire them:
    #   Attachment Handling
    #     → Insert Email Row
    #     → Has Attachments?
    #          true  → Split → Upload → Insert attachment row ─┐
    #          false ─────────────────────────────────────────┤
    #                                                          → Has PDF? (existing)
    disconnect(wf["connections"], "Attachment Handling", "Has PDF?")
    connect(wf["connections"], "Attachment Handling", "Insert Email Row")
    connect(wf["connections"], "Insert Email Row", "Has Attachments?")
    connect(wf["connections"], "Has Attachments?", "Split Attachments", src_idx=0)
    connect(wf["connections"], "Has Attachments?", "Has PDF?", src_idx=1)
    connect(wf["connections"], "Split Attachments", "Upload to Storage")
    connect(wf["connections"], "Upload to Storage", "Insert email_attachments row")
    connect(wf["connections"], "Insert email_attachments row", "Has PDF?")

    # 5. Pre-filter before classifier
    #    Flow: data setter → Pre-filter → Pre-filter Passed? → (AI Agent1 | Mark Out of Scope)
    ds = find_node(wf["nodes"], "data setter")["position"]
    pref = node_prefilter([ds[0] + 224, ds[1]])
    gate = node_prefilter_gate([ds[0] + 448, ds[1]])
    oos = node_update_out_of_scope([ds[0] + 448, ds[1] + 200])
    wf["nodes"].extend([pref, gate, oos])

    disconnect(wf["connections"], "data setter", "AI Agent1")
    connect(wf["connections"], "data setter", "Pre-filter (deterministic)")
    connect(wf["connections"], "Pre-filter (deterministic)", "Pre-filter Passed?")
    connect(wf["connections"], "Pre-filter Passed?", "AI Agent1", src_idx=0)
    connect(wf["connections"], "Pre-filter Passed?", "Mark Out of Scope", src_idx=1)

    # 6. Save Classification before Switch
    ca = find_node(wf["nodes"], "Code in JavaScript")["position"]
    save = node_update_classification([ca[0] + 224, ca[1]])
    wf["nodes"].append(save)

    disconnect(wf["connections"], "Code in JavaScript", "Switch")
    connect(wf["connections"], "Code in JavaScript", "Save Classification")
    connect(wf["connections"], "Save Classification", "Switch")

    # 7. Classifier prompt + response_format + robust parser
    patch_classifier(wf)
    patch_classification_parser(wf)
    patch_switch(wf)

    # 8. Excel / Word crash fix — route Extract from File by type
    #    Replace the single 'Extract from File' with a type Switch + dedicated extractors.
    #    We keep the existing 'Extract from File' as the PDF branch (already works).
    sp = find_node(wf["nodes"], "Split PDF Keys")["position"]
    route = node_switch_extract_type([sp[0] + 224, sp[1] - 200])
    xlsx_node = node_extract_xlsx([sp[0] + 448, sp[1] - 250])
    csv_node = node_extract_csv([sp[0] + 448, sp[1] - 100])
    text_node = node_extract_text([sp[0] + 448, sp[1] + 50])
    wf["nodes"].extend([route, xlsx_node, csv_node, text_node])

    disconnect(wf["connections"], "Split PDF Keys", "Extract from File")
    connect(wf["connections"], "Split PDF Keys", "Route by File Type")
    connect(wf["connections"], "Route by File Type", "Extract from File", src_idx=0)  # pdf
    connect(wf["connections"], "Route by File Type", "Extract XLSX", src_idx=1)
    connect(wf["connections"], "Route by File Type", "Extract CSV", src_idx=2)
    connect(wf["connections"], "Route by File Type", "Extract Text", src_idx=3)

    # All non-PDF extractors feed into the same 'Code in JavaScript4' aggregator
    connect(wf["connections"], "Extract XLSX", "Code in JavaScript4")
    connect(wf["connections"], "Extract CSV", "Code in JavaScript4")
    connect(wf["connections"], "Extract Text", "Code in JavaScript4")

    # 9. Rewire old OWNERS_AGENT path that went through the removed duplicate classifier.
    #    Was: Generate Quotation Email → Classify Request Type → Route by Request Type → Store Owners Agent Email1
    #    Now: Generate Quotation Email → Store Owners Agent Email1
    disconnect(wf["connections"], "Generate Quotation Email", "Classify Request Type")
    connect(wf["connections"], "Generate Quotation Email", "Store Owners Agent Email1")

    # Finally: workflow metadata
    wf["name"] = "Email - PDA - v3.0"
    wf.pop("pinData", None)

    DST.write_text(json.dumps(wf, indent=2, ensure_ascii=False))
    print(f"Wrote {DST}")
    print(f"Nodes: {len(wf['nodes'])} (was {len(src['nodes'])})")
    print(f"Connections entries: {len(wf['connections'])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
