import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"

def test_interview_flow():
    print("=== Starting Backend Verification ===")
    
    # 1. Start Interview
    print("\n[1] Testing /api/start...")
    payload = {
        "jd": "Python Backend Engineer",
        "experience": "5 years with Flask and Django"
    }
    try:
        response = requests.post(f"{BASE_URL}/api/start", json=payload)
        response.raise_for_status()
        data = response.json()
        session_id = data.get("session_id")
        intro = data.get("intro")
        first_question = data.get("question")
        
        if session_id and intro and first_question:
            print(f"✅ Interview Started. Session ID: {session_id}")
            print(f"   Intro: {intro}")
            print(f"   Question: {first_question}")
            if data.get("audio"):
                print("✅ Audio received in Start response.")
            else:
                print("❌ No Audio in Start response.")
        else:
            print("❌ Failed to start interview correctly.")
            return
    except Exception as e:
        print(f"❌ Error starting interview: {e}")
        return

    # 2. Submit Answer
    print("\n[2] Testing /api/answer...")
    answer_payload = {
        "session_id": session_id,
        "answer": "I have used Flask for building REST APIs and managing database migrations with Alembic."
    }
    try:
        response = requests.post(f"{BASE_URL}/api/answer", json=answer_payload)
        response.raise_for_status()
        data = response.json()
        feedback = data.get("feedback")
        next_q = data.get("next_question")
        decision = data.get("decision")
        
        if feedback and decision:
            print(f"✅ Answer Accepted.")
            print(f"   Feedback: {feedback}")
            print(f"   Next Question: {next_q}")
            print(f"   Decision: {decision}")
            if data.get("audio"):
                print("✅ Audio received in Answer response.")
            else:
                print("❌ No Audio in Answer response.")
        else:
            print("❌ Failed to process answer.")
    except Exception as e:
        print(f"❌ Error submitting answer: {e}")

    # 3. Test Cheat Strike
    print("\n[3] Testing /api/cheat_strike...")
    cheat_payload = {"session_id": session_id}
    try:
        # Strike 1
        r1 = requests.post(f"{BASE_URL}/api/cheat_strike", json=cheat_payload)
        print(f"   Strike 1: {r1.json().get('message')}")
        
        # Strike 2
        r2 = requests.post(f"{BASE_URL}/api/cheat_strike", json=cheat_payload)
        print(f"   Strike 2: {r2.json().get('message')}")
        
        # Strike 3 (Termination)
        r3 = requests.post(f"{BASE_URL}/api/cheat_strike", json=cheat_payload)
        print(f"   Strike 3: {r3.json().get('message')}")
        
        if r3.json().get("status") == "terminated":
            print("✅ Cheat detection termination works.")
        else:
            print("❌ Cheat detection termination failed.")
            
    except Exception as e:
        print(f"❌ Error in cheat strike: {e}")

    # 4. Generate Report
    print("\n[4] Testing /api/report...")
    report_payload = {"session_id": session_id}
    try:
        response = requests.post(f"{BASE_URL}/api/report", json=report_payload)
        response.raise_for_status()
        data = response.json()
        report = data.get("report")
        
        if report and len(report) > 10:
            print("✅ Report Generated Successfully.")
            print("   (Report content length verification passed)")
        else:
            print("❌ Failed to generate report.")
    except Exception as e:
        print(f"❌ Error generating report: {e}")

    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    test_interview_flow()
