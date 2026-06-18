# KerfSuite PayPal Webhook & Resend Email Guide

This guide contains the instructions, exact code, and prompt to wire up automated CDKey generation and email delivery in your Next.js **KerfPortal** application.

---

## Part 1: Gemini Prompt
If you want **Gemini** to implement this in Android Studio for you, copy and paste the prompt below:

```text
Please create a PayPal webhook/IPN endpoint in my Next.js App Router portal.

1. File to create: src/app/api/webhook/paypal/route.ts
2. Requirements:
   - Accept POST requests from PayPal.
   - Support both Content-Type 'application/json' (for modern PayPal webhooks) and 'application/x-www-form-urlencoded' (for classic PayPal IPN).
   - Authenticate incoming webhook requests using a query parameter secret check: check if searchParams.get('secret') matches process.env.PAYPAL_WEBHOOK_SECRET.
   - On successful payment (Completed/Approved state), look up the buyer's email from the payload.
   - Connect to Supabase using the service role client (@supabase/supabase-js with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) to bypass RLS policies.
   - Check if a workspace exists in public.workspaces. If none exists, create a default workspace named 'SynonTech Workshop'.
   - Generate a unique CDKey in the format: KCT-PRO-XXXX-XXXX (where XXXX are 4-character random hex blocks derived securely via crypto.randomBytes(2)).
   - Insert the key into the public.license_slots table with:
       * workspace_id: <workspaceId>
       * app: 'kerfcut'
       * cdkey: <generatedKey>
       * status: 'waiting'
   - Send the generated key to the customer's email address via the Resend API using a fetch POST request to https://api.resend.com/emails, authenticated by process.env.RESEND_API_KEY.
   - Use the sender address from process.env.RESEND_FROM_EMAIL.
   - Log everything (errors and successes) clearly so it can be easily debugged in server logs.
```

---

## Part 2: Exact Code Implementation

