import cv2
import numpy as np
import base64
from io import BytesIO

class FaceDetector:
    def __init__(self):
        # Load OpenCV's pre-trained face detector
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
    def detect_faces_from_base64(self, image_base64):
        """
        Detect faces from base64 encoded image
        Returns: {
            'faces_detected': bool,
            'face_count': int,
            'face_locations': list of (x, y, w, h),
            'image_processed': bool
        }
        """
        try:
            # Decode base64 image
            image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return {
                    'faces_detected': False,
                    'face_count': 0,
                    'face_locations': [],
                    'image_processed': False,
                    'error': 'Could not decode image'
                }
            
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
                maxSize=(300, 300)
            )
            
            face_count = len(faces)
            faces_detected = face_count > 0
            
            # Draw rectangles around detected faces (for debugging)
            result_image = image.copy()
            for (x, y, w, h) in faces:
                cv2.rectangle(result_image, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            return {
                'faces_detected': faces_detected,
                'face_count': face_count,
                'face_locations': [(int(x), int(y), int(w), int(h)) for x, y, w, h in faces],
                'image_processed': True,
                'multiple_faces': face_count > 1,
                'no_faces': face_count == 0
            }
            
        except Exception as e:
            return {
                'faces_detected': False,
                'face_count': 0,
                'face_locations': [],
                'image_processed': False,
                'error': str(e)
            }
    
    def analyze_frame_quality(self, image_base64):
        """
        Analyze frame quality for cheat detection
        Returns: {
            'brightness': float,
            'blur_score': float,
            'is_covered': bool,
            'is_too_dark': bool,
            'is_too_bright': bool
        }
        """
        try:
            # Decode base64 image
            image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return {'error': 'Could not decode image'}
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Calculate brightness
            brightness = np.mean(gray)
            
            # Calculate blur score (Laplacian variance)
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Determine conditions - more lenient thresholds
            is_too_dark = brightness < 15  # Was 30, now more lenient
            is_too_bright = brightness > 240  # Was 200, now more lenient
            is_covered = brightness < 10 or blur_score < 50  # Was 20/100, now more lenient
            
            return {
                'brightness': float(brightness),
                'blur_score': float(blur_score),
                'is_covered': bool(is_covered),
                'is_too_dark': bool(is_too_dark),
                'is_too_bright': bool(is_too_bright),
                'quality_good': bool(not (is_too_dark or is_too_bright or is_covered))
            }
            
        except Exception as e:
            return {'error': str(e)}

# Global face detector instance
face_detector = FaceDetector()
