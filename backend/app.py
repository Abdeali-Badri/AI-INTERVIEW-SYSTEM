from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from interview_logic import interviewer_agent, extract_text, report_agent, speak_text, generate_pdf_report
from face_detection import face_detector
from tts_manager import speak_intro, speak_question, start_answer_recording, stop_answer_recording
from dotenv import load_dotenv
import uuid
import os
import time
import re
import random
import base64

load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="/")
CORS(app)

@app.route("/")
def home():
    """
    Serve the home page
    """
    return send_from_directory("static", "home.html")

@app.route("/interview")
def interview_page():
    """
    Serve the interview page
    """
    return send_from_directory("static", "interview.html")

@app.route("/report")
def report_page():
    """
    Serve the report page
    """
    return send_from_directory("static", "report.html")


@app.route("/api/health")
def health_check():
    """
    Health check endpoint
    """
    return jsonify({
        "status": "healthy",
        "backend": "running",
        "gemini": "configured",
        "gtts": "configured",
        "timestamp": time.time()
    })


sessions = {}

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

@app.route('/api/start', methods=['POST'])
def start_interview():
    data = request.json
    jd = data.get('jd', 'General Software Engineering')
    experience = data.get('experience', 'Not specified')
    question_count = data.get('questionCount', 5)
    experience_text = str(experience)
    
    
    def extract_years(text):
        try:
            text = text.lower()
            matches = re.findall(r'(\d+)\s*(?:\+?\s*)?(?:years?|yrs?|y)', text)
            if matches:
                years = int(matches[0])
                print(f"DEBUG: Extracted {years} years from: {text}")
                return years
            
            if any(word in text for word in ['no experience', 'fresher', 'entry level', 'fresh graduate', 'beginner']):
                print(f"DEBUG: Detected no experience from: {text}")
                return 0
                
            print(f"DEBUG: Could not extract years from: {text}")
            return None
        except Exception as e:
            print(f"ERROR extracting years: {e}")
            return None
    
    years = extract_years(experience_text)
    if years is None:
        candidate_level = "UNKNOWN"
    elif years >= 5:
        candidate_level = "SENIOR"
    elif years >= 3:
        candidate_level = "MID"
    elif years >= 1:
        candidate_level = "JUNIOR"
    else:
        candidate_level = "JUNIOR"  # 0 years or fresher
    
    print(f"DEBUG: Experience input: '{experience_text}'")
    print(f"DEBUG: Extracted years: {years}")
    print(f"DEBUG: Candidate level: {candidate_level}")
    
    # Test the extraction function
    test_cases = [
        "2 years of experience",
        "no experience", 
        "5+ years",
        "fresher",
        "3 years experience in autocad",
        "entry level"
    ]
    
    print("DEBUG: Testing experience extraction:")
    for test in test_cases:
        test_years = extract_years(test)
        print(f"  '{test}' -> {test_years} years")
    
    session_id = str(uuid.uuid4())
    
    def fallback_intro_question(jd_text: str, level: str):
        intro = "Welcome to the interview."
        
        if level == "SENIOR":
            q = f"Describe a complex architecture decision you made for {jd_text} and the trade-offs involved."
        elif level == "MID":
            q = f"Walk me through a challenging {jd_text} project you worked on and how you solved it."
        elif level == "JUNIOR":
            q = f"Tell me about your understanding of {jd_text} and any projects you've worked on."
        else:
            q = f"What experience do you have with {jd_text}?"
            
        print(f"DEBUG: Fallback question for {level}: {q}")
        return intro, q
    
    init_prompt = (
        "You are an experienced interviewer. "
        f"Job Description: {jd}. "
        f"Candidate Profile / Experience (raw text): {experience_text}. "
        f"Inferred Candidate Level: {candidate_level}. "
        "Strictly calibrate depth to this level. "
        "Hard rule for SENIOR or MID: do NOT ask textbook definition questions (e.g., 'difference between supervised vs unsupervised'). "
        "Prefer scenario-based, architecture, trade-offs, debugging, performance, and deployment questions aligned to the JD. "
        "For JUNIOR, fundamentals are acceptable but keep them practical.\n"
        "Start a professional interview. This is question 1 of {question_count}. Start with easier questions and progressively increase difficulty. "
        "Respond with exactly two labeled lines:\n"
        "INTRO: <one-line introduction to the candidate>\n"
        "QUESTION: <short, one-line technical question that matches the JD and inferred level>"
    )
    
    try:
        print(f"DEBUG: Calling interviewer agent with prompt: {init_prompt[:200]}...")
        interviewer_response = interviewer_agent(init_prompt)
        text_response = interviewer_response
        print(f"DEBUG: FULL RAW Agent response: {repr(text_response)}")
        
        # Check for empty response (likely due to swallowed exception like 429)
        if not text_response or not str(text_response).strip() or text_response == "None":
            print("DEBUG: Empty response from agent - likely an API error (Quota/RateLimit)")
            return jsonify({
                "error": "Gemini API failed to return a response. This usually means your Gemini Usage Quota is exceeded (429) or the service is overloaded. Please check your billing at ai.google.dev/billing.",
                "intro": "Error: Gemini Quota Exceeded",
                "question": "Error: Gemini Quota Exceeded",
                "audio": None
            }), 500

        parsed = parse_response(text_response)
        print(f"DEBUG: Parsed response: {parsed}")
        
        # Validate Gemini response
        if not parsed.get("intro") or not parsed.get("question"):
            print("DEBUG: Invalid Gemini response for interview start - missing parts")
            print(f"DEBUG: Intro found: {bool(parsed.get('intro'))}, Question found: {bool(parsed.get('question'))}")
            return jsonify({
                "error": "Gemini agent returned invalid response. Please check your Gemini quota and API key.",
                "intro": "Error: Unable to generate AI response. Please check Gemini billing.",
                "question": "Error: Unable to generate AI response. Please check Gemini billing.",
                "audio": None
            }), 500
        
        sessions[session_id] = {
            "history": [], 
            "jd": jd,
            "experience": experience_text,
            "candidate_level": candidate_level,
            "transcript": [f"Interviewer: {parsed.get('intro')}", f"Interviewer: {parsed.get('question')}"],
            "question_count": 1,
            "max_questions": question_count,
            "strikes": 0,
            "current_question": parsed.get("question"),
            "active": True,
        }
        
        audio_text = f"{parsed.get('intro')} {parsed.get('question')}"
        audio_base64 = speak_text(audio_text)
        
        print(f"DEBUG: Returning Gemini-generated intro: '{parsed.get('intro')}', question: '{parsed.get('question')}', audio: {'success' if audio_base64 else 'failed'}")

        # Speak introduction
        try:
            speak_intro(parsed.get('intro'))
        except Exception as e:
            print(f" TTS intro error: {e}")
        
        return jsonify({
            "session_id": session_id,
            "intro": parsed.get("intro"),
            "question": parsed.get("question"),
            "audio": None,  # TTS handled separately
            "question_count": question_count,
            "current_question": 1,
            "max_questions": question_count
        })
    except Exception as e:
        print(f"ERROR in Gemini agent run: {e}")
        print("DEBUG: Gemini failed - no fallback allowed")
        
        # Return error instead of fallback
        error_message = str(e)
        if 'quota' in error_message.lower() or 'billing' in error_message.lower():
            user_message = "Gemini quota exceeded. Please check your Gemini API billing at https://ai.google.dev/billing"
        elif 'api' in error_message.lower() or 'key' in error_message.lower():
            user_message = "Gemini API key issue. Please check your API key configuration."
        else:
            user_message = "Gemini service unavailable. Please try again later."
        
        return jsonify({
            "error": user_message,
            "intro": f"Error: {user_message}",
            "question": f"Error: {user_message}",
            "audio": None
        }), 500

