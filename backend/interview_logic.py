import time
import os
import speech_recognition as sr
try:
    import audioop
except ImportError:
    audioop = None
import base64
import io
from gtts import gTTS
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from datetime import datetime


import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "your_gemini_api_key_here"))

def extract_text(run_output):
    if hasattr(run_output, "content"):
        return run_output.content
    return str(run_output)

def listen_to_user(timeout=10, silence_duration=3):
    """
    Listen to user speech with silence detection.
    Stops recording after `silence_duration` consecutive seconds of silence or timeout.
    Returns the recognized text.
    """
    r = sr.Recognizer()
    
    with sr.Microphone() as source:
        print("Listening... (speak now)")
        try:
            r.adjust_for_ambient_noise(source, duration=0.5)

            chunks = []
            sample_rate = None
            sample_width = None

            silent_seconds = 0

          
            silence_threshold = getattr(r, "energy_threshold", 300)

            
            while True:
                try:
                    audio = r.listen(source, timeout=1, phrase_time_limit=1)
                    raw = audio.get_raw_data()
                    if sample_rate is None:
                        sample_rate = audio.sample_rate
                        sample_width = audio.sample_width

                    
                    try:
                        rms = audioop.rms(raw, sample_width)
                    except Exception:
                        rms = 0

                    
                    if rms < silence_threshold:
                        silent_seconds += 1
                       
                        if silent_seconds >= silence_duration:
                            break
                        
                        continue
                    else:
                        
                        chunks.append(raw)
                        silent_seconds = 0

                except sr.WaitTimeoutError:
                    
                    silent_seconds += 1
                    if silent_seconds >= silence_duration:
                        break
                    continue

            if not chunks:
                print("No speech detected.")
                return None

            
            merged = b"".join(chunks)
            audio_data = sr.AudioData(merged, sample_rate, sample_width)

            try:
                text = r.recognize_google(audio_data)
                print(f"You said: {text}")
                return text
            except sr.UnknownValueError:
                print("Could not understand audio. Please try again.")
                return ""
            except sr.RequestError as e:
                print(f"Error with speech recognition: {e}")
                return ""

        except Exception as e:
            print(f"Microphone error: {e}")
            return ""

def wav_to_text(filename):
    r = sr.Recognizer()
    with sr.AudioFile(filename) as source:
        audio = r.record(source)
    try:
        return r.recognize_google(audio)
    except:
        return ""

def speak_text(text):
    """
    Convert text to speech and return base64 encoded audio.
    """
    text = extract_text(text)
    if not text.strip():
        return None

    try:
        print(f"DEBUG: Attempting TTS for text: '{text[:50]}...'")
        tts = gTTS(text=text, lang="en", slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        audio_base64 = base64.b64encode(fp.read()).decode('utf-8')
        print(f"DEBUG: TTS success, audio length: {len(audio_base64)}")
        return audio_base64
    except Exception as e:
        print(f"ERROR in text-to-speech: {e}")
        return None


def generate_pdf_report(session_data):
    """
    Generate a PDF report from interview session data.
    Returns base64 encoded PDF.
    """
    try:
        # Create a BytesIO buffer
        buffer = io.BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center
        )
        
        # Title
        story.append(Paragraph("AI Interview Report", title_style))
        story.append(Spacer(1, 20))
        
        # Candidate Information
        story.append(Paragraph("Candidate Information", styles['Heading2']))
        candidate_data = [
            ['Job Description', session_data.get('jd', 'N/A')],
            ['Experience', session_data.get('experience', 'N/A')],
            ['Interview Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            ['Total Questions', str(len(session_data.get('transcript', [])) // 2)],
            ['Session ID', session_data.get('session_id', 'N/A')]
        ]
        
        candidate_table = Table(candidate_data, colWidths=[2*inch, 4*inch])
        candidate_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(candidate_table)
        story.append(Spacer(1, 20))
        
        # Interview Transcript
        story.append(Paragraph("Interview Transcript", styles['Heading2']))
        
        transcript = session_data.get('transcript', [])
        for i, line in enumerate(transcript):
            if line.startswith('Candidate:'):
                story.append(Paragraph(f"<b>Candidate:</b> {line[11:]}", styles['Normal']))
            elif line.startswith('Interviewer:'):
                story.append(Paragraph(f"<b>Interviewer:</b> {line[13:]}", styles['Normal']))
            story.append(Spacer(1, 6))
        
        story.append(Spacer(1, 20))
        
        # AI Evaluation
        story.append(Paragraph("AI Evaluation", styles['Heading2']))
        
        # Generate AI evaluation
        evaluation_prompt = f"""
        Based on this interview transcript, provide a comprehensive evaluation:
        
        Job Description: {session_data.get('jd', 'N/A')}
        Experience: {session_data.get('experience', 'N/A')}
        
        Transcript:
        {chr(10).join(transcript)}
        
        Please provide:
        1. Overall Assessment (1-10 scale)
        2. Technical Skills Evaluation
        3. Communication Skills
        4. Problem-Solving Ability
        5. Strengths
        6. Areas for Improvement
        7. Recommendation (Hire/Consider/Reject)
        """
        
        try:
            evaluation = interviewer_agent(evaluation_prompt)
            evaluation_text = evaluation
            
            # Split evaluation into paragraphs
            for paragraph in evaluation_text.split('\n'):
                if paragraph.strip():
                    story.append(Paragraph(paragraph.strip(), styles['Normal']))
                    story.append(Spacer(1, 6))
        except Exception as e:
            story.append(Paragraph(f"Evaluation generation failed: {str(e)}", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF bytes and encode
        buffer.seek(0)
        pdf_bytes = buffer.read()
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return pdf_base64
        
    except Exception as e:
        print(f"Error generating PDF: {e}")
        return None



def interviewer_agent(prompt):
    """
    Generate interviewer response using Gemini API
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    return response.text

def report_agent(prompt):
    """
    Generate report using Gemini API
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    return response.text
