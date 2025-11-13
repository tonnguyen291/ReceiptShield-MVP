import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Assistant API Route
 * Uses Google Gemini to provide conversational assistance
 */
export async function POST(request: NextRequest) {
  try {
    const { message, receiptHistory } = await request.json();
    console.log('🤖 AI Assistant Request received');

    const apiKey = process.env.GOOGLE_AI_API_KEY || 
                   process.env.GEMINI_API_KEY ||
                   process.env.GOOGLE_API_KEY;
    
    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
      console.warn('⚠️ Google AI API key not configured');
      return NextResponse.json({
        response: "I apologize, but the AI assistant is currently unavailable. Please configure the Google AI API key (GOOGLE_AI_API_KEY) in your environment variables to enable AI assistance.",
        error: 'API_KEY_NOT_CONFIGURED',
        suggestUpload: false
      });
    }

    // Build context-aware prompt
    let prompt = `You are a helpful AI assistant for ReceiptShield, an expense management and fraud detection platform. Your role is to assist users with questions about their expenses, receipts, and financial management.

User's Question: ${message}

${receiptHistory ? `\nUser's Receipt History Context:\n${receiptHistory}\n` : ''}

Please provide a helpful, concise, and professional response. If the user asks about uploading receipts, suggest they can do so. If they ask about expenses or receipts, refer to their history if available. Be friendly, accurate, and helpful.

Keep your response to 2-3 sentences unless the user asks for more detail.`;

    // Use Gemini API
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      }
    };

    console.log('🔍 Calling Google Gemini API for assistant...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Gemini API error:', response.status, errorData);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        return NextResponse.json({
          response: "I'm currently experiencing high demand. Please wait a moment and try again in a few seconds. Rate limits help ensure fair access for all users.",
          error: 'RATE_LIMIT_EXCEEDED',
          suggestUpload: false
        }, { status: 429 });
      }
      
      // Handle other API errors
      return NextResponse.json({
        response: response.status === 401 || response.status === 403
          ? "I'm sorry, there's an authentication issue with the AI service. Please contact support."
          : "I'm sorry, I encountered an error processing your request. Please try again later.",
        error: `Gemini API error: ${response.status}`,
        suggestUpload: false
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return NextResponse.json({
        response: "I'm sorry, I received an invalid response from the AI service. Please try again.",
        error: 'Invalid response from Gemini API',
        suggestUpload: false
      }, { status: 500 });
    }

    const assistantResponse = data.candidates[0].content.parts[0].text;
    
    // Determine if we should suggest uploading
    const suggestUpload = message.toLowerCase().includes('upload') || 
                          message.toLowerCase().includes('receipt') ||
                          message.toLowerCase().includes('submit') ||
                          message.toLowerCase().includes('add expense');

    console.log('✅ Assistant response generated');
    
    return NextResponse.json({
      response: assistantResponse,
      error: null,
      suggestUpload
    });

  } catch (error) {
    console.error('❌ Assistant error:', error);
    return NextResponse.json({
      response: "I'm sorry, I encountered an error processing your request. Please try again later, or contact support if the issue persists.",
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestUpload: false
    }, { status: 500 });
  }
}