@app.route('/api/answer', methods=['POST'])
def submit_answer():
    data = request.json
    session_id = data.get('session_id')
    user_answer = data.get('answer')
    
    print(f"DEBUG: Received answer request - session_id: {session_id}, answer: {user_answer}")
    print(f"DEBUG: Available sessions: {list(sessions.keys())}")
    
    if not session_id:
        print("DEBUG: No session_id provided")
        return jsonify({"error": "No session_id provided"}), 400
        
    if session_id not in sessions:
        print(f"DEBUG: Session {session_id} not found in sessions")
        # Strict mode: No fallbacks allowed
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    print(f"DEBUG: Session found: {session}")
    
    if not session['active']:
        print("DEBUG: Session is not active")
        return jsonify({"error": "Interview ended"}), 400

    session['transcript'].append(f"Candidate: {user_answer}")
    
    # Logic fix: Don't increment yet, use current count for prompt
    # We will increment after successful generation of next question
    # or just before returning if complete.
    
    jd = session.get("jd", "")
    experience_text = session.get("experience", "")
    candidate_level = session.get("candidate_level", "UNKNOWN")
    current_q_num = session.get("question_count", 1)
    max_q = session.get("max_questions", 5)
    
    # Calculate progress
    progress_ratio = current_q_num / max_q

    # Check if this is the last question answer
    is_last_answer = current_q_num >= int(max_q)
    
    print(f"DEBUG: Processing answer for Q{current_q_num} of {max_q}. Is last? {is_last_answer}")

    jd = session.get("jd", "")
    experience_text = session.get("experience", "")
    candidate_level = session.get("candidate_level", "UNKNOWN")
    current_q_num = session.get("question_count", 1)
    max_q = session.get("max_questions", 5)
    progress_ratio = current_q_num / max_q

    difficulty_level = "easy"
    if progress_ratio > 0.7:
        difficulty_level = "hard"
    elif progress_ratio > 0.4:
        difficulty_level = "medium"

    feedback_prompt = (
        f'Answer: "{user_answer}"\n'
        f'Question: "{session["current_question"]}"\n'
        f'Job: {jd}\n'
        f'Level: {candidate_level}\n'
        f'Q{current_q_num}/{max_q} ({difficulty_level})\n'
        f'{"FINAL - END" if is_last_answer else "Continue - MUST provide next question"}\n\n'
        'IMPORTANT: You MUST respond with EXACTLY this format:\n'
        'FEEDBACK: <your brief feedback here>\n'
        f'DECISION: {"INTERVIEW_COMPLETE" if is_last_answer else "NEXT_QUESTION"}\n'
        f'{"(No QUESTION line - this is final)" if is_last_answer else "QUESTION: <your next question here>"}'
    )

    # Reduce context for faster response - only last entry
    context_str = "\n".join(session['transcript'][-1:])  # Only last 1 entry
    full_prompt = f"{feedback_prompt}\n\nContext: {context_str}"

    try:
        print(f"DEBUG: Calling interviewer agent with full prompt: {full_prompt[:300]}...")
        interviewer_response = interviewer_agent(full_prompt)
        text_response = interviewer_response
        print(f"DEBUG: Agent response: {text_response[:200]}...")
        parsed = parse_response(text_response)
        
        # Check if the response is valid (has required fields)
        if not parsed.get('feedback') or not parsed.get('decision'):
            print("DEBUG: Invalid agent response - missing required fields")
            print(f"DEBUG: Full response was: {text_response}")
            print(f"DEBUG: Parsed parts: {parsed}")
            
            # Try to extract feedback from the response if it exists
            feedback_text = parsed.get('feedback') or text_response[:200] + "..." if text_response else "Error generating response"
            
            return jsonify({
                "error": "Gemini agent returned invalid response format. The AI didn't follow the required structure.",
                "feedback": feedback_text,
                "decision": "ERROR",
                "next_question": None,
                "audio": None
            }), 500
        
        session['transcript'].append(f"Feedback: {parsed.get('feedback')}")
        
        # Check if decision is complete or we forced it
        if parsed.get('decision') == 'INTERVIEW_COMPLETE' or is_last_answer:
            session['active'] = False
            session['question_count'] += 1 # Increment to show we completed this question
            
            audio_text = parsed.get('feedback')
            if is_last_answer and parsed.get('decision') != 'INTERVIEW_COMPLETE':
                # Force complete if AI didn't listen
                parsed['decision'] = 'INTERVIEW_COMPLETE'
                audio_text = f"{parsed.get('feedback')} limit reached. Thank you."
            
            print(f"DEBUG: Interview completed - Q{current_q_num} of {max_q}")
            
            # Generate report automatically
            try:
                pdf_base64 = generate_pdf_report({
                    'session_id': session_id,
                    'jd': session['jd'],
                    'experience': session['experience'],
                    'transcript': session['transcript'],
                    'strikes': session.get('strikes', 0),
                    'cheating_detected': session.get('strikes', 0) > 0
                })
                
                if pdf_base64:
                    return jsonify({
                        "feedback": parsed.get("feedback") or audio_text,
                        "decision": "INTERVIEW_COMPLETE",
                        "next_question": None,
                        "audio": speak_text(audio_text),
                        "report_generated": True,
                        "pdf_base64": pdf_base64,
                        "download_url": f"data:application/pdf;base64,{pdf_base64}",
                        "note": "Interview completed with report"
                    })
                else:
                    # Generate text report if PDF fails
                    transcript_text = "\n".join(session['transcript'])
                    report_prompt = f"""
                    Based on this interview transcript, provide a comprehensive evaluation:
                    
                    Job Description: {session['jd']}
                    Experience: {session['experience']}
                    
                    Transcript:
                    {transcript_text}
                    
                    Please provide:
                    1. Overall Assessment (1-10 scale)
                    2. Technical Skills Evaluation
                    3. Communication Skills
                    4. Problem-Solving Ability
                    5. Strengths
                    6. Areas for Improvement
                    7. Recommendation (Hire/Consider/Reject)
                    """
                    
                    text_report = report_agent(report_prompt)
                    
                    return jsonify({
                        "feedback": parsed.get("feedback") or audio_text,
                        "decision": "INTERVIEW_COMPLETE",
                        "next_question": None,
                        "audio": speak_text(audio_text),
                        "report_generated": True,
                        "text_report": text_report,
                        "note": "Interview completed with text report"
                    })
                    
            except Exception as e:
                print(f"Error generating report: {e}")
                return jsonify({
                    "feedback": parsed.get("feedback") or audio_text,
                    "decision": "INTERVIEW_COMPLETE",
                    "next_question": None,
                    "audio": speak_text(audio_text),
                    "report_generated": False,
                    "error": "Report generation failed",
                    "note": "Interview completed but report generation failed"
                })
        else:
            # For non-final questions, we must have a next question
            if not parsed.get('question'):
                print("DEBUG: Missing next question for non-final question")
                print(f"DEBUG: Gemini response was: {text_response}")
                return jsonify({
                    "error": "Gemini agent did not provide a next question. Please check your Gemini quota.",
                    "feedback": parsed.get('feedback', 'Error generating response'),
                    "decision": "ERROR",
                    "next_question": None,
                    "audio": None
                }), 500
            
            session['current_question'] = parsed.get('question')
            session['transcript'].append(f"Interviewer: {parsed.get('question')}")
            session['question_count'] += 1 # Move to next question number
            audio_text = f"{parsed.get('feedback')} {parsed.get('question')}"

        audio_base64 = speak_text(audio_text)

        print(f"DEBUG: Returning Gemini-generated feedback: '{parsed.get('feedback')}', decision: '{parsed.get('decision')}', next_question: '{parsed.get('question')}', audio: {'success' if audio_base64 else 'failed'}")

        return jsonify({
            "feedback": parsed.get("feedback"),
            "decision": parsed.get("decision"),
            "next_question": parsed.get("question"),
            "audio": audio_base64,
            "note": "Generated by Gemini AI"
        })
        
    except Exception as e:
        print(f"ERROR in Gemini agent run: {e}")
        print("DEBUG: Gemini failed - no fallback allowed")
        
        # Return error instead of fallback
        error_message = str(e)
        if 'quota' in error_message.lower() or 'billing' in error_message.lower():
            user_message = "Gemini quota exceeded. Please check your Gemini API billing at https://ai.google.dev/billing"
        elif 'api' in error_message.lower() or 'key' in error_message.lower():
            user_message = "Gemini API key issue. Please check your API key configuration."
        else:
            user_message = "Gemini service unavailable. Please try again later."
        
        return jsonify({
            "error": user_message,
            "feedback": f"Error: {user_message}",
            "decision": "ERROR",
            "next_question": None,
            "audio": None
        }), 500

