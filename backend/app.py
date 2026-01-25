from flask import Flask, request, jsonify
from flask_cors import CORS
from interview_logic import interviewer_agent, extract_text, report_agent, speak_text
from dotenv import load_dotenv
import uuid
import os
import time
import re
import random

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "AI Interview Backend is Running! Please use the Frontend."


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
    experience_text = str(experience)
    
    
    def extract_years(text: str):
        try:
            matches = re.findall(r'(\d+)\s*(?:\\+?\\s*)?(?:years?|yrs?|y)?', text.lower())
            if matches:
                return int(matches[0])
        except:
            pass
        return None
    
    years = extract_years(experience_text)
    if years is None:
        candidate_level = "UNKNOWN"
    elif years >= 5:
        candidate_level = "SENIOR"
    elif years >= 3:
        candidate_level = "MID"
    else:
        candidate_level = "JUNIOR"
    
    session_id = str(uuid.uuid4())
    
    def fallback_intro_question(jd_text: str, level: str):
        intro = "Welcome to the interview."
        if level == "SENIOR":
            q = f"Describe a production incident you solved related to {jd_text}, including trade-offs."
        elif level == "MID":
            q = f"Walk me through how you would design a solution for a real-world {jd_text} task."
        elif level == "JUNIOR":
            q = f"Briefly explain a core concept relevant to {jd_text} and how you used it."
        else:
            q = f"What key experience do you have related to {jd_text}?"
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
        "Start a professional interview. Respond with exactly two labeled lines:\n"
        "INTRO: <one-line introduction to the candidate>\n"
        "QUESTION: <short, one-line technical question that matches the JD and inferred level>"
    )
    
    try:
        interviewer_response = interviewer_agent.run(init_prompt)
        text_response = extract_text(interviewer_response)
        parsed = parse_response(text_response)
        if not parsed.get("question"):
            intro_f, q_f = fallback_intro_question(jd, candidate_level)
            parsed["intro"] = parsed.get("intro") or intro_f
            parsed["question"] = q_f
        
        sessions[session_id] = {
            "history": [], 
            "jd": jd,
            "experience": experience_text,
            "candidate_level": candidate_level,
            "transcript": [f"Interviewer: {parsed.get('intro')}", f"Interviewer: {parsed.get('question')}"],
            "question_count": 1,
            "max_questions": 80,
            "strikes": 0,
            "active": True,
            "current_question": parsed.get("question")
        }
        
        
        audio_text = f"{parsed.get('intro')} {parsed.get('question')}"
        audio_base64 = speak_text(audio_text)

        return jsonify({
            "session_id": session_id,
            "intro": parsed.get("intro"),
            "question": parsed.get("question"),
            "audio": audio_base64
        })
    except Exception as e:
        # Fallback without external model dependency
        intro_f, q_f = fallback_intro_question(jd, candidate_level)
        sessions[session_id] = {
            "history": [],
            "jd": jd,
            "experience": experience_text,
            "candidate_level": candidate_level,
            "transcript": [f"Interviewer: {intro_f}", f"Interviewer: {q_f}"],
            "question_count": 1,
            "max_questions": 80,
            "strikes": 0,
            "active": True,
            "current_question": q_f
        }
        audio_base64 = speak_text(f"{intro_f} {q_f}")
        return jsonify({
            "session_id": session_id,
            "intro": intro_f,
            "question": q_f,
            "audio": audio_base64,
            "note": "Using fallback due to interviewer agent error"
        })

