import time
import os
import speech_recognition as sr
import audioop
from gtts import gTTS
from playsound import playsound

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
    # Let recognizer adjust to ambient noise (sets r.energy_threshold)
    with sr.Microphone() as source:
        print("Listening... (speak now)")
        try:
            r.adjust_for_ambient_noise(source, duration=0.5)

            chunks = []
            sample_rate = None
            sample_width = None

            silent_seconds = 0

            # Use energy threshold as base for silence detection
            silence_threshold = getattr(r, "energy_threshold", 300)

            # Record in short (1s) chunks and examine RMS to detect silence
            while True:
                try:
                    audio = r.listen(source, timeout=1, phrase_time_limit=1)
                    raw = audio.get_raw_data()
                    if sample_rate is None:
                        sample_rate = audio.sample_rate
                        sample_width = audio.sample_width

                    # compute RMS of chunk
                    try:
                        rms = audioop.rms(raw, sample_width)
                    except Exception:
                        rms = 0

                    # consider chunk silent if rms below threshold
                    if rms < silence_threshold:
                        silent_seconds += 1
                        # if we've seen enough consecutive silent seconds, stop
                        if silent_seconds >= silence_duration:
                            break
                        # don't append silent chunk
                        continue
                    else:
                        # non-silent chunk: append and reset silent counter
                        chunks.append(raw)
                        silent_seconds = 0

                except sr.WaitTimeoutError:
                    # no phrase started in this 1s window
                    silent_seconds += 1
                    if silent_seconds >= silence_duration:
                        break
                    continue

            if not chunks:
                print("No speech detected.")
                return None

            # Merge raw chunks into a single AudioData
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

def speak_text(text, play=True):
    """
    Convert text to speech and optionally play it.
    """
    text = extract_text(text)
    if not text.strip():
        return None

    filename = f"static/response_{int(time.time())}.mp3"
    try:
        gTTS(text=text, lang="en").save(filename)
        if play:
            print("\n[Playing audio...]")
            playsound(filename)
            print("[Audio finished]\n")
        return filename
    except Exception as e:
        print(f"Error in text-to-speech: {e}")
        return None

# ---------- AGENTS ---------- #

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