@app.route('/api/cheat_strike', methods=['POST'])
def report_cheat():
    data = request.json
    session_id = data.get('session_id')
    
    if session_id not in sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    session['strikes'] += 1
    
    msg = f"Warning {session['strikes']}/5: Suspicious behavior detected."
    
    if session['strikes'] >= 5:
        session['active'] = False
        return jsonify({"status": "terminated", "message": "Interview terminated due to suspicious behavior."})
        
    return jsonify({"status": "warning", "message": msg, "strikes": session['strikes']})

@app.route('/api/face_detection', methods=['POST'])
def detect_faces():
    """
    Detect faces in image frame for cheat monitoring
    """
    data = request.json
    session_id = data.get('session_id')
    image_data = data.get('image')  # Base64 encoded image
    
    if not session_id or not image_data:
        return jsonify({"error": "Missing session_id or image data"}), 400
        
    if session_id not in sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    
    try:
        # Detect faces using OpenCV
        face_result = face_detector.detect_faces_from_base64(image_data)
        
        # Analyze frame quality
        quality_result = face_detector.analyze_frame_quality(image_data)
        
        # Initialize consecutive failure tracking for this session
        if 'consecutive_failures' not in session:
            session['consecutive_failures'] = 0
        
        # Determine if cheating detected
        cheating_detected = False
        cheat_reason = None
        
        if face_result['no_faces']:
            session['consecutive_failures'] += 1
            if session['consecutive_failures'] >= 5:  # Need 5 consecutive failures (10+ seconds)
                cheating_detected = True
                cheat_reason = "No face detected in camera for 10+ seconds"
        elif face_result['multiple_faces']:
            session['consecutive_failures'] = 0
            cheating_detected = True
            cheat_reason = "Multiple faces detected in camera"
        elif quality_result.get('is_covered', False):
            session['consecutive_failures'] += 1
            if session['consecutive_failures'] >= 5:
                cheating_detected = True
                cheat_reason = "Camera appears to be covered for 10+ seconds"
        elif quality_result.get('is_too_dark', False):
            session['consecutive_failures'] += 1
            if session['consecutive_failures'] >= 5:
                cheating_detected = True
                cheat_reason = "Camera feed is too dark for 10+ seconds"
        else:
            # Reset consecutive failures on successful detection
            session['consecutive_failures'] = 0
        
        # Log the detection with debug info
        print(f"Face detection for session {session_id}:")
        print(f"  Faces: {face_result['face_count']}, Detected: {face_result['faces_detected']}")
        print(f"  Quality - Brightness: {quality_result.get('brightness', 'N/A'):.1f}")
        print(f"  Quality - Blur: {quality_result.get('blur_score', 'N/A'):.1f}")
        print(f"  Quality - Covered: {quality_result.get('is_covered', False)}")
        print(f"  Quality - Too Dark: {quality_result.get('is_too_dark', False)}")
        print(f"  Quality - Too Bright: {quality_result.get('is_too_bright', False)}")
        print(f"  Consecutive Failures: {session['consecutive_failures']}/5")
        print(f"  Cheating detected: {cheating_detected}")
        if cheating_detected:
            print(f"  Cheat reason: {cheat_reason}")
            print(f"  Strikes: {session['strikes'] + 1}/5")
        
        # If cheating detected, report it
        if cheating_detected:
            session['strikes'] += 1
            
            if session['strikes'] >= 5:
                session['active'] = False
                session['completed'] = True
                session['completion_reason'] = 'cheating_detected'
                
                # Generate report for terminated interview
                try:
                    print("Generating report for terminated interview...")
                    report_data = generate_pdf_report(
                        session.get('transcript', []),
                        session.get('jd', 'N/A'),
                        session.get('experience', 'N/A'),
                        session['strikes']
                    )
                    session['report_generated'] = True
                    session['report_data'] = report_data
                    print("Report generated for terminated interview")
                except Exception as e:
                    print(f"Error generating report for terminated interview: {e}")
                    session['report_generated'] = False
                
                return jsonify({
                    "cheating_detected": True,
                    "cheat_reason": cheat_reason,
                    "strikes": session['strikes'],
                    "status": "completed",
                    "message": "Interview completed due to suspicious activity. Report generated.",
                    "report_generated": session.get('report_generated', False),
                    "completion_reason": "cheating_detected",
                    "face_result": face_result,
                    "quality_result": quality_result
                })
            else:
                return jsonify({
                    "cheating_detected": True,
                    "cheat_reason": cheat_reason,
                    "strikes": session['strikes'],
                    "status": "warning",
                    "message": f"Warning {session['strikes']}/5: {cheat_reason}",
                    "face_result": face_result,
                    "quality_result": quality_result
                })
        else:
            return jsonify({
                "cheating_detected": False,
                "cheat_reason": None,
                "strikes": session['strikes'],
                "status": "ok",
                "message": "Face detection normal",
                "face_result": face_result,
                "quality_result": quality_result
            })
            
    except Exception as e:
        print(f"Error in face detection: {e}")
        return jsonify({
            "error": f"Face detection failed: {str(e)}",
            "cheating_detected": False
        }), 500