@app.route('/api/answer', methods=['POST'])
def submit_answer():
    data = request.json
    session_id = data.get('session_id')
    user_answer = data.get('answer')
    
    if session_id not in sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    
    if not session['active']:
        return jsonify({"error": "Interview ended"}), 400

    session['transcript'].append(f"Candidate: {user_answer}")
    session['question_count'] += 1
    
    if session['question_count'] > session['max_questions']:
         session['active'] = False
         return jsonify({
             "feedback": "Interview limit reached.",
             "decision": "INTERVIEW_COMPLETE",
             "next_question": None
         })

    jd = session.get("jd", "")
    experience_text = session.get("experience", "")
    candidate_level = session.get("candidate_level", "UNKNOWN")

    feedback_prompt = (
        f'The candidate answered: "{user_answer}"\n'
        f'Previous question was: "{session["current_question"]}"\n'
        f"Job Description: {jd}\n"
        f"Candidate Profile / Experience (raw text): {experience_text}\n"
        f"Candidate Level (from initialization): {candidate_level}\n"
        "Hard rule for SENIOR or MID: avoid trivial or textbook definition questions. Ask deep, scenario-based, architectural, trade-off, scaling, reliability, or deployment questions. "
        "For JUNIOR: fundamentals + simple applications.\n"
        "Please:\n"
        "1. Evaluate their answer.\n"
        "2. Provide constructive feedback.\n"
        "3. Ask the next question or a follow-up that matches the JD and inferred level.\n"
        "4. If you have gathered sufficient information (after at least 5 questions), you can end with [INTERVIEW_COMPLETE].\n"
        "Respond with exactly these labeled lines:\n"
        "FEEDBACK: <one-line constructive feedback>\n"
        "DECISION: NEXT_QUESTION or INTERVIEW_COMPLETE\n"
        "QUESTION: <the next question to ask, short>\n"
    )

    context_str = "\n".join(session['transcript'][-4:])
    full_prompt = f"Context so far:\n{context_str}\n\n{feedback_prompt}"

    try:
        interviewer_response = interviewer_agent.run(full_prompt)
        text_response = extract_text(interviewer_response)
        parsed = parse_response(text_response)
        
        session['transcript'].append(f"Feedback: {parsed.get('feedback')}")
        
        if parsed.get('decision') == 'INTERVIEW_COMPLETE':
            session['active'] = False
            audio_text = parsed.get('feedback')
        else:
            session['current_question'] = parsed.get('question')
            session['transcript'].append(f"Interviewer: {parsed.get('question')}")
            audio_text = f"{parsed.get('feedback')} {parsed.get('question')}"
            
        audio_base64 = speak_text(audio_text)

        return jsonify({
            "feedback": parsed.get("feedback"),
            "decision": parsed.get("decision"),
            "next_question": parsed.get("question"),
            "audio": audio_base64
        })
        
    except Exception as e:
        # Fallback path: simple evaluation and next question template
        fb = "Thanks. Let's dive deeper into your practical experience."
        # Generate a follow-up aligned to level
        if candidate_level == "SENIOR":
            nq = f"Describe architecture and scaling decisions you made for {jd} in production."
        elif candidate_level == "MID":
            nq = f"Explain how you would implement and validate a solution for {jd} end-to-end."
        elif candidate_level == "JUNIOR":
            nq = f"Explain a core concept from {jd} and how you applied it."
        else:
            nq = f"What relevant experience do you have related to {jd}?"
        
        session['current_question'] = nq
        session['transcript'].append(f"Feedback: {fb}")
        session['transcript'].append(f"Interviewer: {nq}")
        audio_base64 = speak_text(f"{fb} {nq}")
        return jsonify({
            "feedback": fb,
            "decision": "NEXT_QUESTION",
            "next_question": nq,
            "audio": audio_base64,
            "note": "Using fallback due to interviewer agent error"
        })

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

@app.route('/api/report', methods=['POST'])
def get_report():
    data = request.json
    session_id = data.get('session_id')
    
    if session_id not in sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = sessions[session_id]
    transcript_text = "\n".join(session['transcript'])
    
    try:
        report_response = report_agent.run(f"Generate a detailed interview report for this transcript:\n\n{transcript_text}")
        report_text = extract_text(report_response)
        return jsonify({"report": report_text})
    except Exception as e:
        jd = session.get("jd", "Role")
        level = session.get("candidate_level", "UNKNOWN")
        q_count = session.get("question_count", 0)
        strikes = session.get("strikes", 0)
        feedbacks = [line.replace("Feedback: ", "") for line in session.get("transcript", []) if line.startswith("Feedback: ")]
        last_feedback = feedbacks[-1] if feedbacks else "Candidate provided responses; further evaluation recommended."
        recommendation = "Next Round" if level in ("SENIOR", "MID") else "Next Round"
        summary = f"Interview for {jd} ({level}). Asked {q_count} questions. Cheat strikes: {strikes}."
        report_md = (
            f"# Interview Report\n\n"
            f"## Executive Summary\n"
            f"{summary}\n\n"
            f"## Technical Skills Assessment\n"
            f"- Feedback: {last_feedback}\n"
            f"- Overall alignment with {jd}: Adequate based on transcript.\n\n"
            f"## Soft Skills Assessment\n"
            f"- Communication: Clear enough for role expectations.\n"
            f"- Demeanor: Professional during interview.\n\n"
            f"## Areas for Improvement\n"
            f"- Provide more concrete examples aligned to {jd}.\n"
            f"- Elaborate trade-offs and reasoning.\n\n"
            f"## Final Recommendation\n"
            f"{recommendation}\n"
        )
        return jsonify({"report": report_md, "note": "Using fallback report due to model error"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
