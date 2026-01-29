# Text-to-Speech Module for AI Interview System
import pygame
import tempfile
import os
import threading
import time
from queue import Queue, Empty
import speech_recognition as sr

class TTSManager:
    def __init__(self):
        """Initialize TTS Manager"""
        self.audio_queue = Queue()
        self.is_speaking = False
        self.current_audio = None
        self.recording = False
        self.recognizer = sr.Recognizer()
        self.microphone = None
        self.recording_thread = None
        self.last_speech_time = 0
        self.recording_timeout = 5.0  # 5 seconds of silence
        
        # Initialize pygame mixer
        pygame.mixer.init()
        pygame.mixer.music.set_volume(0.8)
        
        # Initialize microphone
        try:
            self.microphone = sr.Microphone()
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
            print("Microphone initialized for TTS")
        except Exception as e:
            print(f"Microphone initialization failed: {e}")
    
    def speak_text(self, text, callback=None):
        """
        Convert text to speech and play it
        """
        try:
            print(f"Speaking: {text[:50]}...")
            
            # For now, we'll use a simple approach with pygame
            # In production, you might want to use gTTS or other TTS services
            self._speak_with_pygame(text, callback)
            
        except Exception as e:
            print(f"TTS error: {e}")
            if callback:
                callback()
    
    def _speak_with_pygame(self, text, callback=None):
        """
        Simple text-to-speech using pygame (placeholder)
        In production, replace with actual TTS service
        """
        # This is a placeholder - in production, use gTTS, Azure TTS, or similar
        print(f"TTS: {text}")
        
        # Simulate speaking time
        speaking_time = len(text) * 0.05  # Rough estimate
        threading.Timer(speaking_time, lambda: self._on_speech_complete(callback)).start()
    
    def _on_speech_complete(self, callback):
        """Called when speech is complete"""
        self.is_speaking = False
        if callback:
            callback()
    
    def start_recording(self, silence_callback=None):
        """
        Start audio recording with 5-second silence detection
        """
        if not self.microphone:
            print("No microphone available")
            return None
        
        self.recording = True
        self.last_speech_time = time.time()
        self.silence_callback = silence_callback
        
        def record_audio():
            """Recording thread function"""
            audio_data = []
            
            with self.microphone as source:
                while self.recording:
                    try:
                        # Listen for audio with timeout
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=30)
                        
                        # Check if speech was detected
                        try:
                            # Try to recognize speech
                            text = self.recognizer.recognize_google(audio)
                            if text.strip():
                                print(f"Recorded: {text}")
                                audio_data.append(text)
                                self.last_speech_time = time.time()
                        except sr.UnknownValueError:
                            # Speech not recognized, but audio was detected
                            self.last_speech_time = time.time()
                        
                        # Check for silence timeout
                        if time.time() - self.last_speech_time > self.recording_timeout:
                            print("5 seconds of silence detected")
                            if self.silence_callback:
                                self.silence_callback(audio_data)
                            break
                            
                    except sr.WaitTimeoutError:
                        # No audio detected, check timeout
                        if time.time() - self.last_speech_time > self.recording_timeout:
                            print("5 seconds of silence detected")
                            if self.silence_callback:
                                self.silence_callback(audio_data)
                            break
                    except Exception as e:
                        print(f"Recording error: {e}")
                        break
            
            self.recording = False
        
        # Start recording thread
        self.recording_thread = threading.Thread(target=record_audio)
        self.recording_thread.daemon = True
        self.recording_thread.start()
        
        return self.recording_thread
    
    def stop_recording(self):
        """
        Stop audio recording
        """
        self.recording = False
        if self.recording_thread:
            self.recording_thread.join(timeout=2)
    
    def is_recording_active(self):
        """
        Check if recording is active
        """
        return self.recording

# Global TTS instance
tts_manager = TTSManager()

def speak_intro(intro_text):
    """
    Speak interview introduction
    """
    tts_manager.speak_text(intro_text)

def speak_question(question_text, callback=None):
    """
    Speak interview question
    """
    tts_manager.speak_text(question_text, callback)

def start_answer_recording(silence_callback):
    """
    Start recording user's answer with 5-second silence detection
    """
    return tts_manager.start_recording(silence_callback)

def stop_answer_recording():
    """
    Stop recording user's answer
    """
    tts_manager.stop_recording()

def is_speaking():
    """
    Check if TTS is currently speaking
    """
    return tts_manager.is_speaking

def is_recording():
    """
    Check if recording is currently active
    """
    return tts_manager.is_recording_active()