@app.route('/api/report', methods=['POST'])
def get_report():
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({"error": "No session_id provided"}), 400
        
    if session_id not in sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    
    print(f"DEBUG: Generating report for session {session_id}")
    
    try:
        # Generate PDF report
        pdf_base64 = generate_pdf_report({
            'session_id': session_id,
            'jd': session['jd'],
            'experience': session['experience'],
            'transcript': session['transcript']
        })
        
        if pdf_base64:
            return jsonify({
                "success": True,
                "pdf_base64": pdf_base64,
                "download_url": f"data:application/pdf;base64,{pdf_base64}",
                "job_description": session['jd'],
                "experience": session['experience'],
                "transcript": session['transcript'],
                "strikes": session.get('strikes', 0)
            })
        else:
            # Fallback to text report if PDF generation fails
            transcript_text = "\n".join(session['transcript'])
            report_prompt = f"""
            Based on this interview transcript, provide a comprehensive evaluation:
            
            Job Description: {session['jd']}
            Experience: {session['experience']}
            
            Transcript:
            {transcript_text}
            
            Please provide:
            1. Overall Assessment (1-10 scale)
            2. Technical Skills Evaluation
            3. Communication Skills
            4. Problem-Solving Ability
            5. Strengths
            6. Areas for Improvement
            7. Recommendation (Hire/Consider/Reject)
            """
            
            text_report = report_agent(report_prompt)
            
            return jsonify({
                "success": True,
                "text_report": text_report,
                "job_description": session['jd'],
                "experience": session['experience'],
                "transcript": session['transcript'],
                "strikes": session.get('strikes', 0)
            })
            
    except Exception as e:
        print(f"Error generating report: {e}")
        return jsonify({
            "success": False,
            "error": f"Report generation failed: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
