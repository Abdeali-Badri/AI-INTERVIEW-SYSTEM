from dotenv import load_dotenv
from interview_logic import (
    interviewer_agent,
    listen_to_user,
    speak_text,
    extract_text
)

load_dotenv()

def run_interview():
    """Run the AI interview loop with full voice interaction"""
    print("\n" + "=" * 60)
    print("ML INTERVIEW SYSTEM - Voice Enabled")
    print("=" * 60)
    print("Starting interview...\n")
    

    init_prompt = (
        "CONTEXT: Candidate has 3 years of machine learning experience. "
    "Skills: Python, NumPy, pandas, PyTorch, scikit-learn, NLP (transformers), model training/evaluation, and basic MLOps (Docker, REST deployment). "
    "Role: Mid-level ML Engineer. "
    "Focus on practical system design, model debugging, and trade-offs.\\n"
    "Start a professional ML interview. Respond with exactly two labeled lines:\\n"
    "INTRO: <one-line introduction to the candidate>\\n"
    "QUESTION: <short, one-line technical question about machine learning or data science>"
    )
    interviewer_response = interviewer_agent.run(init_prompt)
    first_response = extract_text(interviewer_response)

    
    def parse_response(resp):
        parts = {"intro": "", "feedback": "", "decision": "", "question": ""}
        for line in resp.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.upper().startswith("INTRO:"):
                parts["intro"] = line.split(":", 1)[1].strip()
            elif line.upper().startswith("FEEDBACK:"):
                parts["feedback"] = line.split(":", 1)[1].strip()
            elif line.upper().startswith("DECISION:"):
                parts["decision"] = line.split(":", 1)[1].strip().upper()
            elif line.upper().startswith("QUESTION:"):
                parts["question"] = line.split(":", 1)[1].strip()
        return parts

    parsed = parse_response(first_response)
    first_intro = parsed.get("intro", "")
    first_question = parsed.get("question", "")

    if first_intro:
        print(f"{first_intro}\n")
        try:
            speak_text(first_intro, play=True)
        except Exception as e:
            print(f"[Audio playback error: {e}]")
            print("Continuing without audio...\n")

    if first_question:
        print(f"AI: {first_question}\n")
        try:
            speak_text(first_question, play=True)
        except Exception as e:
            print(f"[Audio playback error: {e}]")
            print("Continuing without audio...\n")
    else:
        print("AI did not return a question. Exiting.")
        return
    
    interview_active = True
    question_count = 0
    max_questions = 50  
    
    while interview_active:
       
        print("-" * 60)
        attempts = 0
        user_answer = None
        while attempts < 3:
            user_answer = listen_to_user(timeout=30, silence_duration=5)
            if user_answer is None:
               
                try:
                    speak_text("I didn't hear you. Please speak louder.", play=True)
                except Exception:
                    pass
                attempts += 1
                continue
            if not user_answer.strip():
                
                try:
                    speak_text("I couldn't understand you. Please repeat clearly.", play=True)
                except Exception:
                    pass
                attempts += 1
                continue
            break

        if attempts >= 3 and (user_answer is None or not user_answer.strip()):
            try:
                speak_text("No valid response detected. Moving to the next question.", play=True)
            except Exception:
                pass
            user_answer = "[NO_RESPONSE]"
        
        question_count += 1
        print(f"[Question #{question_count} answered]\n")

       
        if question_count >= max_questions:
            try:
                speak_text(f"Reached maximum of {max_questions} questions. Ending interview.", play=True)
            except Exception:
                pass
            print(f"Reached maximum of {max_questions} questions. Interview ended by limit.\n")
            break
        
        
        feedback_prompt = f"""
        The candidate answered: "{user_answer}"
        
        Please:
        1. Evaluate their answer
        2. Provide constructive feedback
        3. Ask the next question or ask a follow-up if needed
        4. If you have gathered sufficient information from 3-5 questions, end with [INTERVIEW_COMPLETE]
        """
        
        interviewer_response = interviewer_agent.run(feedback_prompt)
        ai_response = extract_text(interviewer_response)

        parsed = parse_response(ai_response)
        feedback = parsed.get("feedback", "")
        decision = parsed.get("decision", "")
        next_question = parsed.get("question", "")

        if feedback:
            print(f"Feedback: {feedback}\n")
            try:
               
                speak_text(feedback, play=True)
            except Exception as e:
                print(f"[Audio playback error: {e}]")

        if decision == "INTERVIEW_COMPLETE":
            interview_active = False
            print("\n" + "=" * 60)
            print(f"✓ INTERVIEW COMPLETE!")
            print(f"Total questions asked: {question_count}")
            print("=" * 60 + "\n")
            break

        
        if next_question:
            print(f"AI: {next_question}\n")
            try:
                speak_text(next_question, play=True)
            except Exception as e:
                print(f"[Audio playback error: {e}]")
        else:
            print("No next question provided by interviewer. Ending interview.\n")
            interview_active = False
            break

if __name__ == "__main__":
    run_interview()
