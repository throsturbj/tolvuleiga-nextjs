import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    console.log('=== EMAIL API CALLED ===');
    const body = await request.json();
    const { product, customerInfo, productId, productTitle, productPrice, userProfile, message, accessToken, authUid } = body || {};
    console.log('Incoming body keys:', Object.keys(body || {}));

    // Normalize product/customer fields from either shape
    const normalizedProduct = {
      title: product?.title || productTitle || productId || 'Óþekkt vara',
      beds: product?.beds || '',
      baths: product?.baths || '',
      sqft: product?.sqft || '',
      price: product?.price || productPrice || '',
    };

    const normalizedCustomer = {
      name: customerInfo?.name || userProfile?.full_name || 'Óþekkt nafn',
      email: customerInfo?.email || '',
      phone: customerInfo?.phone || userProfile?.phone || '',
      address: userProfile?.address || '',
      city: userProfile?.city || '',
      postal_code: userProfile?.postal_code || '',
      message: customerInfo?.message || message || '',
    };
    console.log('Normalized product:', normalizedProduct);
    console.log('Normalized customer:', normalizedCustomer);

    const emailUser = "tolvuleiga@gmail.com";
    const emailPass = "sksk wzoi vssc laqd"; // App Password

    console.log('Email User:', emailUser);
    console.log('Email Pass (first 4 chars):', emailPass.substring(0, 4) + '****');
    console.log('Email Pass length:', emailPass.length);

    if (!emailUser || !emailPass) {
      console.error('Missing Gmail credentials');
      return NextResponse.json(
        { success: false, message: 'Email configuration missing.' },
        { status: 500 }
      );
    }

    console.log('Email credentials found, creating transporter...');

    // Configure Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    console.log('Transporter created, verifying connection...');
    
    // Verify connection configuration
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError);
      throw new Error(`SMTP verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
    }

    const text = `
Ný pöntun fyrir tölvuleigu:

Vara: ${normalizedProduct.title}
${normalizedProduct.beds ? `Skjákort: ${normalizedProduct.beds}\n` : ''}${normalizedProduct.baths ? `Örgjörvi: ${normalizedProduct.baths}\n` : ''}${normalizedProduct.sqft ? `Geymsla: ${normalizedProduct.sqft}\n` : ''}${normalizedProduct.price ? `Verð: ${normalizedProduct.price}/mánuði\n` : ''}

Viðskiptavinur:
Nafn: ${normalizedCustomer.name}
${normalizedCustomer.email ? `Netfang: ${normalizedCustomer.email}\n` : ''}${normalizedCustomer.phone ? `Sími: ${normalizedCustomer.phone}\n` : ''}${normalizedCustomer.address ? `Heimilisfang: ${normalizedCustomer.address}\n` : ''}${normalizedCustomer.city || normalizedCustomer.postal_code ? `Borg/Póstnúmer: ${normalizedCustomer.city} ${normalizedCustomer.postal_code}\n` : ''}

Skilaboð:
${normalizedCustomer.message || 'Engin skilaboð'}

---
Þessi pöntun var send frá vefsíðunni.
`;

    console.log('Sending email...');
    const emailResult = await transporter.sendMail({
      from: `"Tölvuleiga" <${emailUser}>`,
      to: 'tolvuleiga@gmail.com',
      subject: `Pöntun fyrir ${normalizedProduct.title}`,
      text,
      html: text.replace(/\n/g, '<br>'),
    });

    console.log('Email sent successfully:', emailResult.messageId);

    // Insert order row via REST using user's access token so RLS passes
    try {
      if (authUid && accessToken) {
        const insertRes = await fetch('https://aowkzhwmazgsuxuyfhgb.supabase.co/rest/v1/orders', {
          method: 'POST',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ auth_uid: authUid, status: 'Undirbúningur' })
        });
        if (!insertRes.ok) {
          const t = await insertRes.text();
          console.error('Insert order failed:', insertRes.status, t);
        } else {
          console.log('Order row inserted');
        }
      } else {
        console.log('Skipping DB insert: missing auth uid or access token');
      }
    } catch (dbErr) {
      console.error('Unexpected error inserting order row:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Pöntun hefur verið send! Við höfum sent tölvupóst á tolvuleiga@tolvuleiga.is.',
    });
  } catch (error) {
    console.error('Error sending Gmail order:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { 
        success: false, 
        message: 'Villa kom upp við að senda tölvupóst.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
