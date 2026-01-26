// Home page logic: collect JD + experience, call /api/start once, then go to interview.html

const jdEl = document.getElementById('jd');
const expEl = document.getElementById('experience');
const startBtn = document.getElementById('start-btn');

if (startBtn) {
  startBtn.addEventListener('click', async () => {
    const jd = jdEl.value.trim();
    const experience = expEl.value.trim();

    if (!jd || !experience) {
      alert('Please fill in both Job Description and Experience.');
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = '⏳ Starting interview...';

    try {
      // Save basics locally
      localStorage.setItem('jd', jd);
      localStorage.setItem('experience', experience);

      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, experience }),
      });

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }
      const data = await res.json();

      localStorage.setItem('session_id', data.session_id || '');
      localStorage.setItem('intro', data.intro || '');
      localStorage.setItem('first_question', data.question || '');
      localStorage.setItem('first_audio', data.audio || '');

      // Navigate to interview; camera + audio will start automatically there
      window.location.href = 'interview.html';
    } catch (err) {
      console.error(err);
      alert('Failed to start interview. Please ensure backend is running on port 5000.');
      startBtn.disabled = false;
      startBtn.textContent = '🚀 Start Interview';
    }
  });
}

