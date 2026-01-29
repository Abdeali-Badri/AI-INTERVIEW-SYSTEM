import requests
import json

# Test complete interview flow and report generation
def test_complete_interview():
    print("Testing complete interview flow...")
    
    try:
        # Start interview
        start_response = requests.post("http://localhost:5000/api/start", json={
            "jd": "Software Engineer",
            "experience": "3 years",
            "questionCount": 3
        })
        
        if start_response.status_code != 200:
            print(f"Failed to start interview: {start_response.status_code}")
            return
        
        start_data = start_response.json()
        session_id = start_data.get('session_id')
        print(f"Interview started: {session_id}")
        print(f"Question 1: {start_data.get('question', 'N/A')[:50]}...")
        
        # Submit answers
        answers = [
            "I have 3 years of experience in software development, working with Python and JavaScript.",
            "I'm proficient in full-stack development, including React, Node.js, and database design.",
            "I have experience with agile methodologies and team collaboration."
        ]
        
        for i, answer in enumerate(answers, 1):
            print(f"Submitting answer {i}...")
            
            answer_response = requests.post("http://localhost:5000/api/answer", json={
                "session_id": session_id,
                "answer": answer
            })
            
            if answer_response.status_code != 200:
                print(f"Failed to submit answer {i}: {answer_response.status_code}")
                print(f"Response: {answer_response.text}")
                return
            
            answer_data = answer_response.json()
            print(f"Answer {i} submitted")
            print(f"Feedback: {answer_data.get('feedback', 'N/A')[:50]}...")
            
            if answer_data.get('decision') == 'INTERVIEW_COMPLETE':
                print("Interview completed!")
                break
            else:
                print(f"Next question: {answer_data.get('next_question', 'N/A')[:50]}...")
        
        # Generate report
        print("Generating report...")
        
        report_response = requests.post("http://localhost:5000/api/report", json={
            "session_id": session_id
        })
        
        if report_response.status_code != 200:
            print(f"Failed to generate report: {report_response.status_code}")
            print(f"Response: {report_response.text}")
            return
        
        report_data = report_response.json()
        
        if report_data.get('success'):
            print("Report generated successfully!")
            print(f"Report type: {'PDF' if report_data.get('pdf_base64') else 'Text'}")
            print(f"Job: {report_data.get('job_description', 'N/A')}")
            print(f"Experience: {report_data.get('experience', 'N/A')}")
            print(f"Transcript length: {len(report_data.get('transcript', []))} entries")
            print(f"Strikes: {report_data.get('strikes', 0)}")
            
            if report_data.get('pdf_base64'):
                print("PDF report ready for download")
            else:
                print("Text report ready for download")
                
        else:
            print(f"Report generation failed: {report_data.get('error', 'Unknown error')}")
        
        return report_data.get('success', False)
        
    except Exception as e:
        print(f"Test failed: {e}")
        return False

if __name__ == "__main__":
    test_complete_interview()
