export class ResponseValidator {
    static validateTweetResponse(response: string): boolean {
      return (
        response.length >= 50 &&
        response.length <= 180 &&
        !response.includes("I cannot engage") &&
        !response.includes("I apologize") &&
        !response.includes("I'm happy to have") &&
        !response.includes("ethical bounds") &&
        !response.includes("respectful conversation")
      );
    }
  
    static cleanResponse(response: string): string {
      return response
        .replace(/#/g, '')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/[\u2600-\u27BF]/g, '')
        .replace(/[\uE000-\uF8FF]/g, '')
        .replace(/\[(\w+)_state\]$/, '')
        .replace(/\[.*?\]/g, '')
        .trim();
    }
  }