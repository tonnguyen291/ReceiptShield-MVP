// AI assistant flow - calls API route
export const assistantFlow = null;

// AI Assistant function that calls the API route
export const runAssistant = async (
  message: string, 
  receiptHistory?: string
): Promise<{
  response: string;
  error: string | null;
  suggestUpload: boolean;
}> => {
  try {
    const response = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        receiptHistory
      }),
    });

    if (!response.ok) {
      // Handle rate limiting with a more specific error
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'RATE_LIMIT_EXCEEDED');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Assistant error:', error);
    
    // Provide user-friendly error messages based on error type
    let errorMessage = "I'm sorry, I encountered an error processing your request. Please try again later, or contact support if the issue persists.";
    
    if (error instanceof Error) {
      if (error.message === 'RATE_LIMIT_EXCEEDED' || error.message.includes('429')) {
        errorMessage = "I'm currently experiencing high demand. Please wait a moment and try again in a few seconds. Rate limits help ensure fair access for all users.";
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = "I'm sorry, there's an authentication issue with the AI service. Please contact support.";
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
      }
    }
    
    return {
      response: errorMessage,
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestUpload: false
    };
  }
};