Create the file at `src/app/api/webhook/paypal/route.ts` with the following content:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  console.log('[PayPal Webhook] Received incoming payment notification.');

  // 1. Verify Webhook Secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const expectedSecret = process.env.PAYPAL_WEBHOOK_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    console.error('[PayPal Webhook] Security mismatch: unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let email = '';
    let isCompleted = false;
    let transactionId = '';

    // 2. Parse payload based on format (IPN form or Webhook JSON)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const bodyText = await request.text();
      const params = new URLSearchParams(bodyText);
      
      email = params.get('payer_email') || '';
      const paymentStatus = params.get('payment_status') || '';
      isCompleted = paymentStatus === 'Completed';
      transactionId = params.get('txn_id') || 'N/A';
      
      console.log(`[PayPal Webhook] Parsed IPN payload. Email: ${email}, Status: ${paymentStatus}, TxID: ${transactionId}`);
    } else {
      const body = await request.json();
      
      email = body.resource?.payer?.email_address || 
              body.resource?.payer_email || 
              body.payer?.email_address || 
              body.payer_email || 
              '';
              
      const state = body.resource?.state || body.resource?.status || body.status || '';
      const eventType = body.event_type || '';
      
      isCompleted = 
        state.toLowerCase() === 'completed' || 
        state.toLowerCase() === 'approved' ||
        eventType === 'PAYMENT.SALE.COMPLETED' ||
        eventType === 'CHECKOUT.ORDER.APPROVED';
        
      transactionId = body.resource?.id || body.id || 'N/A';
      
      console.log(`[PayPal Webhook] Parsed JSON payload. Email: ${email}, Event: ${eventType}, State: ${state}, TxID: ${transactionId}`);
    }

    if (!email) {
      console.error('[PayPal Webhook] Error: No email found in payload.');
      return NextResponse.json({ error: 'No payer email found in payload' }, { status: 400 });
    }

    if (!isCompleted) {
      console.log(`[PayPal Webhook] Payment is not in completed/approved state. Ignoring.`);
      return NextResponse.json({ message: 'Notification received, no action required' });
    }

    // 3. Initialize Supabase client with Service Role Key (bypassing RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[PayPal Webhook] Config Error: Supabase credentials missing.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Resolve Workspace ID (Insert into default workspace for V1)
    let workspaceId = '';
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1);

    if (wsError) {
      console.error('[PayPal Webhook] Database error fetching workspaces:', wsError);
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 });
    }

    if (workspaces && workspaces.length > 0) {
      workspaceId = workspaces[0].id;
    } else {
      console.log('[PayPal Webhook] No workspace found. Creating default workspace...');
      const { data: newWs, error: createWsError } = await supabase
        .from('workspaces')
        .insert({ name: 'SynonTech Workshop' })
        .select('id')
        .single();

      if (createWsError) {
        console.error('[PayPal Webhook] Database error creating default workspace:', createWsError);
        return NextResponse.json({ error: 'Database creation failure' }, { status: 500 });
      }
      workspaceId = newWs.id;
    }

    // 5. Generate Secure CDKey (Format: KCT-PRO-XXXX-XXXX)
    const generateSegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const cdkey = `KCT-PRO-${generateSegment()}-${generateSegment()}`;

    console.log(`[PayPal Webhook] Assigning generated key ${cdkey} to workspace ${workspaceId}...`);

    // 6. Save key to Database
    const { error: insertError } = await supabase
      .from('license_slots')
      .insert({
        workspace_id: workspaceId,
        app: 'kerfcut',
        cdkey: cdkey,
        status: 'waiting'
      });

    if (insertError) {
      console.error('[PayPal Webhook] Database error inserting license key:', insertError);
      return NextResponse.json({ error: 'Database insert failure' }, { status: 500 });
    }

    console.log(`[PayPal Webhook] Key stored successfully. Queueing Resend email delivery...`);

    // 7. Dispatch Email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'licensing@synontech.com';

    if (!resendApiKey) {
      console.error('[PayPal Webhook] Configuration Warning: RESEND_API_KEY is not set. CDKey generated but email not sent.');
      return NextResponse.json({ 
        message: 'CDKey generated, but email delivery was skipped (api key missing)',
        cdkey: cdkey 
      });
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #FF6600; padding-bottom: 20px; margin-bottom: 25px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px; letter-spacing: 1px;">KERFSUITE // LICENSE ACTIVATION</h1>
        </div>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Thank you for purchasing <strong>KerfSuite</strong>!</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">Your professional workspace license key is generated and ready to bind:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px dashed #cbd5e1; font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #FF6600; margin: 25px 0; text-align: center;">
          ${cdkey}
        </div>
        
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
          <h3 style="color: #b45309; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">Activation Instructions:</h3>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #78350f; line-height: 1.5;">
            <li>Download the application build from <a href="https://github.com/synontechsa-hub/KerfSuite/releases" style="color: #FF6600; text-decoration: underline;">GitHub Releases</a>.</li>
            <li>Launch the desktop app on your target workshop computer.</li>
            <li>Select "Activate License" on launch.</li>
            <li>Paste your CDKey into the field to bind the hardware slot.</li>
          </ol>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          This is an automated transaction email. If you did not receive your key, or need support binding your hardware, please contact support at synontech.sa@gmail.com.
        </p>
      </div>
    `;

    const mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Your KerfSuite License Key',
        html: emailHtml
      })
    });

    if (!mailResponse.ok) {
      const errorData = await mailResponse.text();
      console.error('[PayPal Webhook] Error sending email via Resend:', errorData);
      return NextResponse.json({ 
        error: 'License saved but email dispatch failed', 
        cdkey: cdkey 
      }, { status: 502 });
    }

    console.log(`[PayPal Webhook] Key generated and successfully sent to ${email}.`);
    return NextResponse.json({ 
      success: true, 
      message: 'License created and dispatched via email' 
    });

  } catch (error: any) {
    console.error('[PayPal Webhook] Crash occurred in route handler:', error);
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}
```

---

## Part 3: Environment Variables Setup

Configure the following parameters in your **KerfPortal** `.env.local` configuration file:

```bash
# 1. Supabase Service Role Key (Needed to insert to tables bypassing RLS)
# In Supabase dashboard: Project Settings -> API -> service_role (secret)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 2. Webhook Token Security
# Make up a random alphanumeric secret string.
# Example webhook URL to register in PayPal: https://your-portal.vercel.app/api/webhook/paypal?secret=YOUR_TOKEN_HERE
PAYPAL_WEBHOOK_SECRET=your_made_up_secure_token

# 3. Resend Integration API Key
RESEND_API_KEY=re_your_resend_api_key

# 4. Verified Sender Email in Resend
# E.g. licensing@synontech.com or standard verified sender.
RESEND_FROM_EMAIL=licensing@synontech.com
```
