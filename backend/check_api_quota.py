import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

def check_api_quota():
    """Check Gemini API quota and status"""
    
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        print("No GEMINI_API_KEY found in .env file")
        return
    
    print("Checking Gemini API quota...")
    print(f"API Key: {api_key[:10]}...{api_key[-10:]}")
    
    try:
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Test with gemini-2.5-flash
        print("\nTesting gemini-2.5-flash...")
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Simple test prompt
        response = model.generate_content("Hello")
        
        print("gemini-2.5-flash is working")
        print(f"Response: {response.text[:100]}...")
        
        # Check model info
        print(f"\nModel: {model.model_name}")
        print("API quota is available")
        
    except Exception as e:
        error_str = str(e).lower()
        
        if "quota" in error_str or "limit" in error_str:
            print("API QUOTA EXHAUSTED")
            print("To check quota: https://ai.google.dev/billing")
            print("Solution: Add billing or wait for quota reset")
        elif "permission" in error_str or "forbidden" in error_str or "invalid" in error_str:
            print("INVALID API KEY")
            print("To get new key: https://makersuite.google.com/app/apikey")
            print("Solution: Update .env file with new API key")
        else:
            print(f"API ERROR: {e}")
            print("Check internet connection and API key")

def check_interview_api():
    """Test the interview API endpoint"""
    
    print("\nTesting Interview API...")
    
    try:
        import requests
        
        response = requests.post("http://localhost:5000/api/start", json={
            "jd": "Software Engineer",
            "experience": "3 years",
            "questionCount": 1
        }, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print("Interview API working")
            print(f"Session ID: {result.get('session_id', 'N/A')}")
            print(f"Question: {result.get('question', 'N/A')[:100]}...")
        else:
            print(f"Interview API error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Interview API test failed: {e}")

if __name__ == "__main__":
    print("Gemini API Quota Checker")
    print("=" * 50)
    
    check_api_quota()
    check_interview_api()
    
    print("\n" + "=" * 50)
    print("Summary:")
    print("If API works: Interview should work")
    print("If quota exhausted: Update billing or API key")
    print("Billing: https://ai.google.dev/billing")
    print("API Keys: https://makersuite.google.com/app/apikey")
