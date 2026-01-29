// Report generation script
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Loading interview report...');
    
    // Get session ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id') || localStorage.getItem('session_id');
    
    if (!sessionId) {
        showError('No session ID found. Please start a new interview.');
        return;
    }
    
    try {
        // Fetch report data
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Display report
        displayReport(result);
        
    } catch (error) {
        console.error('Error loading report:', error);
        showError(`Failed to load report: ${error.message}`);
    }
});

function displayReport(data) {
    const container = document.getElementById('report-container');
    const loading = document.getElementById('loading-block');
    
    // Build report HTML
    const reportHTML = `
        <div class="report-section">
            <h2>📋 Interview Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <label>Job Description:</label>
                    <span>${data.job_description || 'N/A'}</span>
                </div>
                <div class="summary-item">
                    <label>Experience:</label>
                    <span>${data.experience || 'N/A'}</span>
                </div>
                <div class="summary-item">
                    <label>Questions Asked:</label>
                    <span>${data.question_count || 'N/A'}</span>
                </div>
                <div class="summary-item">
                    <label>Cheat Strikes:</label>
                    <span class="${data.strikes > 0 ? 'text-danger' : 'text-success'}">${data.strikes || 0}</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h2>📝 Interview Transcript</h2>
            <div class="transcript">
                ${data.transcript ? formatTranscript(data.transcript) : '<p>No transcript available</p>'}
            </div>
        </div>
        
        <div class="report-section">
            <h2>📊 Performance Analysis</h2>
            <div class="analysis">
                ${data.analysis || '<p>No analysis available</p>'}
            </div>
        </div>
        
        <div class="report-section">
            <h2>🎯 Recommendations</h2>
            <div class="recommendations">
                ${data.recommendations || '<p>No recommendations available</p>'}
            </div>
        </div>
    `;
    
    container.innerHTML = reportHTML;
    loading.style.display = 'none';
    container.style.display = 'block';
    
    // Setup PDF download
    setupPDFDownload();
}

function formatTranscript(transcript) {
    if (!transcript) return '<p>No transcript available</p>';
    
    // Try to parse transcript if it's a string
    let transcriptData;
    try {
        transcriptData = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
    } catch {
        // If parsing fails, treat as plain text
        return `<p>${transcript}</p>`;
    }
    
    if (Array.isArray(transcriptData)) {
        return transcriptData.map(item => `
            <div class="transcript-item">
                <div class="question">
                    <strong>Q${item.question_number || '?'}:</strong> ${item.question || 'N/A'}
                </div>
                <div class="answer">
                    <strong>A:</strong> ${item.answer || 'N/A'}
                </div>
                ${item.feedback ? `<div class="feedback"><em>Feedback: ${item.feedback}</em></div>` : ''}
            </div>
        `).join('');
    }
    
    return `<p>${transcript}</p>`;
}

function setupPDFDownload() {
    const downloadBtn = document.getElementById('download-pdf');
    
    downloadBtn.addEventListener('click', async () => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(20);
            doc.text('Interview Report', 20, 20);
            
            // Add date
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
            
            // Add content
            const content = document.getElementById('report-container').innerText;
            const lines = doc.splitTextToSize(content, 170);
            
            let y = 40;
            lines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 7;
            });
            
            // Save PDF
            doc.save('interview-report.pdf');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    });
    
    // Back to home button
    document.getElementById('back-home').addEventListener('click', () => {
        window.location.href = '/';
    });
}

function showError(message) {
    const loading = document.getElementById('loading-block');
    loading.innerHTML = `
        <div style="color: #dc2626; text-align: center; padding: 2rem;">
            <h3>❌ Error</h3>
            <p>${message}</p>
            <button onclick="window.location.href='/'" class="btn btn-primary">
                🏠 Back to Home
            </button>
        </div>
    `;
}
