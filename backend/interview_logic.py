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


from agno.agent import Agent
from agno.models.openai import OpenAIChat

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
        
        tts = gTTS(text=text, lang="en")
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        
        audio_base64 = base64.b64encode(fp.read()).decode('utf-8')
        return audio_base64
    except Exception as e:
        print(f"Error in text-to-speech: {e}")
        return None



interviewer_agent = Agent(
    model=OpenAIChat(id="gpt-4o-mini"),
    instructions="""
    You are an experienced human interviewer (do NOT call yourself an AI).
    Speak like an interviewer addressing a candidate. Use short plain lines.
    Do NOT use bullets, asterisks, or markdown. Keep each line brief (one short sentence).
    After evaluating an answer, respond with exactly these labeled lines (each on its own line):
    FEEDBACK: <one-line constructive feedback>
    DECISION: NEXT_QUESTION or INTERVIEW_COMPLETE
    QUESTION: <the next question to ask, short>

    If you decide the interview is complete, set DECISION: INTERVIEW_COMPLETE and include no QUESTION line.
    End responses with no extra commentary.
    """
)

report_agent = Agent(
    model=OpenAIChat(id="gpt-4o-mini"),
    instructions="""
    You are an expert technical interviewer and HR specialist.
    Your task is to generate a detailed interview report based on the transcript of an interview.
    
    The report should include:
    1. **Executive Summary**: Brief overview of the candidate's performance.
    2. **Technical Skills Assessment**: Strengths and weaknesses in technical areas.
    3. **Soft Skills Assessment**: Communication, problem-solving, and demeanor.
    4. **Areas for Improvement**: Specific technical and soft skill areas to work on.
    5. **Final Recommendation**: Hire, No Hire, or Next Round (with justification).
    
    Format the output in Markdown.
    """
)
