import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const TEMPLATE_PATH = path.join(process.cwd(), 'skills', 'contract-generator', 'templates', 'contract_template.md');
const OUTPUT_DIR = path.join(process.cwd(), 'skills', 'contract-generator', 'output');

const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20241022',
  opus: 'claude-opus-4-5-20250514',
  haiku: 'claude-haiku-4-5-20241022',
};

const REQUIRED_FIELDS = ['client_name', 'service_description'];

const EXTRACTION_PROMPT = `You are a contract data extractor. From the given text, extract the following fields as JSON. Return ONLY valid JSON, no markdown code blocks.

Fields to extract:
- contract_number: string (contract/agreement number)
- city: string (city where contract is signed)
- contract_date: string (date of contract)
- document_type: string (type: contract, agreement, etc.)
- document_subtitle: string (subtitle/description)
- company_name: string (service provider company)
- representative_name: string (company representative)
- basis: string (legal basis, e.g., "Charter")
- client_name: string (client person name)
- client_company_name: string (client company name)
- client_company_id: string (client company ID/TIN)
- client_address: string (client address)
- client_director: string (client director/CEO name)
- client_phone: string (client phone)
- client_email: string (client email)
- executor_company_name: string (executor company, default: "DeliverySetup LLC")
- executor_company_id: string (executor ID)
- executor_address: string (executor address)
- executor_representative: string (executor representative)
- executor_phone: string
- executor_email: string
- service_description: string (what services are provided)
- price: string (total price)
- currency: string (GEL, USD, EUR, or RUB)
- setup_price: string (one-time setup fee)
- monthly_price: string (recurring monthly fee)
- advance_payment: string (advance/prepayment amount)
- current_revenue: string (client's current revenue)
- current_orders: string (client's current order count)
- orders_dynamic: string (order growth trend)
- average_check: string (average order value)
- check_dynamic: string (check growth trend)
- conversion_rate: string (conversion rate)
- cancelled_orders: string (cancelled orders count)
- cancelled_revenue: string (cancelled orders revenue)
- contract_duration: string (contract term)
- current_year: string (current year)

Text to extract from:
`;

interface ExtractedFields {
  [key: string]: string | undefined;
}

async function extractFields(inputText: string, model: string): Promise<{ fields: ExtractedFields; missingFields: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured in .env.local');

  const client = new Anthropic({ apiKey });
  const modelId = MODEL_MAP[model] || MODEL_MAP.sonnet;

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    messages: [{ role: 'user', content: EXTRACTION_PROMPT + inputText }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response
  let fields: ExtractedFields = {};
  try {
    // Try direct parse
    fields = JSON.parse(text);
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      fields = JSON.parse(jsonMatch[1].trim());
    } else {
      // Try finding JSON object in text
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) {
        fields = JSON.parse(objMatch[0]);
      }
    }
  }

  // Normalize currency
  if (fields.currency) {
    const curr = fields.currency.toUpperCase();
    if (!['GEL', 'USD', 'EUR', 'RUB'].includes(curr)) {
      fields.currency = 'GEL';
    } else {
      fields.currency = curr;
    }
  }

  // Set defaults
  fields.current_year = fields.current_year || new Date().getFullYear().toString();
  fields.executor_company_name = fields.executor_company_name || 'DeliverySetup LLC';

  // Check missing required fields
  const missingFields = REQUIRED_FIELDS.filter(f => !fields[f]);

  return { fields, missingFields };
}

function renderTemplate(fields: ExtractedFields): string {
  let template: string;
  if (fs.existsSync(TEMPLATE_PATH)) {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } else {
    template = getDefaultTemplate();
  }

  // Replace all {{field_name}} placeholders
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return fields[key] || match;
  });
}

function getDefaultTemplate(): string {
  return `# {{document_type}}

**{{document_subtitle}}**

**Contract #{{contract_number}}**

**City:** {{city}}
**Date:** {{contract_date}}

---

## Parties

**Service Provider:** {{executor_company_name}} (ID: {{executor_company_id}})
- Address: {{executor_address}}
- Representative: {{executor_representative}}
- Phone: {{executor_phone}}
- Email: {{executor_email}}

**Client:** {{client_company_name}} (ID: {{client_company_id}})
- Director: {{client_director}}
- Address: {{client_address}}
- Phone: {{client_phone}}
- Email: {{client_email}}

---

## Service Description

{{service_description}}

## Pricing

| Item | Amount |
|------|--------|
| Setup Fee | {{setup_price}} {{currency}} |
| Monthly Fee | {{monthly_price}} {{currency}} |
| Advance Payment | {{advance_payment}} {{currency}} |

## Current Metrics

| Metric | Value |
|--------|-------|
| Revenue | {{current_revenue}} |
| Orders | {{current_orders}} |
| Average Check | {{average_check}} |
| Conversion Rate | {{conversion_rate}} |

## Terms

- Duration: {{contract_duration}}
- Year: {{current_year}}

---

**{{executor_company_name}}** | **{{client_company_name}}**

___________________________ | ___________________________

{{executor_representative}} | {{client_director}}
`;
}

export async function execute(params: any) {
  const { action = 'preview', inputText, model = 'sonnet', outputFormat = 'markdown', overrideFields } = params;

  if (!inputText || inputText.length < 10) {
    throw new Error('Please provide contract text (minimum 10 characters)');
  }

  // Extract fields using AI
  const { fields, missingFields } = await extractFields(inputText, model);

  // Apply overrides
  if (overrideFields) {
    try {
      const overrides = typeof overrideFields === 'string' ? JSON.parse(overrideFields) : overrideFields;
      Object.assign(fields, overrides);
    } catch {
      // Ignore invalid JSON overrides
    }
  }

  // Preview mode: return extracted fields
  if (action === 'preview') {
    return {
      status: missingFields.length === 0 ? 'complete' : 'partial',
      extractedFields: fields,
      missingFields,
      validation: {
        isValid: missingFields.length === 0,
        missingRequired: missingFields,
        warnings: !fields.setup_price && !fields.monthly_price ? ['No pricing information found'] : [],
      },
      model,
    };
  }

  // Generate mode
  const rendered = renderTemplate(fields);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results: any = {
    status: missingFields.length === 0 ? 'success' : 'partial',
    extractedFields: fields,
    missingFields,
    model,
  };

  // Save markdown
  if (outputFormat === 'markdown' || outputFormat === 'both') {
    const mdPath = path.join(OUTPUT_DIR, `contract_${timestamp}.md`);
    fs.writeFileSync(mdPath, rendered);
    results.markdownPath = mdPath;
    results.markdownContent = rendered;
  }

  // Save as simple HTML for PDF-like output
  if (outputFormat === 'pdf' || outputFormat === 'both') {
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
  h1 { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td, th { border: 1px solid #ccc; padding: 8px; text-align: left; }
  hr { margin: 24px 0; }
</style></head><body>${rendered.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/\n/g, '<br>')}</body></html>`;
    const htmlPath = path.join(OUTPUT_DIR, `contract_${timestamp}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
    results.pdfPath = htmlPath;
    results.message = 'HTML contract generated (open in browser to print as PDF)';
  }

  return results;
}
