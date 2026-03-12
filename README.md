🤖 AI Interview System
An intelligent mock interview platform that generates role-specific questions from a job description, evaluates your answers in real time, and gives instant AI-powered feedback.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-Frontend-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-Styling-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT%20API-412991?style=for-the-badge&logo=openai&logoColor=white)
![uv](https://img.shields.io/badge/Package%20Manager-uv-DE5FE9?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

# Overview :-
AI Interview System is a full-stack AI-powered mock interview platform. The user pastes a job description, and the AI generates relevant interview questions for that specific role. The user answers each question, and the AI evaluates the response — providing detailed feedback on accuracy, clarity, and completeness.
Built with a Python backend and a JavaScript/HTML/CSS frontend, this system simulates a real interview experience end-to-end.

# Key Features :-

🧠 Job-description-aware question generation — questions are tailored to the exact role, not generic
💬 Real-time answer evaluation — AI grades your response and explains what was good or missing
📝 Detailed feedback per answer — not just a score, but constructive written feedback
🔄 Multi-question interview flow — simulates a full interview session
⚡ Fast full-stack architecture — Python API backend + lightweight JS frontend
🛠️ Backend verification script — verify_backend.py for easy health checks during development


# Tech Stack :-

| Component       | Technology              |
|-----------------|-------------------------|
| Backend         | Python (FastAPI / Flask)|
| Frontend        | JavaScript, HTML, CSS   |
| LLM             | OpenAI GPT API          |
| Package Manager | uv                      |
| Language        | Python 3.11+            |


# How It Works :-
```
User pastes Job Description
        │
        ▼
   backend/      ──→  LLM generates role-specific interview questions
        │
        ▼
   frontend/     ──→  Displays questions one by one in the browser UI
        │
        ▼
   User answers  ──→  Response sent back to the backend
        │
        ▼
   backend/      ──→  LLM evaluates the answer & generates feedback
        │
        ▼
   frontend/     ──→  Displays score + detailed feedback to the user
```

# Project Structure :-
```
AI-INTERVIEW-SYSTEM/
│
├── backend/                # Python API — question generation & answer evaluation
├── frontend/               # JS/HTML/CSS — browser-based interview UI
│
├── verify_backend.py       # Script to verify backend is running correctly
├── pyproject.toml          # Project metadata and dependencies
├── uv.lock                 # Locked dependency versions
└── .gitignore

```

# Getting Started Prerequisites :-

1) Python 3.11+
2) uv (recommended) or pip
3) OpenAI API key

# Installation :-
```bash
Clone the repository
git clone https://github.com/Abdeali-Badri/AI-INTERVIEW-SYSTEM.git
```
```bash
cd AI-INTERVIEW-SYSTEM
```
# Using uv (recommended) :-

```bash
uv sync
```
# Using pip :-
```bash
pip install -r requirements.txt
```
# Configuration :-

```bash
Create a .env file in the root directory:
OPENAI_API_KEY=your_openai_api_key_here
```
# Run the Backend :-
```bash
cd backend
python main.py
```
# Run the Frontend :-

Open ```frontend/index.html``` in your browser, or serve it with:
```bash
cd frontend
npx serve .
```
# Verify Backend is Running :-
```bash
python verify_backend.py
```

# Usage :-

1) Open the app in your browser
2) Paste a job description into the input field
3) Click Start Interview
4) Answer each AI-generated question
5) Receive instant feedback on every answer
6) Review your overall performance at the end


# Use Cases :-

1) Job seekers preparing for technical or HR interviews
2) Students practicing for campus placements
3) Professionals switching roles or industries
4) Anyone wanting to improve their interview communication skills


# Future Improvements :-
 1) PDF resume upload to personalize questions further
 2) Session history and performance tracking
 3) Deployable Docker container


## Author
**Abdeali Badri**
[github.com/Abdeali-Badri](https://github.com/Abdeali-Badri)


